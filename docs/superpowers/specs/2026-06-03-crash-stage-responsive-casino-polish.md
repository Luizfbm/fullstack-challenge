# Crash Stage Responsive Casino Polish

## Status

Aprovado em 2026-06-03.

## Contexto

O redesign premium arcade casino migrou a tela para felt green + gold, mas o
palco principal ainda tem duas falhas visuais:

- em telas menores, o carro e o eixo X do guia 3D podem sair da area visivel
  do canvas, mesmo quando a pagina nao tem overflow horizontal;
- o palco ainda carrega ambientacao rose/vermelha herdada do design antigo em
  estados que nao sao crash.

## Objetivo

Manter carro, curva, eixo X, labels e indicadores do guia 3D dentro do canvas
em mobile/tablet/laptop/desktop, e alinhar o palco normal ao tema felt green +
gold. Vermelho/rose deve aparecer apenas em crash, erro ou risco real.

## Escopo

Incluido:

- ajustar o enquadramento interno do guia 3D em aspectos estreitos;
- reservar margem para labels do eixo e ponta do carro;
- reduzir ou limitar escala/ancoragem do carro quando ele chega na borda;
- remover rose/vermelho de `chrono-arena`, `chrono-grid`, `chrono-rift` e
  bordas/sombras normais do palco;
- manter vermelho somente para `CRASHED`/`SETTLED` e elementos de erro;
- adicionar testes unitarios e browser que capturem o comportamento.

Fora de escopo:

- mudar regra de jogo, multiplicador, curva de crescimento ou backend;
- alterar `README.md`;
- reintroduzir cards antigos de metricas;
- trocar assets 3D;
- mudar docs antigas nao rastreadas de auto bet.

## Design

### Responsividade 3D

O guia deve ser limitado pelo espaco visivel da camera, nao pelo tamanho ideal
da cena. Em aspectos estreitos, a largura e altura efetivas do HUD devem usar o
menor valor entre o layout desejado e a area segura da camera, com um minimo
suficiente para leitura. A margem direita deve considerar labels e a ponta do
carro.

O modo compacto deve ativar antes de o canvas ficar extremamente estreito. O
limiar aprovado para investigacao inicial e `camera.aspect < 1.1`, porque o
problema aparece antes do antigo limite `0.82`.

### Cores do Palco

Estados normais (`BETTING`, `RUNNING`, `ENTERING`, idle) usam:

- felt/emerald para superficies e glow;
- gold/amber para destaque premium;
- ciano apenas para elementos tecnicos discretos.

Estados de crash usam:

- rose/vermelho para borda, flash, mensagem `CRASH!`, curva travada e risco.

## Estrategia de Teste

- Teste unitario em `time-car-trail-frame`/`updateTimeCarTrail` para canvas
  estreito, garantindo que o eixo e o anchor do carro ficam dentro da area
  segura.
- Teste unitario de `ChronoStage` para garantir que o palco nao-crashed nao
  tem classes rose/vermelhas.
- Teste de contrato CSS para garantir que `.chrono-arena`, `.chrono-grid` e
  `.chrono-rift` nao usam `rgba(244, 63, 94)` fora do contexto de crash.
- Regressao browser em viewports `390`, `768`, `1024` e `1440`, verificando
  ausencia de overflow horizontal e canvas visivel.

## Criterios de Aceite

- Em `390x844`, carro e eixo X permanecem dentro do canvas.
- Em `768x1024`, `1024x768` e `1440x900`, o palco continua enquadrado.
- Palco normal nao exibe fade rose/vermelho do design antigo.
- `CRASHED` continua usando vermelho/rose de forma intencional.
- Testes frontend, build e regressao browser passam.
