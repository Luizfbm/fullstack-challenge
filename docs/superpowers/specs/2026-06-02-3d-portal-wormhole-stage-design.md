# 3D Portal Wormhole Stage Design

Data: 2026-06-02

## Objetivo

Substituir o portal visual atual do palco Chrono Crash por um portal GLB real
dentro da cena Three.js, usando o asset:

```text
/Users/luiz_fbm/Downloads/blackhole_pixel_pass_3.glb
```

O portal deve fazer parte do mesmo canvas que o carro. O carro deve entrar no
portal durante a transicao da rodada, e a fase `RUNNING` deve parecer que o
carro esta voando dentro de um buraco de minhoca.

Esta e uma mudanca exclusivamente frontend/visual. Nao altera API REST,
WebSocket, regras de aposta, carteira, auto bet, auto cashout, observabilidade
ou backend.

## Estado Atual

O palco atual mistura duas camadas:

- `ChronoStage` renderiza o portal como DOM/CSS com classes
  `black-hole-gate`, `black-hole-ring`, `black-hole-core`,
  `black-hole-accretion` e `black-hole-shockwave`.
- `CrashFlightScene` renderiza a cena Three.js com carro, trilha, luzes,
  estrada/grid e estrelas. O codigo ja usa as coordenadas `portalX`/`portalY`
  para mover o carro em direcao ao portal, mas o portal em si nao esta no
  canvas.

O asset GLB inspecionado tem aproximadamente:

- 862 KB;
- 754 meshes;
- 19 materiais;
- 4 imagens/texturas;
- 1 animacao chamada `CINEMA_4D_Main`, com duracao de 50 segundos;
- dimensoes aproximadas `11 x 2.31 x 11`;
- cerca de 5.3k triangulos.

O tamanho e aceitavel para a cena atual, desde que o asset seja carregado uma
vez, normalizado e reutilizado dentro do loop de animacao.

## Design Aprovado

Implementacao escolhida:

```text
GLB portal + animacao GLB + wormhole procedural Three.js
```

O portal CSS antigo sai como fonte principal. O GLB vira o portal real no
canvas. Depois que o carro entra, o portal desaparece do palco, e o carro
passa a voar dentro de um wormhole procedural em Three.js.

As camadas CSS que podem permanecer sao atmosfericas:

- starfield;
- speed lines leves;
- flight line;
- grid/fundo do palco;
- chips, multiplicador e overlays de UI.

As camadas CSS antigas do portal devem sair:

- rings;
- core;
- accretion;
- shockwave ligado ao portal;
- qualquer retorno visual do portal durante `CRASHED`.

## Fases Visuais

### BETTING

- Portal GLB menor, a direita, em idle.
- Carro parado a esquerda aguardando a rodada.
- Portal pode ter rotacao/pulso sutil.
- Starfield e grid continuam discretos.

### ENTERING

- Portal GLB cresce.
- Animacao do GLB roda.
- Carro se move para dentro do portal.
- Speed lines CSS podem aparecer como camada leve.
- O movimento do carro deve continuar responsivo para desktop e mobile.

### RUNNING

- Portal GLB desaparece do palco.
- Carro fica dentro de um buraco de minhoca procedural em Three.js.
- O wormhole deve comunicar profundidade e movimento com tunnel streaks,
  linhas radiais, aneis/tubos de energia ou particulas no canvas.
- O carro segue visivel e em voo, sem parecer estacionado em frente a um
  portal.

### CRASHED

- O portal GLB nao volta.
- O carro continua dentro do wormhole.
- A cena ganha flare vermelho/rosa e impacto curto.
- Nao deve haver rings/shockwave CSS antigos.
- O impacto deve ser visualmente curto e nao deve ocultar informacoes de UI.

## Arquitetura de Frontend

### Assets

Copiar o GLB para:

```text
frontend/public/models/blackhole_pixel_pass_3.glb
```

Adicionar, se necessario, um arquivo de atribuicao ao lado dos outros modelos:

```text
frontend/public/models/blackhole-pixel-pass-attribution.txt
```

O carregamento em runtime deve usar caminho publico:

```text
/models/blackhole_pixel_pass_3.glb
```

### Modulos

Criar um modulo focado para o portal:

```text
frontend/src/components/game/blackhole-portal-model.ts
```

