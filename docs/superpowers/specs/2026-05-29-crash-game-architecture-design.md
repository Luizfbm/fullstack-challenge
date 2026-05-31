# Crash Game - Architecture Design

Data: 2026-05-29

## Objetivo

Este documento registra as decisoes arquiteturais para implementar o desafio
full-stack Crash Game seguindo o README do projeto.

A entrega deve ser enxuta, completa e defensavel: cumprir os requisitos
obrigatorios, evitar superengenharia e deixar claras as decisoes tecnicas,
trade-offs e limites conhecidos.

Nao trataremos a entrega como "MVP incompleto". A meta e um vertical slice
funcional ponta a ponta cobrindo autenticacao, carteira, aposta, rodada,
cashout/crash, liquidacao, realtime, historico, provably fair, Docker e testes.

## Leitura do README

O README pede um sistema full-stack com:

- dois servicos separados: Game Service e Wallet Service;
- backend em NestJS com TypeScript;
- PostgreSQL como banco de dados;
- comunicacao entre servicos via RabbitMQ/SQS;
- Kong como API Gateway;
- Keycloak/Auth0/Okta como IdP, com backend validando JWTs;
- WebSocket para sincronizacao em tempo real;
- frontend React/Next/Vite/TanStack Start;
- dinheiro sem ponto flutuante;
- algoritmo provably fair verificavel com hash chain, commit/reveal, HMAC,
  seeds e house edge;
- testes unitarios e E2E;
- `bun run docker:up` subindo a aplicacao sem passos manuais.

Tambem ha uma aparente tensao no texto: o README diz que autenticacao nao faz
parte do escopo, mas os criterios eliminatorios exigem IdP e validacao de JWT
no backend. A interpretacao adotada e: nao construiremos autenticacao propria,
mas integraremos Keycloak e validaremos tokens JWT nos endpoints protegidos.

## Decisao Arquitetural Principal

Implementaremos uma arquitetura com dois servicos NestJS, banco separado por
servico, RabbitMQ request/reply para operacoes financeiras interativas, Wallet
como unica dona do saldo, Game como dono da rodada, WebSocket no Game para
sincronizacao, dinheiro em centavos, multiplicador em basis points, provably
fair com hash chain + commit/reveal, frontend Vite SPA e testes focados nos
fluxos eliminatorios.

Essa abordagem segue o README e e otimizada para entrega real: simples de
implementar, simples de testar e simples de defender em arguição tecnica.

## Stack

- Runtime: Bun.
- Backend: NestJS + TypeScript.
- ORM: Prisma.
- Banco: PostgreSQL, com um banco para `games` e outro para `wallets`.
- Mensageria: RabbitMQ.
- API Gateway: Kong.
- IdP: Keycloak.
- WebSocket: Socket.IO via `@nestjs/websockets`.
- Frontend: Vite + React.
- UI: Tailwind CSS v4 + shadcn/ui.
- Estado frontend: TanStack Query para server state e Zustand para estado
  realtime/local.
- Testes backend: Bun test.
- Testes frontend: Vitest.
- Documentacao API: Swagger/OpenAPI.

Prisma foi escolhido pela produtividade, tipagem, migrations e baixo risco de
integracao no prazo do desafio. Os dois servicos devem expor Swagger/OpenAPI
com `@nestjs/swagger`, cobrindo os endpoints publicos e protegidos.

## Bounded Contexts

### Game Service

Responsavel por:

- ciclo de vida das rodadas;
- regras de aposta;
- cashout;
- calculo do multiplicador;
- provably fair;
- historico de rodadas;
- historico de apostas;
- WebSocket para clientes.

O Game Service nao acessa o banco do Wallet Service e nao altera saldo
diretamente.

### Wallet Service

Responsavel por:

- criacao de carteira;
- consulta de saldo;
- debitos;
- creditos;
- ledger/transacoes financeiras;
- idempotencia das operacoes financeiras.

O Wallet Service e o unico dono do saldo. Ele nao conhece regra de rodada,
crash point ou status de jogo.

## Modelo de Dinheiro

Valores monetarios serao representados em centavos inteiros.

Exemplos:

- `100` representa `1.00`;
- `100000` representa `1000.00`;
- aposta minima: `100`;
- aposta maxima: `100000`.

O banco deve usar `BIGINT` para valores monetarios. O dominio nao deve usar
ponto flutuante para dinheiro.

Multiplicadores serao representados em basis points:

