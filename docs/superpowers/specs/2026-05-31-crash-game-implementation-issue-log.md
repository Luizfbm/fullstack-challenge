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
- Validacao: `docker compose config` passou. Validacao runtime ainda depende de
  Docker daemon ativo.
- Status: monitorar.

### 5. Docker daemon nao estava ativo

- Contexto: tentativa de validar build e subida dos containers.
- Sintoma: `docker info` falhou com erro de conexao ao Docker daemon.
- Causa: Docker Desktop/daemon nao estava aberto no ambiente local.
- Correcao: pendente de abrir/iniciar Docker Desktop.
- Validacao pendente: executar `docker info`, `docker compose build` e
  `bun run docker:up`.
- Nova tentativa em 2026-05-31: `docker info` ainda falhou com
  `failed to connect to the docker API`, indicando daemon indisponivel.
- Status: pendente.

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

## Validacoes Pendentes Quando Docker Estiver Ativo

- `docker info`
- `docker compose build games wallets frontend`
- `bun run docker:up`
- testes E2E que dependem dos containers ativos
