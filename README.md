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

## Endpoints consumidos nesta etapa

- `GET /health/live` — indicador de processo HTTP vivo;
- `GET /api/v1/catalog/segments` — seletor de segmentos.

## Escopo atual

A primeira tela entrega o shell desktop-first do Sentinel: sidebar, cabeçalho
com liveness, card “Buscar empresas”, catálogo de segmentos e estados de
carregamento/erro. O botão **Buscar** permanece desabilitado de propósito.

Ficam para as próximas etapas: filtros regionais, buscas por segmento ou
região, tabela de empresas, detalhes, listas, mapa, autenticação, exportação e
qualquer estado global ou cache avançado.