- `10000` representa `1.00x`;
- `25000` representa `2.50x`;
- `100000` representa `10.00x`.

Payout:

```text
payoutCents = floor(amountCents * multiplierBp / 10000)
```

O arredondamento sera explicito e sempre para baixo.

## Game Service - Modelo Inicial

### Round

Campos principais:

- `id`;
- `status`: `BETTING`, `RUNNING`, `CRASHED`, `SETTLED`;
- `bettingStartsAt`;
- `bettingEndsAt`;
- `startedAt`;
- `crashedAt`;
- `crashPointBp`;
- `serverSeedHash`;
- `serverSeed`;
- `clientSeed`;
- `nonce`.

### Bet

Campos principais:

- `id`;
- `roundId`;
- `playerId`;
- `username`;
- `amountCents`;
- `status`: `ACCEPTED`, `REJECTED`, `CASHOUT_PENDING_CREDIT`,
  `CASHED_OUT`, `LOST`;
- `cashoutMultiplierBp`;
- `payoutCents`;
- `rejectionReason`.

### Casos de Uso

- obter rodada atual;
- listar historico de rodadas;
- verificar rodada provably fair;
- listar minhas apostas;
- apostar;
- fazer cashout;
- executar ciclo de rodada;
- liquidar rodada.

## Wallet Service - Modelo Inicial

### Wallet

Campos principais:

- `id`;
- `playerId`;
- `balanceCents`;
- `createdAt`;
- `updatedAt`.

### WalletTransaction

Campos principais:

- `id`;
- `walletId`;
- `type`: `DEBIT`, `CREDIT`;
- `amountCents`;
- `reason`: `BET_PLACED`, `CASHOUT_PAYOUT`, `INITIAL_GRANT`;
- `referenceId`;
- `createdAt`.

`referenceId` deve ser unico para proteger contra processamento duplicado de
mensagens.

## Comunicacao entre Servicos

Usaremos RabbitMQ para comunicacao entre Game e Wallet.

Para operacoes financeiras interativas, como aposta e cashout, adotaremos
request/reply com timeout curto. Isso mantem a comunicacao entre servicos via
broker, sem expor a Wallet por HTTP para o Game, e ainda permite resposta
imediata ao usuario.

### Comandos

- `wallet.debit`
- `wallet.credit`

### Respostas

- `wallet.debit.result`
- `wallet.credit.result`

### Justificativa

O README exige comunicacao assincrona via RabbitMQ/SQS. Request/reply sobre
RabbitMQ continua usando mensagens e broker, mas oferece semantica interativa
na borda HTTP. Esta e uma escolha pragmatica para reduzir complexidade de
frontend e facilitar a experiencia de aposta/cashout.

## Fluxo de Aposta

1. Frontend chama `POST /games/bet`.
2. Game valida JWT, fase da rodada, valor minimo/maximo e aposta duplicada.
3. Game envia `wallet.debit` ao RabbitMQ.
4. Wallet valida saldo e idempotencia.
5. Wallet registra transacao de debito.
6. Wallet responde `wallet.debit.result`.
7. Game cria a aposta como `ACCEPTED` ou retorna erro.
8. Game emite evento WebSocket para atualizar a rodada.

## Fluxo de Cashout

1. Frontend chama `POST /games/bet/cashout`.
2. Game valida JWT, rodada ativa e aposta aceita ainda sem cashout.
3. Game calcula o multiplicador atual.
4. Game calcula `payoutCents`.
5. Game marca a aposta como `CASHOUT_PENDING_CREDIT`.
6. Game envia `wallet.credit` ao RabbitMQ.
7. Wallet registra credito idempotente.
8. Wallet responde `wallet.credit.result`.
9. Game marca aposta como `CASHED_OUT`.
10. Game emite evento WebSocket.

Se o credito falhar por timeout apos a validacao do cashout, o Game deve
preservar `CASHOUT_PENDING_CREDIT` e executar retry interno. Isso evita que o
jogador perca um cashout validado por uma falha temporaria de mensageria ou
Wallet.

## Provably Fair

Adotaremos hash chain + commit/reveal.

Antes do jogo operar, o Game Service gera uma cadeia de seeds. Uma forma
simples e verificavel:

1. Gerar uma seed final aleatoria segura.
2. Aplicar `sha256` repetidamente para montar uma cadeia.
3. Usar uma seed diferente da cadeia por rodada.
4. Antes da rodada, publicar apenas o commitment da seed da rodada:
   `serverSeedHash = sha256(serverSeed)`.