Responsabilidades:

- exportar `BLACKHOLE_PORTAL_ASSET_PATH`;
- criar fallback procedural leve caso o GLB falhe;
- carregar o GLB com `GLTFLoader`;
- normalizar escala, centro e orientacao;
- preparar materiais para a iluminacao da cena;
- expor mixer/actions quando houver animacoes;
- descartar geometrias e materiais importados quando necessario.

Criar um modulo focado para o wormhole:

```text
frontend/src/components/game/wormhole-tunnel.ts
```

Responsabilidades:

- criar geometrias/linhas/particulas do wormhole;
- atualizar intensidade, cor e movimento por fase;
- manter API pequena para `CrashFlightScene`;
- ser testavel sem renderizar React.

Modificar:

```text
frontend/src/components/game/crash-flight-scene.tsx
frontend/src/components/game/chrono-stage.tsx
frontend/src/styles.css
frontend/src/components/game/crash-flight-scene.test.ts
tests/browser/player-flow.spec.ts
```

## Comportamento de Falha

Se o GLB nao carregar:

- a cena nao deve ficar em branco;
- o fallback procedural de portal deve aparecer em `BETTING` e `ENTERING`;
- o wormhole procedural ainda deve funcionar em `RUNNING` e `CRASHED`;
- os testes de canvas nonblank devem continuar passando.

## Acessibilidade e Performance

- Respeitar `prefers-reduced-motion`: reduzir rotacoes, tunnel streaks e camera
  shake.
- Manter o canvas dentro do palco atual, sem overflow horizontal em mobile.
- Nao mover ou ocultar chips, multiplicador, tabs ou controles.
- Evitar alocar novas geometrias/materiais dentro do `requestAnimationFrame`.
- Reutilizar objetos e atualizar apenas transforms, opacidade, cor e tempo de
  animacao.

## Testes

### Unitarios Frontend

Adicionar/ajustar testes em:

```text
frontend/src/components/game/crash-flight-scene.test.ts
```

Cobrir:

- caminho publico do asset `BLACKHOLE_PORTAL_ASSET_PATH`;
- normalizacao do portal GLB/fallback;
- criacao e descarte do wormhole procedural;
- fases em que o portal fica visivel: `BETTING` e `ENTERING`;
- fases em que o portal fica oculto: `RUNNING` e `CRASHED`;
- fase `CRASHED` mantendo wormhole ativo com tons vermelho/rosa.

### Browser E2E

Ajustar `tests/browser/player-flow.spec.ts` para confirmar:

- recurso `/models/blackhole_pixel_pass_3.glb` foi carregado;
- canvas continua nonblank;
- fluxo de login, aposta, cashout, auto cashout e Martingale continua passando.

### Validacao Visual

Depois da implementacao, validar por Playwright ou Browser:

- desktop: palco sem blank canvas, sem overflow, com carro visivel e portal
  visivel apenas em `BETTING`/`ENTERING`;
- mobile: carro nao cortado e portal nao cortado quando estiver visivel;
- `RUNNING`: portal ausente e wormhole visivel;
- `CRASHED`: portal ausente, wormhole vermelho/rosa e impacto curto.

## Gates Obrigatorios

Rodar ao menos:

```bash
cd frontend && bun run test src/components/game/crash-flight-scene.test.ts
cd frontend && bun run build
bun run lint
bun run check:types
bun run test:unit
bun run test:coverage && bun run quality:gate
docker compose config
docker compose up -d --build
bun scripts/ci/check-kong-health.ts
bun run test:e2e:browser
git diff --check
```

Se a mudanca afetar o maior arquivo ou a duplicacao, refatorar em modulos
menores antes de abrir PR.

## Criterio de Pronto

- Portal CSS antigo removido como elemento principal do palco.
- Portal GLB aparece no canvas em `BETTING` e `ENTERING`.
- Animacao do GLB e/ou rotacao procedural esta ativa quando movimento for
  permitido.
- Carro entra no portal em `ENTERING`.
- `RUNNING` mostra carro dentro de wormhole procedural sem portal visivel.
- `CRASHED` mantem carro no wormhole com flare vermelho/rosa e impacto curto,
  sem retorno do portal.
- Fallback funciona se o GLB falhar.
- Testes e quality gates passam.
