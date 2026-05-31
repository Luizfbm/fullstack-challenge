# Crash Game - Implementation Issue Log

Atualizado em: 2026-05-31

Este documento registra problemas encontrados durante a implementacao do
desafio, suas causas, correcoes aplicadas e validacoes executadas depois da
correcao.

Regra operacional: todo erro relevante observado em instalacao, build, testes,
Docker, migrations, runtime ou integracao deve ser registrado aqui antes ou
logo apos a correcao. Depois da correcao, deve existir um teste ou comando de
validacao que demonstre que o problema nao ocorre mais.

## Formato de Registro

Cada entrada deve conter:

- contexto: etapa em que o problema ocorreu;
- sintoma: mensagem de erro ou comportamento observado;
- causa: explicacao tecnica objetiva;
- correcao: mudanca aplicada;
- validacao: comando ou teste executado depois da correcao;
- status: `resolvido`, `pendente` ou `monitorar`.

## Problemas Registrados

### 1. Bun nao estava instalado no ambiente local

- Contexto: bootstrap do projeto.
- Sintoma: o runtime exigido pelo README nao estava disponivel localmente.
- Causa: a maquina ainda nao tinha Bun instalado.
- Correcao: Bun instalado via Homebrew.
- Validacao: `bun --version` retornou `1.3.14`.
- Status: resolvido.

### 2. `bun install` falhava por workspace frontend incompleto

- Contexto: instalacao das dependencias do monorepo.
- Sintoma: o workspace `frontend` era referenciado, mas nao possuia
  `package.json`.
- Causa: o projeto recebido era um esqueleto e o frontend ainda era apenas um
  placeholder.
- Correcao: scaffold minimo do frontend Vite + React criado em `frontend/`.
- Validacao: `bun install` executou com sucesso e `bun run build` no frontend
  tambem passou.
- Status: resolvido.

### 3. Docker Compose dependia de `.env` inexistente no root

- Contexto: validacao da infraestrutura local.
- Sintoma: o `docker-compose.yml` referenciava variaveis via arquivo `.env` que
  nao existia no root do projeto.
- Causa: configuracao inicial do esqueleto exigia um passo manual que entrava
  em conflito com o requisito do README de `bun run docker:up` subir tudo sem
  passos manuais.
- Correcao: variaveis necessarias para execucao Docker foram explicitadas no
  `docker-compose.yml` para os servicos locais.
- Validacao: `docker compose config` passou.
- Status: resolvido.

### 4. Healthcheck com `curl` criaria dependencia desnecessaria

- Contexto: healthchecks dos servicos Bun/NestJS no Docker Compose.
- Sintoma: imagens baseadas em Bun Alpine nao garantem `curl` instalado.
- Causa: usar `curl` em healthcheck exigiria instalar pacote extra apenas para
  checar `GET /health`.
- Correcao: healthchecks dos servicos usam `bun -e fetch(...)`, aproveitando o
  runtime ja presente na imagem.
- Validacao: `docker compose config` passou; com Docker daemon ativo,
  `docker compose ps` mostrou `games`, `wallets` e `frontend` como healthy.
- Status: resolvido.

### 5. Docker daemon nao estava ativo

- Contexto: tentativa de validar build e subida dos containers.
- Sintoma: `docker info` falhou com erro de conexao ao Docker daemon.
- Causa: Docker Desktop/daemon nao estava aberto no ambiente local.
- Correcao: pendente de abrir/iniciar Docker Desktop.
- Validacao pendente: executar `docker info`, `docker compose build` e
  `bun run docker:up`.
- Nova tentativa em 2026-05-31: `docker info` ainda falhou com
  `failed to connect to the docker API`, indicando daemon indisponivel.
- Correcao aplicada em 2026-05-31: Docker Desktop iniciado com
  `docker desktop start` e daemon aguardado por polling.
- Validacao: `docker info` passou; `docker compose build games wallets
  frontend` passou; `docker compose up -d` subiu os containers.
- Status: resolvido.

### 6. DTO do Game importava type alias como valor em runtime

