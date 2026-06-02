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

### 31. REST revelava crashPointBp antes do reveal da rodada

- Contexto: revisao antes do Passo 11, ao comparar REST com os eventos
  WebSocket.
- Sintoma: `GET /games/rounds/current` e `GET /games/rounds/:roundId/verify`
  retornavam `crashPointBp` mesmo quando `serverSeed` ainda nao tinha sido
  revelado.
- Causa: o serializer REST usava diretamente `round.crashPointBp`, enquanto o
  serializer realtime ja escondia o crash point antes do reveal.
- Correcao: REST e verify agora retornam `crashPointBp: null` antes do reveal e
  so revelam o valor quando `serverSeed` existe. Os E2E continuam podendo
  preparar rodadas por consulta direta ao banco de teste, sem vazar o valor pela
  API publica.
- Regressao: adicionados testes unitarios em `GamesController` e
  `VerifyRoundUseCase` cobrindo crash point escondido antes do reveal e
  revelado depois do crash.
- Validacao: `cd services/games && bun test tests/unit`,
  `bunx tsc --noEmit -p services/games/tsconfig.json`, `cd frontend && bun
  test` e `bunx tsc --noEmit -p frontend/tsconfig.json` passaram.
- Status: resolvido.

### 32. Passo 11 falhou na catraca por duplicacao de tipos WebSocket

- Contexto: Passo 11, integracao WebSocket no frontend.
- Sintoma: `bun run ci:local` falhou em `quality:gate`; cobertura e percentual
  de duplicacao melhoraram, mas `duplication.duplicatedLines` subiu de 250 para
  265 e `duplication.clones` subiu de 15 para 16.
- Causa: os tipos frontend de payload realtime repetiam textualmente parte dos
  tipos WebSocket do backend, criando um novo clone no `jscpd`.
- Correcao: o frontend passou a modelar o metadado `emittedAt` com um envelope
  generico, mantendo o contrato sem repetir o mesmo bloco do backend.
- Regressao: o Quality Gate agora volta a exigir `duplication.duplicatedLines`
  em 250 e `duplication.clones` em 15, sem alterar o baseline.
- Validacao: `bunx tsc --noEmit -p frontend/tsconfig.json`, `cd frontend &&
  bun test` e `bun run test:coverage && bun run quality:gate` passaram.
- Status: resolvido.

### 33. Rate limiting nao bloqueou requisicoes anonimas no primeiro teste

- Contexto: bonus de rate limiting via Kong, ao rodar o E2E isolado
  `rate-limiting.e2e.test.ts`.
- Sintoma: 12 chamadas rapidas para `POST /games/bet` retornaram `401`, sem
  nenhuma resposta `429`.
- Causa: o plugin `rate-limiting` do Kong estava com `limit_by` padrao
  `consumer`; como as chamadas anonimas nao tinham consumer, a janela nao
  contava como esperado para esse teste.
- Correcao: os plugins de rate limit passaram a usar `limit_by: ip`, mantendo
  `policy: local`.
- Regressao: adicionado E2E que confirma `429` em rota de aposta e, ao mesmo
  tempo, valida que `/games/health`, `/wallets/health` e `/` nao sao limitados.
- Validacao: `docker compose restart kong` recarregou a config declarativa;
  `cd services/games && bun test tests/e2e/rate-limiting.e2e.test.ts` passou.
- Status: resolvido.

### 34. Playwright E2E falhou por seletores ambiguos e frontend desatualizado

- Contexto: bonus de Playwright browser E2E para o fluxo real do jogador.
- Sintoma: o teste falhou primeiro porque `Entrar` tambem encontrava
  `Entrar para apostar`; depois `player` e `Crash Game` tambem tinham mais de
  um match. Em uma execucao intermediaria, o teste procurou `data-testid`
  novo em uma imagem Docker antiga do frontend.
- Causa: seletores amplos em uma tela com textos repetidos e container
  frontend ainda nao reconstruido depois da alteracao local.
- Correcao: os seletores foram escopados por papel/regiao (`banner`, `heading`
  e match exato) e o saldo passou a ter `data-testid` estavel. A stack foi
  reconstruida antes da validacao browser.
