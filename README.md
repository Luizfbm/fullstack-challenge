# Chrono Crash - Full-stack Crash Game

Este e o README final de entrega do desafio. O enunciado original foi
preservado em [`DESAFIO_ORIGINAL.md`](DESAFIO_ORIGINAL.md) para que o
avaliador consiga comparar requisito por requisito.

Chrono Crash e um Crash Game full-stack com dois bounded contexts, comunicacao
financeira via RabbitMQ, Keycloak como IdP, Kong como API Gateway, frontend
React/Vite responsivo e uma suite de qualidade automatizada cobrindo dominio,
API, Docker, browser e UI.

## Stack

| Camada | Implementacao |
| --- | --- |
| Runtime | Bun |
| Backend | NestJS + TypeScript strict |
| Bancos | PostgreSQL com bancos separados `games` e `wallets` |
| ORM | Prisma |
| Mensageria | RabbitMQ |
| API Gateway | Kong DB-less |
| IdP | Keycloak realm `crash-game` |
| Realtime | Socket.IO via `@nestjs/websockets` |
| Frontend | Vite + React + Tailwind CSS v4 |
| Estado | TanStack Query + Zustand |
| Testes | Bun test, Vitest e Playwright |
| Docs API | Swagger/OpenAPI |
| Observabilidade | Prometheus, Grafana, Jaeger e OpenTelemetry |

## Como rodar

Pre-requisitos:

- Bun 1.x
- Docker e Docker Compose

Instalacao:

```bash
bun install
```

Subir a stack completa:

```bash
bun run docker:up
```

O script acima executa `docker compose up --build` e fica em primeiro plano.
Para uso local em segundo plano, o equivalente e:

```bash
docker compose up -d --build
```

Parar a stack:

```bash
bun run docker:down
```

Reset completo de containers, volumes e imagens locais do projeto:

```bash
bun run docker:prune
```

Use `docker:prune` somente quando quiser apagar o estado local de banco e
fila.

## URLs e credenciais

| Recurso | URL | Credenciais |
| --- | --- | --- |
| Aplicacao via Kong | `http://localhost:8000/` | login pelo botao `Entrar` |
| Game Service via Kong | `http://localhost:8000/games/*` | conforme rota |
| Wallet Service via Kong | `http://localhost:8000/wallets/*` | conforme rota |
| Game Swagger direto | `http://localhost:4001/docs` | publico |
| Wallet Swagger direto | `http://localhost:4002/docs` | publico |
| Keycloak admin | `http://localhost:8080/admin/master/console/` | `admin` / `admin` |
| RabbitMQ Management | `http://localhost:15672` | `admin` / `admin` |
| Prometheus | `http://localhost:9090` | publico local |
| Grafana | `http://localhost:3001` | `admin` / `admin` |
| Jaeger | `http://localhost:16686` | publico local |

Usuario de teste:

| Campo | Valor |
| --- | --- |
| Realm | `crash-game` |
| Client ID | `crash-game-client` |
| Usuario | `player` |
| Senha | `player123` |
| Wallet inicial | `100000` centavos, equivalente a R$ 1.000,00 |

## Guia rapido para avaliadores

Ao abrir `http://localhost:8000/`, a aplicacao exibe uma chamada discreta para
avaliadores. O botao `Ver guia` abre a barra lateral de auditoria no painel de
entrega.

Essa barra agrupa os atalhos mais uteis para revisar o desafio:

- entrega, README e repositorio no GitHub;
- usuario de teste e credenciais dos dashboards locais;
- Swagger, metricas, Grafana, Prometheus, Jaeger, RabbitMQ, Kong e Keycloak;
- evidencias dos fluxos E2E, provably fair e consistencia financeira.

Depois de fechada ou usada, a chamada nao volta a aparecer no mesmo navegador.

## Arquitetura

```text
Frontend React/Vite
  | HTTP REST + WebSocket
Kong API Gateway
  | REST                         | REST
Game Service (NestJS)            Wallet Service (NestJS)
  | PostgreSQL games             | PostgreSQL wallets
  |                              |
  +------ RabbitMQ wallet.commands ------+

Keycloak emite JWTs; Game e Wallet validam Bearer tokens via JWKS.
```

O Game Service e dono de rodada, aposta, cashout, leaderboard, auto bet,
auto cashout, provably fair e eventos realtime. O Wallet Service e dono do
saldo, ledger financeiro, debitos, creditos e idempotencia financeira.

O Game nunca altera saldo diretamente. Operacoes financeiras passam pelo
RabbitMQ com comandos `wallet.debit` e `wallet.credit`. O fluxo usa outbox no
Game e inbox no Wallet para manter idempotencia e tolerar reentregas.

## Dinheiro e multiplicadores

Dinheiro nunca usa ponto flutuante.

