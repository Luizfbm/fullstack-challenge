# Premium Arcade Casino Responsive Redesign

## Status

Design aprovado em 2026-06-03.

Esta spec define o redesenho responsivo e visual da tela principal do Chrono
Crash. Ela nao autoriza alterar `README.md`, nao altera as docs antigas nao
rastreadas e nao substitui os requisitos existentes do README/specs.

## Contexto

O README exige uma UI responsiva para desktop e mobile, animacoes, estetica de
cassino, loading states e experiencia de jogo clara. A implementacao atual
cumpre a maior parte do fluxo funcional, mas a tela ainda comunica mais
"dashboard sci-fi/arcade tecnico" do que "cassino premium".

Auditoria visual atual mostrou:

- uso dominante de ciano/rose e paineis tecnicos;
- palco visual forte, mas pouca linguagem de mesa de aposta;
- cashier ficando abaixo do palco em larguras intermediarias;
- mobile com risco de acao principal ficar longe ou alta demais;
- cards antigos de metricas ja removidos e nao devem voltar.

## Objetivo

Melhorar responsividade desktop/mobile e estetica de cassino da tela principal,
mantendo o comportamento funcional existente de login, aposta, cashout,
auto cashout, auto bet, historico, leaderboard e evidencias tecnicas.

## Decisoes Aprovadas

### Direcao Geral: Mesa Primeiro

A tela deve parecer uma mesa premium de crash game:

- palco da rodada como espetaculo central;
- bet slip como area de decisao rapida;
- historico como chips de cassino;
- leaderboard como placar/ranking;
- paineis tecnicos discretos, sem competir com a aposta.

Esta direcao foi escolhida sobre alternativas mais cinematograficas ou densas
porque prioriza jogabilidade, clareza e responsividade.

### Mobile: Dock Compacto Sticky

No mobile, a acao principal precisa ficar ao alcance do jogador.

O mobile deve oferecer:

- dock compacto e sticky para aposta/cashout;
- valor da aposta e presets essenciais no dock;
- botao principal sempre claro;
- painel completo de configuracao como area expandida ou fluxo secundario;
- palco e acao principal visiveis sem excesso de scroll inicial.

O painel completo de aposta continua existindo, mas nao deve ocupar toda a
primeira experiencia mobile quando uma versao compacta resolver o fluxo rapido.

### Tablet/Desktop: Duas Colunas a partir de 1024px

A partir de `lg` (`1024px`), o layout deve colocar palco e cashier lado a lado.

Motivo:

- a largura intermediaria atual ainda empurra o cashier abaixo do palco;
- jogar crash exige acao rapida;
- laptop/tablet landscape devem se comportar mais como desktop operacional;
- o scroll vertical deve ser reduzido antes de `xl`.

Desktop amplo pode manter sidebar/rail mais completo, mas o salto principal
para duas colunas deve acontecer em `lg`.

### Estetica: Felt Green + Gold

A linguagem visual aprovada e premium arcade casino:

- base escura/OLED;
- verde felt para superficies de mesa e aposta;
- dourado/amber para valor, historico, ranking e destaque premium;
- verde/emerald para ganho, saldo positivo, cashout e apostar;
- vermelho/rose apenas para crash, risco e erro;
- ciano reservado para tecnologia, provably fair e evidencias tecnicas.

A UI deve evitar que ciano/rose continuem dominando a experiencia inteira.

## Escopo

Incluido:

- atualizar responsividade do `GameDashboardShell`;
- ajustar o breakpoint principal de layout para `lg` onde fizer sentido;
- criar ou adaptar modo compacto mobile do cashier/bet controls;
- refinar `BetControlsPanel` como bet slip premium;
- refinar `RoundHistoryPanel` para chips de cassino;
- refinar `LeaderboardPanel` como placar premium;
- ajustar tokens/classes globais de estilo em `frontend/src/styles.css`;
- manter palco 3D responsivo e visualmente integrado a mesa;
- manter paineis tecnicos acessiveis, mas visualmente secundarios;
- atualizar testes unitarios e browser E2E conforme a nova hierarquia.

Fora de escopo:

- mudar regra de jogo, multiplicador, provably fair ou lifecycle;
- alterar contratos backend;
- alterar `README.md`;
- recriar landing page;
- adicionar sons;
- adicionar Storybook;
- reintroduzir cards antigos de metricas;
- trocar stack de UI.

## Regras de Compatibilidade

Nao reintroduzir:

- card `LIVE`;
- `metric-rodada`;
- `metric-saldo`;
- grid antigo de metricas.

Manter:

- saldo no header em `aria-label="Conta do jogador"`;
- estado de rodada no palco, como `connected BETTING`;
- countdown em `BETTING` com `Rodada inicia em`;
- browser E2E usando a UI atual e API publica para validar rodada preparada;
- ausencia de overflow horizontal em mobile e desktop.

## Design de Layout

### Mobile

Ordem esperada:

1. header compacto com jogador/saldo;
2. historico em chips horizontais;
3. palco da rodada;
4. dock compacto de aposta/cashout;
5. leaderboard mobile;
6. provably fair, round state e mesa.

O dock compacto deve:

- ser legivel em `390px`;
- ter alvos de toque confortaveis;
- nao cobrir conteudo essencial sem reserva visual;
- deixar claro se a acao primaria e `Apostar` ou `Cash Out`;
- permitir acesso ao painel completo de configuracoes.