- Regressao: o teste Playwright agora cobre login Keycloak, fixture
  deterministica, `LIVE`, formula da curva, aposta, cashout, saldo atualizado e
  tela renderizada apos eventos realtime.
- Validacao: `docker compose up -d --build && bun scripts/ci/check-kong-health.ts
  && bun run test:e2e:browser` passou.
- Status: resolvido.

### 35. Bonus falhou na catraca por maior arquivo e linha duplicada

- Contexto: pacote de bonus, ao rodar `bun run test:coverage && bun run
  quality:gate`.
- Sintoma: o Quality Gate falhou com `files.largestFile.lineCount` em 294
  contra baseline 269 e `duplication.duplicatedLines` em 251 contra baseline
  250.
- Causa: a formula da curva foi adicionada diretamente na dashboard, deixando
  `game-dashboard-shell.tsx` grande demais; alem disso, o novo campo
  `multiplierGrowthBpPerSecond` aumentou a duplicacao textual entre o mapper
  REST e o serializer WebSocket.
- Correcao: a UI da rodada foi extraida para `CrashRoundPanel` e helpers de
  formatacao; REST e WebSocket passaram a usar um mapper publico comum para
  campos de rodada e aposta.
- Regressao: o proprio Quality Gate valida que maior arquivo e duplicacao nao
  pioram em relacao ao baseline.
- Validacao: `bunx tsc --noEmit -p frontend/tsconfig.json`, `bunx tsc
  --noEmit -p services/games/tsconfig.json`, `cd frontend && bun test`, `cd
  services/games && bun test tests/unit` e `bun run test:coverage && bun run
  quality:gate` passaram depois da correcao.
- Status: resolvido.

### 36. Refatoracao do bonus reduziu cobertura do pacote Games

- Contexto: segunda execucao de `bun run test:coverage && bun run
  quality:gate`, depois da correcao de duplicacao.
- Sintoma: duplicacao e maior arquivo passaram, mas
  `coverage.packages.services/games.lines.pct` caiu para 79.25 contra baseline
  79.40.
- Causa: a refatoracao mudou a distribuicao de linhas cobertas no pacote Games
  e os use cases de leitura ainda nao tinham testes diretos suficientes para
  sustentar a catraca.
- Correcao: adicionados testes unitarios para `GetCurrentRoundUseCase`,
  `ListRoundHistoryUseCase` e `ListMyBetsUseCase`.
- Erro intermediario: o primeiro teste novo esperava limite padrao 10 para
  historico, mas o valor real do dominio e `DEFAULT_ROUND_HISTORY_LIMIT = 20`.
  O teste foi corrigido para usar a constante do codigo.
- Regressao: a cobertura do pacote Games volta a ser validada pelo Quality Gate
  sem alterar o baseline.
- Validacao: `bunx tsc --noEmit -p services/games/tsconfig.json`, `cd
  services/games && bun test tests/unit/application/game-use-cases.test.ts`,
  `bun run test:coverage && bun run quality:gate` e `bun run ci:local`
  passaram.
- Status: resolvido.

### 37. Validacao visual teve erros de comando antes de passar

- Contexto: checagem visual desktop/mobile apos o Playwright E2E passar.
- Sintoma: a automacao do browser da sessao falhou ao aguardar `networkidle`;
  depois, o script local de Playwright falhou por expansao de template string no
  `zsh` e por importar `playwright` em vez de `@playwright/test`.
- Causa: diferencas da API disponivel no browser da sessao e erro de quoting no
  comando local; nao houve falha funcional da aplicacao.
- Correcao: a checagem no browser passou a usar `load`; o script local foi
  reexecutado com aspas simples e importando `@playwright/test`.
- Regressao: a validacao final confirma a formula da curva e ausencia de
  overflow horizontal em viewport mobile e desktop.
- Validacao: browser da sessao em `http://localhost:8000/` encontrou titulo,
  formula, ritmo e status realtime; script Playwright validou mobile 390px e
  desktop 1440px com `overflowX: false`.
- Status: resolvido.

### 38. Passo 12 falhou typecheck por fronteira REST/realtime no cashout

- Contexto: Passo 12, ao adicionar payout potencial no botao de cashout.
- Sintoma: `bunx tsc --noEmit -p frontend/tsconfig.json` falhou porque
  `currentMultiplierBp` nao existe em `RoundResponse`.