- Contexto: testes unitarios do Game apos adicionar DTOs Swagger.
- Sintoma: `bun test tests/unit` falhou com
  `SyntaxError: Export named 'BetStatus' not found in module`.
- Causa: `BetStatus` e um type alias TypeScript, portanto deve ser importado
  com `import type`; o import normal vira uma expectativa de export em runtime
  no executor de testes.
- Correcao: DTOs do Game passaram a importar `BetStatus` e `RoundStatus` com
  `import type`.
- Validacao: `bun test tests/unit` em `services/games` passou com 22 testes.
- Status: resolvido.

### 7. Build Docker do frontend copiava `node_modules`

- Contexto: primeira validacao real com Docker daemon ativo usando
  `docker compose build games wallets frontend`.
- Sintoma: build do frontend falhou em `COPY . .` com
  `cannot replace to directory .../node_modules/@tailwindcss/vite with file`.
- Causa: `frontend/.dockerignore` ainda nao existia, entao o contexto Docker
  incluia `node_modules` local e entrava em conflito com os pacotes instalados
  dentro da imagem.
- Correcao: criado `frontend/.dockerignore` ignorando `node_modules`, `dist`,
  `.vite` e `.DS_Store`.
- Validacao: `docker compose build games wallets frontend` passou.
- Status: resolvido.

### 8. Postgres 18 falhava por volume montado no caminho antigo

- Contexto: primeira execucao real de `docker compose up -d` apos daemon Docker
  estar ativo.
- Sintoma: container `postgres` saiu com codigo 1 e log informando que, em
  imagens 18+, o volume nao deve ser montado diretamente em
  `/var/lib/postgresql/data`.
- Causa: `docker-compose.yml` montava `postgres_data` em
  `/var/lib/postgresql/data`, padrao comum em versoes anteriores, mas
  incompatível com o comportamento atual da imagem `postgres:18.3-alpine`.
- Correcao: mount do volume alterado para `/var/lib/postgresql`; volumes
  locais do Compose recriados com `docker compose down -v`.
- Validacao: `docker compose up -d` subiu o Postgres e `docker compose ps`
  mostrou `postgres` como healthy.
- Status: resolvido.

### 9. Healthcheck do Keycloak apontava para a porta publica

- Contexto: validacao de runtime apos `docker compose up -d`.
- Sintoma: todos os servicos ficaram healthy exceto `keycloak`, que permaneceu
  em `health: starting`; `http://localhost:8080/realms/master` respondia 200,
  mas `http://localhost:8080/health/ready` respondia 404.
- Causa: no Keycloak 26.5.5, com health habilitado, a interface de management
  escuta em `9000`, e o healthcheck estava consultando `8080/health/ready`.
- Correcao: healthcheck alterado para `localhost:9000/health/ready` e
  container recriado.
- Validacao: `docker inspect` mostrou `keycloak` como healthy e
  `docker compose ps` confirmou o servico healthy.
- Status: resolvido.

### 10. Validacao JWT falhava por issuer interno diferente do issuer publico

- Contexto: teste autenticado real via Kong apos subir o Compose.
- Sintoma: `POST /wallets` e `GET /wallets/me` retornaram 401 usando token
  obtido com `player/player123`.
- Causa: o token emitido pelo Keycloak via host usa issuer
  `http://localhost:8080/realms/crash-game`, mas os backends estavam
  configurados com `KEYCLOAK_ISSUER=http://keycloak:8080/realms/crash-game`.
  O host interno `keycloak` e correto para buscar JWKS entre containers, mas
  nao deve substituir o issuer publico gravado no JWT.
- Correcao: backends agora aceitam `KEYCLOAK_JWKS_URL` separado do
  `KEYCLOAK_ISSUER`; no Compose, o issuer publico fica como
  `http://localhost:8080/realms/crash-game` e o JWKS interno como
  `http://keycloak:8080/realms/crash-game/protocol/openid-connect/certs`.
- Validacao: `POST /wallets` e `GET /wallets/me` via Kong passaram usando token
  real do usuario `player/player123`.
- Status: resolvido.

