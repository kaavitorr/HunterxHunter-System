/**
 * jj/gm-resource-hud.mjs
 * HUD do NARRADOR (GM-only) para acompanhar e controlar os recursos dos jogadores.
 *
 * Mostra, por jogador → personagem(ns) que ele possui:
 *   • PV (editável)            system.attributes.hp.value / .max
 *   • Aura atual (editável)    system.energy.total / .max
 *   • Aura gerada (editável)   system.energy.generated
 *   • Percepção Passiva        system.skills.prc.passive
 *   • Acerto (ataque normal)   prof + melhor mod físico (FOR/DES)
 *   • Acerto (Técnica)         system.attributes.spell.attack
 *   • CD                       system.attributes.spell.dc
 *
 * PV, Aura e Gerada são campos editáveis (o Narrador controla). O resto é só
 * leitura (são derivados). Cada personagem pode ser ocultado/reexibido. O HUD é
 * arrastável, minimizável, e seu estado (aberto/posição/minimizado/ocultos) é
 * salvo por usuário. Abre/fecha pelo botão em GM Tools (controles de cena).
 */

const SCOPE = "hunter-system";
const FLAG_OPEN   = "gmResHudOpen";     // bool  — HUD aberto
const FLAG_POS    = "gmResHudPos";      // { left, top }
const FLAG_MIN    = "gmResHudMin";      // bool  — minimizado
const FLAG_HIDDEN = "gmResHudHidden";   // [actorId] — personagens ocultos

let hudEl = null;

/* -------------------------------------------- */
/*  Estilos (injetados via JS)                  */
/* -------------------------------------------- */