- Causa: o painel de aposta ainda aceitava uma rodada REST pura, enquanto a
  dashboard trabalha com um tipo unificado que pode conter dados realtime.
- Correcao: `BetControlsPanel` passou a receber `DashboardRound | null`, que
  modela corretamente a rodada reconciliada REST/WebSocket.
- Regressao: adicionados testes de `calculatePayoutCents`, timing da rodada,
  curva visual e cores do historico; o typecheck do frontend voltou a passar.
- Validacao: `bunx tsc --noEmit -p frontend/tsconfig.json`, `cd frontend &&
  bun test`, `cd frontend && bun run build` e `bun run test:coverage && bun
  run quality:gate` passaram.
- Status: resolvido.

### 39. Playwright perdeu status CASHED_OUT apos melhoria visual da mesa

- Contexto: Passo 12, validacao browser apos adicionar payout e tratamento
  visual para a lista de apostas da rodada.
- Sintoma: `bun run test:e2e:browser` falhou aguardando `CASHED_OUT`, embora a
  screenshot mostrasse saldo atualizado e payout na mesa.
- Causa: a refatoracao de `BetTableRow` passou a exibir valor, multiplicador e
  payout, mas removeu o status textual da aposta.
- Correcao: a linha da mesa voltou a exibir o status como primeiro item do
  valor, preservando `CASHED_OUT`, `LOST` e demais estados como informacao
  visivel e testavel.
- Regressao: o Playwright continua verificando que cashout aparece na tela apos
  o fluxo real no browser.
- Validacao: `bunx tsc --noEmit -p frontend/tsconfig.json`, `cd frontend &&
  bun test`, `cd frontend && bun run build` e `bun run test:e2e:browser`
  passaram depois da correcao.
- Status: resolvido.

### 40. Validacao mobile detectou overflow horizontal no Passo 12

- Contexto: validacao visual desktop/mobile apos reforcar a tela principal do
  jogo.
- Sintoma: a primeira checagem Playwright de mobile retornou `overflowX: true`
  com `scrollWidth` maior que `clientWidth`.
- Causa: os containers de grid e os textos monoespacados longos da formula/hash
  ainda nao forçavam `min-w-0` e quebra segura em todos os pontos necessarios.
- Correcao: adicionados `min-w-0` nos containers principais da dashboard,
  painel da rodada, grafico e cards, alem de quebra de texto nos hashes e na
  formula da curva.
- Regressao: a validacao visual mobile/desktop mede `overflowX` explicitamente.
- Validacao: `bunx tsc --noEmit -p frontend/tsconfig.json`, `cd frontend &&
  bun test`, `cd frontend && bun run build`, `bun run test:e2e:browser` e
  validacao visual mobile/desktop com `overflowX: false` passaram.
- Status: resolvido.

### 41. Script de validacao visual usou import e seletores incorretos

- Contexto: validacao visual final do Passo 12 via script Playwright inline.
- Sintoma: a primeira execucao falhou com `Cannot find package 'playwright'`
  e a segunda execucao reportou falsos negativos para timer e grafico.
- Causa: o projeto importa o runtime de browser por `@playwright/test`, e nao
  diretamente por `playwright`, e os seletores do script buscavam texto literal
  `Timer` e `aria-label` inexistente no SVG decorativo.
- Correcao: o script passou a importar `chromium` de `@playwright/test` e a
  validar os elementos pela estrutura/textos reais da UI autenticada.
- Regressao: a validacao visual mobile/desktop agora verifica heading, formula,
  ritmo, timer, curva SVG e ausencia de overflow horizontal.
- Validacao: o script Playwright corrigido passou para mobile `390x844` e
  desktop `1440x900` com `overflowX: false`.
- Status: resolvido.

### 42. E2E browser ficou ambiguo com duplicidade legitima de status

- Contexto: redesign Chrono Crash adicionou telemetria de rodape com status
  realtime alem do badge existente da rodada.
- Sintoma: `bun run test:e2e:browser` falhou em strict mode porque
  `getByText("LIVE")` e depois `getByText("BETTING")` passaram a encontrar
  duas ocorrencias visiveis; o mesmo ocorreu com o texto humano do ritmo da
  curva e com o heading legado `Crash Game`.