### 11. Kong retornou 502 logo apos recriar backends

- Contexto: validacao manual logo apos `docker compose up -d` recriar
  `games`, `wallets` e `frontend`.
- Sintoma: primeira chamada autenticada via Kong para `POST /wallets` e
  `GET /wallets/me` retornou 502; alguns segundos depois a mesma chamada
  passou com 201/200.
- Causa: janela curta em que o Kong ainda tentava conectar a upstream antigo
  ou ainda nao pronto apos recriacao dos containers backend.
- Correcao: `kong` passa a depender dos healthchecks de `games` e `wallets`
  no fluxo normal do Compose; apos recriacao manual de backends no ambiente ja
  ativo, `docker compose restart kong` limpou os workers/upstreams antigos.
- Validacao: cinco chamadas consecutivas para `GET /games/health` e
  `GET /wallets/health` via Kong passaram; `POST /wallets` e `GET /wallets/me`
  passaram com token real.
- Status: resolvido.

### 12. Healthcheck do Postgres gerava erro para banco `admin`

- Contexto: execucao da stack Docker com o Postgres healthy.
- Sintoma: logs recorrentes com
  `FATAL: database "admin" does not exist`.
- Causa: o healthcheck usava `pg_isready -U admin`; quando o banco nao e
  informado, o cliente tenta conectar no banco com o mesmo nome do usuario
  (`admin`). No Compose, o banco padrao criado e `postgres`, e os bancos de
  dominio sao `games` e `wallets`.
- Correcao: healthcheck alterado para `pg_isready -U admin -d postgres`.
- Validacao: `docker compose up -d --build` subiu a stack; `docker compose ps`
  mostrou `postgres` healthy; logs recentes checados com `rg` nao tiveram
  novas ocorrencias de `database "admin" does not exist`.
- Status: resolvido.

### 13. Kong nao possuia rota raiz para `http://localhost:8000`

- Contexto: acesso manual ao gateway em `http://localhost:8000`.
- Sintoma: Kong retornou `404` com `no Route matched with those values`.
- Causa: a configuracao declarativa do Kong tinha apenas rotas `/games` e
  `/wallets`; nao havia rota para `/`.
- Correcao: adicionada rota raiz `/` apontando para o servico `frontend`.
- Validacao: `GET /` via Kong retornou `200 OK` com HTML do frontend; `GET
  /games/health` e `GET /wallets/health` continuaram retornando `200`.
- Status: resolvido.

### 14. URL incorreta do console administrativo do Keycloak

- Contexto: acesso manual a `http://localhost:8080/admin/admin`.
- Sintoma: tela do Keycloak informou erro interno.
- Causa: `/admin/admin` nao e a rota do console administrativo. O console do
  realm master fica em `/admin/master/console/`.
- Correcao: nao exigiu mudanca de codigo; a URL correta deve ser usada na
  validacao e na orientacao de execucao local.
- Validacao: `http://localhost:8080/admin/master/console/` retornou `200`; a
  senha `admin/admin` foi validada obtendo token no realm `master`.
- Status: resolvido.

### 15. Frontend bloqueava requisicoes proxied pelo Kong

- Contexto: validacao de `GET /` via Kong apos adicionar rota raiz para o
  frontend.
- Sintoma: `http://localhost:8000/` retornou `403 Forbidden` com mensagem
  `Blocked request. This host ("frontend") is not allowed`.
- Causa: o Vite recebeu a requisicao proxied com host interno `frontend` e
  bloqueou esse host por nao estar em `server.allowedHosts`.
- Correcao: `frontend/vite.config.ts` passou a permitir o host interno
  `frontend` em `server.allowedHosts` e `preview.allowedHosts`.
- Validacao: frontend rebuildado/recriado; `GET /` via Kong retornou `200 OK`
  com HTML; `bun run build` em `frontend` passou.
- Status: resolvido.

### 16. Validacao via Kong executada com stack parcial

- Contexto: validacao do ciclo automatico de rodadas apos rebuild isolado do
  servico `games`.
