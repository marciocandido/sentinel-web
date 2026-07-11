# Sentinel Web

Frontend do **Sentinel**, a ferramenta de Discovery Comercial baseada na base
pública de CNPJ. Este repositório é separado de
[`marciocandido/sentinel`](https://github.com/marciocandido/sentinel), que
mantém ETL, regras de domínio, PostgreSQL/PostGIS e a API FastAPI.

O frontend não replica regras de busca, score ou interpretação de status
comercial: ele consome os contratos públicos do backend.

## Stack

- React + TypeScript;
- Vite;
- CSS comum, sem framework visual;
- ESLint;
- Vitest, React Testing Library, jest-dom e jsdom.

## Pré-requisitos

- Node.js 20.19+ (ou 22.12+) e npm;
- API Sentinel opcional para integração local.

## Instalação e configuração

```bash
cp .env.example .env.local
npm ci
```

`.env.local` é a configuração usual quando frontend e backend rodam em portas
separadas:

```env
VITE_SENTINEL_API_URL=http://127.0.0.1:8000
```

Se `VITE_SENTINEL_API_URL` estiver ausente ou vazia, o frontend usa URLs
relativas/same-origin, como `/health/live`. Isso permite publicar API e UI na
mesma origem por reverse proxy. Nenhuma URL de produção fica embutida no
código. Espaços e barras finais extras da variável são removidos.

## Executar

```bash
npm run dev
```

Com o backend rodando separadamente, habilite CORS nele antes de abrir o Vite:

```bash
export SENTINEL_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
uvicorn sentinel_api.main:app --host 127.0.0.1 --port 8000
```

O catálogo real exige que o backend tenha acesso ao PostgreSQL/PostGIS. Sem
banco, a liveness ainda pode ficar online e o catálogo pode retornar 503 com
`database_unavailable`; essa é uma condição tratada pela interface, não uma
indicação de que o catálogo esteja configurado.

## Qualidade

```bash
npm run test -- --run
npm run lint
npm run build
```

## Discovery

A tela principal possui dois modos explícitos:

- **Por segmento** — exige segmento e aceita UF, código TOM, porte, capital
  mínimo e capital máximo como filtros opcionais;
- **Por região** — exige ao menos UF, código TOM, código IBGE ou nome do
  município. O segmento pode ser usado como filtro adicional, mas não valida
  sozinho uma busca regional.

O formulário valida apenas condições obviamente inválidas, como ausência do
filtro obrigatório, decimal malformado e capital mínimo maior que o máximo. O
backend continua sendo a autoridade sobre normalização e regras de domínio.

Os resultados são exibidos na ordem retornada pela API, em uma tabela com
scroll horizontal em telas estreitas. CNPJ, CNAE, TOM, IBGE, porte e capital
permanecem texto. Valores ausentes aparecem como `—`, e o status comercial
`UNKNOWN`/`none` é apresentado explicitamente como desconhecido e provisório.

### Paginação

A busca começa com 50 registros por página e permite selecionar 25, 50 ou
100. A navegação usa somente `limit`, `offset`, `returned` e `has_more` do
backend. Não é executado `COUNT` e a interface não mostra um total geral
inventado.

Filtros editados após uma pesquisa não alteram silenciosamente a paginação ou
o retry: ambos repetem o snapshot dos critérios efetivamente submetidos. Uma
nova busca sempre começa em `offset=0`.

### Detalhes do resultado

Cada linha da tabela possui a ação **Ver detalhes**, que abre um painel lateral
com os dados do `DiscoveryEstablishment` já retornado pela busca. Abrir, copiar
ou fechar o painel não realiza nova chamada à API.

O painel exibe:

- razão social, nome fantasia, CNPJ completo e raiz;
- município, UF, códigos TOM e IBGE, precisão e disponibilidade geográfica;
- CNAE principal, porte, capital social e correspondência da busca;
- status comercial explicitamente desconhecido e sem fonte integrada.

A ação **Copiar CNPJ** envia ao clipboard exatamente o `cnpj_full` recebido,
preservando zeros à esquerda e caracteres alfanuméricos, sem máscara ou
conversão numérica.

Este painel representa somente os detalhes disponíveis no resultado atual. Ele
não é uma ficha completa da empresa e não consulta endpoint de detalhe.

## Endpoints consumidos

- `GET /health/live` — indicador de processo HTTP vivo;
- `GET /api/v1/catalog/segments` — seletor de segmentos.
- `GET /api/v1/discovery/segments/{segment_id}/establishments` — busca por
  segmento;
- `GET /api/v1/discovery/regions/establishments` — busca por região.

## Escopo atual

A tela entrega o shell desktop-first do Sentinel, busca funcional por segmento
ou região, estados de validação/carregamento/erro, retry manual e tabela
paginada. Requisições anteriores são canceladas ao iniciar uma nova busca,
trocar o modo ou desmontar a tela; respostas obsoletas são ignoradas.

Ficam para as próximas etapas: ficha completa, endereço, contatos, CNAEs
secundários detalhados, QSA, mapa, raio, empresas semelhantes, raiz/filiais,
grupos comerciais, feedback, exportação, listas salvas, autenticação,
ordenação client-side, busca fuzzy e filtros persistidos na URL.
