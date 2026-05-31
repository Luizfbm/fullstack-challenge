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

## Validacoes Docker Ja Executadas

- `docker info`
- `docker compose build games wallets frontend`
- `docker compose up -d`
- `docker compose ps`
- `GET /games/health` via Kong
- `GET /wallets/health` via Kong
- `POST /wallets` e `GET /wallets/me` via Kong com token real do Keycloak

## Validacoes Ainda Pendentes

- testes E2E automatizados que dependem dos containers ativos ainda serao
  criados em corte posterior.
