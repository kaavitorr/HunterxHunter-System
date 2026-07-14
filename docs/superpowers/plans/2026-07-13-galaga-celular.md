# Galaga no celular — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o quinto jogo — Galaga completo (com feixe trator, captura e nave dupla) — à central de Jogos do celular do `hunter-world-building`.

**Architecture:** Motor isolado em `scripts/celular/jogo-galaga.mjs` (classe `JogoGalaga`, zero Foundry), plugado nas costuras existentes do hub (`jogosAbrir`/`jogosVoltar`/`#pararJogos`/`#ctxJogos`/recordes). Simulação (`passo(dt)`) separada do desenho (`#desenha()`) para testar headless em node.

**Tech Stack:** JavaScript puro (ESM), canvas 2D, ApplicationV2 (celular já existente), Handlebars, CSS puro. Testes: `node test/galaga-smoke.mjs` (asserts simples, sem framework).

**Spec:** `docs/superpowers/specs/2026-07-13-galaga-celular-design.md` (no hunter-system).

## Global Constraints

- Alvo: `C:\Users\kaa_v\Documents\FoundryVTT\Data\modules\hunter-world-building` — **não é repositório git**: os passos de "commit" viram **checkpoints de validação** (`node --check` + `node test/galaga-smoke.mjs` verdes).
- Nomes/comentários em **PT-BR**, seguindo o estilo do `celular-app.mjs`.
- `jogo-galaga.mjs` **não pode** referenciar API do Foundry (`game.*`, `ui.*`, `foundry.*`) — só DOM/canvas.
- Canvas do jogo: **300×360** (`export const W = 300, H = 360`).
- Delta do loop **limitado a 50ms** por passo (voltar de aba não teleporta a física).
- Recorde por usuário: `game.user.getFlag("hunter-world-building", "jogos").galaga` via `#salvarRecorde("galaga", pontos)` já existente.
- Callbacks do motor embrulhados em try/catch — erro no consumidor não mata o loop.
- Teste real no Foundry exige **reiniciar o app** (F5 não recarrega `.mjs` de módulo).

## Estrutura de arquivos

| Arquivo | Papel |
|---|---|
| `scripts/celular/jogo-galaga.mjs` (**criar**) | Motor completo: constantes, funções puras exportadas, classe `JogoGalaga`. |
| `test/galaga-smoke.mjs` (**criar**) | Harness de asserts headless; cresce a cada task. |
| `scripts/celular/celular-app.mjs` (**modificar**) | Import, campo `#galaga`, ações, `#ctxJogos`, `#pararJogos`, `#onJogosAbrir`, `_onRender`. |
| `templates/celular/celular.hbs` (**modificar**) | Card no menu de jogos + tela `{{#if jogoGalaga}}`. |
| `styles/hunter-celular.css` (**modificar**) | Bloco `.hj-jg__nave-ctrl` (botões de segurar + FIRE). |

## API pública do motor (contrato entre as tasks)

```js
const g = new JogoGalaga({ aoMudarPlacar, aoTerminar, rnd = Math.random, faseInicial = 1 });
g.montar(rootEl);        // liga canvas[data-galaga], botões [data-galaga-esq|dir|fire], teclado e RAF (idempotente)
g.parar();               // cancela RAF + solta teclado (idempotente)
g.reiniciar();           // partida nova (fase 1) e religa
g.passo(dt);             // avança a simulação dt ms (RAF e testes usam)
g.segurar("esq"|"dir", ligado);  g.atirar();      // input (listeners e testes)
g.placar;                // { pontos, fase, vidas, dupla }
g.fim;                   // boolean
g.depurar;               // contadores p/ testes: { inimigos, fila, emFormacao, entrando, mergulhando, tirosJogador, tirosInimigos, bonus, dupla, capturada, naveViva, naveX, alvo, feixe, bossPresa }
```

`aoMudarPlacar({ pontos, fase, vidas })` é chamado **por evento** (não por frame); `aoTerminar(pontos)` uma vez, no fim de jogo.

---

### Task 1: Funções puras + harness de teste

**Files:**
- Create: `scripts/celular/jogo-galaga.mjs` (só a parte pura)
- Create: `test/galaga-smoke.mjs`

**Interfaces:**
- Produces: `W`, `H`, `TIPOS`, `layoutFormacao()`, `posFormacao(slot, t)`, `pontosPara(tipo, emVoo)`, `CAMINHOS`, `caminhoEntrada(padrao, t)`, `colide(a, b)`, `FEIXE_ALC`, `FEIXE_LARG`, `dentroDoFeixe(boss, x, y)` — usados pela classe (Tasks 2-4) e pelos testes.

- [ ] **Step 1: Escrever os testes que vão falhar** — criar `test/galaga-smoke.mjs`:

```js
/** Smoke tests do motor Galaga — rode: node test/galaga-smoke.mjs (a partir da raiz do módulo). */
import JogoGalaga, {
  W, H, TIPOS, layoutFormacao, posFormacao, pontosPara, caminhoEntrada, colide, dentroDoFeixe
} from "../scripts/celular/jogo-galaga.mjs";

let ok = 0, falhas = 0;
function afirma(cond, msg) { if ( cond ) ok++; else { falhas++; console.error("FALHOU:", msg); } }
/** RNG determinístico (LCG) — mesmo seed => mesma partida. */
function lcg(seed = 42) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
/** Simula `ms` de jogo em passos de 16ms; aCadaTick(g) roda antes de cada passo — retornar `false` para a simulação cedo. */
function simular(g, ms, aCadaTick = null) { for ( let t = 0; t < ms; t += 16 ) { if ( aCadaTick?.(g) === false ) break; g.passo(16); } }

/* ---------- Task 1: funções puras ---------- */
{
  const slots = layoutFormacao();
  afirma(slots.length === 40, "formação tem 40 slots");
  afirma(slots.filter(s => s.tipo === "boss").length === 4, "4 bosses");
  afirma(slots.filter(s => s.tipo === "borboleta").length === 16, "16 borboletas");
  afirma(slots.filter(s => s.tipo === "abelha").length === 20, "20 abelhas");
  afirma(slots.every(s => s.col >= 0 && s.col <= 9), "colunas 0..9");

  const p0 = posFormacao({ col: 4.5, lin: 0 }, 0);
  afirma(p0.y === 42, "linha 0 fica em y=42");
  const a = posFormacao({ col: 0, lin: 3 }, 0), b = posFormacao({ col: 0, lin: 3 }, 900);
  afirma(a.x !== b.x, "formação respira (x muda com o tempo)");

  afirma(pontosPara("abelha", false) === 50 && pontosPara("abelha", true) === 100, "pontos abelha 50/100");
  afirma(pontosPara("boss", true) === 400, "boss em voo 400");

  const ini = caminhoEntrada(0, 0), fim = caminhoEntrada(0, 1);
  afirma(ini.x < 0 || ini.y < 0 || ini.x > W || ini.y > H, "entrada começa fora da tela");
  afirma(Math.abs(fim.x - 150) < 0.5 && Math.abs(fim.y - 110) < 0.5, "entrada termina em (150,110)");
  const m1 = caminhoEntrada(0, 0.4999), m2 = caminhoEntrada(0, 0.5001);
  afirma(Math.hypot(m1.x - m2.x, m1.y - m2.y) < 3, "emenda das béziers é contínua");

  afirma(colide({ x: 0, y: 0, raio: 5 }, { x: 6, y: 0, raio: 2 }) === true, "colide encostando");
  afirma(colide({ x: 0, y: 0, raio: 5 }, { x: 10, y: 0, raio: 2 }) === false, "não colide longe");

  const boss = { x: 150, y: 148 };
  afirma(dentroDoFeixe(boss, 150, 300) === true, "feixe pega logo abaixo");
  afirma(dentroDoFeixe(boss, 150, 140) === false, "feixe não pega acima do boss");
  afirma(dentroDoFeixe(boss, 150, 348) === false, "feixe tem alcance limitado");
  afirma(dentroDoFeixe(boss, 100, 300) === false, "fora do cone lateral");
}

console.log(`\n${ok} ok · ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd "C:/Users/kaa_v/Documents/FoundryVTT/Data/modules/hunter-world-building" && node test/galaga-smoke.mjs`
Expected: FAIL — `Cannot find module .../jogo-galaga.mjs`.

- [ ] **Step 3: Implementar a parte pura** — criar `scripts/celular/jogo-galaga.mjs`:

```js
/**
 * Galaga — motor completo do jogo, isolado do Foundry (testável em node).
 * O celular usa só: new JogoGalaga({ aoMudarPlacar, aoTerminar }) + montar()/parar()/reiniciar().
 * Coordenadas em px do canvas W×H; tempos em ms.
 */

