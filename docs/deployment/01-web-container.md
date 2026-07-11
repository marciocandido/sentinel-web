# Container de produção do Sentinel Web

O container de produção do Sentinel Web constrói o React/Vite em uma imagem
Node e entrega somente `dist/` por Nginx. A imagem final não contém Node, npm,
`node_modules`, fontes TypeScript/TSX, testes ou arquivos `.env`.

## Build

```bash
docker build -t sentinel-web:test .
```

O build usa `node:22.22.0-alpine3.22`, compatível com o Vite atual, fixada pelo
digest `sha256:7aa86fa052f6e4b101557ccb56717cb4311be1334381f526fe013418fe157384`.
Ele executa `npm ci` com o lockfile e força `VITE_SENTINEL_API_URL` vazio.
Portanto, o bundle usa URLs relativas como `/health/live` e
`/api/v1/catalog/segments`.

O runtime usa `nginxinc/nginx-unprivileged:1.28.0-alpine`, também fixada pelo
digest `sha256:c97ff0bf7cbae369953c6da1232ec14ad9f971d66360c5698db0856a4cd657a0`.
Ele escuta em `8080` como o usuário `nginx` (UID 101). Não há `latest` em
nenhuma imagem.

## Executar

Sem API, a interface e o health local continuam disponíveis; as rotas proxy
retornarão erro de upstream quando acessadas:

```bash
docker run --rm -p 8080:8080 sentinel-web:test
```

Para configurar a API interna, informe o upstream somente no runtime:

```bash
docker run --rm -p 8080:8080 \
  -e SENTINEL_API_UPSTREAM=http://api:8000 \
  sentinel-web:test
```

O padrão é `http://api:8000`. Um valor vazio ou que não comece com `http://` ou
`https://` encerra o container com mensagem clara e código 64. A variável não
é uma URL pública e não é incorporada ao bundle.

## Rotas e same-origin

| Caminho | Comportamento |
| --- | --- |
| `/healthz` | Resposta local `200 ok`; não consulta API ou banco. |
| `/api/*` | Proxy para `${SENTINEL_API_UPSTREAM}/api/*`. |
| `/health/*` | Proxy para `${SENTINEL_API_UPSTREAM}/health/*`. |
| `/` e rotas SPA | Servem `index.html`; por exemplo, `/discovery`. |

A imagem também possui `HEALTHCHECK` Docker local para `/healthz`; portanto,
indisponibilidade temporária da API não torna o container web não saudável.

Path, query string, método, corpo e status são preservados pelo proxy. Os
cabeçalhos `Host`, `X-Real-IP`, `X-Forwarded-For` e `X-Forwarded-Proto` são
definidos explicitamente. Os timeouts de conexão, envio e leitura são 5s, 30s
e 30s, respectivamente. Um `503` do upstream continua sendo `503`; ele nunca
é substituído pelo fallback da SPA.

## Cache e segurança

Os arquivos versionados em `/assets/*` recebem `Cache-Control: public,
max-age=31536000, immutable`. `index.html` usa `Cache-Control: no-cache` para
permitir uma atualização após novo deploy. O Nginx não lista diretórios,
oculta a versão, bloqueia dotfiles e extensões de configuração/source map, e
escreve logs em stdout/stderr.

Não inclua segredos no build. `.dockerignore` remove `.env`, `.env.local`,
Git, caches, resultados de testes e artefatos de smoke do contexto Docker.

## Filesystem read-only

O template de upstream é renderizado em `/tmp`; os temporários do Nginx também
ficam ali. Isso permite futura execução no Compose com root filesystem somente
leitura e `tmpfs` em `/tmp`:

```bash
docker run --rm --read-only --tmpfs /tmp -p 8080:8080 \
  -e SENTINEL_API_UPSTREAM=http://api:8000 \
  sentinel-web:test
```

## Smoke reproduzível

O script usa um upstream Python descartável em uma rede Docker dedicada, sem
depender da API Sentinel real:

```bash
docker build -t sentinel-web:test .
./scripts/smoke-container.sh
```

Ele valida health local, fallback da SPA, cache, encaminhamento de API e
health, preservação de query string, `503`, usuário não-root, ausência de
Node/npm, bundle same-origin, configuração inválida e execução read-only.

## Troubleshooting

- **Container encerra imediatamente:** confira a mensagem de
  `SENTINEL_API_UPSTREAM`; ele precisa iniciar com `http://` ou `https://`.
- **Erro `5xx` em `/api` ou `/health`:** confirme a conectividade e o nome do
  serviço do upstream na rede Docker. O erro de proxy não é convertido em HTML.
- **O navegador usa uma versão antiga:** verifique caches intermediários;
  `index.html` já é servido com `no-cache`, enquanto assets hashados são
  imutáveis por design.

A composição com API e PostgreSQL será definida posteriormente na issue
`marciocandido/sentinel#113`; este repositório não cria Docker Compose.