### Tablet e Desktop Medio (`lg`)

Ordem esperada:

- coluna principal: historico, palco, tabs tecnicas;
- coluna lateral: cashier/bet slip e leaderboard;
- palco e cashier visiveis juntos acima da dobra sempre que a altura permitir.

### Desktop Amplo

O desktop amplo pode manter a organizacao mais rica:

- palco com maior respiro;
- cashier e leaderboard em rail lateral;
- tabs tecnicas abaixo do palco ou em area secundaria;
- sem duplicar formulario de aposta.

## Design Visual

### Tokens

Os estilos devem migrar para tokens semanticamente ligados ao cassino:

- `felt`: verde escuro de mesa;
- `gold`: destaque premium, historico e ranking;
- `win`: verde de ganho;
- `risk`: vermelho de crash/erro;
- `tech`: ciano reservado para provas e telemetria;
- `surface`: paineis escuros de alto contraste.

### Componentes

`BetControlsPanel`:

- deve parecer bet slip, nao card tecnico;
- botao primario em verde forte para apostar/cashout elegivel;
- estados bloqueados claros;
- valor em reais destacado;
- presets com cara de chips;
- auto cashout e auto bet visiveis, mas sem competir com acao primaria.

`RoundHistoryPanel`:

- chips coloridos por resultado;
- baixo crash em vermelho;
- medio em dourado/amber;
- alto em verde;
- scroll horizontal controlado, sem overflow da pagina.

`LeaderboardPanel`:

- linguagem de placar/ranking;
- dourado para rank e lucro;
- linha do jogador atual destacada;
- estado vazio discreto.

`ArcadeTechnicalTabs`:

- visual de audit panel;
- ciano pode aparecer aqui;
- nao deve dominar a primeira impressao.

`CrashRoundPanel` e palco:

- integrar moldura de mesa/felt/gold;
- manter canvas nonblank;
- manter countdown, crash message e multiplier legiveis;
- respeitar `prefers-reduced-motion` quando aplicavel.

## Acessibilidade e UX

- alvos interativos mobile devem ser confortaveis para toque;
- foco de teclado deve continuar visivel;
- texto nao pode sobrepor botoes ou sair de containers;
- animacoes de UI devem ficar em torno de 150-300ms;
- evitar animacoes decorativas infinitas fora do palco/jogo;
- inputs numericos devem usar teclado adequado no mobile quando possivel;
- nao depender apenas de cor para status critico.

## Estrategia de Testes

### Testes Unitarios/Componentes

Adicionar ou ajustar testes em:

- `frontend/src/components/game/game-dashboard-shell.test.tsx`;
- `frontend/src/components/game/chrono-stage.test.tsx`;
- testes de componentes de cashier, historico e leaderboard quando necessario.

Cobrir:

- cards antigos continuam ausentes;
- mobile preserva ordem: palco, cashier/dock, leaderboard, tabs tecnicas;
- layout `lg` usa duas colunas;
- desktop nao duplica formulario de aposta;
- saldo continua no header;
- historico continua com overflow apenas local;
- classes responsivas principais nao voltam a depender apenas de `xl`.

### Browser E2E

Manter e adaptar:

- `tests/browser/player-flow.spec.ts`.

Cobrir:

- login com `player/player123`;
- aposta manual e cashout;
- auto cashout;
- auto bet Martingale;
- leitura de saldo por `Conta do jogador`;
- rodada preparada validada por `/games/rounds/current`;
- ausencia de seletores antigos.

### Validacao Visual Responsiva

Criar ou manter script Playwright para viewports:

- `390x844`;
- `768x1024`;
- `1024x768`;
- `1440x900`.

Checar:

- `overflowX: false`;
- canvas presente e nonblank;
- palco visivel;
- acao principal visivel;
- dock/painel nao sobrepoe conteudo essencial;
- header nao quebra;
- tabs tecnicas nao dominam a primeira dobra mobile.

### Gates

Antes de concluir:

```bash
cd frontend && bun run test
cd frontend && bun run build
bun run test:e2e:browser
bun run ci:local
git diff --check
```

Se tocar contratos ou stack Docker, tambem rodar:

```bash
bun run ci:e2e
docker compose ps
```

## Criterios de Aceite

- A tela comunica cassino premium sem parecer landing page.
- Mobile tem acao principal clara e acessivel.
- `1024px` ja mostra palco e cashier lado a lado.
- Nao ha overflow horizontal nos viewports definidos.
- O fluxo de aposta/cashout continua passando no browser E2E.
- Quality gate continua passando, incluindo tamanho de arquivos e duplicacao.
- Nenhum teste e removido, desabilitado ou reduzido.
- `README.md` permanece inalterado.
- Docs antigas nao rastreadas permanecem intocadas.

## Riscos

- refatorar cashier pode quebrar fluxos de auto cashout/auto bet;
- dock sticky mobile pode sobrepor palco ou tabs se nao reservar espaco;
- restyle pode aumentar duplicacao de classes ou tamanho de arquivos;
- trocar breakpoints pode quebrar testes de ordem de layout existentes;
- excesso de dourado pode reduzir legibilidade se aplicado sem hierarquia.

Mitigacao:

- executar em fatias pequenas com TDD;
- manter componentes focados;
- validar com Playwright em quatro viewports;
- atualizar issue log para falhas reais;
- rodar quality gate antes de considerar completo.