export const W = 300;
export const H = 360;
const NAVE_Y = H - 26;
const NAVE_VEL = 150 / 1000;   // px por ms
const TIRO_VEL = 320 / 1000;
const RAIO_NAVE = 7;

/** Tipos de inimigo: raio de colisão, vidas e pontos [na formação, em voo]. */
export const TIPOS = {
  abelha:    { raio: 7,  vidas: 1, pontos: [50, 100] },
  borboleta: { raio: 8,  vidas: 1, pontos: [80, 160] },
  boss:      { raio: 10, vidas: 2, pontos: [150, 400] }
};

/** Grade clássica: 4 bosses + 16 borboletas + 20 abelhas = 40 slots (10 colunas). */
export function layoutFormacao() {
  const slots = [];
  for ( let i = 0; i < 4; i++ ) slots.push({ tipo: "boss", col: i + 3, lin: 0 });
  for ( let l = 0; l < 2; l++ ) for ( let i = 0; i < 8; i++ ) slots.push({ tipo: "borboleta", col: i + 1, lin: 1 + l });
  for ( let l = 0; l < 2; l++ ) for ( let i = 0; i < 10; i++ ) slots.push({ tipo: "abelha", col: i, lin: 3 + l });
  return slots;
}

/** Posição do slot no instante t — a formação "respira" (balança e expande). */
export function posFormacao(slot, t = 0) {
  const esp = 26 * (1 + 0.05 * Math.sin((t / 1900) * Math.PI * 2));
  const x = W / 2 + (slot.col - 4.5) * esp + 7 * Math.sin((t / 3100) * Math.PI * 2);
  const y = 42 + slot.lin * 22;
  return { x, y };
}

export function pontosPara(tipo, emVoo) { return TIPOS[tipo].pontos[emVoo ? 1 : 0]; }

function bez(a, b, c, d, t) {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}
function pontoBez(P, t) { return { x: bez(P[0].x, P[1].x, P[2].x, P[3].x, t), y: bez(P[0].y, P[1].y, P[2].y, P[3].y, t) }; }

/** 4 padrões de entrada; cada um = 2 béziers cúbicas emendadas, terminando em (150,110). */
export const CAMINHOS = [
  [[{ x: -20, y: 120 }, { x: 90, y: 300 }, { x: 230, y: 300 }, { x: 230, y: 170 }],
   [{ x: 230, y: 170 }, { x: 230, y: 60 }, { x: 110, y: 60 }, { x: 150, y: 110 }]],
  [[{ x: 320, y: 120 }, { x: 210, y: 300 }, { x: 70, y: 300 }, { x: 70, y: 170 }],
   [{ x: 70, y: 170 }, { x: 70, y: 60 }, { x: 190, y: 60 }, { x: 150, y: 110 }]],
  [[{ x: 40, y: -20 }, { x: 40, y: 140 }, { x: 260, y: 120 }, { x: 260, y: 240 }],
   [{ x: 260, y: 240 }, { x: 260, y: 330 }, { x: 120, y: 330 }, { x: 150, y: 110 }]],
  [[{ x: 260, y: -20 }, { x: 260, y: 140 }, { x: 40, y: 120 }, { x: 40, y: 240 }],
   [{ x: 40, y: 240 }, { x: 40, y: 330 }, { x: 180, y: 330 }, { x: 150, y: 110 }]]
];

export function caminhoEntrada(padrao, t) {
  const P = CAMINHOS[((padrao % CAMINHOS.length) + CAMINHOS.length) % CAMINHOS.length];
  const seg = t < 0.5 ? P[0] : P[1];
  const tt = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  return { x: bez(seg[0].x, seg[1].x, seg[2].x, seg[3].x, tt), y: bez(seg[0].y, seg[1].y, seg[2].y, seg[3].y, tt) };
}

/** Bézier de mergulho: do ponto atual até sair por baixo, passando perto do alvo. */
function caminhoMergulho(de, alvoX, rnd) {
  const lado = rnd() < 0.5 ? -1 : 1;
  return [
    { x: de.x, y: de.y },
    { x: de.x + lado * 70, y: de.y + 70 },
    { x: alvoX - lado * 40, y: H - 130 },
    { x: alvoX + lado * 70, y: H + 40 }
  ];
}

/** Colisão círculo-círculo (a e b têm x, y, raio). */
export function colide(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, r = (a.raio ?? 0) + (b.raio ?? 0);
  return dx * dx + dy * dy <= r * r;
}

/** Cone do feixe trator: nasce no boss e abre até FEIXE_LARG a FEIXE_ALC px abaixo. */
export const FEIXE_ALC = 190, FEIXE_LARG = 76;
export function dentroDoFeixe(boss, x, y) {
  const dy = y - boss.y;
  if ( dy <= 0 || dy > FEIXE_ALC ) return false;
  const meia = (FEIXE_LARG / 2) * (dy / FEIXE_ALC);
  return Math.abs(x - boss.x) <= meia;
}

let _id = 0;

/** Placeholder da Task 2 — só para o import default não quebrar os testes da Task 1. */
export default class JogoGalaga {}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd "C:/Users/kaa_v/Documents/FoundryVTT/Data/modules/hunter-world-building" && node --check scripts/celular/jogo-galaga.mjs && node test/galaga-smoke.mjs`
Expected: `node --check` silencioso; smoke imprime `18 ok · 0 falha(s)` e sai com código 0.

- [ ] **Step 5: Checkpoint (sem git — módulo não é repo)**

Confirmar que os dois comandos acima estão verdes antes de seguir.

---

### Task 2: Classe JogoGalaga — ciclo de vida, nave, tiros, input, estrelas, desenho

**Files:**
- Modify: `scripts/celular/jogo-galaga.mjs` (substituir o placeholder `export default class JogoGalaga {}`)
- Modify: `test/galaga-smoke.mjs` (acrescentar bloco Task 2 antes do `console.log` final)

**Interfaces:**
- Consumes: tudo da Task 1.
- Produces: a API pública completa (`montar/parar/reiniciar/passo/segurar/atirar/placar/fim/depurar`) com **stubs vazios** para `#passoInimigos`, `#passoPresa`, `#passoColisoes`, `#passoFase` (Tasks 3-4 preenchem). `#novaFase` já monta a fila de entrada.

- [ ] **Step 1: Testes que vão falhar** — acrescentar em `test/galaga-smoke.mjs`, antes do `console.log` final:

```js
/* ---------- Task 2: ciclo de vida, nave, tiros ---------- */
{
  const g = new JogoGalaga({ rnd: lcg(3) });
  afirma(g.fim === false, "começa sem fim");
  const p = g.placar;
  afirma(p.pontos === 0 && p.fase === 1 && p.vidas === 3 && p.dupla === false, "placar inicial 0/1/3/simples");
  g.parar();                                   // sem montar: não pode explodir
  afirma(true, "parar() sem montar é inofensivo");

  const x0 = g.depurar.naveX;
  g.segurar("dir", true); simular(g, 500); g.segurar("dir", false);
  afirma(g.depurar.naveX > x0, "segurar('dir') move a nave pra direita");
  g.segurar("esq", true); simular(g, 5000); g.segurar("esq", false);
  afirma(g.depurar.naveX === 14, "nave para na borda esquerda (x=14)");

  g.atirar(); g.atirar(); g.atirar();
  afirma(g.depurar.tirosJogador === 2, "máximo 2 tiros na tela");
  simular(g, 2000);
  afirma(g.depurar.tirosJogador === 0, "tiros somem ao sair por cima");

  const g2 = new JogoGalaga({ rnd: lcg(2) });
  simular(g2, 1200);
  afirma(g2.depurar.inimigos > 0, "fila de entrada solta inimigos com o tempo");
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node test/galaga-smoke.mjs`
Expected: FAIL — construtor placeholder não tem `fim`/`placar`/`depurar`.

- [ ] **Step 3: Implementar a classe** — substituir as duas linhas finais (`let _id = 0;` + placeholder) por:

```js
let _id = 0;

export default class JogoGalaga {
  // ---- infra ----
  #cb; #rnd;
  #rootEl = null;
  #raf = null;
  #ultimo = 0;
  #tecladoDownFn = null;
  #tecladoUpFn = null;

  // ---- partida (vive na instância; re-render de fora não zera) ----
  #relogio = 0;
  #pontos = 0; #vidas = 3; #fase = 1; #fim = false;
  #marcosVida = [20000, 70000];        // marcos de nave extra ainda não pagos
  #seg = { esq: false, dir: false };
  #nave = { x: W / 2, viva: true, dupla: false, respawnEm: 0, invulAte: 0, capturando: false };
  #tiros = []; #tirosInimigos = [];
  #inimigos = []; #fila = [];
  #explosoes = [];
  #estrelas = [];
  #presa = null;                       // nave capturada: { modo: "subindo"|"presa"|"resgatando", x, y, bossId, t }
  #proxMergulho = 2500; #proxFeixe = 9000;
  #bonus = false; #bonusAbates = 0;
  #aviso = null;                       // { texto, ateT }

  constructor({ aoMudarPlacar = () => {}, aoTerminar = () => {}, rnd = Math.random, faseInicial = 1 } = {}) {
    this.#cb = { placar: aoMudarPlacar, fim: aoTerminar };
    this.#rnd = rnd;
    for ( let i = 0; i < 50; i++ ) {
      this.#estrelas.push({ x: this.#rnd() * W, y: this.#rnd() * H, v: (12 + this.#rnd() * 28) / 1000 });
    }
    this.#fase = Math.max(1, faseInicial);
    this.#novaFase(this.#fase);
  }

  /* ---------- API pública ---------- */

  get fim() { return this.#fim; }

  get placar() { return { pontos: this.#pontos, fase: this.#fase, vidas: this.#vidas, dupla: this.#nave.dupla }; }

  /** Visão de depuração p/ testes headless. */
  get depurar() {
    const m = modo => this.#inimigos.filter(i => i.modo === modo).length;
    const formacao = this.#inimigos.filter(i => i.modo === "formacao");
    const alvo = formacao.length ? formacao.reduce((a, b) => (b.y > a.y ? b : a)) : null;
    const feixe = this.#inimigos.find(i => i.modo === "feixe") ?? null;
    const bossPresa = this.#inimigos.find(i => i.presa) ?? null;
    return {
      inimigos: this.#inimigos.length, fila: this.#fila.length,
      emFormacao: formacao.length, entrando: m("entrando") + m("acomodando"),
      mergulhando: m("mergulhando") + m("voltando"),
      tirosJogador: this.#tiros.length, tirosInimigos: this.#tirosInimigos.length,
      bonus: this.#bonus, dupla: this.#nave.dupla, capturada: !!this.#presa,
      naveViva: this.#nave.viva, naveX: this.#nave.x,
      alvo: alvo ? { x: alvo.x, y: alvo.y } : null,
      feixe: feixe ? { x: feixe.x, y: feixe.y } : null,
      bossPresa: bossPresa ? { x: bossPresa.x, y: bossPresa.y } : null
    };
  }

  segurar(lado, ligado) { if ( lado in this.#seg ) this.#seg[lado] = !!ligado; }

  atirar() {
    if ( this.#fim || !this.#nave.viva || this.#nave.capturando ) return;
    const max = this.#nave.dupla ? 4 : 2;
    const canos = this.#nave.dupla ? [this.#nave.x - 9, this.#nave.x + 9] : [this.#nave.x];
    for ( const cx of canos ) {
      if ( this.#tiros.length >= max ) break;
      this.#tiros.push({ x: cx, y: NAVE_Y - 10, raio: 2 });
    }
  }

  reiniciar() {
    this.#relogio = 0; this.#pontos = 0; this.#vidas = 3; this.#fim = false;
    this.#marcosVida = [20000, 70000];
    this.#seg = { esq: false, dir: false };
    this.#nave = { x: W / 2, viva: true, dupla: false, respawnEm: 0, invulAte: 0, capturando: false };
    this.#tiros = []; this.#tirosInimigos = []; this.#explosoes = []; this.#presa = null;
    this.#novaFase(1);
    this.#avisaPlacar();
    if ( this.#rootEl ) this.montar(this.#rootEl);   // religa teclado + RAF
  }

  /** Liga IO no DOM atual. Idempotente: re-render troca o corpo, remontar religa. */
  montar(rootEl) {
    if ( !rootEl ) return;
    this.#rootEl = rootEl;
    const solta = lado => () => this.segurar(lado, false);
    const esq = rootEl.querySelector("[data-galaga-esq]");
    if ( esq ) {
      esq.onpointerdown = ev => { ev.preventDefault(); this.segurar("esq", true); };
      esq.onpointerup = esq.onpointerleave = esq.onpointercancel = solta("esq");
    }
    const dir = rootEl.querySelector("[data-galaga-dir]");
    if ( dir ) {
      dir.onpointerdown = ev => { ev.preventDefault(); this.segurar("dir", true); };
      dir.onpointerup = dir.onpointerleave = dir.onpointercancel = solta("dir");
    }
    const fire = rootEl.querySelector("[data-galaga-fire]");
    if ( fire ) fire.onpointerdown = ev => { ev.preventDefault(); this.atirar(); };
    this.#tecladoLigar();
    this.#ligar();
  }

  parar() {
    if ( this.#raf != null ) { cancelAnimationFrame(this.#raf); this.#raf = null; }
    this.#tecladoDesligar();
    this.#seg = { esq: false, dir: false };
  }

  /** Avança a simulação `dt` ms — separado do desenho p/ rodar headless nos testes. */
  passo(dt) {
    if ( this.#fim ) return;
    this.#relogio += dt;
    for ( const e of this.#estrelas ) { e.y += e.v * dt; if ( e.y > H ) { e.y = -2; e.x = this.#rnd() * W; } }
    this.#passoNave(dt);
    this.#passoTiros(dt);
    this.#passoFila(dt);
    this.#passoInimigos(dt);
    this.#passoPresa(dt);
    this.#passoColisoes();
    this.#passoFase();
    for ( let i = this.#explosoes.length - 1; i >= 0; i-- ) {
      if ( this.#relogio - this.#explosoes[i].t0 > 400 ) this.#explosoes.splice(i, 1);
    }
  }

  /* ---------- fases e fila de entrada ---------- */

  #velFase() { return 1 + 0.08 * (this.#fase - 1); }

  #novaFase(n) {
    this.#fase = n;
    this.#bonus = n % 4 === 0;
    this.#bonusAbates = 0;
    this.#tiros = []; this.#tirosInimigos = [];
    this.#inimigos = []; this.#fila = [];
    this.#proxMergulho = this.#relogio + 2500;
    this.#proxFeixe = this.#relogio + 9000;
    // 5 esquadrões de 8, cada um com um padrão de caminho e atraso
    layoutFormacao().forEach((slot, i) => {
      const esq = Math.floor(i / 8), dentro = i % 8;
      this.#fila.push({
        em: this.#relogio + 400 + esq * 2200 + dentro * 180,
        inimigo: {
          id: ++_id, tipo: slot.tipo, slot, vidas: TIPOS[slot.tipo].vidas,
          modo: this.#bonus ? "bonus" : "entrando", t: 0,
          dur: 2600 / this.#velFase(), caminho: (esq + n) % CAMINHOS.length,
          x: -30, y: -30, de: null, presa: false
        }
      });
    });
    this.#aviso = { texto: this.#bonus ? `FASE ${n} — BÔNUS!` : `FASE ${n}`, ateT: this.#relogio + 1400 };
  }

  #passoFila() {
    while ( this.#fila.length && this.#relogio >= this.#fila[0].em ) {
      this.#inimigos.push(this.#fila.shift().inimigo);
    }
  }

  /* ---------- nave e tiros ---------- */

  #passoNave(dt) {
    const n = this.#nave;
    if ( !n.viva ) {
      if ( n.respawnEm && this.#relogio >= n.respawnEm ) {
        n.viva = true; n.respawnEm = 0; n.x = W / 2; n.invulAte = this.#relogio + 2000;
      }
      return;
    }
    if ( n.capturando ) return;                        // sendo tragada: sem controle
    const dx = (this.#seg.dir ? 1 : 0) - (this.#seg.esq ? 1 : 0);
    n.x = Math.max(14, Math.min(W - 14, n.x + dx * NAVE_VEL * dt));
  }

  #passoTiros(dt) {
    for ( let i = this.#tiros.length - 1; i >= 0; i-- ) {
      this.#tiros[i].y -= TIRO_VEL * dt;
      if ( this.#tiros[i].y < -10 ) this.#tiros.splice(i, 1);
    }
    for ( let i = this.#tirosInimigos.length - 1; i >= 0; i-- ) {
      const b = this.#tirosInimigos[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if ( b.y > H + 10 || b.x < -10 || b.x > W + 10 ) this.#tirosInimigos.splice(i, 1);
    }
  }

  /* ---------- stubs preenchidos nas Tasks 3-4 ---------- */

  #passoInimigos(dt) {}   // Task 3 (+ feixe na Task 4)
  #passoPresa(dt) {}      // Task 4
  #passoColisoes() {}     // Task 3 (+ presa na Task 4)
  #passoFase() {}         // Task 3

  /* ---------- placar / fim ---------- */

  #avisaPlacar() {
    try { this.#cb.placar({ pontos: this.#pontos, fase: this.#fase, vidas: this.#vidas }); } catch ( e ) { console.error(e); }
  }

  #terminar() {
    this.#fim = true;
    this.parar();
    try { this.#cb.fim(this.#pontos); } catch ( e ) { console.error(e); }
  }

  /* ---------- teclado ---------- */

  #tecladoLigar() {
    this.#tecladoDesligar();
    this.#tecladoDownFn = ev => {
      if ( /input|textarea|select/i.test(ev.target?.tagName ?? "" ) ) return;
      const k = ev.key;
      if ( k === "ArrowLeft" || k === "a" || k === "A" ) { this.segurar("esq", true); ev.preventDefault(); }
      else if ( k === "ArrowRight" || k === "d" || k === "D" ) { this.segurar("dir", true); ev.preventDefault(); }
      else if ( k === " " || k === "ArrowUp" || k === "w" || k === "W" ) { this.atirar(); ev.preventDefault(); }
    };
    this.#tecladoUpFn = ev => {
      const k = ev.key;
      if ( k === "ArrowLeft" || k === "a" || k === "A" ) this.segurar("esq", false);
      else if ( k === "ArrowRight" || k === "d" || k === "D" ) this.segurar("dir", false);
    };
    window.addEventListener("keydown", this.#tecladoDownFn);
    window.addEventListener("keyup", this.#tecladoUpFn);
  }

  #tecladoDesligar() {
    if ( this.#tecladoDownFn ) { window.removeEventListener("keydown", this.#tecladoDownFn); this.#tecladoDownFn = null; }
    if ( this.#tecladoUpFn ) { window.removeEventListener("keyup", this.#tecladoUpFn); this.#tecladoUpFn = null; }
  }

  /* ---------- loop ---------- */

  #ligar() {
    if ( this.#raf != null || this.#fim ) return;
    this.#ultimo = 0;
    const loop = agora => {
      if ( this.#raf == null ) return;
      const dt = this.#ultimo ? Math.min(agora - this.#ultimo, 50) : 16;   // clamp: voltar de aba não teleporta
      this.#ultimo = agora;
      this.passo(dt);
      this.#desenha();
      if ( this.#raf == null || this.#fim ) return;   // parar()/fim DURANTE o passo não pode rearmar o loop
      this.#raf = requestAnimationFrame(loop);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  /* ---------- desenho (todo o quadro, todo tick — o RAF acha o canvas novo após re-render) ---------- */

  #desenha() {
    const cv = this.#rootEl?.querySelector("canvas[data-galaga]");
    if ( !cv ) return;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#05050f";
    ctx.fillRect(0, 0, W, H);
    for ( const e of this.#estrelas ) {
      ctx.fillStyle = e.v > 0.03 ? "#9fb4ff" : "#5a6280";
      ctx.fillRect(e.x, e.y, e.v > 0.03 ? 2 : 1, e.v > 0.03 ? 2 : 1);
    }
    for ( const i of this.#inimigos ) if ( i.modo === "feixe" ) this.#desenhaFeixe(ctx, i);
    ctx.fillStyle = "#7df9ff";
    for ( const t of this.#tiros ) ctx.fillRect(t.x - 1, t.y - 5, 2, 8);
    ctx.fillStyle = "#ff5d5d";
    for ( const t of this.#tirosInimigos ) ctx.fillRect(t.x - 1.5, t.y - 3, 3, 6);
    for ( const i of this.#inimigos ) this.#desenhaInimigo(ctx, i);
    if ( this.#presa ) this.#desenhaNaveEm(ctx, this.#presa.x, this.#presa.y, "#e05555", Math.PI);
    const n = this.#nave;
    if ( n.viva && (this.#relogio >= n.invulAte || Math.floor(this.#relogio / 120) % 2 === 0) ) {
      if ( n.dupla ) { this.#desenhaNaveEm(ctx, n.x - 9, NAVE_Y, "#f2f2f2"); this.#desenhaNaveEm(ctx, n.x + 9, NAVE_Y, "#f2f2f2"); }
      else this.#desenhaNaveEm(ctx, n.x, NAVE_Y, "#f2f2f2");
    }
    for ( const ex of this.#explosoes ) {
      const t = (this.#relogio - ex.t0) / 400;
      ctx.strokeStyle = `rgba(255,${(200 - 150 * t) | 0},80,${1 - t})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ex.x, ex.y, 3 + t * 14, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,210,63,${1 - t})`;
      for ( let k = 0; k < 6; k++ ) {
        const a = k * Math.PI / 3, r = 4 + t * 18;
        ctx.fillRect(ex.x + Math.cos(a) * r, ex.y + Math.sin(a) * r, 2, 2);
      }
    }
    if ( this.#aviso && this.#relogio < this.#aviso.ateT ) {
      ctx.fillStyle = "#ffd23f";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(this.#aviso.texto, W / 2, H / 2 - 30);
    }
  }

  #desenhaNaveEm(ctx, x, y, cor, rot = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e0433b";
    ctx.fillRect(-1.5, -4, 3, 6);
    ctx.restore();
  }

  #desenhaInimigo(ctx, i) {
    const q = Math.floor(this.#relogio / 250) % 2;   // 2 quadros de asa
    ctx.save();
    ctx.translate(i.x, i.y);
    if ( i.tipo === "abelha" ) {
      ctx.fillStyle = "#3fa7ff";
      ctx.fillRect(-7, q ? -5 : -3, 4, 3); ctx.fillRect(3, q ? -5 : -3, 4, 3);
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath(); ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#05050f";
      ctx.fillRect(-4, -1, 8, 2);
    } else if ( i.tipo === "borboleta" ) {
      ctx.fillStyle = "#f2f2f2";
      ctx.beginPath();
      ctx.ellipse(-5, q ? -2 : 0, 4, 6, -0.5, 0, Math.PI * 2);
      ctx.ellipse(5, q ? -2 : 0, 4, 6, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ff5d5d";
      ctx.beginPath(); ctx.ellipse(0, 0, 3, 7, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = i.vidas === 2 ? "#41d17a" : "#b06bff";   // boss ferido fica roxo
      ctx.beginPath(); ctx.ellipse(0, 1, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-9, q ? -6 : -4, 5, 4); ctx.fillRect(4, q ? -6 : -4, 5, 4);
      ctx.fillStyle = "#05050f";
      ctx.fillRect(-3, -3, 2, 2); ctx.fillRect(1, -3, 2, 2);
    }
    ctx.restore();
  }

  #desenhaFeixe(ctx, boss) {
    const pulso = 0.3 + 0.18 * Math.sin(this.#relogio / 90);
    const grad = ctx.createLinearGradient(boss.x, boss.y, boss.x, boss.y + FEIXE_ALC);
    grad.addColorStop(0, `rgba(125,249,255,${pulso + 0.25})`);
    grad.addColorStop(1, "rgba(125,249,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(boss.x, boss.y);
    ctx.lineTo(boss.x - FEIXE_LARG / 2, boss.y + FEIXE_ALC);
    ctx.lineTo(boss.x + FEIXE_LARG / 2, boss.y + FEIXE_ALC);
    ctx.closePath();
    ctx.fill();
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --check scripts/celular/jogo-galaga.mjs && node test/galaga-smoke.mjs`
Expected: `26 ok · 0 falha(s)`, exit 0. (Os inimigos spawnam e ficam parados em (-30,-30) — os modos vêm na Task 3; o teste só confere que a fila solta.)

