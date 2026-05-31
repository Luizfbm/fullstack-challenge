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

## Validacoes de Regressao Ja Executadas

- `bun install`
- `bunx tsc --noEmit -p services/games/tsconfig.json`
- `bunx tsc --noEmit -p services/wallets/tsconfig.json`
- `bun test tests/unit` em `services/games`
- `bun test tests/unit` em `services/wallets`
- `bun run build` em `frontend`
- `prisma validate` nos schemas dos servicos
- `bun run db:generate` nos servicos
- `docker compose config`
- `docker compose up -d --build`
- Fluxo E2E autenticado via Kong com Keycloak real:
  `POST /games/bet`, `POST /games/bet/cashout`, `GET /wallets/me`,
  `GET /games/bets/me?limit=1` e `GET /games/rounds/history?limit=1`

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

## Validacoes Ainda Pendentes

- E2E WebSocket completo ainda sera criado no Passo 7 do plano de execucao.
- Validacao browser/frontend real ainda depende dos passos de frontend.
