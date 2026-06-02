# Frontend Multiplier Display Animation - Design

Data: 2026-06-02

## Objetivo

Animar o multiplicador no frontend entre os ticks do WebSocket sem alterar a
regra real do jogo. O backend continua sendo a fonte da verdade para curva,
crash, cashout, auto cashout e payout.

## Decisao

O frontend calcula uma estimativa visual do multiplicador enquanto a rodada
esta `RUNNING`, usando:

- `startedAt`;
- `multiplierBaseBp`;
- `multiplierGrowthRateBpPerSecond`;
- relogio local usado pela UI.

A estimativa segue a mesma curva exponencial do backend:

```text
multiplierBp = floor(multiplierBaseBp * exp(rate * elapsedSeconds))
```

Para texto e previews, o valor exibido e quantizado em passos de `0.01x` com
arredondamento sempre para baixo:

```text
displayMultiplierBp = floor(multiplierBp / 100) * 100
```

Assim, `1.0199x` ainda aparece como `1.01x`, e `1.02x` so aparece quando o
valor estimado realmente alcanca pelo menos `1.0200x`.

## Escopo

Aplicar a quantizacao conservadora a:

- texto principal do multiplicador;
- textos de multiplicador em paineis do frontend;
- preview visual de payout.

Nao aplicar a quantizacao a:

- calculo de cashout no backend;
- auto cashout;
- payout persistido;
- lifecycle da rodada;
- animacoes e efeitos do palco 3D.

O palco pode continuar usando valores suaves e progresso temporal para manter a
sensacao de movimento continuo. Apenas texto e previews financeiros precisam
ser conservadores.

## Testes

Os testes devem cobrir:

- multiplicador em `RUNNING` calculado entre ticks e exibido em passos de
  `0.01x`;
- crash point revelado sem arredondar para cima;
- preview de payout usando o multiplicador visual quantizado;
- preservacao dos testes existentes de palco, dashboard e E2E browser.