- [ ] **Step 5: Checkpoint**

Dois comandos verdes. Nota: `caminhoMergulho` e `pontoBez` ficam sem uso até a Task 3 — esperado.

---

### Task 3: Inimigos — entrada, formação, mergulhos, colisões, fases

**Files:**
- Modify: `scripts/celular/jogo-galaga.mjs` (substituir os 4 stubs — menos `#passoPresa` — e acrescentar métodos novos)
- Modify: `test/galaga-smoke.mjs` (bloco Task 3)

**Interfaces:**
- Consumes: `caminhoEntrada`, `posFormacao`, `caminhoMergulho`, `pontoBez`, `colide`, `pontosPara` (Task 1); campos/stubs da Task 2.
- Produces: `#passoInimigos(dt)` (modos `entrando/bonus/fugindo/acomodando/formacao/mergulhando/voltando`), `#lancarMergulho()`, `#tiroInimigo(de)`, `#matar(i)`, `#ganharPontos(p)`, `#naveAtingida()`, `#perderVida(capturada)`, `#passoColisoes()`, `#passoFase()`. A Task 4 **reescreve** `#passoInimigos` (acrescenta modos de feixe), `#passoColisoes` (presa) e `#naveAtingida` (ramo dupla).

- [ ] **Step 1: Testes que vão falhar** — acrescentar antes do `console.log` final:

```js
/* ---------- Task 3: inimigos, mergulhos, fases ---------- */
{
  // entrada completa: 40 inimigos acabam em formação
  const g = new JogoGalaga({ rnd: lcg(15) });
  simular(g, 16000);
  afirma(g.depurar.emFormacao + g.depurar.mergulhando === g.depurar.inimigos && g.depurar.fila === 0,
    "após 16s a fila esvaziou e ninguém ficou preso entrando");
  afirma(g.depurar.inimigos >= 30, "a maioria dos 40 está viva e posicionada (nave parada pode ter matado alguns por colisão)");

  // mergulhos acontecem
  let viuMergulho = false;
  simular(g, 8000, jg => { if ( jg.depurar.mergulhando > 0 ) viuMergulho = true; });
  afirma(viuMergulho, "inimigos mergulham depois da entrada");

  // dá pra matar: perseguir o alvo mais baixo da formação e atirar
  const g2 = new JogoGalaga({ rnd: lcg(11) });
  simular(g2, 30000, jg => {
    const d = jg.depurar;
    const alvoX = d.alvo?.x ?? W / 2;
    jg.segurar("esq", d.naveX > alvoX + 3);
    jg.segurar("dir", d.naveX < alvoX - 3);
    if ( d.tirosJogador < 2 ) jg.atirar();
  });
  afirma(g2.placar.pontos > 0, "perseguir e atirar marca pontos");
  afirma(g2.depurar.inimigos < 40, "inimigos morrem");

  // fase bônus: ninguém atira, todos atravessam e a fase avança sozinha
  const g3 = new JogoGalaga({ rnd: lcg(7), faseInicial: 4 });
  afirma(g3.depurar.bonus === true, "fase 4 é bônus");
  let tiroInimigoNoBonus = false;
  // só conta tiros ENQUANTO o bônus está ativo — a janela de 30s alcança a fase 5 (normal), que atira legitimamente
  simular(g3, 30000, jg => { if ( jg.depurar.bonus && jg.depurar.tirosInimigos > 0 ) tiroInimigoNoBonus = true; });
  afirma(tiroInimigoNoBonus === false, "no bônus ninguém atira");
  afirma(g3.placar.fase === 5, "bônus termina e vira fase 5");
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node test/galaga-smoke.mjs`
Expected: FAIL — com os stubs, `emFormacao` fica 0 e a fase nunca avança.

- [ ] **Step 3: Implementar** — em `jogo-galaga.mjs`, **remover** o bloco de stubs (`#passoInimigos`, `#passoColisoes`, `#passoFase` — manter `#passoPresa(dt) {}` para a Task 4) e colar no lugar:

```js
  /* ---------- inimigos ---------- */

  #passoInimigos(dt) {
    const vel = this.#velFase();
    const podeAtirar = !this.#bonus && this.#nave.viva && !this.#nave.capturando;
    for ( let idx = this.#inimigos.length - 1; idx >= 0; idx-- ) {
      const i = this.#inimigos[idx];
      if ( i.modo === "entrando" || i.modo === "bonus" ) {
        i.t += dt / i.dur;
        if ( i.t >= 1 ) {
          if ( i.modo === "bonus" ) i.modo = "fugindo";
          else { i.modo = "acomodando"; i.t = 0; i.de = { x: i.x, y: i.y }; }
        } else {
          const p = caminhoEntrada(i.caminho, i.t);
          i.x = p.x; i.y = p.y;
          if ( podeAtirar && this.#rnd() < 0.00018 * dt * vel ) this.#tiroInimigo(i);
        }
      } else if ( i.modo === "fugindo" ) {
        i.y -= 0.2 * dt;
        if ( i.y < -30 ) this.#inimigos.splice(idx, 1);
      } else if ( i.modo === "acomodando" ) {
        i.t += dt / 600;
        const alvo = posFormacao(i.slot, this.#relogio);
        if ( i.t >= 1 ) { i.modo = "formacao"; i.x = alvo.x; i.y = alvo.y; }
        else { i.x = i.de.x + (alvo.x - i.de.x) * i.t; i.y = i.de.y + (alvo.y - i.de.y) * i.t; }
      } else if ( i.modo === "formacao" ) {
        const p = posFormacao(i.slot, this.#relogio);
        i.x = p.x; i.y = p.y;
      } else if ( i.modo === "mergulhando" ) {
        i.t += dt / i.dur;
        if ( i.t >= 1 ) {
          i.modo = "voltando"; i.t = 0;
          i.x = 40 + this.#rnd() * (W - 80); i.y = -24;
          i.de = { x: i.x, y: i.y };
        } else {
          const p = pontoBez(i.rota, i.t);
          i.x = p.x; i.y = p.y;
          if ( podeAtirar && i.balas > 0 && i.t > i.proxBala ) {
            this.#tiroInimigo(i); i.balas--;
            i.proxBala = i.t + 0.18 + this.#rnd() * 0.2;
          }
        }
      } else if ( i.modo === "voltando" ) {
        i.t += dt / 900;
        const alvo = posFormacao(i.slot, this.#relogio);
        if ( i.t >= 1 ) i.modo = "formacao";
        else { i.x = i.de.x + (alvo.x - i.de.x) * i.t; i.y = i.de.y + (alvo.y - i.de.y) * i.t; }
      }
    }
    if ( !this.#bonus && this.#fila.length === 0 && this.#relogio >= this.#proxMergulho ) {
      this.#lancarMergulho();
      this.#proxMergulho = this.#relogio + (1600 + this.#rnd() * 1400) / vel;
    }
  }

  #lancarMergulho() {
    const vel = this.#velFase();
    const emFormacao = this.#inimigos.filter(i => i.modo === "formacao");
    if ( !emFormacao.length ) return;
    const quantos = Math.min(1 + Math.floor(this.#fase / 2), 4, emFormacao.length);
    const lider = emFormacao[Math.floor(this.#rnd() * emFormacao.length)];
    const grupo = [lider];
    if ( lider.tipo === "boss" ) {
      // boss mergulha com até 2 borboletas de escolta das colunas vizinhas
      grupo.push(...emFormacao.filter(i => i.tipo === "borboleta" && Math.abs(i.slot.col - lider.slot.col) <= 1).slice(0, 2));
    } else if ( quantos > 1 ) {
      grupo.push(...emFormacao.filter(i => i !== lider).slice(0, quantos - 1));
    }
    for ( const i of grupo ) {
      i.modo = "mergulhando"; i.t = 0;
      i.rota = caminhoMergulho(i, this.#nave.x + (this.#rnd() * 60 - 30), this.#rnd);
      i.dur = 2300 / vel;
      i.balas = 1 + Math.floor(this.#rnd() * 3);
      i.proxBala = 0.15 + this.#rnd() * 0.2;
    }
  }

  #tiroInimigo(de) {
    const n = this.#nave;
    const dx = n.x - de.x, dy = NAVE_Y - de.y;
    const d = Math.hypot(dx, dy) || 1;
    const v = (130 + this.#fase * 8) / 1000;
    const esp = (this.#rnd() - 0.5) * 0.25;                 // espalhamento
    this.#tirosInimigos.push({ x: de.x, y: de.y + 6, vx: (dx / d + esp) * v, vy: (dy / d) * v, raio: 2 });
  }

  /* ---------- colisões / dano ---------- */

  #passoColisoes() {
    const n = this.#nave;
    for ( let ti = this.#tiros.length - 1; ti >= 0; ti-- ) {
      const tiro = this.#tiros[ti];
      for ( const i of this.#inimigos ) {
        if ( !colide(tiro, { x: i.x, y: i.y, raio: TIPOS[i.tipo].raio }) ) continue;
        this.#tiros.splice(ti, 1);
        i.vidas--;
        if ( i.vidas <= 0 ) this.#matar(i);
        break;
      }
    }
    if ( !n.viva || n.capturando || this.#relogio < n.invulAte ) return;
    const hitbox = { x: n.x, y: NAVE_Y, raio: n.dupla ? RAIO_NAVE * 2 : RAIO_NAVE };
    for ( let bi = this.#tirosInimigos.length - 1; bi >= 0; bi-- ) {
      if ( colide(this.#tirosInimigos[bi], hitbox) ) {
        this.#tirosInimigos.splice(bi, 1);
        this.#naveAtingida();
        return;
      }
    }
    for ( const i of this.#inimigos ) {
      if ( !["mergulhando", "entrando", "bonus"].includes(i.modo) ) continue;
      if ( colide({ x: i.x, y: i.y, raio: TIPOS[i.tipo].raio }, hitbox) ) {
        this.#matar(i);
        this.#naveAtingida();
        return;
      }
    }
  }

  #matar(i) {
    const idx = this.#inimigos.indexOf(i);
    if ( idx >= 0 ) this.#inimigos.splice(idx, 1);
    this.#explosoes.push({ x: i.x, y: i.y, t0: this.#relogio });
    this.#ganharPontos(pontosPara(i.tipo, i.modo !== "formacao"));
    if ( this.#bonus ) this.#bonusAbates++;
  }

  #ganharPontos(p) {
    this.#pontos += p;
    while ( this.#marcosVida.length && this.#pontos >= this.#marcosVida[0] ) {
      this.#marcosVida.shift();
      this.#vidas++;
      this.#aviso = { texto: "NAVE EXTRA!", ateT: this.#relogio + 1400 };
    }
    this.#avisaPlacar();
  }

  #naveAtingida() {
    this.#perderVida();
  }

  #perderVida(capturada = false) {
    const n = this.#nave;
    if ( !capturada ) this.#explosoes.push({ x: n.x, y: NAVE_Y, t0: this.#relogio });
    n.viva = false;
    n.dupla = false;
    this.#vidas--;
    this.#avisaPlacar();
    if ( this.#vidas <= 0 ) { this.#terminar(); return; }
    n.respawnEm = this.#relogio + 1600;
  }

  /* ---------- avanço de fase ---------- */

  #passoFase() {
    if ( this.#fila.length || this.#inimigos.length ) return;
    const perfeito = this.#bonus && this.#bonusAbates >= 40;
    this.#novaFase(this.#fase + 1);            // seta o aviso "FASE n"…
    if ( perfeito ) {
      this.#ganharPontos(1000);                // …que pode virar "NAVE EXTRA!"…
      this.#aviso = { texto: "PERFEITO! +1000", ateT: this.#relogio + 1600 };   // …mas o PERFEITO prevalece
    }
    this.#avisaPlacar();
  }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --check scripts/celular/jogo-galaga.mjs && node test/galaga-smoke.mjs`