- Sintoma: `curl http://localhost:8000/games/rounds/current` falhou com
  `Failed to connect to localhost port 8000`, e o parser JSON recebeu EOF.
- Causa: o comando usado para rebuild foi `docker compose up -d --build games`,
  que recriou apenas `games` e dependencias diretas; o Kong nao estava ativo
  naquele momento. Nao era falha do endpoint do Game.
- Correcao: repetir a validacao com `docker compose up -d --build`, subindo a
  stack completa conforme o README.
- Validacao: `docker compose ps` mostrou todos os servicos healthy; `GET
  /games/rounds/current`, `GET /games/rounds/history?limit=5`, `POST
  /games/bet` e `GET /wallets/me` via Kong responderam corretamente.
- Status: resolvido.

### 17. Script de validacao E2E falhou ao parsear resposta vazia

- Contexto: validacao manual do fluxo autenticado completo via Kong
  (`bet -> cashout -> wallet -> history -> settlement`).
- Sintoma: o script exibiu `SyntaxError: JSON Parse error: Unexpected EOF`
  durante polling de `GET /games/rounds/current`; em uma tentativa anterior,
  tambem houve `read-only variable: status` no shell.
- Causa: durante a transicao `CRASHED -> SETTLED -> BETTING`, existe uma
  janela curta em que nao ha rodada atual. O parser tentava executar
  `JSON.parse` mesmo quando o corpo estava vazio. Alem disso, `status` e uma
  variavel especial no `zsh`, portanto nao deve ser usada como variavel local
  em scripts de validacao.
- Correcao: script de validacao refeito usando `bash`, variavel local
  `current_round_status` e parser que trata corpo vazio antes de parsear JSON.
- Validacao: o fluxo E2E rodou limpo via Kong com token real do Keycloak:
  `POST /games/bet` retornou `ACCEPTED`, `POST /games/bet/cashout` retornou
  `CASHED_OUT`, `GET /wallets/me` retornou saldo atualizado,
  `GET /games/bets/me?limit=1` retornou a aposta sacada e
  `GET /games/rounds/history?limit=1` retornou rodada `SETTLED`.
- Status: resolvido.

### 18. Containers Docker do projeto nao estavam mais presentes

- Contexto: verificacao final da stack apos validacoes E2E.
- Sintoma: `docker compose ps` listou apenas o cabecalho e
  `curl http://localhost:8000/games/rounds/history?limit=1` falhou com
  `Failed to connect to localhost port 8000`.
- Causa: os containers do projeto `fullstack-challenge-*` nao existiam mais em
  `docker ps -a`. Nao houve erro de aplicacao nos logs porque os containers
  ja tinham sido removidos; a causa externa da remocao nao foi identificada.
- Correcao: stack recriada com `docker compose up -d --build`.
- Validacao: `docker compose ps` mostrou `frontend`, `games`, `keycloak`,
  `kong`, `postgres`, `rabbitmq` e `wallets` como healthy; `GET
  /games/health`, `GET /wallets/health` e `GET /games/rounds/current` via
  Kong responderam corretamente.
- Status: resolvido.

### 19. Kong respondeu 502 imediatamente apos recreate dos backends

- Contexto: portao de integracao do Passo 2 do plano de execucao, apos
  `docker compose up -d --build` recriar `games` e `wallets`.
- Sintoma: chamada imediata para `GET /games/health` via Kong retornou
  `502`, mesmo com `docker compose ps` mostrando `games` healthy poucos
  segundos depois.
- Causa: janela curta em que o Kong ainda tentava conectar no IP anterior do
  container `games` (`connect() failed (111: Connection refused)` nos logs do
  Kong). O servico `games` novo ja havia iniciado corretamente.
- Correcao: aguardar a estabilizacao do upstream antes de repetir os
  healthchecks via Kong. Nao houve alteracao de codigo neste ponto.
- Validacao: apos poucos segundos, `GET /games/health` via Kong retornou
  `200 OK` com `{"status":"ok","service":"games"}`.
