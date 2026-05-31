# Crash Game Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** executar os proximos passos do Crash Game em etapas pequenas, testadas e commitadas, ate cumprir os requisitos eliminatorios do README.

**Architecture:** este plano executa o desenho definido em `docs/superpowers/specs/2026-05-29-crash-game-architecture-design.md`. O README e o requisito soberano; quando houver duvida, cumprir o README tem prioridade. O plano pode ser ajustado durante a execucao, mas nunca pode contrariar a arquitetura decidida: dois servicos NestJS, bancos separados, RabbitMQ, Keycloak, Kong, WebSocket no Game, frontend Vite, dinheiro em centavos e provably fair com hash chain + commit/reveal.

**Tech Stack:** Bun, NestJS, Prisma, PostgreSQL, RabbitMQ, Kong, Keycloak, Vite, React, Tailwind CSS v4, shadcn/ui, TanStack Query, Zustand, Bun test e Vitest.

---

## Regras de Execucao

- Cada passo deve ser pequeno, revisavel e gerar no maximo um commit atomico.
- Antes de iniciar qualquer passo, execute `git status --short --branch` e confirme que nao ha alteracoes inesperadas.
- Depois de concluir qualquer passo, execute integralmente o portao de testes obrigatorio deste documento.
- E proibido iniciar o proximo passo com qualquer teste, build, typecheck, healthcheck ou E2E falhando.
- Todo erro real de instalacao, build, teste, Docker, migration, runtime ou integracao deve ser registrado em `docs/superpowers/specs/2026-05-31-crash-game-implementation-issue-log.md`.
- Todo bug corrigido exige teste de regressao antes do commit.
- Toda alteracao que envolver banco, Prisma, RabbitMQ, JWT/auth, API ou fluxo entre servicos exige validacao via Docker/Kong/Keycloak.
- Toda alteracao que envolver frontend exige build, testes frontend e validacao visual/browser quando a tela existir.
- Commits devem ser objetivos e contar a historia da entrega.

## Portoes de Teste Obrigatorios

### Portao Base

Execute apos todos os passos, inclusive passos somente de documentacao:

```bash
git status --short --branch
bunx tsc --noEmit -p services/games/tsconfig.json
cd services/games && bun test tests/unit
cd ../..
bunx tsc --noEmit -p services/wallets/tsconfig.json
cd services/wallets && bun test tests/unit
cd ../..
docker compose config
git diff --check
```

Resultado esperado:

- typecheck sem erros;
- todos os testes unitarios passando;
- `docker compose config` com exit code `0`;
- `git diff --check` sem whitespace errors.

### Portao API/Integracao

Execute alem do Portao Base quando o passo tocar API, banco, Prisma, RabbitMQ, JWT/auth ou qualquer fluxo entre servicos:

```bash
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8000/games/health
curl -fsS http://localhost:8000/wallets/health
cd services/games && bun test tests/e2e
cd ../..
```

Resultado esperado:

- `frontend`, `games`, `wallets`, `postgres`, `rabbitmq`, `keycloak` e `kong` healthy;
- healthchecks via Kong retornando `{"status":"ok"}`;
- E2E de API passando.

### Portao E2E Docker/Kong/Keycloak

Execute quando o fluxo atravessar mais de um servico:

```bash
docker compose up -d --build
TOKEN=$(curl -fsS -X POST http://localhost:8080/realms/crash-game/protocol/openid-connect/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=password' \
  --data-urlencode 'client_id=crash-game-client' \
  --data-urlencode 'username=player' \
  --data-urlencode 'password=player123' \
  | bun -e 'const body = await new Response(Bun.stdin.stream()).json(); console.log(body.access_token);')
curl -fsS -H "Authorization: Bearer $TOKEN" http://localhost:8000/wallets/me
```

Resultado esperado:

- token real emitido pelo Keycloak;
- `/wallets/me` respondendo com `playerId` e `balanceCents`;
- fluxo especifico do passo validado por teste automatizado ou script documentado.

### Portao Frontend

Execute alem do Portao Base quando o passo tocar `frontend/`:

```bash
cd frontend && bun run build
cd ..
cd frontend && bun test
cd ..
docker compose up -d --build
curl -fsS http://localhost:8000/
```