- Causa: o teste estava acoplado a uma unica ocorrencia visual de status,
  mas o redesign passou a exibir os mesmos dados reais em badge e telemetria.
- Correcao: o E2E agora valida a primeira ocorrencia visivel dos textos de
  status e usa o heading principal `Chrono Crash` para confirmar que a tela
  permanece renderizada apos cashout.
- Regressao: rerodar `bun run test:e2e:browser` apos a correcao.
- Validacao: `bun run test:e2e:browser` passou apos a correcao.
- Status: resolvido.

### 43. Rail mobile sobrepunha o palco Chrono Crash

- Contexto: validacao visual mobile do redesign Chrono Crash.
- Sintoma: o rail de navegacao fixo na parte inferior aparecia sobre o palco,
  cortando parte do multiplicador e do cockpit.
- Causa: o rail mobile usava `position: fixed`, o que nao reservava espaco no
  layout e sobrepunha conteudo essencial do jogo.
- Correcao: o shell mobile passou a usar layout em coluna e o rail ficou
  `sticky` no fluxo da pagina; no desktop ele continua como rail vertical.
- Regressao: rerodar validacao visual mobile/desktop com screenshot e
  `overflowX: false`.
- Validacao: script Playwright mobile/desktop passou com `overlapsStage:
  false` e `overflowX: false`.
- Status: resolvido.

### 44. Typecheck do redesign 3D falhou por tipos ausentes do Three.js

- Contexto: implementacao da arena 3D do Chrono Crash com Three.js.
- Sintoma: `bunx tsc --noEmit -p frontend/tsconfig.json` falhou com
  `Could not find a declaration file for module 'three'`.
- Causa: o pacote `three` foi adicionado ao workspace frontend, mas a
  resolucao TypeScript usada pelo Bun precisou de `@types/three` instalado
  explicitamente.
- Correcao: `@types/three` foi adicionado como dependencia de desenvolvimento
  do frontend.
- Regressao: rerodar `bunx tsc --noEmit -p frontend/tsconfig.json`.
- Validacao: `bunx tsc --noEmit -p frontend/tsconfig.json` passou.
- Status: resolvido.

### 45. Lint bloqueou uso inseguro de refs e state no componente Three.js

- Contexto: validacao `bun run lint` apos criar `CrashFlightScene`.
- Sintoma: ESLint reportou `react-hooks/refs` por atualizar `stateRef.current`
  durante render e `react-hooks/set-state-in-effect` por chamar
  `setFallbackVisible` diretamente dentro do effect.
- Causa: a cena Three.js precisa de estado mais recente dentro do
  `requestAnimationFrame`, mas a primeira implementacao sincronizava esse
  estado no corpo do componente; o fallback WebGL tambem atualizava state de
  forma sincronizada no effect.
- Correcao: mover a sincronizacao do estado da cena para um effect com
  dependencias e agendar a visibilidade do fallback fora do corpo imediato do
  effect.
- Regressao: rerodar `bun run lint`.
- Validacao: `bun run lint` passou.
- Status: resolvido.

### 46. Validacao visual mobile mostrou carro 3D cortado no palco

- Contexto: validacao visual Playwright mobile/desktop da arena Three.js.
- Sintoma: no screenshot mobile `390x844`, o carro procedural aparecia
  cortado no canto inferior esquerdo e os cards internos do palco reduziam a
  leitura da cena.
- Causa: a posicao inicial e a camera da cena foram calibradas primeiro para
  desktop; em viewport estreita, o aspect ratio cortava a esquerda da cena.
- Correcao: tornar a posicao/camera do carro responsiva ao aspect ratio e
  ocultar os cards internos do palco em viewport pequena, mantendo a mesma
  telemetria logo abaixo.
- Regressao: rerodar validacao Playwright mobile/desktop com canvas nonblank,
  `overflowX: false` e `actionOverlap: false`.
- Validacao: script Playwright mobile/desktop passou com `nonblankCanvas:
  true`, `hasOverflowX: false` e `actionOverlap: false`.
- Status: resolvido.

### 47. Comando auxiliar de healthcheck usou variavel reservada do zsh

- Contexto: espera do healthcheck do container `frontend` depois do rebuild.
- Sintoma: o shell retornou `zsh:1: read-only variable: status`.
- Causa: `status` e uma variavel especial/read-only do zsh, portanto nao pode
  ser usada como variavel local em inline shell.
