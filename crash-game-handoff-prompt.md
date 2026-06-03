# Prompt de Continuidade - Chrono Crash

Continue o projeto em `/Users/luiz_fbm/Documents/programacao/fullstack-challenge`.

Idioma: responda em portugues.

## Contexto do projeto

Projeto full-stack de um Crash Game chamado **Chrono Crash**, com:

- Backend em NestJS + Bun.
- Servicos separados: `services/games` e `services/wallets`.
- Prisma + PostgreSQL.
- RabbitMQ para integracao wallet outbox/inbox.
- Kong como API gateway em `http://localhost:8000`.
- Keycloak em `http://localhost:8080`, realm `crash-game`.
- Frontend React/Vite/Tailwind em `frontend`.
- Observabilidade com Prometheus, Grafana, Jaeger e OpenTelemetry.
- Quality gates com cobertura, duplicacao, tamanho de arquivos e auditoria.

## Comandos obrigatorios no inicio

Primeiro rode:

```bash
git status --short --branch
```

Depois leia, antes de alterar qualquer coisa:

```text
README.md
docs/superpowers/specs/2026-05-29-crash-game-architecture-design.md
docs/superpowers/specs/2026-05-31-crash-game-execution-plan.md
docs/superpowers/specs/2026-05-31-crash-game-implementation-issue-log.md
/Users/luiz_fbm/.codex/skills/tdd/SKILL.md
```

Para qualquer UI/frontend, leia tambem:

```text
/Users/luiz_fbm/.codex/skills/ui-ux-pro-max/SKILL.md
```

## Regras rigidas

- Trabalhar sempre na branch `crash-game-implementation`.
- Branch principal e `main`.
- Nao criar branch `codex/...`.
- Nao alterar `README.md`.
- Nao fazer commit, push, PR ou merge sem pedido explicito.
- Nao usar comandos destrutivos sem autorizacao explicita.
- Nao reverter mudancas existentes sem autorizacao explicita.
- Nao deletar, desabilitar ou reduzir testes.
- Usar sempre TDD.
- Usar `apply_patch` para edicoes manuais.
- Usar `rg`/`rg --files` para buscas.
- Respeitar README e specs.
- Nao tocar nestas docs antigas nao rastreadas:
  - `docs/superpowers/plans/2026-06-02-auto-bet-backend.md`
  - `docs/superpowers/specs/2026-06-02-auto-bet-backend-design.md`

## Estado git esperado

- Branch: `crash-game-implementation`.
- Esta `ahead 12` de `origin/crash-game-implementation`.
- Ultimo commit local conhecido: `38049dc feat(frontend): polish crash game experience`.
- Ha mudancas locais nao commitadas.
- As duas docs antigas nao rastreadas acima devem continuar intocadas.

## O que foi feito recentemente

### Frontend/UI

- Cards antigos de metricas foram removidos.
- Nao existe mais card `LIVE`.
- Nao existe mais `metric-rodada`.
- Nao existe mais `metric-saldo`.
- O saldo agora fica no header, dentro da area acessivel `aria-label="Conta do jogador"`.
- O estado da rodada aparece no palco, por exemplo `connected BETTING`.
- O countdown em `BETTING` mostra `Rodada inicia em` e usa `@number-flow/react` sem sufixo `s`.
- O palco 3D foi polido:
  - Curva/fill delta.
  - Eixo X responsivo com tempo atual.
  - Eixo Y com indicador de multiplicador.
  - Mensagem `CRASH!` e subtexto `A rodada finalizou em ...x`.
  - Transicao `BETTING -> RUNNING` em `0.9s`.
  - Camera acompanha o carro.
  - Shake/impacto restaurado.
  - Estado `CRASHED` usa asset running sem fogo e sem crescer.
- Layout reorganizado:
  - Desktop: Cashier rail acima do Leaderboard.
  - Mobile: Cashier antes de Provably Fair; Leaderboard acima de Provably Fair.
- Cashier rail foi ajustado:
  - Valor em reais.
  - Melhor espacamento.
  - Botoes sem overflow.
  - `Ultimo Auto Bet` compacto e no final.

### Refatoracao frontend importante

Para passar quality gate, o antigo `frontend/src/components/game/time-car-trail.ts` foi dividido em modulos menores:

```text
frontend/src/components/game/time-car-trail.ts
frontend/src/components/game/time-car-trail-types.ts
frontend/src/components/game/time-car-trail-constants.ts
frontend/src/components/game/time-car-trail-math.ts
frontend/src/components/game/time-car-trail-frame.ts
frontend/src/components/game/time-car-trail-labels.ts
frontend/src/components/game/time-car-trail-objects.ts
frontend/src/components/game/time-car-trail-axis.ts
frontend/src/components/game/time-car-trail-geometry.ts
frontend/src/components/game/time-car-trail-materials.ts
```

Tambem foram extraidos:

```text
frontend/src/components/game/crash-flight-trail-frame.ts
frontend/src/components/game/crash-flight-storyboard-frames.ts
frontend/src/components/game/crash-flight-scene-assets.ts
frontend/src/components/game/crash-flight-renderer-size.ts
```

Atencao: essa refatoracao foi para manter comportamento e visual, nao para mudar feature.

### Backend/Docker

Foi corrigido um bug real em `services/games`:

- O container `games` morria com `Prisma P1001` no polling do wallet outbox.
- `WalletOutboxDispatcher.dispatchNext()` agora captura/loga falhas de `claimNext()` sem derrubar o processo.
- Existe teste unitario cobrindo isso.

Tambem foi corrigido o Keycloak:

- O Admin Console local carregava HTML, mas login/token no realm `master` falhava com `HTTPS required`.
- Causa: `sslRequired=external` no realm `master`.
- Agora o Keycloak sobe via `docker/keycloak/start-dev.sh`, que inicia `start-dev --import-realm` e aplica `sslRequired=none` no realm `master`.
- `docker-compose.yml` usa:
  `entrypoint: ["sh", "/opt/keycloak/data/import/start-dev.sh"]`
- Foi criado `scripts/ci/check-keycloak-admin.ts`.
- `package.json` atualizou `ci:e2e` para rodar `check-keycloak-admin`.

## Testes e gates: muito importante

Nunca reduza testes. Se um teste falhar, trate como sinal real ate provar o contrario.

### Comandos principais

Quality/local completo:

```bash
bun run ci:local
```

Esse comando roda:

- `bun install --frozen-lockfile`
- `bun run lint`
- `bun run check:types`
- `bun run test:unit`
- `bun run test:coverage`
- `bun run quality:gate`
- `docker compose config`

E2E Docker/API:

```bash
bun run ci:e2e
```

Esse comando sobe/rebuilda Docker, checa Kong, checa Keycloak admin e roda E2E de API em `services/games`.

Browser E2E:

```bash
bun run test:e2e:browser
```

Build frontend:

```bash
cd frontend && bun run build
```

Whitespace/diff:

```bash
git diff --check
```

Status Docker:

```bash
docker compose ps
```

### Testes frontend

Frontend usa Vitest:

```bash
cd frontend && bunx vitest run
cd frontend && bun run test
```

Testes relevantes recentes:

- `frontend/src/components/game/crash-flight-scene.test.ts`
- `frontend/src/components/game/game-dashboard-shell.test.tsx`
- `frontend/src/components/game/chrono-stage.test.tsx`
- `frontend/src/components/layout/app-shell.test.tsx`

Importante:

- Ha teste garantindo que os cards antigos nao aparecem:
  `metric-realtime`, `metric-saldo`, `metric-jogador`, `metric-rodada` devem continuar ausentes.
- Nao reintroduzir `LIVE` como card.
- Browser E2E deve usar UI atual:
  - `connected BETTING`
  - `Rodada inicia em`
  - saldo em `Conta do jogador`
  - API `/games/rounds/current` para confirmar rodada deterministica preparada.

### Testes backend games

Unit:

```bash
cd services/games && bun test tests/unit
```

Passou recentemente com `116 passed`.

Tipos:

```bash
bunx tsc --noEmit -p services/games/tsconfig.json
```

E2E:

```bash
cd services/games && bun test tests/e2e
```

Passou recentemente com `17 passed`.

Testes importantes:

- lifecycle de rodada.
- place bet.
- cashout.
- auto cashout.
- auto bet/martingale.
- wallet outbox dispatcher.
- outbox/inbox.
- rate limiting.
- deterministic seed.
- OpenAPI/docs.