Resultado esperado:

- build do frontend sem erro;
- testes frontend passando;
- frontend acessivel via Kong em `http://localhost:8000/`;
- quando houver UI real, validar visualmente em desktop e mobile.

## Passos de Execucao

### Passo 1: Automatizar E2E de API do fluxo cashout

- [ ] Criar `services/games/tests/e2e/cashout-flow.e2e.test.ts`.
- [ ] Testar o fluxo real via Kong: token Keycloak, wallet inicial, aposta aceita, rodada em `RUNNING`, cashout, saldo atualizado, bet `CASHED_OUT`, round `SETTLED`, verify `fair=true`.
- [ ] Aceleracao permitida no teste: alterar apenas tempo de rodada (`bettingEndsAt` ou `startedAt`) no banco de desenvolvimento. Nao alterar `crashPointBp`, porque isso invalida provably fair.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Commit sugerido: `test(games): cover cashout e2e flow`.

### Passo 2: Automatizar E2E de API do fluxo crash/perda

- [ ] Criar `services/games/tests/e2e/crash-loss-flow.e2e.test.ts`.
- [ ] Testar token Keycloak, aposta aceita, ausencia de cashout, crash da rodada, bet `LOST`, saldo debitado sem credito de payout, round `SETTLED`, verify `fair=true`.
- [ ] Aceleracao permitida: apenas manipular `bettingEndsAt` ou `startedAt`.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Commit sugerido: `test(games): cover crash loss e2e flow`.

### Passo 3: Automatizar E2E de erros obrigatorios

- [ ] Criar `services/games/tests/e2e/game-validation.e2e.test.ts`.
- [ ] Cobrir saldo insuficiente, aposta duplicada, aposta fora da fase `BETTING`, cashout sem aposta e cashout fora da fase `RUNNING`.
- [ ] Garantir que erros nao deixam saldo negativo nem bet inconsistente.
- [ ] Registrar no issue log qualquer comportamento divergente encontrado.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Commit sugerido: `test(games): cover validation e2e flows`.

### Passo 4: Implementar WebSocket basico no Game

- [ ] Adicionar dependencias Socket.IO/NestJS necessarias no Game Service.
- [ ] Criar gateway WebSocket no Game com namespace do jogo e endpoint roteavel pelo Kong.
- [ ] Conectar clientes em modo server-to-client; nenhuma acao do jogador deve ser feita via WebSocket.
- [ ] Expor evento inicial de snapshot da rodada atual ao conectar.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Commit sugerido: `feat(games): add realtime gateway`.

### Passo 5: Emitir eventos do lifecycle

- [ ] Emitir `round.betting_started` quando uma rodada abrir.
- [ ] Emitir `round.started` quando a fase de apostas terminar.
- [ ] Emitir `round.tick` enquanto a rodada estiver `RUNNING`.
- [ ] Emitir `round.crashed` com dados de crash e commitment/reveal.
- [ ] Emitir `round.settled` apos liquidacao.
- [ ] Garantir payload com `roundId`, `status`, `startedAt`, `bettingEndsAt`, `crashPointBp` quando revelado, `serverSeedHash`, `serverSeed` quando revelado, `chainIndex`, `nonce` e `bets`.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Commit sugerido: `feat(games): publish round lifecycle events`.

### Passo 6: Emitir eventos de bet/cashout

- [ ] Emitir `bet.placed` depois de aposta aceita.
- [ ] Emitir `bet.cashed_out` depois de credito confirmado na Wallet.
- [ ] Nao emitir evento financeiro antes da confirmacao do Wallet Service.
- [ ] Payload minimo: `betId`, `roundId`, `playerId`, `username`, `amountCents`, `status`, `cashoutMultiplierBp`, `payoutCents`.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Commit sugerido: `feat(games): publish bet realtime events`.

### Passo 7: Testar WebSocket

- [ ] Criar testes de WebSocket para conexao, snapshot inicial e recebimento de eventos.
- [ ] Validar pelo menos duas conexoes simultaneas recebendo o mesmo evento.
- [ ] Validar que REST continua sendo o unico caminho para apostar e sacar.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Executar teste E2E WebSocket com stack Docker ativa.
- [ ] Commit sugerido: `test(games): cover realtime websocket events`.

