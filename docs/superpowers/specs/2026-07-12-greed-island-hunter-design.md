# Greed Island hunter — Livro de Cartas na ficha — Design

> **Status:** design aprovado (2026-07-12). Escopo desta spec = **o MÓDULO** (a aba/fichário e sua mecânica). O **compêndio das ~140 cartas** (arte + metadados + efeito) é uma entrega **separada**, montada depois a partir das imagens `.webp` já convertidas e do texto dos efeitos.

## Contexto e objetivo

Um módulo novo, **"Greed Island hunter"** (id `greed-island-hunter`), que adiciona uma **aba "Cartas"** na ficha de personagem do `hunter-system`. A aba é o **fichário de Greed Island**: **100 espaços específicos** (numerados 0–99, cada um para a carta daquele número) + **45 espaços livres** (qualquer carta). As cartas são **Itens do Foundry**; ao entrar no livro elas **saem do inventário** e passam a morar no livro; para usar, o jogador clica na carta e aperta **Gain**, que **materializa o Item de volta no inventário** e esvazia o espaço.

Alvo: `C:\Users\kaa_v\Documents\FoundryVTT\Data\modules\greed-island-hunter` (módulo — **não** é repositório git; só esta spec é versionada, no `hunter-system`).

## Grounding — verificado no repositório

- **Nenhum módulo hoje adiciona aba na ficha.** O hunter-arquivos integra por scene-controls + hooks de journal, não por aba. Então este é o primeiro caso.
- **Classe da ficha:** `CharacterActorSheet extends BaseActorSheet` (`module/applications/actor/character-sheet.mjs:37`) — ApplicationV2 + HandlebarsApplicationMixin. Dispara o hook `renderCharacterActorSheet(app, html, context)`.
- **Abas:** definidas em `static TABS` (linha 167) como `{ tab, label, icon }`, com o corpo renderizado por `PARTS`/templates do sistema. **Empurrar uma entrada em `TABS` a partir do módulo não funciona** (o sistema não tem PART/template para `data-tab="cartas"`, então a aba apareceria vazia). O caminho de módulo é **injeção de DOM** no hook de render + troca de aba tratada na mão.
- **Armazenamento de módulo:** flags no ator (`flags.greed-island-hunter.*`). O jogador é dono da própria ficha → grava a flag direto, **sem socket**. O Narrador é GM → grava em qualquer ficha.
- **Assets:** 190 cartas convertidas de PNG (125 MB) para **WebP (16,5 MB)** em `…/Greed Island Cards US REV1.0/webp/`. Vão para `modules/greed-island-hunter/cards/` quando o módulo for construído. Nomes: `000 - Ruler's Blessing.webp` … (000–099 específicas; 100–711 e 1001+ magias/especiais; `[-NNN]` = cartas de sistema/GM).

## Arquitetura

Módulo leve, sem janela própria — a aba é **injetada na ficha**:

- `scripts/main.mjs` — `init`/`ready`, registro do hook, settings, `loadTemplates`.
- `scripts/aba-cartas.mjs` — o hook `renderCharacterActorSheet`: injeta o item de nav + a `<section data-tab="cartas">`, cuida da **troca de aba manual**, re-injeta a cada render, e liga o drag-drop e os cliques.
- `scripts/livro.mjs` — funções **puras/de dados**: ler/gravar o flag do livro, **rotear** uma carta (número → espaço), tirar o **retrato** de um Item (snapshot p/ recriar), e **recriar** o Item no inventário. Testável isolado.
- `templates/aba-cartas.hbs` — o HTML do fichário (páginas de específicas + livres, popover de detalhe).
- `styles/greed-island.css` — tema (livro/carta).
- `cards/` — as artes `.webp` (copiadas depois).
- `lang/pt-BR.json`.

### Injeção da aba (o ponto sensível)

No `renderCharacterActorSheet(app, html)`, com `app.actor.type === "character"`:
1. Achar o nav de abas e **acrescentar** um item `Cartas` (mesma classe visual dos outros).
2. Achar o container do corpo e **acrescentar** `<section class="tab" data-tab="cartas">` com o fichário renderizado do `livro`.
3. **Troca de aba manual:** clicar no nosso item ativa nossa seção e desativa as demais; clicar nos itens do sistema desativa a nossa. Como cada render reconstrói o DOM, **re-injetamos a cada render** e respeitamos a aba ativa atual (nossa seção só aparece quando é a ativa). Risco conhecido: fragilidade da injeção — mitigado por re-injeção idempotente + handlers reaplicados a cada render.

## Modelo de dados

### A carta (é um Item)
Uma carta é um **Item do Foundry** com flags do módulo:
- `flags.greed-island-hunter.numero` → **0–99** = carta específica (define o espaço); ausente/fora de 0–99 = **livre**.
- `flags.greed-island-hunter.rank` (`SS`…`G`), `.limite` (nº de cópias no jogo), `.tipo` (Longo/Curto Alcance, Regular/Ataque/Defensiva/Proteção/Contínuo), `.requisito` (Ação de Poder / Ação Bônus / Reação).
- **Efeito** = descrição do Item (rich text). **Arte** = `img` do Item.