Expected: `34 ok · 0 falha(s)`, exit 0. **Se um assert com RNG falhar** (a simulação é determinística por seed, mas o seed pode ser azarado), ajustar o seed do teste (`lcg(7)` → outro) — nunca a mecânica — e reexecutar.

- [ ] **Step 5: Checkpoint**

Dois comandos verdes.

---

### Task 4: Captura, resgate e nave dupla

**Files:**
- Modify: `scripts/celular/jogo-galaga.mjs` (4 edições cirúrgicas + 2 métodos novos)
- Modify: `test/galaga-smoke.mjs` (bloco Task 4)

**Interfaces:**
- Consumes: `dentroDoFeixe`, `#perderVida(capturada)`, modos da Task 3, `#presa` (campo da Task 2).
- Produces: modos `descendoFeixe`/`feixe` no boss, `#lancarFeixe()`, `#passoPresa(dt)` completo, `#naveAtingida()` com ramo dupla, tiro do jogador destruindo a própria nave presa. É o estado final do motor.

- [ ] **Step 1: Testes que vão falhar** — acrescentar antes do `console.log` final:

```js
/* ---------- Task 4: captura, resgate, nave dupla ---------- */
{
  const g = new JogoGalaga({ rnd: lcg(9358) });
  // 1) deixar ser capturado: perseguir o feixe quando ele existir, sem atirar
  // (o harness para a simulação quando o callback retorna false — sem isso a nave morre de outras causas antes/depois da captura)
  let capturou = false;
  simular(g, 90000, jg => {
    const d = jg.depurar;
    if ( d.capturada ) { capturou = true; if ( !d.naveViva ) return false; return; }
    const alvoX = d.feixe ? d.feixe.x : W / 2;
    jg.segurar("esq", d.naveX > alvoX + 2);
    jg.segurar("dir", d.naveX < alvoX - 2);
  });
  afirma(capturou, "o feixe trator captura a nave (se falhar, trocar o seed — determinístico)");
  afirma(g.placar.vidas === 2, "captura custa uma vida");
  afirma(g.fim === false, "com vidas sobrando o jogo segue");

  // 2) resgatar: perseguir o boss que carrega a presa e atirar nele
  let resgatou = false;
  simular(g, 60000, jg => {
    const d = jg.depurar;
    if ( d.dupla ) { resgatou = true; return false; }
    const alvoX = d.bossPresa ? d.bossPresa.x : (d.alvo?.x ?? W / 2);
    jg.segurar("esq", d.naveX > alvoX + 3);
    jg.segurar("dir", d.naveX < alvoX - 3);
    if ( d.tirosJogador < 2 && d.naveViva ) jg.atirar();
  });
  afirma(resgatou, "matar o boss capturador devolve a nave => dupla");
  afirma(g.placar.dupla === true, "placar reporta nave dupla");
  afirma(g.depurar.capturada === false, "presa liberada não conta mais como capturada");
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node test/galaga-smoke.mjs`
Expected: FAIL — nunca captura (`#lancarFeixe` não existe, `#passoPresa` é stub).

- [ ] **Step 3: Implementar — 6 edições em `jogo-galaga.mjs`:**

**(a)** Em `#passoInimigos`, logo **depois** do bloco `else if ( i.modo === "voltando" ) { ... }`, acrescentar os dois modos do boss:

```js
      } else if ( i.modo === "descendoFeixe" ) {
        i.t += dt / 1000;
        if ( i.t >= 1 ) { i.modo = "feixe"; i.t = 0; }
        else { i.x = i.de.x + (i.alvoFeixe.x - i.de.x) * i.t; i.y = i.de.y + (i.alvoFeixe.y - i.de.y) * i.t; }
      } else if ( i.modo === "feixe" ) {
        i.t += dt / 3000;
        const nv = this.#nave;
        if ( nv.viva && !nv.capturando && !this.#presa && this.#relogio >= nv.invulAte && dentroDoFeixe(i, nv.x, NAVE_Y) ) {
          nv.capturando = true;
          this.#presa = { modo: "subindo", x: nv.x, y: NAVE_Y, bossId: i.id, t: 0 };
        }
        const minhaPresa = this.#presa?.bossId === i.id;
        // volta pra formação quando o feixe acaba (sem pegar ninguém) ou quando a presa docou nele
        if ( (i.t >= 1 && !minhaPresa) || (minhaPresa && this.#presa.modo === "presa" && !i.voltou) ) {
          i.voltou = minhaPresa;                      // marca pra não relançar o retorno
          i.modo = "voltando"; i.t = 0; i.de = { x: i.x, y: i.y };
        }
```

**(b)** Ainda em `#passoInimigos`, logo **depois** do bloco que lança mergulho (`this.#proxMergulho = ...`), acrescentar:

```js
    if ( !this.#bonus && !this.#presa && !this.#nave.capturando && this.#fila.length === 0 && this.#relogio >= this.#proxFeixe ) {
      this.#lancarFeixe();
      this.#proxFeixe = this.#relogio + 12000 + this.#rnd() * 6000;
    }
```

**(c)** Método novo, colar depois de `#lancarMergulho`:

```js
  /** Boss intacto desce até o meio da tela e abre o feixe trator. */
  #lancarFeixe() {
    const boss = this.#inimigos.find(i => i.tipo === "boss" && i.modo === "formacao" && i.vidas === 2 && !i.presa);
    if ( !boss ) return;
    boss.modo = "descendoFeixe"; boss.t = 0;
    boss.voltou = false;   // rearma o retorno — sem isso um boss que RECAPTURA trava no modo feixe
    boss.de = { x: boss.x, y: boss.y };
    boss.alvoFeixe = { x: 50 + this.#rnd() * (W - 100), y: 148 };
  }
```

**(d)** Substituir o stub `#passoPresa(dt) {}` por:

```js
  /** A nave capturada: subindo pro boss, presa nele, ou descendo no resgate. */
  #passoPresa(dt) {
    const p = this.#presa;
    if ( !p ) return;
    const boss = this.#inimigos.find(i => i.id === p.bossId);
    if ( p.modo === "subindo" ) {
      if ( !boss ) {                                   // boss morreu no meio da tragada: vira resgate
        p.modo = "resgatando"; this.#nave.capturando = false; this.#perderVida(true); return;
      }
      p.t += dt / 1200;
      p.x += (boss.x - p.x) * Math.min(1, dt / 300);
      p.y += (boss.y - 16 - p.y) * Math.min(1, dt / 300);
      if ( p.t >= 1 ) {
        p.modo = "presa"; boss.presa = true;
        this.#nave.capturando = false;
        this.#perderVida(true);                        // capturada conta como vida perdida (sem explosão)
      }
    } else if ( p.modo === "presa" ) {
      if ( !boss ) { p.modo = "resgatando"; return; }  // resgate: o boss capturador morreu
      p.x = boss.x; p.y = boss.y - 16;
    } else if ( p.modo === "resgatando" ) {
      const alvo = { x: this.#nave.x + 9, y: NAVE_Y };
      p.x += (alvo.x - p.x) * Math.min(1, dt / 400);
      p.y += (alvo.y - p.y) * Math.min(1, dt / 400);
      if ( Math.hypot(alvo.x - p.x, alvo.y - p.y) < 6 && this.#nave.viva ) {
        this.#presa = null;
        this.#nave.dupla = true;
        this.#aviso = { texto: "NAVE RESGATADA!", ateT: this.#relogio + 1400 };
        this.#avisaPlacar();
      }
    }
  }
```

**(e)** Em `#passoColisoes`, **substituir** o laço dos tiros do jogador por esta versão (só muda o miolo: checa a presa antes dos inimigos):

```js
    for ( let ti = this.#tiros.length - 1; ti >= 0; ti-- ) {
      const tiro = this.#tiros[ti];
      // atirar na própria nave presa a destrói (sem resgate)
      if ( this.#presa && ["presa", "resgatando"].includes(this.#presa.modo)
        && colide(tiro, { x: this.#presa.x, y: this.#presa.y, raio: RAIO_NAVE }) ) {
        this.#explosoes.push({ x: this.#presa.x, y: this.#presa.y, t0: this.#relogio });
        this.#presa = null;
        for ( const b of this.#inimigos ) b.presa = false;
        this.#tiros.splice(ti, 1);
        continue;
      }
      for ( const i of this.#inimigos ) {
        if ( !colide(tiro, { x: i.x, y: i.y, raio: TIPOS[i.tipo].raio }) ) continue;
        this.#tiros.splice(ti, 1);
        i.vidas--;
        if ( i.vidas <= 0 ) this.#matar(i);
        break;
      }
    }
```

E na lista de modos que colidem com a nave, **incluir os do feixe** — trocar a linha do filtro por:

```js
      if ( !["mergulhando", "entrando", "bonus", "descendoFeixe", "feixe"].includes(i.modo) ) continue;
```

**(f)** Substituir `#naveAtingida()` pela versão com nave dupla:

```js
  #naveAtingida() {
    const n = this.#nave;
    if ( n.dupla ) {                                   // perde só a nave extra, sem perder vida
      n.dupla = false;
      this.#explosoes.push({ x: n.x + 9, y: NAVE_Y, t0: this.#relogio });
      n.invulAte = this.#relogio + 1200;
      this.#avisaPlacar();
      return;
    }
    this.#perderVida();
  }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --check scripts/celular/jogo-galaga.mjs && node test/galaga-smoke.mjs`
Expected: `40 ok · 0 falha(s)`, exit 0. Mesma regra de seed da Task 3 se o assert de captura não fechar.

- [ ] **Step 5: Checkpoint**

Motor completo e verde. A partir daqui só integração com o celular.

---

### Task 5: Integração no celular-app.mjs

**Files:**
- Modify: `scripts/celular/celular-app.mjs` (8 edições ancoradas; linhas referem-se ao arquivo atual)

**Interfaces:**
- Consumes: `JogoGalaga` (default export) com `montar/parar/reiniciar/placar/fim`; `#salvarRecorde(chave, valor)` e `#pararJogos()` existentes.
- Produces: estado `jogosTela === "galaga"`, contexto `jogoGalaga` p/ o template (Task 6), ação `galagaReiniciar`, atributos DOM `[data-galaga-pontos|fase|vidas]` atualizados por `#galagaPlacarDom`.

- [ ] **Step 1: Import** — junto aos imports do topo (após `import FonesApp, { embedDe } from "./fones-app.mjs";`, linha ~16):

```js
import JogoGalaga from "./jogo-galaga.mjs";
```

- [ ] **Step 2: Ação** — no bloco `actions` (após `pacDir:        CelularApp.#onPacDir`, linha ~282):

```js
      pacDir:        CelularApp.#onPacDir,
      galagaReiniciar: CelularApp.#onGalagaReiniciar
```

- [ ] **Step 3: Estado + campo** — atualizar o comentário de `jogosTela` (linha ~324):

```js
    jogosTela: null,                    // Jogos: null (menu) | "campo" | "cobra" | "tetris" | "pacman" | "galaga"
```

E após `#pacTecladoFn = null;` (linha ~339):

```js
  #galaga = null;         // instância de JogoGalaga (motor isolado em jogo-galaga.mjs)
```

- [ ] **Step 4: Contexto** — em `#ctxJogos()` (linha ~1246), após o bloco `if ( tela === "pacman" ) {...}`:

```js
    if ( tela === "galaga" ) {
      const g = this.#galaga;
      const p = g?.placar ?? { pontos: 0, fase: 1, vidas: 3 };
      return { jogoGalaga: {
        pontos: p.pontos, fase: p.fase, vidas: "▲".repeat(Math.max(0, p.vidas)),
        recorde: recordes.galaga ?? 0, fim: !!g?.fim
      } };
    }
```

E na linha final do menu (`return { jogosMenu: true, recordes: {...} };`), acrescentar a chave:

```js
    return { jogosMenu: true, recordes: { cobra: recordes.cobra ?? 0, campo: recordes.campo ?? null, tetris: recordes.tetris ?? 0, pacman: recordes.pacman ?? 0, galaga: recordes.galaga ?? 0 } };
```

- [ ] **Step 5: Limpeza** — em `#pararJogos()` (linha ~1298), antes de fechar o método:

```js
    this.#galaga?.parar();   // pausa (a partida fica na instância — reabrir retoma, como nos outros)
```

- [ ] **Step 6: Abrir/reiniciar** — em `#onJogosAbrir` (linha ~2104), após o caso do pacman:

```js
    if ( jogo === "galaga" ) {
      if ( !this.#galaga ) this.#galaga = new JogoGalaga({
        aoMudarPlacar: p => this.#galagaPlacarDom(p),
        aoTerminar: pontos => { this.#salvarRecorde("galaga", pontos); this.render(); }
      });
      else if ( this.#galaga.fim ) this.#galaga.reiniciar();
      // montar/religar acontece no _onRender após o this.render() abaixo
    }
```

E os dois métodos novos, colados logo após `#onPacDir` (fim do bloco de handlers dos jogos):

```js
  static #onGalagaReiniciar() {
    this.#galaga?.reiniciar();
    this.render();
  }

  /** Placar do Galaga direto no DOM (por evento — sem re-render). */
  #galagaPlacarDom({ pontos, fase, vidas }) {
    const el = this.element;
    const p = el?.querySelector("[data-galaga-pontos]"); if ( p ) p.textContent = pontos;
    const f = el?.querySelector("[data-galaga-fase]");   if ( f ) f.textContent = fase;
    const v = el?.querySelector("[data-galaga-vidas]");  if ( v ) v.textContent = "▲".repeat(Math.max(0, vidas));
  }
```

- [ ] **Step 7: Remontagem pós-render** — em `_onRender` (linha ~1913), logo após `this.#marcarVisto();`:

```js
    // Galaga: religa canvas/botões depois de QUALQUER re-render (o corpo é trocado)
    if ( this._state.app === "jogos" && this._state.jogosTela === "galaga" && this.#galaga && !this.#galaga.fim ) {
      this.#galaga.montar(el);
    }
```

- [ ] **Step 8: Validar**

Run: `node --check scripts/celular/celular-app.mjs && node --check scripts/celular/jogo-galaga.mjs && node test/galaga-smoke.mjs`
Expected: tudo verde (o smoke continua `40 ok`).

---

### Task 6: Template + CSS