- Valores monetarios sao armazenados como `BigInt`/`BIGINT` em centavos.
- A API serializa dinheiro como string para evitar perda de precisao em JSON.
- `100` representa R$ 1,00.
- Aposta minima: `100` centavos.
- Aposta maxima: `100000` centavos.

Multiplicadores usam basis points:

- `10000` representa `1.00x`.
- `25000` representa `2.50x`.
- Payout: `floor(amountCents * multiplierBp / 10000)`.

## Provably fair

Cada rodada tem commitment antes da revelacao:

- `serverSeedHash` fica publico antes e durante a rodada.
- `serverSeed` e `crashPointBp` so sao revelados depois do crash.
- O crash point e calculado com hash chain + HMAC SHA-256, `clientSeed`,
  `nonce` e house edge.
- `GET /games/rounds/:roundId/verify` recalcula o resultado e retorna se a
  rodada e verificavel.

Arquivos principais:

- `services/games/src/domain/provably-fair.ts`
- `services/games/src/application/use-cases/verify-round.use-case.ts`
- `services/games/tests/unit/domain/game-domain.test.ts`
- `services/games/tests/e2e/cashout-flow.e2e.test.ts`
- `services/games/tests/e2e/crash-loss-flow.e2e.test.ts`

## API

Todas as rotas principais sao acessadas via Kong em `http://localhost:8000`.

### Wallet

| Metodo | Rota | Auth | Descricao |
| --- | --- | --- | --- |
| `POST` | `/wallets` | sim | Cria a wallet do jogador autenticado |
| `GET` | `/wallets/me` | sim | Retorna saldo do jogador autenticado |
| `GET` | `/wallets/health` | nao | Healthcheck |
| `GET` | `/wallets/metrics` | nao | Metricas Prometheus |

Debito e credito nao sao expostos por REST. Eles acontecem via RabbitMQ.

### Game

| Metodo | Rota | Auth | Descricao |
| --- | --- | --- | --- |
| `GET` | `/games/rounds/current` | nao | Rodada atual |
| `GET` | `/games/rounds/history` | nao | Historico de rodadas |
| `GET` | `/games/rounds/:roundId/verify` | nao | Verificacao provably fair |
| `GET` | `/games/bets/me` | sim | Historico de apostas do jogador |
| `POST` | `/games/bet` | sim | Faz uma aposta |
| `POST` | `/games/bet/cashout` | sim | Executa cashout |
| `GET` | `/games/leaderboard` | nao | Ranking por lucro liquido |
| `POST` | `/games/auto-bet/sessions` | sim | Inicia auto bet |
| `GET` | `/games/auto-bet/sessions/me` | sim | Consulta auto bet do jogador |
| `POST` | `/games/auto-bet/sessions/me/stop` | sim | Para auto bet ativo |
| `GET` | `/games/health` | nao | Healthcheck |
| `GET` | `/games/metrics` | nao | Metricas Prometheus |

### WebSocket

O WebSocket e usado apenas para server-to-client. Apostas e cashouts continuam
por REST.

| Campo | Valor |
| --- | --- |
| Namespace | `/games` |
| Path via Kong | `/games/socket.io` |

Eventos emitidos:

- `round.snapshot`
- `round.betting_started`
- `round.started`
- `round.tick`
- `round.crashed`
- `round.settled`
- `bet.placed`
- `bet.cashed_out`

O E2E `services/games/tests/e2e/realtime-websocket.e2e.test.ts` valida duas
conexoes simultaneas recebendo os mesmos eventos e confirma que comandos de
aposta enviados pelo socket nao produzem apostas.

## Frontend

O frontend entrega a experiencia principal do jogo, sem landing page:

- Login Keycloak com authorization code flow + PKCE.
- Palco 3D com carro, portal, curva do multiplicador e estados de rodada.
- Controles de aposta, cashout, auto cashout e auto bet Martingale.
- Historico de rodadas, leaderboard, mesa de apostas e aba provably fair.
- Saldo e username no header.
- Dark mode com estetica premium arcade casino em felt green + gold.
- Responsividade validada por Playwright em mobile, tablet, laptop e desktop.
- Loading/error states e feedbacks de erro via UI.

Arquivos principais:

- `frontend/src/components/game/game-dashboard-shell.tsx`
- `frontend/src/components/game/chrono-stage.tsx`
- `frontend/src/components/game/crash-flight-scene.tsx`
- `frontend/src/hooks/use-game-rest.ts`
- `frontend/src/hooks/use-game-realtime.ts`
- `frontend/src/stores/game-realtime-store.ts`

## Requisitos eliminatorios do desafio