- Correcao: repetir o comando usando outro nome de variavel.
- Regressao: rerodar a espera do healthcheck do frontend.
- Validacao: espera do healthcheck rerodada com `frontend_health` e retornou
  `frontend=healthy`.
- Status: resolvido.

### 48. Navegador embutido nao aceitou `networkidle` na validacao visual

- Contexto: verificacao visual final no navegador embutido do Codex.
- Sintoma: a automacao retornou `playwright_wait_for_load_state does not
  support networkidle`.
- Causa: a API Playwright exposta pelo navegador embutido suporta apenas parte
  da superficie upstream e rejeitou esse estado de load nessa sessao.
- Correcao: repetir a verificacao usando `load` e validacoes diretas de DOM e
  canvas.
- Regressao: rerodar a verificacao no navegador embutido.
- Validacao: verificacao no navegador embutido avancou com `load`; o erro de
  `networkidle` nao se repetiu.
- Status: resolvido.

### 49. Validacao do canvas no navegador embutido falhou com `instanceof`

- Contexto: verificacao visual final no navegador embutido do Codex.
- Sintoma: o evaluate retornou `TypeError: Right-hand side of 'instanceof' is
  not an object` ao testar `canvas instanceof HTMLCanvasElement`.
- Causa: o ambiente read-only de evaluate do navegador embutido nao expôs o
  construtor `HTMLCanvasElement` como objeto comparavel.
- Correcao: usar checagem estrutural por `tagName` e presenca de `toDataURL`.
- Regressao: rerodar a verificacao no navegador embutido.
- Validacao: verificacao no navegador embutido passou sem excecao e confirmou
  `hasCanvas: true`, `heading: true` e `overflowX: false`; pixel nonblank foi
  validado pelo Playwright local.
- Status: resolvido.

### 50. Modelo GLB do carro carregava com a dianteira invertida

- Contexto: integracao do asset `time-machine-low-poly.glb` na arena Three.js.
- Sintoma: o carro aparecia com a traseira apontando para a direcao de voo; a
  dianteira deveria ficar voltada para a direita da cena.
- Causa: o GLB importado usa orientacao local diferente da convencao da cena,
  que move o carro no eixo `+X`.
- Correcao: o adaptador do modelo passou a aplicar rotacao `Y = Math.PI` antes
  da normalizacao/centralizacao do GLB.
- Regressao: adicionado teste unitario garantindo que um marcador de dianteira
  termina com `x` maior que o marcador traseiro depois da preparacao do asset.
- Validacao: `bunx tsc --noEmit -p frontend/tsconfig.json`, `cd frontend &&
  bun test src/components/game/crash-flight-scene.test.ts`, `cd frontend &&
  bun run build`, `bun run test:e2e:browser`, `bun run lint`, `bun run
  check:types`, `bun run test:coverage && bun run quality:gate`, `docker
  compose config` e screenshot Playwright em
  `/tmp/chrono-crash-car-front-right.png` passaram.
- Status: resolvido.

### 51. E2E browser perdeu a janela de aposta ao validar canvas antes do bet

- Contexto: validacao browser apos corrigir a orientacao do GLB.
- Sintoma: `bun run test:e2e:browser` falhou aguardando o botao `Apostar`
  habilitado; a screenshot mostrava a rodada ja em `RUNNING`.
- Causa: o teste validava carregamento do GLB e pixels do canvas antes de
  enviar a aposta, consumindo a janela curta de `BETTING`.
- Correcao: o fluxo E2E passou a apostar primeiro, executar cashout em seguida
  e validar carregamento do asset/canvas depois do cashout.
- Regressao: `bun run test:e2e:browser` cobre novamente login, aposta,
  cashout, carregamento do GLB e canvas renderizado.
- Validacao: `bun run test:e2e:browser` passou.
- Status: resolvido.

### 52. Teste de componente React exigiu runner com DOM

- Contexto: Passo 13 do plano de execucao, ao adicionar testes renderizados da
  dashboard e dos controles de aposta.
- Sintoma: `cd frontend && bun test
  src/components/game/game-dashboard-shell.test.tsx` falhou com
  `ReferenceError: window is not defined` ao inicializar o cliente OIDC.