O **módulo só precisa do `numero` para rotear** e de `name`/`img` para exibir; `rank`/`tipo`/`requisito`/efeito aparecem no **detalhe** ao clicar (antes do Gain). Esses flags/efeitos são preenchidos no **compêndio** (entrega separada).

### O livro (flag no ator)
`flags.greed-island-hunter.livro = { especificas: { "0": carta|null, …, "99": … }, livres: [ carta|null × 45 ] }`

Cada `carta` guardada é um **retrato**: `{ nome, img, numero, rank, tipo, requisito, itemData }`, onde `itemData` = `item.toObject()` (sem `_id`) — o suficiente para **recriar o Item** no Gain. `especificas` é objeto keyed por número (0–99); `livres` é lista de 45 posições.

## Roteamento ao colocar uma carta

Ao soltar um Item no livro (de inventário **ou** de compêndio):
1. Lê `numero`. Se **0–99** e `especificas[numero]` está vazio → coloca ali.
2. Se o espaço específico já está cheio (duplicata) **ou** não tem `numero` válido → primeiro **espaço livre** vago.
3. Se não há espaço livre → avisa "livro cheio" e cancela.
4. Grava o retrato no livro. Se o Item era **embarcado na própria ficha**, **deleta** o Item (a carta "saiu do inventário"). Se veio de compêndio/externo, só guarda.
- **Uma carta por espaço** no v1 (sem empilhar contagem). Duplicata de específica cai no livre.

## Fluxo "Gain"

Clicar numa carta (específica ou livre) abre um **popover de detalhe** (arte, nome, nº, rank, tipo, requisito, efeito) com o botão **Gain**:
1. **Gain** → recria o Item no inventário do ator a partir de `itemData`.
2. Esvazia o espaço no livro.
3. (Sem disparo automático de efeito — o jogador usa o Item pela ficha normalmente e o Narrador adjudica.)

## Layout da aba

Fichário **paginado**, 10 espaços por página:
- **Específicas:** 10 páginas (00–09, 10–19, … 90–99). Espaço cheio mostra arte + nº; vazio mostra só o número.
- **Livres:** 5 páginas (45 espaços; a última com 5). Cheio mostra a arte; vazio fica pontilhado.
- Navegação: ◀ ▶ entre páginas + salto por seção (Específicas / Livres). Drop de Item em qualquer lugar do fichário roteia pela regra acima; drop **direto** num espaço livre vago coloca ali.

## Permissões

- **Jogador** mexe no **próprio** livro (dono da ficha → grava flag direto, sem socket).
- **Narrador** (GM) mexe em qualquer livro.
- A aba só aparece em atores `type === "character"`.

## Escopo do v1 e fronteiras

**v1 (esta spec):** a aba + fichário 100+45 + arrastar/rotear + **Gain** + storage em flag + detalhe da carta. Sistema-alvo: `hunter-system`.

**Fora do v1 (importante):**
- **Efeitos das cartas NÃO são automatizados.** Batedor/Fortaleza/Espiar/etc. são resolvidos **na mão** (jogadores/Narrador movem cartas). O módulo só segura e faz o Gain.
- **Compêndio das ~140 cartas** = entrega separada: eu caso os **efeitos** (texto que você mandou) com os **números** (nome de arquivo é a fonte da verdade das 000–099), gero os Itens com as flags/descrição/arte `.webp`, e te mando a lista pra conferir.
- **Empilhar cópias** num mesmo espaço (contagem) — fica pra depois se quiser.
- Campo de nº na ficha do Item (edição manual do `numero`) — opcional/futuro; no v1 o número vem do compêndio.
- Outros sistemas (oprpg) — fácil habilitar depois.

## Plano de verificação

1. `node --check` em cada `.mjs`; precompilar o `.hbs`.
2. Teste em app (Narrador): abrir a ficha de um personagem, ver a aba **Cartas**, trocar entre ela e as abas do sistema (ida e volta, sem quebrar as outras).
3. Arrastar uma carta-Item nº 7 (do inventário) → cai no espaço específico 7 e **some do inventário**. Arrastar uma sem número → cai num livre. Arrastar duplicata do 7 → vai pro livre.
4. Clicar a carta → detalhe correto → **Gain** → Item volta pro inventário e o espaço esvazia.
5. Livro cheio → aviso, sem perder a carta.
6. Conta de jogador (não-GM, dono do personagem): tudo acima funciona no próprio livro **sem** o Narrador precisar estar conectado (é flag própria).
7. Recarregar a ficha mantém o livro (persistência no flag).

## Arquivos

- `module.json` — id `greed-island-hunter`, esmodules, styles, dependência do sistema `hunter-system`.
- `scripts/main.mjs`, `scripts/aba-cartas.mjs`, `scripts/livro.mjs` — novos.
- `templates/aba-cartas.hbs` — novo.
- `styles/greed-island.css` — novo.
- `cards/*.webp` — artes (copiadas da conversão).
- `lang/pt-BR.json` — rótulos.