- Recorrencia: no portao de integracao do Passo 5, apos novo
  `docker compose up -d --build`, `GET /games/health` e em seguida
  `GET /wallets/health` via Kong retornaram `502` uma vez cada. Os
  healthchecks diretos em `:4001` e `:4002` retornaram `200`, e os logs do
  Kong novamente mostraram tentativa contra IP anterior de container com
  `connect() failed (111: Connection refused)`.
- Validacao adicional: apos aguardar a estabilizacao do upstream, `GET
  /games/health` e `GET /wallets/health` via Kong retornaram `200 OK`.
- Correcao adicional: o helper E2E `ensureStackIsHealthy` passou a aguardar
  `/games/health` e `/wallets/health` via Kong com retry curto, preservando a
  falha com a ultima resposta caso o upstream nao estabilize.
- Causa raiz confirmada: o Kong mantinha DNS stale para nomes de containers
  recriados. A configuracao padrao de `dns_stale_ttl` e longa para resiliencia
  em ambientes distribuidos, mas prejudica o ciclo local de
  `docker compose up -d --build` com containers recriados.
- Correcao final: o Compose local passou a definir `KONG_DNS_VALID_TTL=1`,
  `KONG_DNS_STALE_TTL=0` e `KONG_DNS_NOT_FOUND_TTL=1`, reduzindo cache DNS
  stale do Kong durante desenvolvimento/testes.
- Validacao final: apos recriar o Kong com essas variaveis, `GET
  /games/health`, `GET /wallets/health`, handshake Socket.IO em
  `/games/socket.io` e os 7 testes E2E de API passaram via Kong.
- Status: resolvido.

### 20. Build do frontend falhou por mock tipado como `fetch`

- Contexto: Passo 8 do plano de execucao, ao criar a base real do frontend e
  rodar `cd frontend && bun run build`.
- Sintoma: `tsc --noEmit -p tsconfig.json` falhou com
  `Property 'mock' does not exist on type ... fetch` em
  `src/services/http-client.test.ts`.
- Causa: o teste convertia `vi.fn(...)` para `typeof fetch` para satisfazer a
  assinatura do `HttpClient`. Essa conversao removia, para o TypeScript, a API
  `.mock` do Vitest. Como o `tsconfig` inclui `src`, os testes tambem entram
  no typecheck do build.
- Correcao: o teste passou a capturar o `RequestInit` recebido por uma funcao
  `fetch` fake tipada como `typeof fetch`, sem acessar `.mock`.
- Validacao: `cd frontend && bun run build` passou; `cd frontend && bun test`
  passou com 9 testes.
- Status: resolvido.

### 21. Callback OIDC falhou por `fetch` sem bind no navegador

- Contexto: Passo 9 do plano de execucao, validacao browser do login
  Keycloak via `http://localhost:8000/`.
- Sintoma: apos autenticar `player/player123`, o frontend voltou para `/` com
  `code` na URL, mas exibiu
  `Failed to execute 'fetch' on 'Window': Illegal invocation`.
- Causa: os clientes `HttpClient` e `OidcClient` guardavam o `fetch` nativo
  como funcao (`this.fetcher = fetch`) e chamavam depois via propriedade de
  classe. Em navegador, algumas implementacoes exigem que `fetch` seja chamado
  com `window/globalThis` como receiver; chamado como metodo da instancia, ele
  falha com `Illegal invocation`.
- Correcao: os clientes passaram a usar
  `globalThis.fetch.bind(globalThis)` quando nenhum `fetcher` customizado e
  informado. O callback OIDC tambem passou a limpar `code/state` da URL e o
  login pendente quando a troca de token falha.
- Validacao: `cd frontend && bun run build` passou; `cd frontend && bun test`
  passou com 19 testes; no browser via `http://localhost:8000/`, o login
  Keycloak com `player/player123` voltou para `/`, removeu `code/state` da URL
  e exibiu `player`/`Sair` sem erro de auth.
- Status: resolvido.

### 22. Typecheck dos scripts de qualidade falhou apos incluir `tsconfig`

- Contexto: Passo 9.5 do plano de execucao, ao adicionar scripts do Quality
  Gate e incluir `scripts/**/*.ts` em `tsconfig.quality.json`.
