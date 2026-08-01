# AGENTS — Sentinel Web

## 1. Papel do repositório

`sentinel-web` é o frontend React, TypeScript e Vite do Sentinel, com CSS comum,
Vitest, React Testing Library, Leaflet como mapa complementar e imagem Nginx
não-root. ETL, domínio, PostgreSQL/PostGIS e API pertencem a
`marciocandido/sentinel`; este repositório consome contratos públicos e não é
autoridade de regras comerciais.

Não é CRM, BI genérico, motor de busca independente, fonte de status comercial,
motor de ranking/associação, sistema de geocodificação ou aplicação autônoma
sem backend. Este arquivo é autossuficiente para Codex, Claude Code e outros
agentes e não pressupõe outro `AGENTS.md` ou histórico de conversa.

## 2. Leia antes de agir

1. Leia este arquivo, o `README.md`, a issue e a PR relacionadas, inclusive
   comentários, dependências e critérios de aceite.
2. Confira primeiro o contrato público do backend aplicável.
3. Inspecione componentes, serviços, tipos e testes diretamente afetados.
4. Leia documentos contextuais mínimos e amplie somente quando a evidência
   exigir.

| Contexto | Fontes mínimas |
| --- | --- |
| Discovery | `README.md`, issue/PR, contrato HTTP do backend e vertical afetada |
| HTTP/cancelamento | `src/services/`, `src/types/api.ts` e testes |
| paginação/drawer/mapa | componentes, tipos, utilitários e testes em `src/features/discovery/` |
| acessibilidade/layout | componente, teste e `src/styles/global.css` |
| imagem/proxy/runtime | `Dockerfile`, `docs/deployment/01-web-container.md` e Docker afetado |

Não releia toda a documentação por padrão.

## 3. Hierarquia de verdade

1. instrução explícita do operador, dentro de escopo e segurança;
2. invariantes e alterações protegidas deste arquivo;
3. código, testes e contratos TypeScript vigentes;
4. contratos públicos e documentação estabilizada do backend;
5. documentos canônicos do frontend;
6. issue e PR relacionadas, incluindo comentários;
7. roadmap e épicos;
8. documentos históricos e conversas.

Código representa comportamento atual. O backend é autoridade de Discovery e
HTTP. Não resolva divergência material silenciosamente, nem “corrija” contrato
backend por inferência. Uma issue não autoriza duplicar regra de negócio no
navegador ou ampliar escopo.

## 4. Invariantes do frontend

- Não replicar busca, ranking, normalização, associação, score ou interpretação
  comercial.
- CNPJ completo/raiz, CNAE, TOM, IBGE, porte, capital e códigos definidos pelo
  contrato permanecem strings; aceitar CNPJ alfanumérico e preservar zeros.
- Não usar `Number`, `parseInt` ou `parseFloat` em identificadores.
- Preservar ordem da API; não usar `sort()` sem contrato e não inventar total.
- Não calcular matriz/filial, grupo ou similaridade. `confidence` é metadado
  textual, não percentual, probabilidade ou decisão.
- Não inventar cliente, prospect, atendido ou filial não atendida; status sem
  fonte permanece explicitamente provisório.
- HTTP 200 malformado gera `invalid_response`, nunca lista vazia. Mensagem
  arbitrária do backend não aparece na UI.
- Features não usam `fetch` direto: requests passam por cliente e serviços.
- Formulário editável é separado do snapshot submetido; paginação e retry usam
  esse snapshot. Cancelar request aplicável em nova busca/paginação/retry/troca
  de modo/desmontagem; ignorar resposta obsoleta; não publicar cancelamento.
- Mapa complementa tabela; falha de tiles não remove resultado e atribuição é
  visível. Acessibilidade é contrato funcional e nada essencial depende só de
  cor.
- Sem Google Maps, geocodificação, IA, fuzzy, score, router, estado global,
  cache ou framework visual sem issue explícita.

## 5. Fronteiras arquiteturais

### `src/services/`

Cliente HTTP, timeout, cancelamento, erros tipados, endpoints e query strings;
sem estado de apresentação.

### `src/types/api.ts`

Contratos públicos, unions discriminadas, guards e validação estrutural; sem
JSX, regra visual ou comercial.

### `src/features/discovery/`

Formulários, snapshots, orquestração, resultados, tabela, mapa e drawer.
Reutilize padrões atuais e não duplique backend.

### `src/components/`, `src/styles/` e `src/test/`

Componentes compartilhados não recebem regra específica por conveniência. CSS
cuida de layout, densidade, foco e overflow sem esconder semântica. Testes usam
fixtures sintéticas, setup e utilitários, sem dados comerciais reais.

## 6. Alterações protegidas

Exigem autorização explícita: alterar API sem backend estabilizado; criar regra
comercial/ranking/score; trocar cliente HTTP ou cancelamento; router, estado
global, cache, framework visual ou biblioteca de formulários; refactor amplo,
abstração especulativa ou redesign geral; drawer/foco/acessibilidade estrutural;
Leaflet/provider/tiles; telemetria, analytics, autenticação ou permissões;
dependências; Docker/Nginx/proxy/logs/headers; backend; publicação de imagem ou
deploy.

## 7. Escopo de issue

