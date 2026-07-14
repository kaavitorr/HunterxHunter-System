# Galaga no celular (hunter-world-building) — Design

> **Status:** design aprovado (2026-07-13). Fidelidade escolhida: **Galaga completo** (com feixe trator, captura e nave dupla). Tema: **arcade clássico**, coeso com os outros jogos do hub. Abordagem aprovada: **C** — motor em arquivo próprio, plugado nas costuras existentes do hub de Jogos.

## Contexto e objetivo

O celular do `hunter-world-building` já tem uma central de **Jogos** (`_state.app === "jogos"`) com quatro títulos — Campo Minado, Cobrinha, Tetris e Pac-Man — todos seguindo o mesmo padrão: card no menu, tela própria com topo `◀`, canvas, placar em DOM, overlay de fim com "JOGAR DE NOVO", controles por teclado + botões na tela, recorde por usuário em `game.user.getFlag(MOD, "jogos")`, e limpeza central em `#pararJogos()`. O objetivo é adicionar o **quinto jogo: Galaga**, o mais complexo dos cinco, sem inchar o `celular-app.mjs` (3.515 linhas).

Alvo: `C:\Users\kaa_v\Documents\FoundryVTT\Data\modules\hunter-world-building` (módulo — não é repositório git; só esta spec é versionada, no `hunter-system`).

## Grounding — verificado no repositório

- **Hub de jogos:** `scripts/celular/celular-app.mjs` — `_state.jogosTela: null | "campo" | "cobra" | "tetris" | "pacman"` (linha ~324); ações `jogosAbrir`/`jogosVoltar` (~273-274); contexto por tela em `#ctxJogos()` (~1246); recordes com `#salvarRecorde(chave, valor, menorMelhor)` (~1290) gravando em `getFlag(MOD, "jogos")`.
- **Limpeza:** `#pararJogos()` (~1298) para timers/RAF/teclado de todos os jogos; é chamada em `#onJogosVoltar`, em `#onAbrirApp` (ao sair de "jogos") e em `_onClose` (~341). O Galaga precisa apenas entrar nessa função.
- **Modelo canvas + RAF:** o Pac-Man usa `<canvas data-pac>` com loop `requestAnimationFrame` (`#pacRaf`), teclado em `window` com função guardada (`#pacTecladoFn`) para remover depois, e placar em spans DOM (`data-pac-pontos`, `data-pac-vidas`) atualizados por evento. Comentário no código confirma o truque de re-render: "re-render de fora troca o canvas e o próximo tick repinta" — remontagem idempotente.
- **Template:** `templates/celular/celular.hbs` — menu de jogos em cards (`data-action="jogosAbrir" data-jogo="..."`, ~883-914) e uma seção `{{#if jogoX}}` por jogo (Pac-Man: ~982-996, com canvas 300×300, overlay e d-pad).
- **CSS:** `styles/hunter-celular.css` com classes `.hj-jg__*` reutilizáveis (card, topo, placar, overlay, botões).
- **Precedente de arquivo separado:** `fones-app.mjs` já mostra o padrão de módulo irmão importado pelo `celular-app.mjs`.

## Arquitetura (abordagem C)

Motor isolado + costuras existentes:

- **`scripts/celular/jogo-galaga.mjs` (novo, ~500 linhas)** — classe `JogoGalaga`, dona de TODO o motor: estado, física, trajetórias, desenho, input. Zero conhecimento de Foundry (sem `game.*`), o que a torna legível e testável isolada.
- **`celular-app.mjs` (muda pouco, ~40 linhas)** — import, campo `#galaga = null`, `"galaga"` no comentário de `jogosTela`, caso no `#onJogosAbrir`, remontagem no `_onRender`, `parar()` dentro de `#pararJogos()`, ramo no `#ctxJogos()`, ação `galagaReiniciar`, e recorde via `#salvarRecorde("galaga", pontos)`.
- **`templates/celular/celular.hbs`** — card no menu + seção `{{#if jogoGalaga}}`.
- **`styles/hunter-celular.css`** — bloquinho novo só para os controles de segurar (◀ ▶ FIRE).

### Interface da classe (o contrato com o celular)

```js
new JogoGalaga({
  aoMudarPlacar,   // ({ pontos, fase, vidas }) => atualiza spans DOM (por evento, não por frame)
  aoTerminar       // (pontos) => salvar recorde + re-render (mostra overlay de fim)
})
```