### Passo 8: Estruturar frontend real

- [ ] Substituir placeholder por estrutura de aplicacao Vite: `src/app`, `src/components`, `src/services`, `src/stores`, `src/hooks`.
- [ ] Configurar TanStack Query, Zustand e camada de API REST.
- [ ] Manter Tailwind CSS v4.
- [ ] Introduzir shadcn/ui apenas para componentes usados na tela do jogo.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend.
- [ ] Commit sugerido: `feat(frontend): structure crash game app`.

### Passo 9: Integrar login Keycloak no frontend

- [ ] Implementar authorization code flow com PKCE para o realm `crash-game`.
- [ ] Tratar callback e armazenar token apenas no estado/local storage necessario ao desafio.
- [ ] Exibir estado autenticado com username vindo do JWT.
- [ ] Proteger acoes autenticadas de aposta, cashout e consulta de wallet.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Commit sugerido: `feat(frontend): add keycloak login flow`.

### Passo 9.5: Implementar Quality Gate com baseline e catraca

- [ ] Criar GitHub Actions para Pull Requests e pushes com Bun, lint,
  typecheck, testes, coverage, quality gate e E2E Docker/Kong/Keycloak.
- [ ] Usar `bun install --frozen-lockfile`, nao `npm ci`.
- [ ] Usar `bun audit --audit-level=critical` como bloqueio de seguranca.
- [ ] Usar `bun audit --audit-level=high` como aviso nao bloqueante.
- [ ] Adicionar ESLint flat config para backend, frontend e scripts, ignorando
  codigo gerado por ferramentas como Prisma.
- [ ] Adicionar scripts raiz: `lint`, `check:types`, `test:unit`,
  `test:coverage`, `quality:baseline`, `quality:gate`, `ci:local` e `ci:e2e`.
- [ ] Implementar coletor de metricas para coverage, duplicacao com `jscpd`,
  tamanho de arquivos e auditoria de pacotes.
- [ ] Versionar `quality/baseline.json` como fotografia inicial.
- [ ] Garantir que o CI nunca atualiza o baseline automaticamente.
- [ ] Garantir que a catraca falha quando coverage cai, duplicacao sobe,
  maior arquivo aumenta, quantidade de arquivos acima do limite aumenta ou
  vulnerabilidade critica aparece.
- [ ] Garantir que vulnerabilidade alta gera aviso no Markdown, mas nao bloqueia.
- [ ] Gerar `quality/reports/quality-gate-summary.md` e artefatos de coverage
  para feedback do Pull Request.
- [ ] Comentar o sumario no Pull Request com `GITHUB_TOKEN`, mantendo artefatos
  mesmo se o comentario nao for permitido por politicas de fork.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend.
- [ ] Executar `bun run test:coverage`.
- [ ] Executar `bun run quality:gate`.
- [ ] Executar `bun run ci:local`.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Commit sugerido: `ci: add baseline quality gate`.

### Passo 10: Integrar REST no frontend

- [ ] Implementar clientes REST para `/games/rounds/current`, `/games/rounds/history`, `/games/rounds/:roundId/verify`, `/games/bets/me`, `/games/bet`, `/games/bet/cashout` e `/wallets/me`.
- [ ] Usar TanStack Query para server state.
- [ ] Tratar loading, erro de rede, 401 e validacoes de API.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Commit sugerido: `feat(frontend): integrate rest api`.

### Passo 11: Integrar WebSocket no frontend

- [ ] Conectar o frontend ao WebSocket via Kong.
- [ ] Persistir estado realtime em Zustand.
- [ ] Reconciliar snapshot REST inicial com eventos WebSocket.
- [ ] Suportar reconexao buscando snapshot atual.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend.
- [ ] Executar E2E/manual com duas abas recebendo o mesmo estado.
- [ ] Commit sugerido: `feat(frontend): integrate realtime state`.

### Passo 12: Construir UI principal do jogo