### Testes backend wallets

Unit:

```bash
cd services/wallets && bun test tests/unit
```

Tipos:

```bash
bunx tsc --noEmit -p services/wallets/tsconfig.json
```

### Quality gate

```bash
bun run test:coverage && bun run quality:gate
```

Metricas recentes aprovadas:

- Global coverage: `84.56%`
- Frontend coverage: `83.71%`
- Duplicated lines: `236`
- Clones: `12`
- Largest file: `frontend/src/components/game/crash-flight-scene.tsx` com `267` linhas
- Files over 300 lines: `0`
- Critical/high vulnerabilities: `0`

Se mexer no frontend, cuidado para nao estourar:

- tamanho de arquivo.
- duplicacao.
- cobertura.
- lint Fast Refresh.

### Browser E2E atual

Arquivo:

```text
tests/browser/player-flow.spec.ts
```

Fluxos:

1. Login, aposta manual, cash out e tabela realtime visivel.
2. Auto cashout preset sem cashout manual.
3. Configurar e parar sessao auto bet Martingale.

O helper atual deve validar:

- `connected BETTING`
- `Rodada inicia em`
- `/games/rounds/current` com `id`, `chainIndex` e `status` da rodada preparada.

A leitura de saldo deve vir de:

```ts
page.getByLabel("Conta do jogador").locator("p").last()
```

Nao usar:

- `LIVE`
- `metric-rodada`
- `metric-saldo`

## Verificacoes que passaram por ultimo

Passaram depois das ultimas alteracoes:

```bash
bun run ci:local
cd frontend && bun run build
bun run ci:e2e
bun run test:e2e:browser
git diff --check
docker compose ps
```

`bun run test:e2e:browser` passou com `3 passed`.

`docker compose ps` mostrou os servicos principais `healthy`:

- frontend
- games
- wallets
- keycloak
- kong
- postgres
- rabbitmq

Tambem foi validado no browser embutido em `http://localhost:8000/`:

- `Chrono Crash` aparece.
- Header com saldo aparece.
- `LIVE` nao aparece.
- `metric-rodada` nao aparece.
- `metric-saldo` nao aparece.

## Issue log

Atualizar sempre que encontrar falha real de teste/build/Docker/runtime.

Arquivo:

```text
docs/superpowers/specs/2026-05-31-crash-game-implementation-issue-log.md
```

Issues recentes registrados:

- 61: `games` parava por falha transiente no polling do outbox.
- 62: Admin Console do Keycloak exigia HTTPS no realm master.
- 63: Quality gate falhou por concentracao do palco 3D.
- 64: E2E browser usava seletores dos cards removidos.

## Arquivos alterados/relevantes recentes

```text
docker-compose.yml
package.json
docker/keycloak/start-dev.sh
scripts/ci/check-keycloak-admin.ts
tests/browser/player-flow.spec.ts
docs/superpowers/specs/2026-05-31-crash-game-implementation-issue-log.md
frontend/src/components/game/time-car-trail.ts
frontend/src/components/game/time-car-trail-*.ts
frontend/src/components/game/crash-flight-scene.tsx
frontend/src/components/game/crash-flight-scene.test.ts
frontend/src/components/game/crash-flight-storyboard.ts
frontend/src/components/game/crash-flight-storyboard-frames.ts
frontend/src/components/game/crash-flight-trail-frame.ts
frontend/src/components/game/crash-flight-scene-assets.ts
frontend/src/components/game/crash-flight-renderer-size.ts
frontend/src/components/game/game-dashboard-shell.tsx
```

## Proximo estado de trabalho

O Passo 16, revisao Docker final, esta essencialmente validado.
O Passo 17 envolve README final, mas esta bloqueado pela instrucao atual de **nao alterar README.md**.

Antes de qualquer nova mudanca:

1. Rode `git status --short --branch`.
2. Leia os arquivos obrigatorios.
3. Identifique o menor recorte.
4. Escreva ou ajuste teste primeiro quando houver mudanca de comportamento.
5. Rode os testes focados.
6. Rode gates completos relevantes.
7. Atualize o issue log se houver falha real.
8. Nao faca commit/push/PR sem pedido explicito.