- Causa: o runner nativo do Bun nao fornece ambiente DOM/jsdom para testes de
  componentes React, enquanto os novos testes precisam renderizar a UI e
  disparar eventos de formulario. O script do pacote frontend ja usa Vitest,
  que suporta `@vitest-environment jsdom`.
- Correcao: adicionadas dependencias `@testing-library/react`,
  `@testing-library/dom` e `jsdom`; o script raiz `test:unit` passou a executar
  o frontend via `bun run test`, preservando Bun nos testes de backend e
  scripts.
- Regressao: os novos testes cobrem renderizacao da tela principal,
  normalizacao do input de aposta, estados habilitado/desabilitado de apostar e
  cashout, chamada das mutations e exibicao de erro de saldo insuficiente.
- Validacao: `cd frontend && bun run test
  src/components/game/game-dashboard-shell.test.tsx`, `cd frontend && bun run
  test`, `cd frontend && bun run build`, `bun run lint`, `bun run
  test:unit`, `bun run check:types`, `bun run test:coverage && bun run
  quality:gate`, `docker compose config`, `docker compose up -d --build`,
  `docker compose ps`, `bun scripts/ci/check-kong-health.ts`, `curl -fsS
  http://localhost:8000/` e `git diff --check` passaram.
- Status: resolvido.

### 53. Quality gate falhou apos redesign da arena 3D

- Contexto: fechamento do PR de refinamento visual da arena, assets GLB e
  animacao do fogo do carro.
- Sintoma: `bun run test:coverage && bun run quality:gate` falhou com queda de
  cobertura frontend e aumento do maior arquivo acima da baseline da catraca.
- Causa: a coreografia Three.js ficou concentrada em
  `crash-flight-scene.tsx`, e helpers novos estavam pouco cobertos.
- Correcao: extraidos `crash-flight-motion.ts`, `crash-flight-fallback.tsx` e
  `time-car-fire.ts`; adicionados testes unitarios para fases, easing,
  progresso, FOV, shake e pulsacao do fogo.
- Regressao: a catraca agora valida cobertura frontend, tamanho maximo de
  arquivo, duplicacao e auditoria antes do PR.
- Validacao: `bun run test:coverage && bun run quality:gate` passou com
  cobertura global `77.17%`, cobertura frontend `74.88%`, maior arquivo em
  `269` linhas e sem falhas.
- Status: resolvido.

### 54. Healthcheck de observabilidade encontrou stack local desatualizada

- Contexto: Task 8 do bonus Observabilidade, ao validar o novo script
  `scripts/ci/check-observability-health.ts` e o E2E
  `services/games/tests/e2e/observability.e2e.test.ts`.
- Sintoma: `bun scripts/ci/check-observability-health.ts` falhou em
  `http://localhost:8000/games/metrics` com `404 Not Found` e body
  `{"message":"Cannot GET /metrics","error":"Not Found","statusCode":404}`.
  O E2E de observabilidade tambem chegou ao cashout, mas falhou aguardando a
  mesma rota `/games/metrics`.
- Causa: a stack local ainda estava com containers/Kong da configuracao
  anterior, sem as novas rotas publicas `/games/metrics` e `/wallets/metrics`
  nem os servicos Prometheus, Grafana e Jaeger recriados.
- Correcao: recriar a stack completa com `docker compose up -d --build` antes
  da validacao final de observabilidade, garantindo que Kong, Games, Wallets e
  os servicos de observabilidade usem a configuracao atual.
- Validacao: `docker compose up -d --build` recriou a stack com
  Prometheus, Grafana, Jaeger e OpenTelemetry Collector; `bun
  scripts/ci/check-observability-health.ts` passou; `cd services/games && bun
  test tests/e2e/observability.e2e.test.ts` passou dentro do E2E completo.
- Status: resolvido.

### 55. Pull inicial das imagens de observabilidade ficou sem progresso

- Contexto: Task 10 do bonus Observabilidade, durante o primeiro
  `docker compose up -d --build` com Prometheus, Grafana, Jaeger e
  OpenTelemetry Collector.