| Requisito | Status | Evidencia |
| --- | --- | --- |
| `bun run docker:up` sobe tudo sem passo manual | Cumprido | `package.json`, `docker-compose.yml`, Dockerfiles com `prisma migrate deploy`, `bun run ci:e2e` |
| Gameplay apostar -> multiplicador -> cashout/crash -> liquidacao | Cumprido | `cashout-flow.e2e.test.ts`, `crash-loss-flow.e2e.test.ts`, `player-flow.spec.ts` |
| Dois servicos separados comunicando via RabbitMQ/SQS | Cumprido | `services/games`, `services/wallets`, `rabbitmq-wallet.client.ts`, `wallet-command-handler.ts` |
| Sincronizacao em tempo real multiaba | Cumprido | `realtime-websocket.e2e.test.ts` |
| Precisao monetaria sem ponto flutuante | Cumprido | schemas Prisma com `BigInt`, `Money` domain object, testes de wallet e payout |
| Autenticacao via IdP e backend validando JWT | Cumprido | Keycloak realm importado, `KeycloakJwtGuard` nos dois servicos, E2E com token real |
| Testes unitarios + E2E | Cumprido | `bun run ci:local`, `bun run ci:e2e`, `bun run test:e2e:browser` |

## Bonus implementados

- Outbox no Game e inbox no Wallet para comandos financeiros idempotentes.
- Auto cashout por aposta.
- Auto bet com estrategia fixed e Martingale, stop-loss e take-profit.
- Observabilidade com Prometheus, Grafana, Jaeger e OpenTelemetry.
- Seed deterministica para E2E em `scripts/e2e/prepare-deterministic-state.ts`.
- Leaderboard por lucro liquido.
- CI/quality gate com baseline ratchet.
- Playwright E2E de jogador e responsividade.
- Rate limiting via Kong em rotas de aposta/cashout/wallet.
- Formula da curva do multiplicador exibida na UI.

Bonus nao implementados:

- Storybook.
- Efeitos sonoros.

## Testes e quality gates

Comandos principais:

```bash
bun run ci:local
bun run ci:e2e
bun run test:e2e:browser
```

`bun run ci:local` executa:

- `bun install --frozen-lockfile`
- lint
- typecheck dos servicos, frontend e scripts de qualidade
- unitarios do Game
- unitarios do Wallet
- testes do frontend
- testes dos scripts de qualidade
- coverage
- quality gate por baseline
- `docker compose config`

`bun run ci:e2e` executa:

- `docker compose up -d --build`
- healthcheck de Kong
- healthcheck de Keycloak admin
- E2E de API em `services/games/tests/e2e`

`bun run test:e2e:browser` executa Playwright contra
`http://localhost:8000`, usando a stack Docker ativa.

Comandos focados:

```bash
cd services/games && bun test tests/unit
cd services/wallets && bun test tests/unit
cd services/games && bun test tests/e2e
cd frontend && bun run test
cd frontend && bun run build
docker compose config
git diff --check
```

Ultima auditoria local executada em 2026-06-03:

- `bun run ci:local`: passou.
- `bun run ci:e2e`: passou com 17 testes E2E.
- `bun run test:e2e:browser`: passou com 7 testes.
- Quality gate: cobertura global `84.58%`, duplicacao `1.46%`, zero
  vulnerabilidades high/critical.

## Mapa para avaliador e IA

Comece por estes arquivos se quiser auditar rapido:

- Enunciado original: `DESAFIO_ORIGINAL.md`
- Plano de execucao: `docs/superpowers/specs/2026-05-31-crash-game-execution-plan.md`
- Issue log: `docs/superpowers/specs/2026-05-31-crash-game-implementation-issue-log.md`
- Compose: `docker-compose.yml`
- Kong: `docker/kong/kong.yml`
- Keycloak realm: `docker/keycloak/realm-export.json`
- Game schema: `services/games/prisma/schema.prisma`
- Wallet schema: `services/wallets/prisma/schema.prisma`
- Game controller: `services/games/src/presentation/controllers/games.controller.ts`
- Wallet controller: `services/wallets/src/presentation/controllers/wallets.controller.ts`
- Realtime gateway: `services/games/src/presentation/realtime/rounds.gateway.ts`
- Wallet messaging: `services/wallets/src/infrastructure/messaging/wallet-command-handler.ts`
- Browser E2E: `tests/browser/player-flow.spec.ts`
- Responsividade: `tests/browser/responsive-layout.spec.ts`
- Quality gate: `quality/baseline.json` e `scripts/quality`

## Trade-offs

- RabbitMQ request/reply foi usado para operacoes financeiras interativas,
  mantendo comunicacao por broker sem expor a Wallet por HTTP ao Game.
- O frontend Docker usa Vite dev server para a entrega local do desafio; isso
  prioriza reproducibilidade local sobre hardening de producao.
- As rotas `/metrics` ficam publicas para demonstracao local e nao expoem
  tokens, secrets, URLs de banco ou dados sensiveis.
- Playwright roda com `workers: 1` porque os testes usam a mesma stack Docker,
  o mesmo Keycloak e o mesmo usuario `player`.
- A autenticacao propria nao foi implementada; o projeto usa Keycloak, como
  permitido pelo desafio.