- `montar(rootEl)` — acha `canvas[data-galaga]` e os botões (`[data-galaga-esq]`, `[data-galaga-dir]`, `[data-galaga-fire]`) dentro de `rootEl`, liga canvas/teclado/botões e inicia o RAF se ainda não roda. **Idempotente**: re-render troca o DOM; remontar religa tudo sem duplicar listeners (listeners de teclado guardados em campo e removidos antes de religar; listeners de botões morrem junto com o DOM antigo).
- `parar()` — cancela o RAF e remove o teclado. Idempotente (pode ser chamada sem ter montado).
- `reiniciar()` — reseta o estado para a fase 1 e retoma o loop.

O teclado segue o padrão dos outros jogos (listener em `window` com função guardada), com uma diferença: escuta `keydown` **e** `keyup`, porque mover é *segurar* (estado `esquerda/direita pressionados`), não toque discreto. Os botões de tela usam `pointerdown`/`pointerup`/`pointerleave` para o mesmo efeito de segurar, e o FIRE atira no `pointerdown`.

## Mecânica do jogo

**Canvas 300×360**, mundo em coordenadas de pixel. Loop RAF com passo por tempo decorrido (delta), como o Pac-Man.

### Sua nave
- Base na parte de baixo, move ◀ ▶ (segurar), atira para cima. Tiro: espaço (teclado) ou botão FIRE.
- Máximo **2 tiros seus na tela** (limite clássico); **4** com nave dupla.
- **3 vidas**; vida extra aos **20.000** e aos **70.000** pontos (uma vez cada). Vidas mostradas como mini-naves no placar.
- Ao ser atingida (tiro inimigo ou colisão com mergulhador): explosão, pausa curta (~1,5s, inimigos recuam o fogo), respawn com ~2s de invulnerabilidade piscando. Sem vidas restantes → fim de jogo.

### Inimigos (3 tipos, como no arcade)
| Tipo | Posição na formação | Vida | Pontos (formação / em voo) |
|---|---|---|---|
| 🐝 Abelha (Zako) | 2 fileiras de baixo (até 20) | 1 | 50 / 100 |
| 🦋 Borboleta (Goei) | 2 fileiras do meio (até 16) | 1 | 80 / 160 |
| 👾 Boss Galaga | fileira do topo (4) | 2 (verde → roxo) | 150 / 400 |

- **Entrada em voo:** cada fase começa com a formação vazia; esquadrões de 4-8 entram por trajetórias curvas paramétricas (arcos/loops vindos das bordas), atirando ocasionalmente, e se acomodam cada um no seu slot da grade.
- **Formação "respira":** a grade balança lateralmente e expande/contrai num ciclo senoidal contínuo.
- **Mergulhos:** concluída a entrada, inimigos aleatórios (frequência cresce com a fase) largam o slot e mergulham em curvas na direção da nave, atirando 1-3 tiros. Boss mergulha com até 2 escoltas de borboleta. Quem sai por baixo da tela reaparece no topo e volta ao slot.
- **Fase limpa** (todos mortos) → próxima fase: entra mais rápido, mais mergulhos simultâneos, mais tiros.

### Captura e nave dupla (o "completo")
- Um Boss **com as duas vidas** pode, em vez de mergulho normal, descer até o meio da tela e abrir o **feixe trator**: cone pulsante desenhado abaixo dele por ~3s.
- Nave dentro do cone → é **tragada** (animação de subida com giro), vira **nave capturada** presa acima do boss, que volta com ela para a formação. Conta como perder uma vida: se havia vidas, respawn normal; se era a última, **fim de jogo**.
- **Resgate:** destruir o boss capturador (na formação ou em voo) liberta a nave presa, que desce deslizando e **encaixa ao lado da sua** → **nave dupla**: tiro duplo em paralelo, hitbox de largura dobrada. (Simplificação assumida e aprovada no design: no arcade original o resgate na formação vira caça inimigo; aqui liberar sempre é mais limpo e mais divertido.)
- Atirar **na nave capturada** a destrói (sem resgate).
- Com nave dupla, ser atingido destrói **uma** das duas (volta a nave simples), não perde vida.
- No máximo **um** boss com nave capturada por vez (se já existe captura ativa, nenhum outro boss abre feixe).