- Sintoma: o comando ficou mais de seis minutos em `Pulling` para as imagens
  de observabilidade sem baixar camadas nem criar imagens locais. Tentativas
  sequenciais com `docker pull prom/prometheus:v3.0.1` e com imagem equivalente
  do Quay tambem ficaram sem progresso visivel.
- Causa: o cliente/daemon Docker local entrou em estado travado no caminho de
  pull. A conectividade HTTP com Docker Hub e Quay respondia, indicando que o
  problema nao era indisponibilidade de rede externa.
- Correcao: encerrar os clientes `docker compose`/`docker pull` travados e
  reiniciar o Docker Desktop com `docker desktop restart`.
- Validacao: apos o restart, `docker pull prom/prometheus:v3.0.1` concluiu, e
  `docker compose up -d --build` puxou as imagens restantes, buildou
  `games`, `wallets` e `frontend`, e subiu a stack completa.
- Status: resolvido.

### 56. Quality gate falhou apos extracao inicial de Outbox/Inbox

- Contexto: bonus Outbox/Inbox transacional, apos implementar outbox no
  servico `games`, inbox no servico `wallets` e E2E Docker/Postgres para
  idempotencia de comandos financeiros.
- Sintoma: `bun run test:coverage && bun run quality:gate` passou todos os
  testes de cobertura, mas falhou na catraca de qualidade. Primeiro por
  aumento de duplicacao (`duplicatedLines` 293 contra baseline 250, `clones`
  16 contra baseline 15) e maior arquivo (`advance-round-lifecycle.use-case.ts`
  com 290 linhas contra baseline 269). Apos a primeira correcao, a duplicacao
  passou, mas `app.module.ts` virou o maior arquivo com 279 linhas.
- Causa: a logica de credito de cashout via outbox estava duplicada entre
  cashout manual e auto cashout/retry, os mapeamentos Prisma de outbox estavam
  repetidos entre repositorios, e o provider Nest do servico extraido ficou
  inline em `app.module.ts`.
- Correcao: extrair `CashoutCreditService` para compartilhar o fluxo de credito
  de cashout, extrair mapper Prisma de outbox, consolidar dados de persistencia
  de round/bet e mover o provider Nest do servico para
  `cashout-credit-service.provider.ts`.
- Validacao: `cd services/games && bun test
  tests/unit/application/game-use-cases.test.ts`, `cd services/games && bun
  test tests/unit/infrastructure/wallet-outbox-dispatcher.test.ts
  tests/unit/infrastructure/rabbitmq-wallet-client.test.ts`, `bun run
  check:types` e `bun run quality:gate` passaram. O quality gate voltou para
  `duplicatedLines` 236, `clones` 12 e maior arquivo no baseline de 269 linhas.
- Status: resolvido.

### 57. Audit encontrou vulnerabilidade alta no OpenTelemetry Prometheus exporter

- Contexto: babysit do PR #16, apos o quality gate reportar o warning
  `security.high` com duas ocorrencias.
- Sintoma: `bun audit --json` reportou a CVE-2026-44902 /
  GHSA-q7rr-3cgh-j5r3 em `@opentelemetry/exporter-prometheus@0.57.2` e
  `@opentelemetry/sdk-node@0.57.2`.
- Causa: a versao instalada do `@opentelemetry/sdk-node` trazia o exporter
  Prometheus vulneravel a crash de processo por request HTTP malformada.
- Correcao: atualizar os pacotes OpenTelemetry dos servicos `games` e
  `wallets` para a linha corrigida `0.218.0`/`2.7.1`, e trocar a criacao de
  resource de tracing para `resourceFromAttributes`, API recomendada pela
  versao atual.
- Validacao: `bun audit --json` retornou `{}`; `bun run lint`,
  `bun run check:types`, `bun run test:unit`,
  `bun run test:coverage && bun run quality:gate`, `docker compose config`,
  `docker compose up -d --build`, `bun scripts/ci/check-kong-health.ts`,
  `bun scripts/ci/check-observability-health.ts`,
  `cd services/games && bun run test:e2e` e `bun run test:e2e:browser`
  passaram.
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
- Passo 11 focado:
  `cd frontend && bun test`, `bunx tsc --noEmit -p frontend/tsconfig.json`,
  `cd services/games && bun test tests/unit` e
  `bunx tsc --noEmit -p services/games/tsconfig.json`.