const STYLE_ID = "jj-gm-res-hud-styles";
const CSS_TEXT = `
#jj-gm-res-hud {
  position: fixed; z-index: 61; width: 320px; max-width: 92vw;
  display: flex; flex-direction: column;
  border: 1px solid rgba(200,168,75,0.55); border-radius: 10px;
  background: linear-gradient(135deg, #181c26 0%, #0b0d12 100%);
  box-shadow: 0 4px 18px rgba(0,0,0,.55), 0 0 14px rgba(200,168,75,.2), inset 0 1px 0 rgba(200,168,75,.1);
  font-family: var(--dnd5e-font-roboto, sans-serif); user-select: none;
}
#jj-gm-res-hud .jj-gr-header {
  display: flex; align-items: center; gap: 6px; padding: 6px 8px;
  border-bottom: 1px solid rgba(200,168,75,.25); cursor: grab; color: #d9b355;
}
#jj-gm-res-hud .jj-gr-header:active { cursor: grabbing; }
#jj-gm-res-hud .jj-gr-header > i { font-size: 12px; opacity: .9; }
#jj-gm-res-hud .jj-gr-title { flex: 1 1 auto; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
#jj-gm-res-hud .jj-gr-hbtn {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; padding: 0; border: none; border-radius: 4px;
  background: none; color: #8a7a4a; font-size: 12px; cursor: pointer; transition: background .12s, color .12s;
}
#jj-gm-res-hud .jj-gr-hbtn:hover { background: rgba(200,168,75,.18); color: #e8d9a8; }
#jj-gm-res-hud .jj-gr-hbtn.jj-gr-close:hover { background: rgba(200,80,80,.22); color: #ff7676; }
#jj-gm-res-hud.is-min .jj-gr-body { display: none; }
#jj-gm-res-hud.is-min .jj-gr-header { border-bottom: none; }

#jj-gm-res-hud .jj-gr-body { display: flex; flex-direction: column; gap: 6px; padding: 7px; max-height: 64vh; overflow-y: auto; }
#jj-gm-res-hud .jj-gr-group { display: flex; flex-direction: column; gap: 4px; }
#jj-gm-res-hud .jj-gr-player {
  display: flex; align-items: center; gap: 6px; padding: 2px 4px; margin-bottom: 1px;
  font-size: 9px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #aeb4c0;
  border-left: 2px solid var(--pc, #c8a84b);
}
#jj-gm-res-hud .jj-gr-player .jj-gr-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; background: var(--pc, #c8a84b); box-shadow: 0 0 5px var(--pc, #c8a84b); }
#jj-gm-res-hud .jj-gr-pname { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#jj-gm-res-hud .jj-gr-pcount { flex: 0 0 auto; min-width: 14px; padding: 0 4px; text-align: center; border-radius: 8px; background: rgba(255,255,255,.08); color: #cfd4dd; font-size: 8px; font-weight: 800; }

#jj-gm-res-hud .jj-gr-card {
  display: flex; flex-direction: column; gap: 4px; padding: 5px 6px;
  border: 1px solid rgba(200,168,75,.24); border-radius: 8px; background: rgba(200,168,75,.05);
}
#jj-gm-res-hud .jj-gr-cardtop { display: flex; align-items: center; gap: 6px; }
#jj-gm-res-hud .jj-gr-img { width: 24px; height: 24px; border-radius: 5px; object-fit: cover; border: 1px solid rgba(200,168,75,.3); flex: 0 0 auto; background: #000; }
#jj-gm-res-hud .jj-gr-name { flex: 1 1 auto; min-width: 0; font-size: 12px; font-weight: 700; color: #e8d9a8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#jj-gm-res-hud .jj-gr-lvl { flex: 0 0 auto; min-width: 16px; padding: 0 4px; text-align: center; border-radius: 8px; background: rgba(200,168,75,.16); color: #ffd76b; font-size: 10px; font-weight: 800; line-height: 15px; }
#jj-gm-res-hud .jj-gr-eye {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border: none; border-radius: 5px; background: none;
  color: #6c6c78; font-size: 11px; cursor: pointer; transition: color .12s, background .12s;
}
#jj-gm-res-hud .jj-gr-eye:hover { color: #d9b355; background: rgba(200,168,75,.12); }
#jj-gm-res-hud .jj-gr-aura { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 4px; font-size: 9px; }
#jj-gm-res-hud .jj-gr-aura.on  { color: #ffd76b; background: rgba(200,168,75,.16); }
#jj-gm-res-hud .jj-gr-aura.off { color: #5a6070; background: rgba(60,60,70,.3); }

/* recursos (editáveis) — BARRAS horizontais empilhadas */
#jj-gm-res-hud .jj-gr-bars { display: flex; flex-direction: column; gap: 3px; }
#jj-gm-res-hud .jj-gr-brow {
  display: flex; align-items: center; gap: 6px; padding: 2px 5px;
  border: 1px solid transparent; border-radius: 6px; background: rgba(0,0,0,.25);
}
#jj-gm-res-hud .jj-gr-brow.is-active { border-color: rgba(200,168,75,.5); background: rgba(200,168,75,.09); }
#jj-gm-res-hud .jj-gr-blbl { flex: 0 0 28px; font-size: 8px; font-weight: 800; letter-spacing: .03em; text-transform: uppercase; color: #9098a8; }
#jj-gm-res-hud .jj-gr-btrack { flex: 1 1 auto; min-width: 20px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.07); overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,.4); }
#jj-gm-res-hud .jj-gr-bfill { height: 100%; border-radius: 4px; background: #999; transition: width .2s ease; }
#jj-gm-res-hud .jj-gr-bnum { flex: 0 0 auto; display: flex; align-items: baseline; gap: 1px; }
#jj-gm-res-hud .jj-gr-bnum i { font-style: normal; color: #7a7f8c; font-size: 10px; }
#jj-gm-res-hud .jj-gr-bnum b { font-weight: 700; color: #aeb4c0; font-size: 11px; }
#jj-gm-res-hud .jj-gr-btemp { color: #9be29b; font-size: 9px; font-weight: 800; margin: 0 1px; }
#jj-gm-res-hud .jj-gr-bger { flex: 0 0 auto; display: flex; align-items: center; gap: 2px; padding-left: 5px; margin-left: 1px; border-left: 1px solid rgba(200,168,75,.2); color: #ffd76b; }
#jj-gm-res-hud .jj-gr-bger i { font-size: 9px; }
#jj-gm-res-hud .jj-gr-brow input {
  width: 40px; padding: 1px 2px; text-align: center; font-size: 12px; font-weight: 800; line-height: 1.1;
  background: rgba(0,0,0,.4); border: 1px solid rgba(200,168,75,.26); border-radius: 4px; color: #e8d9a8;
  -moz-appearance: textfield;
}
#jj-gm-res-hud .jj-gr-bger input { width: 30px; color: #9be29b; }
#jj-gm-res-hud .jj-gr-brow input::-webkit-outer-spin-button,
#jj-gm-res-hud .jj-gr-brow input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
#jj-gm-res-hud .jj-gr-brow input:focus { outline: none; border-color: #d9b355; background: rgba(0,0,0,.55); }
/* gradientes por recurso */
#jj-gm-res-hud .jj-gr-brow.is-hp   .jj-gr-bfill { background: linear-gradient(90deg, #d94b4b, #ff9a9a); }
#jj-gm-res-hud .jj-gr-brow.is-hp   .jj-gr-bnum input { color: #ff8a8a; }
#jj-gm-res-hud .jj-gr-brow.is-vit  .jj-gr-bfill { background: linear-gradient(90deg, #4faf6b, #bff7c8); }
#jj-gm-res-hud .jj-gr-brow.is-vit  .jj-gr-bnum input { color: #b6f5c0; }
#jj-gm-res-hud .jj-gr-brow.is-aura .jj-gr-bfill { background: linear-gradient(90deg, #3673c4, #8ec2ff); }
#jj-gm-res-hud .jj-gr-brow.is-aura .jj-gr-bnum input { color: #7fb8ff; }
/* alerta de recurso baixo (≤25%) — pisca vermelho */
#jj-gm-res-hud .jj-gr-brow.is-low .jj-gr-bfill { background: #ff5a5a; animation: jj-gr-pulse 1.1s ease-in-out infinite; }
@keyframes jj-gr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

/* derivados (só leitura) — faixa compacta de 1 linha */
#jj-gm-res-hud .jj-gr-derived { display: flex; gap: 3px; }
#jj-gm-res-hud .jj-gr-dcell {
  flex: 1 1 0; display: flex; align-items: baseline; justify-content: center; gap: 3px;
  padding: 2px 3px; border-radius: 5px; background: rgba(0,0,0,.25);
  font-size: 12px; font-weight: 800; color: #e8d9a8; white-space: nowrap;
}
#jj-gm-res-hud .jj-gr-dcell i { font-style: normal; font-size: 8px; font-weight: 700; letter-spacing: .02em; text-transform: uppercase; color: #8891a3; }

#jj-gm-res-hud .jj-gr-hidden { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; padding-top: 6px; margin-top: 2px; border-top: 1px solid rgba(200,168,75,.18); }
#jj-gm-res-hud .jj-gr-hidden .jj-gr-hsub { font-size: 8px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #6c7280; }
#jj-gm-res-hud .jj-gr-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px;
  border: 1px solid #44444f; border-radius: 999px; background: rgba(60,60,70,.35);
  color: #9aa0ac; font-size: 10px; font-weight: 600; cursor: pointer; transition: color .12s, border-color .12s;
}
#jj-gm-res-hud .jj-gr-chip:hover { color: #e8d9a8; border-color: #d9b355; }
#jj-gm-res-hud .jj-gr-empty { padding: 10px 4px; text-align: center; font-size: 11px; color: #6c7280; }
`;