### Fase bônus (Challenging Stage)
- A cada **4ª fase** (4, 8, 12…): 40 inimigos atravessam a tela em esquadrões pelas trajetórias de entrada, **sem atirar e sem parar na formação**; saem pela borda.
- 100 pts por abate; **todos os 40 = +1.000 bônus** com aviso na tela. Termina quando o último sai ou morre.
- Custo baixo: reusa as trajetórias e o spawner da entrada em voo, sem IA de mergulho.

### Visual (arcade clássico)
- Fundo preto com **estrelas rolando** para baixo em 2-3 velocidades (paralaxe barata).
- Nave: triângulo branco com detalhe vermelho. Tiros: traços neon (azul do jogador, vermelho dos inimigos).
- Inimigos desenhados com formas no canvas, **2 quadros de asa** alternando (~4 Hz): abelha amarela/azul, borboleta vermelha/branca, boss verde (roxo quando ferido, maior).
- Feixe trator: cone em gradiente azul-claro pulsante. Explosões: círculo expandindo com partículas simples.
- HUD fora do canvas (DOM, padrão do hub): `FASE X · pts · 🏆 recorde · vidas`.

## Template e controles

Card no menu (depois do Pac-Man):

```
🚀  GALAGA
    ◀ ▶ move (segurar) · espaço atira · fuja do feixe trator
    🏆 {recorde} pts
```

Tela do jogo (`{{#if jogoGalaga}}`): topo `◀ GALAGA`, placar DOM (`data-galaga-pontos`, `data-galaga-vidas`, fase), `<canvas data-galaga width="300" height="360">`, overlay de fim (`jogoGalaga.fim`) com pontos + "JOGAR DE NOVO" (`data-action="galagaReiniciar"`), e a barra de controles: botões ◀ ▶ (segurar) + FIRE, com os data-attrs que o motor procura. Os botões de tela **não** usam o sistema de `actions` do ApplicationV2 (que é click-based) — o motor liga `pointerdown/up` neles no `montar()`; só o "JOGAR DE NOVO" e o "◀ voltar" usam actions.

## Dados

- **Recorde:** `game.user.getFlag(MOD, "jogos").galaga` (pontos, maior-melhor), salvo em `aoTerminar` via `#salvarRecorde("galaga", pontos)` — infra existente, sem migração.
- **Sem estado persistente além do recorde.** Partida vive na instância; fechar o celular ou trocar de app descarta (idêntico aos outros jogos).

## Tratamento de erros e limpeza

- `montar()` sem canvas no DOM (tela trocada entre agendar e rodar) → no-op silencioso; o próximo `_onRender` remonta.
- `parar()` idempotente; `#pararJogos()` ganha `this.#galaga?.parar(); this.#galaga = null;` — cobre voltar ao menu, trocar de app e fechar o celular (caminhos já verificados no código).
- Callbacks (`aoMudarPlacar`/`aoTerminar`) embrulhados em try/catch no motor: erro no consumidor não mata o loop.
- Tab perde foco (RAF congela): delta é **limitado a 50ms** por passo — ao voltar, o jogo continua de onde parou sem "teleporte" de física.

## Verificação

1. `node --check` em `jogo-galaga.mjs` e `celular-app.mjs`.
2. **Reiniciar o app do Foundry** (mudança de `.mjs` de módulo não recarrega com F5) e testar manualmente:
   - Menu mostra o card com 🏆; abrir → entrada em voo → formação respirando → mergulhos com tiros.
   - Captura: boss desce, feixe pega a nave, vida perdida, nave presa aparece sobre o boss; resgate → nave dupla com 4 tiros; atingido com dupla → volta a simples sem perder vida.
   - Captura na última vida → fim de jogo.
   - Fase 4 = bônus sem tiros inimigos; 40/40 → +1.000.
   - Vida extra em 20.000.
   - Fim de jogo → overlay + recorde salvo (reabrir menu mostra 🏆 novo).
   - Voltar ao menu / trocar de app / fechar celular no meio do jogo → nenhum loop segue rodando (sem erro no console, sem teclado fantasma).
   - Espelho de tela (GM espelhando o celular) não quebra: o espelho copia HTML sanitizado, e conteúdo de `<canvas>` não serializa — o jogo aparece como tela vazia no espelho, sem erro. Limitação **pré-existente e aceita** dos outros jogos canvas (Cobrinha/Tetris/Pac-Man), não é regressão.