> Uma issue, uma branch, um PR e um merge.

Correções continuam na mesma branch/PR. Não crie segunda branch para PR ativa,
não incorpore achado adjacente, não crie issue automaticamente, não misture
dependências/redesign/refactor/estética e não prepare fases futuras. Registre
pendências na PR.

## 8. Git e branch

Antes de editar:

```sh
git status --short
git branch --show-current
git fetch --prune
git log --oneline --decorate -5
```

Confirme repo/remote, branch, árvore limpa, commits locais, relação
`main`/`origin/main`, merge/rebase e branch/PR da issue. Bloqueie estado não
explicado. Nunca execute automaticamente `git reset --hard`, `git clean`,
`git stash`, `git rebase` ou `git push --force`.

Atualize `main` só por fast-forward e não a altere diretamente. Prefira:

```text
feat/<numero>-<slug>
fix/<numero>-<slug>
docs/<numero>-<slug>
chore/<numero>-<slug>
```

Mantenha uma branch de trabalho ativa por padrão. Worktree somente com
paralelismo real autorizado.

## 9. Método operacional

Identifique repo/branch/issue; leia fontes mínimas; confira contrato backend;
inspecione código e testes afetados; separe diagnóstico de implementação; faça
o menor diff; teste proporcionalmente; valide progressivamente; atualize docs
quando houver mudança real autorizada; revise o diff e relate evidências,
limitações e pendências.

Não faça varredura global sem evidência, abstração para futuro, correção
automática adjacente, estética não solicitada, dependência desnecessária ou
validação repetida sem mudança. Modelo mais forte não amplia escopo.

## 10. Validação progressiva

Para documentação:

```sh
git diff --check
git status --short
```

Não execute `npm ci`, build ou suíte completa para alteração documental.

Para alteração localizada, execute teste relacionado e, conforme necessário:

```sh
npm run lint
npm run test -- --run <teste relacionado>
```

Antes de PR com código:

```sh
npm ci
npm run lint
npm run test -- --run
npm run build
git diff --check
git status --short
```

Execute `npm run dev -- --host 0.0.0.0` apenas quando interface/runtime mudar.
Distinga Vite, mocks e integração real API/PostgreSQL/PostGIS.

## 11. Contratos HTTP e integração real

Preserve URLs same-origin ou `VITE_SENTINEL_API_URL`, timeout, cancelamento,
erros públicos, guards estritos e `X-Request-ID`. Use `URLSearchParams` e
somente parâmetros previstos. Nunca exponha SQL, stack, DSN, hostname,
credencial ou mensagem privada. Mock não prova integração real.

## 12. Acessibilidade e interface

Exija labels, `aria-invalid`/`aria-describedby`, `aria-busy`, regiões vivas
ou `role=status`, alertas apropriados, tabelas com `caption`, foco visível,
teclado e Escape. Drawer preserva contenção/retorno de foco e usa `inert` para
o exterior quando aberto. Mapa não substitui texto e overflow horizontal fica
no container correto.

## 13. Docker/Nginx e runtime

Preserve multi-stage, Vite separado do runtime, Nginx não-root, bundle
same-origin, upstream em runtime, logs sanitizados, `X-Request-ID`, ausência de
Node/npm e filesystem read-only quando previsto. Execute Docker somente quando
Dockerfile, Nginx, proxy, headers, imagem, request ID ou runtime forem afetados;
não é gate universal.

## 14. Documentação

README é índice. Contratos públicos e deployment definem comportamento durável.
Não duplique implementação. Atualize documento canônico na mesma issue quando
contrato/comportamento autorizado mudar; pendência adjacente vai para a PR.

## 15. Configuração proporcional de modelos

Todo prompt técnico para Codex informa modelo, raciocínio e justificativa
específica, inclusive para o padrão:

```text
Modelo: GPT-5.6 Terra
Raciocínio: Medium
```

- Luna Low: texto, CSS, teste ou correção pontual mecânica.
- Luna Medium: tarefa repetitiva e localizada de baixo risco.
- Terra Medium: padrão para issue bem fechada e padrões existentes.
- Terra High: debugging não trivial, concorrência, foco/acessibilidade complexos
  ou integração entre áreas conhecidas.
- Sol Medium/High: arquitetura nova, segurança, mudança estrutural, incidente
  difícil, revisão adversarial ou insuficiência demonstrada do Terra.
- Extra, xHigh ou Max: somente caso excepcional, explicitamente justificado e
  nunca por padrão.

Não escolha Sol por prompt longo/quantidade de arquivos. Maior capacidade não
autoriza ampliar escopo.

## 16. Publicação e controle humano

Quando autorizado, o agente pode criar branch, implementar, testar, revisar,
commit, push e abrir/atualizar PR draft. Exigem autorização posterior: ready,
merge, fechamento manual de issue, release, imagem, deploy ou alteração
destrutiva. Nunca faça merge automático.

## 17. Relatório final obrigatório

Informe repo, branch, issue/objetivo, arquivos e decisões, validações feitas e
omitidas, escopo não alterado, riscos/pendências, estado para revisão humana e
próxima ação Git. Pare ao cumprir requisito, diante de conflito material,
bloqueio, nova autorização necessária ou expansão de escopo.