function injectStyles() {
  if ( document.getElementById(STYLE_ID) ) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

/* -------------------------------------------- */
/*  Dados                                        */
/* -------------------------------------------- */

const hiddenSet = () => new Set(game.user.getFlag(SCOPE, FLAG_HIDDEN) ?? []);

/** Jogadores (não-GM) → personagens que possuem. Cada personagem aparece uma vez
 *  (sob o primeiro dono, priorizando o personagem atribuído ao usuário). */
function playerRoster() {
  const users = game.users.filter(u => !u.isGM).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const seen = new Set();
  const groups = [];
  // 1ª passada: o personagem ATRIBUÍDO fica com seu usuário
  for ( const u of users ) {
    const c = u.character;
    if ( c?.type === "character" && !seen.has(c.id) ) seen.add(c.id);
  }
  for ( const u of users ) {
    const chars = game.actors.filter(a =>
      a.type === "character" && a.testUserPermission(u, "OWNER")
      && (u.character?.id === a.id || !seen.has(a.id) || false));
    // dedup final: só entra se ainda não foi colocado em outro grupo
    const finais = [];
    for ( const a of chars ) {
      if ( groups.some(g => g.chars.includes(a)) ) continue;
      finais.push(a);
    }
    finais.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    if ( finais.length ) groups.push({ user: u, chars: finais });
  }
  return groups;
}

/** Bônus de acerto da ARMA — o MESMO valor que o inventário mostra na coluna
 *  "ROLAR" (parseInt(labels.modifier), igual base-actor-sheet), pegando a arma de
 *  maior acerto. Prefere as EQUIPADAS, mas cai em qualquer arma que ataque caso
 *  nenhuma esteja marcada como equipada; sem arma, estimativa (prof + melhor mod). */
function atkNormalOf(a) {
  let eq = null, any = null;
  for ( const w of (a.items ?? []) ) {
    if ( w.type !== "weapon" || !w.hasAttack ) continue;
    const n = parseInt(w.labels?.modifier);   // mesma leitura da coluna "ROLAR"
    if ( !Number.isFinite(n) ) continue;
    if ( any == null || n > any ) any = n;
    if ( w.system?.equipped && (eq == null || n > eq) ) eq = n;
  }
  if ( eq != null ) return eq;
  if ( any != null ) return any;
  const s = a.system ?? {};
  return (s.attributes?.prof ?? 0) + Math.max(s.abilities?.str?.mod ?? 0, s.abilities?.dex?.mod ?? 0);
}

function statsOf(a) {
  const s = a.system ?? {};
  return {
    // Vida (hp) e Vitalidade (pve) são pools SEPARADOS; a aura decide qual "vale"
    hpVal: s.attributes?.hp?.value ?? 0,
    hpMax: s.attributes?.hp?.max ?? 0,
    vitVal: s.attributes?.pve?.value ?? 0,
    vitMax: s.attributes?.pve?.max ?? 0,
    auraOn: !!s.attributes?.auraOn,        // aura ligada → Vida em jogo; senão → Vitalidade
    auraTotal: s.energy?.total ?? 0,
    auraMax: s.energy?.max ?? 0,
    auraGer: s.energy?.generated ?? 0,
    pp: s.skills?.prc?.passive ?? 0,
    atkNormal: atkNormalOf(a),
    atkTec: s.attributes?.spell?.attack ?? 0,
    cd: s.attributes?.spell?.dc ?? 0,
    level: s.details?.level ?? 1,
    hpTemp: s.attributes?.hp?.temp ?? 0,
    vitTemp: s.attributes?.pve?.temp ?? 0
  };
}

const sinal = n => `${n >= 0 ? "+" : ""}${n}`;
const pct = (v, m) => m > 0 ? Math.max(0, Math.min(100, Math.round(100 * v / m))) : 0;

/* -------------------------------------------- */
/*  Render                                       */
/* -------------------------------------------- */

/** Barra horizontal de recurso (PV / VIT / AURA), empilhável. Valor editável; a
 *  barra preenche por val/max. `ger` (opcional, pode ser 0) anexa a Aura Gerada
 *  editável NO FIM da linha — usado só na barra de Aura. Destaque no pool ativo. */
function barRow({ cls, lbl, tip, field, val, max = 0, active = false, ger = null, temp = 0 }) {
  const p = max > 0 ? pct(val, max) : 0;
  const fill = max > 0 ? `<div class="jj-gr-bfill" style="width:${p}%"></div>` : "";
  const tempHtml = temp > 0 ? `<span class="jj-gr-btemp" data-tooltip="Temporário">+${temp}</span>` : "";
  const gerHtml = ger != null
    ? `<span class="jj-gr-bger" data-tooltip="Aura gerada por turno"><i class="fas fa-bolt" inert></i><input type="number" data-field="system.energy.generated" value="${ger}"></span>`
    : "";
  const low = max > 0 && val > 0 && p <= 25 ? " is-low" : "";   // alerta de recurso baixo
  return `
    <div class="jj-gr-brow ${cls}${active ? " is-active" : ""}${low}" data-tooltip="${tip}">
      <span class="jj-gr-blbl">${lbl}</span>
      <div class="jj-gr-btrack">${fill}</div>
      <span class="jj-gr-bnum"><input type="number" data-field="${field}" value="${val}">${tempHtml}<i>/</i><b>${max}</b></span>
      ${gerHtml}
    </div>`;
}

/** Faixa compacta dos derivados (só leitura), numa linha só. */
function derivedStrip(st) {
  const cell = (lbl, val, tip) => `<span class="jj-gr-dcell" data-tooltip="${tip}"><i>${lbl}</i>${val}</span>`;
  return `<div class="jj-gr-derived">
    ${cell("Perc", st.pp, "Percepção Passiva")}
    ${cell("Atk", sinal(st.atkNormal), "Acerto da arma equipada (maior). Sem arma: estimativa prof + melhor mod")}
    ${cell("Téc", sinal(st.atkTec), "Acerto — Técnica")}
    ${cell("CD", st.cd, "CD (dificuldade das técnicas)")}
  </div>`;
}

function cardHtml(a) {
  const st = statsOf(a);
  const esc = foundry.utils.escapeHTML;
  return `
    <div class="jj-gr-card" data-actor-id="${a.id}">
      <div class="jj-gr-cardtop">
        <img class="jj-gr-img" src="${a.img}" alt="">
        <span class="jj-gr-name" title="${esc(a.name)}">${esc(a.name)}</span>
        <span class="jj-gr-lvl" data-tooltip="Nível">${st.level}</span>
        <span class="jj-gr-aura ${st.auraOn ? "on" : "off"}" data-tooltip="${st.auraOn ? "Aura ligada (Vida em jogo)" : "Zetsu — Vitalidade em jogo"}"><i class="fas ${st.auraOn ? "fa-bolt" : "fa-bolt-slash"}" inert></i></span>
        <button type="button" class="jj-gr-eye" data-act="sheet" data-tooltip="Abrir ficha" aria-label="Abrir ficha"><i class="fas fa-id-badge" inert></i></button>
        <button type="button" class="jj-gr-eye" data-act="hide" data-tooltip="Ocultar este personagem" aria-label="Ocultar"><i class="fas fa-eye-slash" inert></i></button>
      </div>
      <div class="jj-gr-bars">
        ${barRow({ cls: "is-hp",   lbl: "PV",   tip: "Pontos de Vida",       field: "system.attributes.hp.value",  val: st.hpVal,     max: st.hpMax,   active: st.auraOn,  temp: st.hpTemp })}
        ${barRow({ cls: "is-vit",  lbl: "VIT",  tip: "Pontos de Vitalidade", field: "system.attributes.pve.value", val: st.vitVal,    max: st.vitMax,  active: !st.auraOn, temp: st.vitTemp })}
        ${barRow({ cls: "is-aura", lbl: "AURA", tip: "Aura atual · Gerada no fim", field: "system.energy.total",     val: st.auraTotal, max: st.auraMax, ger: st.auraGer })}
      </div>
      ${derivedStrip(st)}
    </div>`;
}

function bodyHtml() {
  const hidden = hiddenSet();
  const groups = playerRoster();
  const esc = foundry.utils.escapeHTML;

  const visiveis = groups.map(g => {
    const visChars = g.chars.filter(a => !hidden.has(a.id));
    if ( !visChars.length ) return "";
    const cor = String(g.user.color?.css ?? g.user.color ?? "#c8a84b");
    return `<div class="jj-gr-group" style="--pc:${cor}">
      <div class="jj-gr-player"><span class="jj-gr-dot"></span><span class="jj-gr-pname">${esc(g.user.name)}</span><span class="jj-gr-pcount">${visChars.length}</span></div>
      ${visChars.map(cardHtml).join("")}</div>`;
  }).join("");

  // chips dos ocultos (de qualquer grupo)
  const todos = groups.flatMap(g => g.chars);
  const ocultos = todos.filter(a => hidden.has(a.id));
  const chips = ocultos.length
    ? `<div class="jj-gr-hidden"><span class="jj-gr-hsub">Ocultos:</span>${ocultos.map(a =>
        `<button type="button" class="jj-gr-chip" data-act="show" data-actor-id="${a.id}"><i class="fas fa-eye" inert></i>${esc(a.name)}</button>`).join("")}</div>`
    : "";

  if ( !visiveis && !chips ) return `<div class="jj-gr-empty">Nenhum personagem de jogador encontrado.</div>`;
  return (visiveis || `<div class="jj-gr-empty">Todos os personagens estão ocultos.</div>`) + chips;
}

function shellHtml() {
  return `
    <div class="jj-gr-header" data-drag-handle>
      <i class="fas fa-users-gear" inert></i>
      <span class="jj-gr-title">Recursos dos Jogadores</span>
      <button type="button" class="jj-gr-hbtn jj-gr-min" data-tooltip="Minimizar" aria-label="Minimizar"><i class="fas fa-window-minimize" inert></i></button>
      <button type="button" class="jj-gr-hbtn jj-gr-close" data-tooltip="Fechar" aria-label="Fechar"><i class="fas fa-xmark" inert></i></button>
    </div>
    <div class="jj-gr-body">${bodyHtml()}</div>`;
}

function removeHud() { hudEl?.remove(); hudEl = null; }

/** (Re)desenha o HUD conforme o flag de aberto/estado. GM-only. */
export function renderGmResourceHud() {
  if ( !game.user.isGM || !game.user.getFlag(SCOPE, FLAG_OPEN) ) { removeHud(); return; }
  if ( hudEl ) { refreshBody(); return; }
  try {
    injectStyles();

    hudEl = document.createElement("div");
    hudEl.id = "jj-gm-res-hud";
    if ( game.user.getFlag(SCOPE, FLAG_MIN) ) hudEl.classList.add("is-min");
    hudEl.innerHTML = shellHtml();

    const pos = game.user.getFlag(SCOPE, FLAG_POS);
    if ( pos && Number.isFinite(pos.left) && Number.isFinite(pos.top) ) {
      hudEl.style.left = `${pos.left}px`; hudEl.style.top = `${pos.top}px`;
    } else {
      hudEl.style.right = "16px"; hudEl.style.top = "80px";
    }

    document.body.appendChild(hudEl);
    attachShellListeners();
    attachBodyListeners();
    makeDraggable();
  } catch ( err ) {
    console.error("hunter-system | HUD de recursos falhou ao renderizar", err);
    removeHud();
    ui.notifications?.error("HUD de Recursos falhou — veja o console (F12).");
  }
}

function refreshBody() {
  const body = hudEl?.querySelector(".jj-gr-body");
  if ( !body ) return;
  // não pisa no input que o Narrador está editando agora
  if ( body.contains(document.activeElement) && document.activeElement?.tagName === "INPUT" ) return;
  body.innerHTML = bodyHtml();
  attachBodyListeners();
}

/* -------------------------------------------- */
/*  Listeners                                    */
/* -------------------------------------------- */

function attachShellListeners() {
  const min = hudEl?.querySelector(".jj-gr-min");
  const close = hudEl?.querySelector(".jj-gr-close");
  [min, close].forEach(b => b?.addEventListener("pointerdown", e => e.stopPropagation())); // não arrasta
  min?.addEventListener("click", async e => {
    e.stopPropagation();
    const novo = !game.user.getFlag(SCOPE, FLAG_MIN);
    hudEl.classList.toggle("is-min", novo);
    await game.user.setFlag(SCOPE, FLAG_MIN, novo);
  });
  close?.addEventListener("click", e => { e.stopPropagation(); closeHud(); });
}

function attachBodyListeners() {
  // edição de PV / Aura / Gerada
  hudEl?.querySelectorAll(".jj-gr-brow input").forEach(inp => {
    inp.addEventListener("change", () => {
      const card = inp.closest("[data-actor-id]");
      const a = game.actors.get(card?.dataset.actorId);
      if ( !a ) return;
      const v = Math.max(0, parseInt(inp.value) || 0);
      a.update({ [inp.dataset.field]: v });
    });
    // Enter aplica e sai
    inp.addEventListener("keydown", e => { if ( e.key === "Enter" ) inp.blur(); });
  });
  // ocultar / abrir ficha
  hudEl?.querySelectorAll(".jj-gr-eye").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.closest("[data-actor-id]")?.dataset.actorId;
      if ( !id ) return;
      if ( btn.dataset.act === "sheet" ) { game.actors.get(id)?.sheet?.render(true); return; }
      if ( btn.dataset.act === "hide" ) {
        const h = hiddenSet(); h.add(id);
        await game.user.setFlag(SCOPE, FLAG_HIDDEN, [...h]);
        refreshBody();
      }
    });
  });
  // reexibir (chips)
  hudEl?.querySelectorAll(".jj-gr-chip[data-act='show']").forEach(chip => {
    chip.addEventListener("click", async () => {
      const h = hiddenSet(); h.delete(chip.dataset.actorId);
      await game.user.setFlag(SCOPE, FLAG_HIDDEN, [...h]);
      refreshBody();
    });
  });
}