- Sintoma: `bun run check:types` falhou com `TS1375` em
  `scripts/ci/check-kong-health.ts` por top-level await em arquivo sem modulo
  e `TS18046` em `scripts/quality/collect-metrics.ts` por leitura de
  `duplicates` como `unknown`.
- Causa: o healthcheck era um script executavel sem import/export, e o parser
  do relatorio `jscpd` ainda nao fazia narrowing explicito do campo
  `duplicates`.
- Correcao: `scripts/ci/check-kong-health.ts` recebeu `export {}` para ser
  tratado como modulo, e o parser do `jscpd` passou a converter
  `duplicates` para `unknown[]` somente depois de `Array.isArray`.
- Validacao: `bun run check:types` passou.
- Status: resolvido.

### 23. ESLint varreu Prisma gerado e encontrou import morto em E2E

- Contexto: Passo 9.5 do plano de execucao, primeira execucao de
  `bun run lint` apos adicionar ESLint flat config.
- Sintoma: o lint retornou milhares de erros em
  `services/*/prisma/generated/**`; depois de ignorar gerados, restou
  `cashOut is defined but never used` em
  `services/games/tests/e2e/game-validation.e2e.test.ts`.
- Causa: a configuracao inicial do ESLint nao ignorava codigo gerado pelo
  Prisma, que nao deve ser editado nem medido como codigo autoral. O E2E tinha
  um import morto real que ainda nao era verificado por lint.
- Correcao: `eslint.config.mjs` passou a ignorar
  `services/*/prisma/generated/**`, e o import `cashOut` foi removido do teste
  E2E.
- Validacao: `bun run lint` passou.
- Status: resolvido.

### 24. Baseline inicial mostrou coletor de qualidade acima do limite

- Contexto: Passo 9.5 do plano de execucao, primeira geracao de
  `quality/baseline.json`.
- Sintoma: a fotografia inicial registrou `filesOverLimit: 1` porque
  `scripts/quality/collect-metrics.ts` ficou com mais de 300 linhas e virou o
  maior arquivo do projeto.
- Causa: o coletor concentrava cobertura, duplicacao, auditoria, metricas de
  arquivos e IO no mesmo modulo.
- Correcao: o coletor foi dividido em modulos menores:
  `coverage-metrics.ts`, `duplication-metrics.ts`, `file-metrics.ts`,
  `security-metrics.ts` e `quality-paths.ts`.
- Validacao: `bun run test:coverage`, `bun run quality:baseline` e
  `bun run quality:gate` passaram; o baseline passou a registrar
  `filesOverLimit: 0`.
- Status: resolvido.

### 25. E2E de crash/perda falhou por requisito desnecessario de crash alto

- Contexto: Passo 9.5 do plano de execucao, ao rodar `bun run ci:e2e` depois
  de criar o Quality Gate.
- Sintoma: `crash-loss-flow.e2e.test.ts` falhou com
  `Could not prepare a suitable betting round` depois de 46s. O helper
  `prepareBettingRound` esgotou 20 tentativas procurando rodada com crash
  point minimo de `3.00x`.
- Causa: o fluxo de crash/perda nao precisa de crash point alto, porque a
  aposta deve perder sem cashout. O helper usava o mesmo default exigente do
  fluxo de cashout, e a sequencia deterministica da hash chain gerou muitos
  rounds abaixo de `3.00x` naquele trecho.
- Correcao: o default de `prepareBettingRound` foi reduzido para `1.50x`,
  suficiente para cashout imediato, e o teste de crash/perda passou a pedir
  explicitamente `1.00x`, que e o minimo valido de dominio.
- Validacao: `cd services/games && bun test
  tests/e2e/crash-loss-flow.e2e.test.ts` passou; depois `bun run ci:e2e`
  passou com 9 testes E2E via Docker/Kong/Keycloak.
- Status: resolvido.

### 26. CI falhou no typecheck por Prisma Client ausente em runner limpo