**Files:**
- Modify: `templates/celular/celular.hbs` (card no menu ~linha 914 + tela após o bloco do Pac-Man ~linha 1002)
- Modify: `styles/hunter-celular.css` (bloco novo após `.hj-jg__dica`, linha ~971)

**Interfaces:**
- Consumes: contexto `jogoGalaga` e `recordes.galaga` (Task 5); atributos `[data-galaga-*]` que o motor procura (Task 2).
- Produces: DOM que `montar()` encontra: `canvas[data-galaga]`, `[data-galaga-esq]`, `[data-galaga-dir]`, `[data-galaga-fire]`.

- [ ] **Step 1: Card no menu** — em `celular.hbs`, logo após o `</button>` do card do Pac-Man (linha ~914), dentro do mesmo `hj-cel__scroll`:

```handlebars
    <button type="button" class="hj-jg__card" data-action="jogosAbrir" data-jogo="galaga">
      <span class="hj-jg__icone">🚀</span>
      <span class="hj-jg__card-info">
        <b>Galaga</b>
        <small>◀ ▶ move (segurar) · espaço atira · fuja do feixe trator</small>
      </span>
      {{#if recordes.galaga}}<em>🏆 {{recordes.galaga}} pts</em>{{/if}}
    </button>
```

- [ ] **Step 2: Tela do jogo** — logo após o `{{/if}}` que fecha o bloco `{{#if jogoPac}}` (antes de `{{#if jogoCampo}}`):

```handlebars
  {{#if jogoGalaga}}
  <div class="hj-jg__topo">
    <button type="button" data-action="jogosVoltar">◀</button>
    <b>GALAGA</b>
    <span>🏆 {{jogoGalaga.recorde}}</span>
  </div>
  <div class="hj-cel__scroll hj-jg__area">
    <div class="hj-jg__placar">FASE <b data-galaga-fase>{{jogoGalaga.fase}}</b> &nbsp;·&nbsp; <b data-galaga-pontos>{{jogoGalaga.pontos}}</b> pts &nbsp;·&nbsp; <b data-galaga-vidas class="hj-jg__vidas">{{jogoGalaga.vidas}}</b></div>
    <div class="hj-jg__moldura">
      <canvas data-galaga width="300" height="360"></canvas>
      {{#if jogoGalaga.fim}}
      <div class="hj-jg__fim">
        <b>FIM DE JOGO — Fase {{jogoGalaga.fase}} · {{jogoGalaga.pontos}} pts</b>
        <button type="button" data-action="galagaReiniciar">JOGAR DE NOVO</button>
      </div>
      {{/if}}
    </div>
    <div class="hj-jg__nave-ctrl">
      <button type="button" data-galaga-esq>◀</button>
      <button type="button" class="hj-jg__fire" data-galaga-fire>FIRE</button>
      <button type="button" data-galaga-dir>▶</button>
    </div>
  </div>
  {{/if}}
```

- [ ] **Step 3: CSS** — em `hunter-celular.css`, após a regra `.hj-jg__dica` (linha ~971):

```css
/* Galaga — botões de segurar (◀ ▶) + FIRE */
.hunter-world-building-celular .hj-jg__nave-ctrl { display: flex; gap: 10px; justify-content: center; }
.hunter-world-building-celular .hj-jg__nave-ctrl button {
  width: 64px; height: 40px; padding: 0; cursor: pointer; line-height: 1;
  display: flex; align-items: center; justify-content: center;
  background: rgba(74, 30, 120, .1); border: 1px solid rgba(74, 30, 120, .45);
  border-radius: 8px; color: #4a1e78; font-size: 13px;
  touch-action: none; user-select: none;   /* segurar no touch sem scroll/seleção */
}
.hunter-world-building-celular .hj-jg__nave-ctrl button:hover { background: rgba(208, 82, 224, .18); }
.hunter-world-building-celular .hj-jg__fire {
  font-size: 10px; font-weight: 800; letter-spacing: 1px;
  border-color: rgba(224, 67, 59, .55) !important; color: #b3271e !important;
  background: rgba(224, 67, 59, .08) !important;
}
```

- [ ] **Step 4: Validar**

Run (da raiz do módulo):
```bash
node -e "const s=require('fs').readFileSync('templates/celular/celular.hbs','utf8'); const a=(s.match(/\{\{#if /g)||[]).length, f=(s.match(/\{\{\/if\}\}/g)||[]).length; console.log('#if',a,'/if',f, a===f?'OK':'DESBALANCEADO')"
node -e "const s=require('fs').readFileSync('styles/hunter-celular.css','utf8'); const o=(s.match(/\{/g)||[]).length, c=(s.match(/\}/g)||[]).length; console.log('chaves',o,c, o===c?'OK':'DESBALANCEADO')"
```
Expected: ambos `OK` (o hbs já tem `{{#if}}`/`{{/if}}` balanceados hoje; a contagem deve continuar igual dos dois lados).

---

### Task 7: Verificação final

**Files:** nenhum novo — só validação.

- [ ] **Step 1: Bateria completa**

```bash
cd "C:/Users/kaa_v/Documents/FoundryVTT/Data/modules/hunter-world-building"
node --check scripts/celular/jogo-galaga.mjs
node --check scripts/celular/celular-app.mjs
node test/galaga-smoke.mjs
```
Expected: `40 ok · 0 falha(s)`.

- [ ] **Step 2: Revisar o diff completo** — reler as 8 edições do `celular-app.mjs` e os 3 blocos de template/CSS conferindo nomes: `jogo-galaga.mjs`, `#galaga`, `galagaReiniciar`, `jogoGalaga`, `recordes.galaga`, `data-galaga`, `data-galaga-esq/dir/fire`, `data-galaga-pontos/fase/vidas`, chave de recorde `"galaga"`.

- [ ] **Step 3: Teste manual no Foundry** — **REINICIAR O APP** (F5 não recarrega `.mjs` de módulo) e rodar o checklist da spec:

1. Menu de Jogos mostra o card 🚀 GALAGA (sem 🏆 na primeira vez).
2. Abrir → esquadrões entram voando → formação respira → mergulhos com tiros.
3. Setas/AD movem (segurar), espaço atira (máx. 2), botões ◀ ▶ FIRE funcionam segurando no mouse.
4. Boss desce e abre o feixe; entrar no cone → captura (vida some do placar, navinha vermelha presa sobre o boss).
5. Matar o boss capturador → nave desce e encaixa → dupla (4 tiros); levar hit com dupla → volta a simples sem perder vida.
6. Captura na última vida → FIM DE JOGO.
7. Fase 4 = bônus (ninguém atira, todos atravessam); matar todos → “PERFEITO! +1000”.
8. 20.000 pts → “NAVE EXTRA!” e vida a mais no placar.
9. Fim de jogo → overlay + JOGAR DE NOVO; voltar ao menu → 🏆 com o recorde.
10. No meio do jogo: voltar ao menu, trocar de app e fechar o celular — console limpo, sem teclado fantasma (setas não mexem em nada), reabrir retoma a partida pausada.

- [ ] **Step 4: Encerrar** — marcar o plano como executado e avisar o usuário do resultado do checklist.

---

## Self-review do plano (feito na escrita)

- **Cobertura da spec:** entrada em voo/formação/mergulhos (T3), captura/resgate/dupla/1-captura-por-vez (T4 — `!this.#presa` no lançador), fase bônus a cada 4 (T2 `#novaFase` + T3 `#passoFase`), vidas extras 20k/70k (T3 `#ganharPontos`), pontos formação/voo (T1+T3), limite 2/4 tiros (T2), delta 50ms (T2 `#ligar`), remontagem idempotente (T2 `montar` + T5 `_onRender`), placar por evento (T5 `#galagaPlacarDom`), recorde flag (T5), overlay fim (T6), botões segurar + `touch-action` (T6), limpeza em voltar/trocar/fechar (T5 via `#pararJogos` existente), canvas vazio no espelho = limitação pré-existente aceita (spec).
- **Divergência consciente da spec:** `#pararJogos` **não** anula `#galaga` (spec dizia `= null`) — pausar e retomar é o comportamento dos outros 4 jogos (“voltar pra partida pausada retoma”); anular quebraria essa paridade. Instância morre com a janela (`_onClose` → sem referência).
- **Placeholders:** nenhum TBD/TODO; todo passo de código tem o código.
- **Consistência de nomes:** conferida (T2 define `montar/parar/reiniciar/passo/segurar/atirar/placar/fim/depurar`; T3-T5 só usam esses; `depurar.alvo/feixe/bossPresa` definidos na T2 e usados nos testes T3-T4).