/* -------------------------------------------- */
/*  Arrastar                                     */
/* -------------------------------------------- */

function makeDraggable() {
  const handle = hudEl?.querySelector("[data-drag-handle]");
  if ( !handle ) return;
  let startX, startY, origLeft, origTop;
  const onMove = e => {
    const left = Math.max(0, Math.min(window.innerWidth  - 44, origLeft + (e.clientX - startX)));
    const top  = Math.max(0, Math.min(window.innerHeight - 20, origTop  + (e.clientY - startY)));
    hudEl.style.left = `${left}px`; hudEl.style.top = `${top}px`; hudEl.style.right = "auto";
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const rect = hudEl.getBoundingClientRect();
    game.user.setFlag(SCOPE, FLAG_POS, { left: Math.round(rect.left), top: Math.round(rect.top) });
  };
  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    const rect = hudEl.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY; origLeft = rect.left; origTop = rect.top;
    hudEl.style.left = `${rect.left}px`; hudEl.style.top = `${rect.top}px`; hudEl.style.right = "auto";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

/* -------------------------------------------- */
/*  Abrir / fechar                              */
/* -------------------------------------------- */

async function openHud()  { await game.user.setFlag(SCOPE, FLAG_OPEN, true);  renderGmResourceHud(); }
async function closeHud() { await game.user.setFlag(SCOPE, FLAG_OPEN, false); removeHud(); }
export function toggleGmResourceHud() {
  if ( !game.user.isGM ) return;
  game.user.getFlag(SCOPE, FLAG_OPEN) ? closeHud() : openHud();
}

/* -------------------------------------------- */
/*  Ciclo de vida                               */
/* -------------------------------------------- */

Hooks.on("updateActor", (actor) => {
  if ( hudEl && actor?.type === "character" ) refreshBody();
});
Hooks.on("updateUser", () => { if ( hudEl ) refreshBody(); });   // troca de personagem/cor
Hooks.on("createActor", (a) => { if ( hudEl && a?.type === "character" ) refreshBody(); });
Hooks.on("deleteActor", (a) => { if ( hudEl && a?.type === "character" ) refreshBody(); });

/** Adiciona o botão ao grupo "GM Tools" (criado pelo session-log); cai no "Notes"
 *  se não houver. Registrado TARDE (no ready) de propósito — ver comentário abaixo. */
function addGmToolsButton(controls) {
  if ( !game.user?.isGM ) return;
  const grupo = controls.gmTools ?? controls.notes;
  if ( !grupo?.tools ) return;
  grupo.tools.gmResourceHud = {
    name: "gmResourceHud",
    order: 3,
    title: "Recursos dos Jogadores",
    icon: "fa-solid fa-users-gear",
    button: true,
    visible: game.user.isGM,
    onChange: () => { if ( game.user.isGM ) toggleGmResourceHud(); }
  };
}

// Atalho de teclado (o GM define a tecla em Configurar Controles) — via 100% confiável.
Hooks.once("init", () => {
  game.keybindings.register(SCOPE, "gmResourceHud", {
    name: "Recursos dos Jogadores (HUD do Narrador)",
    hint: "Abre/fecha o painel de recursos dos jogadores.",
    editable: [],
    restricted: true,
    onDown: () => { toggleGmResourceHud(); return true; }
  });
});

Hooks.on("ready", () => {
  game.hunterGmResourceHud = toggleGmResourceHud;   // fallback: game.hunterGmResourceHud()
  // registra o botão SÓ AGORA (no ready): como este arquivo carrega cedo (via
  // character-sheet), se registrasse o hook no escopo do módulo ele rodaria ANTES
  // do session-log criar o grupo gmTools, e o botão caía no grupo errado. No ready,
  // o hook do session-log já existe → o nosso roda depois → cai no gmTools certo.
  Hooks.on("getSceneControlButtons", addGmToolsButton);
  ui.controls?.render({ reset: true });   // reset:true re-dispara getSceneControlButtons (force sozinho NÃO — ver scene-controls.mjs:277)
  renderGmResourceHud();
});