- Contexto: Pull Request #1 no GitHub Actions, job `Quality Gate / Baseline
  ratchet`, passo `Typecheck`.
- Sintoma: `bun run check:types` falhou no GitHub com
  `Cannot find module '../../../prisma/generated/client'` em
  `services/games/src/infrastructure/prisma/game-prisma.repository.ts` e
  `services/games/src/infrastructure/prisma/prisma-client.ts`. Os passos de
  testes, coverage e Quality Gate foram pulados porque o typecheck falhou
  antes.
- Causa: o runner do GitHub comeca limpo e nao possui
  `services/*/prisma/generated/`, que e ignorado pelo git. Localmente o
  typecheck passava porque o Prisma Client ja tinha sido gerado em execucoes
  anteriores.
- Correcao: criado script raiz `db:generate` para gerar os clients de Games e
  Wallets; `check:types` passou a executar `bun run db:generate` antes dos
  `tsc`.
- Validacao: os diretorios `services/games/prisma/generated` e
  `services/wallets/prisma/generated` foram removidos localmente e
  `bun run check:types` regenerou os clients e passou.
- Status: resolvido.

### 27. CI Docker E2E falhou por Keycloak ainda inicializando o token endpoint

- Contexto: Pull Request #1 no GitHub Actions, job
  `Quality Gate / Docker Kong Keycloak E2E`, passo
  `Run API E2E through Kong and Keycloak`.
- Sintoma: os testes E2E `cashout-flow.e2e.test.ts` e
  `crash-loss-flow.e2e.test.ts` falharam em `getAccessToken()` com
  `ECONNRESET` ao chamar
  `http://localhost:8080/realms/crash-game/protocol/openid-connect/token`.
- Causa: no runner limpo do GitHub Actions, o healthcheck de Docker/Kong
  passava antes do endpoint de token do Keycloak estar pronto para aceitar a
  primeira requisicao real usada pelos testes.
- Correcao: `getAccessToken()` passou a aguardar o token endpoint com retry,
  tratando respostas nao-OK, token ausente e falhas transientes de conexao
  antes de falhar com a ultima causa observada.
- Validacao: `bun run ci:local` passou; `bun run ci:e2e` passou com 9 testes
  E2E via Docker/Kong/Keycloak.
- Status: resolvido.

### 28. Validacao da skill de babysit falhou por tooling Python e YAML invalido

- Contexto: criacao da skill `gh-pr-babysit`, usando o validador oficial do
  `skill-creator`.
- Sintoma: `python` nao existia no ambiente local; ao usar `python3`, o
  validador falhou por ausencia do pacote `PyYAML`; depois disso, a skill
  falhou por frontmatter YAML invalido na descricao com `:`.
- Causa: o macOS local dispoe de `python3`, nao `python`; o pacote `PyYAML`
  ainda nao estava instalado; a descricao do frontmatter precisava estar entre
  aspas por conter dois-pontos.
- Correcao: instalado `PyYAML` com `python3 -m pip install --user PyYAML` e
  corrigida a descricao do frontmatter da skill.
- Validacao: `python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py
  ~/.codex/skills/gh-pr-babysit` passou; `diff -qr` confirmou que a skill local
  esta igual a copia versionada.
- Status: resolvido.

### 29. Passo 10 falhou na catraca por duplicacao de tipo frontend/backend

- Contexto: Passo 10, integracao REST no frontend.
- Sintoma: `bun run ci:local` falhou em `quality:gate`; cobertura e percentual
  de duplicacao melhoraram, mas `duplication.duplicatedLines` subiu de 250 para
  268 e `duplication.clones` subiu de 15 para 16.
- Causa: o tipo frontend `VerifyRoundResponse` repetia textualmente o contrato
  do use case de verificacao do backend por 19 linhas, disparando `jscpd`.
- Correcao: o tipo frontend passou a reutilizar os campos comuns de
  `RoundResponse` via `Pick`, mantendo o contrato tipado sem duplicar o bloco.
- Validacao: `bun run test:coverage && bun run quality:gate` passou, com
  `duplication.duplicatedLines` de volta a 250 e `duplication.clones` de volta
  a 15.
- Status: resolvido.

### 30. Frontend ficou em branco apos cashout por leitura insegura de bets

- Contexto: Passo 10, validacao visual/browser do fluxo autenticado.
- Sintoma: depois de apostar pela UI e acionar `Cash Out`, a tela em
  `http://localhost:8000/` ficou preta; o console do navegador registrou
  `TypeError: Cannot read properties of undefined (reading 'length')` em
  `GameDashboardShell`.
- Causa: a tabela da mesa lia `currentRound?.bets.length`. Se o estado
  intermediario da query viesse com `currentRound` presente e `bets` ausente,
  a optional chain protegia apenas `currentRound`, nao `bets`.
- Correcao: a tela passou a normalizar as apostas da rodada com
  `getRoundBets()`, retornando lista vazia quando `bets` nao for array.
- Regressao: adicionado teste frontend para garantir que payload de rodada sem
  `bets` nao quebra a renderizacao da tabela.
- Validacao: `cd frontend && bun test` passou com 26 testes; `cd frontend &&
  bun run build` passou; apos `docker compose up -d --build`, o fluxo visual
  com login, aposta e cashout renderizou sem blank screen.
- Status: resolvido.

## Validacoes de Regressao Ja Executadas

- `bun install`
- `bunx tsc --noEmit -p services/games/tsconfig.json`
- `bunx tsc --noEmit -p services/wallets/tsconfig.json`
- `bun test tests/unit` em `services/games`
- `bun test tests/unit` em `services/wallets`
- `bun run build` em `frontend`
- `bun test` em `frontend`
- `bun test tests/e2e` em `services/games`
- `prisma validate` nos schemas dos servicos
- `bun run db:generate` nos servicos
- `docker compose config`
- `bun run lint`
- `bun run check:types`
- `rm -rf services/games/prisma/generated services/wallets/prisma/generated &&
  bun run check:types`
- `bun run test:unit`
- `bun run test:coverage`
- `bun run quality:gate`
- `bun run ci:local`
- `cd services/games && bun test tests/e2e/crash-loss-flow.e2e.test.ts`
- `bun run ci:e2e`
- `bun run lint`
- `docker compose config`
- `bun test scripts/quality`
- `python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py
  ~/.codex/skills/gh-pr-babysit`
- `diff -qr docs/superpowers/skills/gh-pr-babysit
  ~/.codex/skills/gh-pr-babysit`
- `gh pr view --json number,url,headRefName,state,mergeStateStatus,statusCheckRollup`
- `gh pr checks 2`
- `~/.codex/skills/gh-pr-babysit/scripts/fetch_review_threads.py --pr 2`
- `cd frontend && bun test`
- `cd frontend && bun run build`
- `bun run test:coverage && bun run quality:gate`
- `docker compose up -d --build`
- Fluxo E2E autenticado via Kong com Keycloak real:
  `POST /games/bet`, `POST /games/bet/cashout`, `GET /wallets/me`,
  `GET /games/bets/me?limit=1` e `GET /games/rounds/history?limit=1`
- Validacao visual/browser do Passo 10:
  login frontend com `player/player123`, aposta via UI, saldo atualizado,
  cashout via UI e mesa sem blank screen apos regressao de `bets`.

## Validacoes Docker Ja Executadas

- `docker info`
- `docker compose build games wallets frontend`
- `docker compose up -d`
- `docker compose ps`
- `GET /games/health` via Kong
- `GET /wallets/health` via Kong
- `GET /` via Kong retornando HTML do frontend
- `GET /admin/master/console/` no Keycloak retornando 200
- token de admin do Keycloak validado com `admin/admin`
- RabbitMQ management API validada com `admin/admin`
- token do usuario `player/player123` validado no realm `crash-game`
- `POST /wallets` e `GET /wallets/me` via Kong com token real do Keycloak
- login frontend via browser em `http://localhost:8000/` com
  `player/player123`

## Validacoes Ainda Pendentes

- Integracao REST completa no frontend sera implementada no Passo 10.
- Integracao WebSocket completa no frontend sera implementada no Passo 11.