- Passo 11 catraca:
  `bun run test:coverage && bun run quality:gate`.
- Passo 11 completo:
  `cd frontend && bun run build`, `bun run ci:local`, `bun run ci:e2e` e
  validacao visual/browser em duas abas em `http://localhost:8000/`, ambas com
  badge `LIVE` e a mesma rodada.
- Bonus focado:
  `bunx tsc --noEmit -p frontend/tsconfig.json`, `cd frontend && bun test`,
  `bunx tsc --noEmit -p services/games/tsconfig.json`,
  `bunx tsc --noEmit -p tsconfig.quality.json`, `bun run e2e:prepare
  clean-betting`, `cd services/games && bun test
  tests/e2e/deterministic-seed.e2e.test.ts` e `cd services/games && bun test
  tests/e2e/rate-limiting.e2e.test.ts`.
- Bonus Playwright:
  `bunx playwright install chromium`, `cd frontend && bun run build` e
  `docker compose up -d --build && bun scripts/ci/check-kong-health.ts && bun
  run test:e2e:browser`.
- Bonus final:
  `bun run ci:local`, `bun run ci:e2e`, `bun run test:e2e:browser` e validacao
  visual mobile/desktop via Playwright com formula da curva e `overflowX:
  false`.
- Passo 12 focado:
  `bunx tsc --noEmit -p frontend/tsconfig.json`, `cd frontend && bun test`,
  `cd frontend && bun run build`, `git diff --check` e `bun run test:coverage
  && bun run quality:gate`.
- Passo 12 browser:
  `docker compose up -d --build frontend`, `bun run test:e2e:browser` e script
  Playwright mobile/desktop validando curva, timer, formula e ausencia de
  overflow horizontal.
- Passo 12 final:
  `bun run ci:local`, `bun run ci:e2e`, `bun run test:e2e:browser` e script
  Playwright mobile/desktop corrigido validando curva, timer, formula, ritmo e
  ausencia de overflow horizontal.
- Redesign Chrono Crash:
  `bunx tsc --noEmit -p frontend/tsconfig.json`, `cd frontend && bun test`,
  `cd frontend && bun run build`, `bun run lint`, `bun run test:coverage &&
  bun run quality:gate`, `docker compose config`, `docker compose up -d
  --build frontend`, `bun run test:e2e:browser` e script Playwright
  mobile/desktop validando cockpit, curva, mesa, historico, botoes, formula,
  `overlapsStage: false` e `overflowX: false`.
- Redesign Chrono Crash final:
  `bun run ci:local`, `bun run ci:e2e`, `bun run test:e2e:browser` e script
  Playwright final em mobile `390x844` e desktop `1440x900` validando
  `hasStage`, `hasCurve`, `hasActions`, `hasTables`, `overlapsStage: false`
  e `overflowX: false`.
- Passo 13 frontend:
  `cd frontend && bun run test src/components/game/game-dashboard-shell.test.tsx`,
  `cd frontend && bun run test`, `cd frontend && bun run build`, `bun run
  lint`, `bun run test:unit`, `bun run check:types`, `bun run test:coverage
  && bun run quality:gate`, `docker compose config`, `docker compose up -d
  --build`, `docker compose ps`, `bun scripts/ci/check-kong-health.ts`, `curl
  -fsS http://localhost:8000/` e `git diff --check`.
- Refinamento visual da arena:
  `bun run lint`, `bun run check:types`, `bun run test:unit`, `cd frontend &&
  bun run build`, `bun run test:coverage && bun run quality:gate`, `docker
  compose config`, `git diff --check`, `docker compose up -d --build`, `curl
  -fsS http://localhost:8000/` e `bun run test:e2e:browser`.
- Passo 15 OpenAPI:
  `bun run lint`, `bun run check:types`, `bun run test:unit`, `docker compose
  config`, `git diff --check`, `docker compose up -d --build`, `bun
  scripts/ci/check-kong-health.ts`, `cd services/games && bun test tests/e2e`,
  `curl -fsS http://localhost:4001/docs`, `curl -fsS
  http://localhost:4002/docs`, `curl -fsS http://localhost:4001/docs-json` e
  `curl -fsS http://localhost:4002/docs-json`.

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

- Proximo passo do plano: Passo 14, adicionar E2E browser se viavel.