- [ ] Construir tela principal sem landing page.
- [ ] Incluir grafico do crash, multiplicador animado, hash da seed antes da rodada, controles de aposta, botao de cashout, timer, lista de apostas, historico de rodadas, saldo e username.
- [ ] UI deve ser dark mode, responsiva, com loading states e toasts de erro.
- [ ] Garantir que botao de aposta so habilita em `BETTING` e cashout so habilita em `RUNNING` com aposta pendente.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend.
- [ ] Validar visualmente desktop e mobile.
- [ ] Commit sugerido: `feat(frontend): build crash game screen`.

### Passo 13: Adicionar testes frontend

- [ ] Cobrir renderizacao da tela principal.
- [ ] Cobrir validacao do formulario de aposta.
- [ ] Cobrir estados habilitado/desabilitado de apostar e cashout.
- [ ] Cobrir exibicao de erro em saldo insuficiente ou falha de rede.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend.
- [ ] Commit sugerido: `test(frontend): cover game screen behavior`.

### Passo 14: Adicionar E2E browser se viavel

- [ ] Viabilidade padrao: adicionar Playwright se a instalacao e execucao local forem estaveis no ambiente.
- [ ] Cobrir login, visualizacao da rodada, aposta, cashout e saldo atualizado pelo browser.
- [ ] Se Playwright falhar por dependencia de ambiente, registrar no issue log e executar validacao visual/browser manual documentada.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Commit sugerido: `test(frontend): add browser e2e flow`.

### Passo 15: Revisar Swagger/OpenAPI

- [ ] Confirmar Swagger em `http://localhost:4001/docs` e `http://localhost:4002/docs`.
- [ ] Garantir DTOs documentados para todos os endpoints publicos e protegidos.
- [ ] Garantir que endpoints protegidos indiquem bearer auth.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Commit sugerido: `docs(api): complete openapi documentation`.

### Passo 16: Revisar Docker final

- [ ] Validar que `bun run docker:up` sobe infra, backends, migrations, Keycloak, Kong e frontend sem passo manual.
- [ ] Validar ambiente limpo com volumes recriados quando necessario.
- [ ] Validar RabbitMQ UI, Keycloak admin e Kong proxy.
- [ ] Garantir que nenhum `.env` manual seja obrigatorio para Docker.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Commit sugerido: `chore: verify docker delivery flow`.

### Passo 17: Atualizar README final

- [ ] Documentar setup local e Docker.
- [ ] Documentar credenciais: Keycloak admin, usuario `player`, RabbitMQ, portas e URLs.
- [ ] Documentar arquitetura, trade-offs, consistencia via RabbitMQ, provably fair e WebSocket events.
- [ ] Documentar todos os comandos de teste.
- [ ] Documentar limitacoes conscientemente nao adotadas: outbox/inbox completa, observabilidade, auto bet, auto cashout, leaderboard e Storybook.
- [ ] Executar Portao Base.
- [ ] Executar Portao Frontend se README mencionar fluxo frontend final.
- [ ] Commit sugerido: `docs: explain setup architecture and tests`.

### Passo 18: Rodar bateria final completa

- [ ] Executar `bun install`.
- [ ] Executar Portao Base.
- [ ] Executar Portao API/Integracao.
- [ ] Executar Portao E2E Docker/Kong/Keycloak.
- [ ] Executar Portao Frontend.
- [ ] Executar todos os testes E2E de API.
- [ ] Executar E2E browser ou validacao visual/browser documentada.
- [ ] Confirmar `git status --short --branch` limpo.
- [ ] Commit final somente se houver ajuste de documentacao ou correcao.
- [ ] Commit sugerido se necessario: `chore: finalize crash game delivery`.

## Criterios de Pronto

- `bun run docker:up` sobe tudo sem passos manuais.
- Jogador autentica via Keycloak.
- Wallet existe para `player` com saldo de desenvolvimento.
- Jogador aposta, faz cashout e recebe credito correto.
- Jogador aposta, nao faz cashout e perde no crash.
- Wallet nunca usa ponto flutuante para dinheiro.
- Game e Wallet se comunicam via RabbitMQ.
- Rodadas usam hash chain + commit/reveal e `verify.fair=true` para rodadas legitimas.
- WebSocket sincroniza multiplas abas.
- Frontend entrega experiencia de jogo real, nao placeholder.
- Testes unitarios, integracao, E2E API e testes frontend passam.
- README final explica setup, arquitetura, testes, WebSocket, provably fair e trade-offs.