5. Calcular o crash point de forma deterministica com
   `HMAC_SHA256(serverSeed, clientSeed:nonce)`.
6. Ao final da rodada, revelar `serverSeed`.
7. O jogador verifica:
   - se `sha256(serverSeed)` bate com o hash publicado antes da rodada;
   - se a seed revelada pertence a sequencia esperada da hash chain;
   - se o crash point recalculado bate com o resultado da rodada.

O crash point fica determinado antes da rodada aceitar apostas, mas oculto ate
o fim da rodada. Isso impede manipulacao apos observar apostas ou cashouts.

Dados de verificacao:

- `serverSeedHash`;
- `serverSeed`;
- `clientSeed`;
- `nonce`;
- `chainIndex`;
- `nextServerSeedHash`, quando aplicavel;
- `algorithm`;
- `houseEdge`;
- `crashPoint`.

A house edge sera documentada e aplicada no calculo. Para o desafio, usaremos
uma house edge simples e explicita, por exemplo `1%`, com testes garantindo que
o calculo seja deterministico.

## API REST

Endpoints publicos:

- `GET /games/rounds/current`;
- `GET /games/rounds/history`;
- `GET /games/rounds/:roundId/verify`.

Endpoints protegidos por JWT:

- `POST /wallets`;
- `GET /wallets/me`;
- `GET /games/bets/me`;
- `POST /games/bet`;
- `POST /games/bet/cashout`.

O `playerId` sera extraido do `sub` do JWT. O `username` sera extraido de
`preferred_username`.

## WebSocket

O WebSocket sera responsabilidade do Game Service. Ele sera usado apenas para
push server-to-client, conforme o README. Todas as acoes do jogador continuam
via REST.

Eventos iniciais:

- `round.betting_started`;
- `round.started`;
- `round.tick`;
- `round.crashed`;
- `round.settled`;
- `bet.placed`;
- `bet.cashed_out`.

O frontend deve animar o multiplicador com base em `startedAt` e nos ticks do
servidor, evitando depender de uma frequencia muito alta de eventos.

## Frontend

Usaremos Vite + React porque o jogo e uma SPA em tempo real e nao precisa de
SSR para cumprir o desafio.

Telas/componentes principais:

- login via Keycloak;
- callback OIDC;
- tela principal do jogo;
- grafico do crash;
- controles de aposta;
- botao de cashout;
- lista de apostas da rodada;
- historico de rounds;
- saldo do jogador;
- toasts de erro;
- indicador de conexao realtime.

TanStack Query sera usado para REST. Zustand sera usado para estado realtime
recebido via WebSocket.

O frontend deve usar Tailwind CSS v4 e shadcn/ui, conforme o README. A escolha
por Vite + React permanece por ser uma SPA realtime sem necessidade de SSR.

## Testes

Testes unitarios obrigatorios:

- ciclo de vida de `Round`;
- validacao e transicoes de `Bet`;
- debito, credito, saldo insuficiente e idempotencia em `Wallet`;
- calculo deterministico de provably fair;
- calculo monetario sem ponto flutuante.

Testes E2E obrigatorios:

- criar wallet, apostar, cashout e verificar saldo atualizado;
- apostar e perder apos crash;
- rejeitar saldo insuficiente;
- rejeitar aposta duplicada;
- rejeitar aposta fora da fase de apostas.

Testes frontend:

- renderizacao da tela principal;
- validacao do formulario de aposta;
- estados habilitado/desabilitado de apostar e cashout.

## Docker, Migrations e Setup

`bun run docker:up` deve subir tudo sem passos manuais:

- Postgres;
- RabbitMQ;
- Keycloak com realm importado;
- Kong com rotas declarativas;
- Game Service;
- Wallet Service;
- Frontend.

Isso inclui:

- criar os bancos `games` e `wallets`;
- aplicar migrations do Prisma do Game Service;
- aplicar migrations do Prisma do Wallet Service;
- importar o realm do Keycloak;
- configurar rotas declarativas do Kong;
- subir RabbitMQ com credenciais locais;
- subir o frontend na porta `3000`;
- deixar `http://localhost:8000` como entrada principal via Kong;
- deixar os healthchecks funcionando sem depender de ferramentas ausentes na
  imagem Docker;
- criar ou garantir um usuario de teste com wallet e saldo inicial.

Arquivos `.env` necessarios aos containers devem ser versionados como valores
locais de desenvolvimento, gerados automaticamente no build/startup, ou
substituidos por variaveis declaradas diretamente no Compose. A entrega nao
deve exigir copiar `.env.example` manualmente antes de `bun run docker:up`.

### Migrations Prisma

Cada servico tera seu proprio schema Prisma e suas proprias migrations:

- `services/games/prisma/schema.prisma`;
- `services/wallets/prisma/schema.prisma`.

No container, antes de iniciar a aplicacao, cada servico deve executar as
migrations correspondentes, por exemplo com `prisma migrate deploy`, e depois
subir o servidor NestJS.

O fluxo precisa funcionar tanto em ambiente limpo quanto apos reiniciar os
containers.

### Seed de desenvolvimento

O usuario de teste do Keycloak e `player` / `player123`. Para cumprir o README,
esse usuario deve ter uma carteira com saldo inicial.

Decisao: em ambiente local/desafio, criaremos uma wallet para o `sub` do
usuario `player` com saldo inicial de `100000` centavos (`1000.00`).

Justificativa:

- permite testar apostas pequenas e grandes sem precisar de top-up manual;
- cobre a aposta maxima definida no README (`1000.00`);
- simplifica E2E e demonstracao;
- e claramente valor de desenvolvimento, nao regra de producao.

Esse seed deve ser idempotente: rodar novamente nao pode duplicar wallet nem
creditar saldo repetidamente.

## Git

O README avalia historico Git com peso de 10%. O criterio descrito e:

- commits atomicos;
- mensagens claras;
- progressao logica.

Tambem exige repositorio publico na entrega.

Estrategia adotada:

- um commit para ajustes de base/infra;
- um commit para dominio compartilhado ou primitives;
- um commit para Wallet Service;
- um commit para Game Service;
- um commit para RabbitMQ/integracao;
- um commit para autenticacao;
- um commit para WebSocket;
- um commit para frontend;
- um commit para testes;
- um commit final para README/documentacao.

As mensagens devem ser objetivas, por exemplo:

- `chore: fix docker compose startup`;
- `feat(wallets): add wallet ledger and idempotent operations`;
- `feat(games): add round lifecycle and betting rules`;
- `feat(games): add provably fair crash calculation`;
- `feat(frontend): add crash game screen`;
- `test: cover required game and wallet flows`;
- `docs: explain architecture decisions and trade-offs`.

Nao devemos fazer um unico commit gigante. A progressao do historico deve
contar a historia da implementacao.

## Trade-offs

### Adotado

- Request/reply via RabbitMQ para operacoes financeiras interativas.
- Idempotencia basica via `referenceId` unico em transacoes da Wallet.
- Vite SPA em vez de Next.js para reduzir complexidade.
- Prisma para produtividade e menor risco.

### Nao adotado no escopo principal

- Outbox/inbox transacional completa.
- Observabilidade com Prometheus/Grafana.
- Auto bet.
- Auto cashout.
- Leaderboard.
- Storybook.
- Playwright.

Esses itens podem ser documentados como proximos passos ou bonus futuros.

## Riscos e Mitigacoes

- Risco: RabbitMQ request/reply ser visto como menos assincrono.
  Mitigacao: documentar que a comunicacao inter-servicos segue via broker e que
  a escolha foi feita para comandos interativos com timeout.

- Risco: dinheiro tratado acidentalmente como float.
  Mitigacao: criar value objects e testes especificos para calculos monetarios.

- Risco: WebSocket divergir entre abas.
  Mitigacao: estado do servidor como fonte da verdade, com `startedAt` e ticks
  periodicos.

- Risco: escopo estourar.
  Mitigacao: priorizar eliminatorios do README e deixar bonus fora do caminho
  critico.

## Criterio de Pronto

A implementacao sera considerada pronta quando:

- `bun run docker:up` subir tudo;
- jogador conseguir autenticar;
- jogador conseguir criar/consultar wallet;
- jogador conseguir apostar;
- rodada executar com multiplicador em tempo real;
- jogador conseguir cashout;
- aposta sem cashout perder no crash;
- saldo for debitado/creditado corretamente;
- historico de rodadas aparecer;
- endpoint de verificacao provably fair funcionar;
- multiplas abas receberem o mesmo estado via WebSocket;
- testes unitarios e E2E obrigatorios passarem;
- README explicar setup, arquitetura, trade-offs e testes.
