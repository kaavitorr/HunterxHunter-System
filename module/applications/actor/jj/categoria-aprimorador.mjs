/**
 * jj/categoria-aprimorador.mjs
 * Regras AUTOMÁTICAS da categoria Aprimorador — ligam sozinhas por classe/nível,
 * sem depender de itens no compêndio:
 *
 *   · SEM RECUAR (classe Aprimorador, nível 3+): efeito ativo com +1 CR a cada
 *     20 PV perdidos (máx +5), recalculado quando a Vida muda. A CR final não
 *     passa de 20 (nv 3-5), 24 (nv 6-11) ou 27 (nv 12+). A condição de "se
 *     afastar do inimigo" é julgamento humano: DESATIVAR o efeito zera o bônus;
 *     reativar recalcula.
 *
 *   · VIGOR ILIMITADO (classe Aprimorador, nível 3+): +3 PA (Aura atual) ao
 *     CAUSAR dano máximo no dado principal ou crítico (hook hunterDamageRolled,
 *     chamado pelos cards custom) e ao SOFRER crítico (hook hunterDamageApplied,
 *     chamado na aplicação de dano). Dano máximo SOFRIDO é indetectável → botão
 *     de punho injetado na sidebar da ficha. Teto de recuperação: 4 × nível,
 *     zerado no descanso longo.
 *
 *   · RESISTÊNCIA DO GIGANTE (Caminho/subclasse "aprimorador-fisico", nível 6+):
 *     redução fixa de 1 em TODO dano de PV sofrido (inclusive Verdadeiro), +1 no
 *     início de cada turno próprio em combate até o teto = nível; o fim do
 *     combate devolve à base 1. A pipeline de dano consome via reducaoDoGigante().
 */

const SCOPE = "hunter-system";
const EFF_FLAG = "semRecuar";           // flag do ActiveEffect "Sem Recuar"
const VIGOR_FLAG = "vigorIlimitado";    // flag do ator: { usado }
const GIGANTE_FLAG = "resistenciaGigante"; // flag do ator: { extra }
const AC_KEY = "system.attributes.ac.bonus";

/** Só um cliente age: GM ativo (se houver) ou o dono do ator. */
function _canAct(actor) {
  const gm = game.users?.activeGM;
  return gm ? (gm === game.user) : (actor?.isOwner === true);
}

const _norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const nivelDe = actor => Number(actor?.system?.details?.level ?? 0);

/** Classe Aprimorador + nível de personagem ≥ 3. */
export function ehAprimorador3(actor) {
  if ( actor?.type !== "character" || nivelDe(actor) < 3 ) return false;
  return actor.items.some(i => i.type === "class" && _norm(i.name).startsWith("aprimorador"));
}

/** Caminho (subclasse) Aprimorador Físico + nível de personagem ≥ 6. */
export function ehFisico6(actor) {
  if ( actor?.type !== "character" || nivelDe(actor) < 6 ) return false;
  return actor.items.some(i => i.type === "subclass"
    && (i.system?.identifier === "aprimorador-fisico"
      || _norm(i.name).replace(/\s+/g, "-") === "aprimorador-fisico"));
}

/* -------------------------------------------- */
/*  SEM RECUAR — efeito ativo recalculado        */
/* -------------------------------------------- */

const _tetoCR = nivel => nivel >= 12 ? 27 : nivel >= 6 ? 24 : 20;

/** (Re)calcula o efeito "Sem Recuar" do ator: cria, atualiza ou remove. */
async function atualizarSemRecuar(actor) {
  if ( actor?.type !== "character" || !_canAct(actor) ) return;
  const eff = actor.effects.find(e => e.getFlag(SCOPE, EFF_FLAG));
  if ( !ehAprimorador3(actor) ) {
    if ( eff ) await eff.delete().catch(() => null);
    return;
  }

  const hp = actor.system.attributes?.hp ?? {};
  const perdido = Math.max(0, (hp.max ?? 0) - (hp.value ?? 0));
  const bruto = Math.min(5, Math.floor(perdido / 20));
  const atual = Number(eff?.changes?.find(c => c.key === AC_KEY)?.value ?? 0);
  // CR base = CR atual MENOS o que o próprio efeito está somando (se ativo) —
  // assim armadura/escudo/outros efeitos continuam contando pro teto.
  const caAtual = Number(actor.system.attributes?.ac?.value ?? 10);
  const base = caAtual - ((eff && !eff.disabled) ? atual : 0);
  const teto = _tetoCR(nivelDe(actor));
  const efetivo = Math.max(0, Math.min(bruto, teto - base));

  if ( !eff ) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Sem Recuar",
      img: "icons/skills/melee/unarmed-punch-fist-yellow.webp",
      flags: { [SCOPE]: { [EFF_FLAG]: true } },
      changes: [{ key: AC_KEY, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(efetivo) }],
      description: "<p><b>Sem Recuar</b> — a cada 20 PV perdidos, +1 de Classe de Resistência (máx +5). "
        + "A CR não passa de 20/24/27 pelos níveis 3/6/12. "
        + "<em>Desative este efeito ao se afastar de uma criatura inimiga sem ir na direção de outra.</em></p>"
    }]).catch(() => null);
    return;
  }
  if ( eff.disabled ) return;   // o jogador "recuou": não mexe até religar
  if ( atual === efetivo ) return;
  await eff.update({
    changes: [{ key: AC_KEY, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(efetivo) }]
  }).catch(() => null);
}

// Vida mudou → recalcula (o update do próprio efeito não passa por aqui: é embedded).
Hooks.on("updateActor", (actor, changes) => {
  if ( actor.type !== "character" ) return;
  if ( foundry.utils.getProperty(changes, "system.attributes.hp") === undefined ) return;
  atualizarSemRecuar(actor);
});

// Religou o efeito → recalcula na hora (desligar não mexe em nada).
Hooks.on("updateActiveEffect", (eff, changes) => {
  if ( !eff.getFlag?.(SCOPE, EFF_FLAG) ) return;
  if ( changes.disabled === false ) atualizarSemRecuar(eff.parent);
});

// Classe/Caminho entrou, saiu ou subiu de nível → reavalia elegibilidade.
const _reavaliarPorItem = item => {
  if ( !["class", "subclass"].includes(item?.type) ) return;
  if ( item.parent instanceof Actor ) atualizarSemRecuar(item.parent);
};
Hooks.on("createItem", _reavaliarPorItem);
Hooks.on("updateItem", _reavaliarPorItem);
Hooks.on("deleteItem", _reavaliarPorItem);

// Varredura inicial: corrige efeitos de mundos que mudaram com o sistema fechado.
Hooks.on("ready", () => {
  for ( const a of game.actors ) {
    if ( a.type === "character" ) atualizarSemRecuar(a);
  }
});

/* -------------------------------------------- */
/*  VIGOR ILIMITADO — +3 PA, teto 4×nível        */
/* -------------------------------------------- */

const _tetoVigor = actor => 4 * Math.max(1, nivelDe(actor));

/** Concede +3 PA (ou o que restar do teto) e anota no contador. */
async function ganharVigor(actor, motivo) {
  if ( !ehAprimorador3(actor) ) return;
  const usado = Number(actor.getFlag(SCOPE, VIGOR_FLAG)?.usado ?? 0);
  const teto = _tetoVigor(actor);
  const ganho = Math.min(3, Math.max(0, teto - usado));
  if ( ganho <= 0 ) {
    ui.notifications.info(`Vigor Ilimitado esgotado (${usado}/${teto}) — um descanso longo restaura.`);
    return;
  }
  const en = actor.system.energy ?? {};
  const novoTotal = Math.min(Number(en.max ?? Infinity), Number(en.total ?? 0) + ganho);
  await actor.update({
    "system.energy.total": novoTotal,
    [`flags.${SCOPE}.${VIGOR_FLAG}.usado`]: usado + ganho
  }, { isEnergySystem: true });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `⚡ <b>${actor.name}</b> — Vigor Ilimitado: <b>+${ganho} PA</b> (${motivo}). `
      + `<span style="opacity:.75">${usado + ganho}/${teto} até o descanso longo.</span>`
  });
}

/** O dado principal (primeiro termo de dados) saiu todo no máximo? */
function dadoPrincipalMaximo(roll) {
  const die = roll?.dice?.[0];
  if ( !die || !die.results?.length ) return false;
  return die.results.filter(r => r.active !== false).every(r => r.result === die.faces);
}

// CAUSOU: os cards custom avisam ao finalizar uma rolagem de dano (ou marcar crit).
// `card` (elemento do card no chat) serve só de trava anti-duplo-ganho por card.
Hooks.on("hunterDamageRolled", (actor, { card = null, mainRoll = null, crit = false } = {}) => {
  if ( !actor || !ehAprimorador3(actor) ) return;
  if ( card?.dataset?.vigorOk === "1" ) return;
  if ( !crit && !dadoPrincipalMaximo(mainRoll) ) return;
  if ( card?.dataset ) card.dataset.vigorOk = "1";
  ganharVigor(actor, crit ? "acerto crítico" : "dano máximo no dado principal");
});

// SOFREU crítico: a aplicação de dano (PV e Vitalidade) avisa com o crit do card.
Hooks.on("hunterDamageApplied", (actor, { crit = false } = {}) => {
  if ( crit ) ganharVigor(actor, "crítico sofrido");
});

// Descanso longo restaura o teto.
Hooks.on("dnd5e.restCompleted", async (actor, result) => {
  if ( !actor || actor.type !== "character" ) return;
  const isLong = result?.longRest ?? (result?.type === "long");
  if ( !isLong ) return;
  const usado = Number(actor.getFlag(SCOPE, VIGOR_FLAG)?.usado ?? 0);
  if ( usado > 0 && ehAprimorador3(actor) ) {
    await actor.update({ [`flags.${SCOPE}.${VIGOR_FLAG}.usado`]: 0 }, { isRest: true });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `⚡ <b>${actor.name}</b> — Vigor Ilimitado restaurado (0/${_tetoVigor(actor)}).`
    });
  }
});

// Botão do punho na sidebar da ficha: o caso indetectável (dano máximo SOFRIDO).
Hooks.on("renderCharacterActorSheet", (app, html) => {
  const actor = app.actor ?? app.document;
  if ( !ehAprimorador3(actor) ) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  const anchor = root?.querySelector(".hc-generate-energy-btn");
  if ( !anchor || root.querySelector(".jj-vigor-btn") ) return;
  const usado = Number(actor.getFlag(SCOPE, VIGOR_FLAG)?.usado ?? 0);
  const btn = document.createElement("a");
  btn.className = "jj-vigor-btn";
  btn.innerHTML = `<i class="fas fa-hand-fist" inert></i>`;
  btn.dataset.tooltip = `Vigor Ilimitado — +3 PA ao sofrer/causar dano máximo ou crítico `
    + `(${usado}/${_tetoVigor(actor)}). Clique: registrar dano máximo SOFRIDO.`;
  btn.style.cssText = "cursor:pointer;margin-left:6px;color:#e0a040;font-size:12px;";
  btn.addEventListener("click", () => ganharVigor(actor, "dano máximo sofrido"));
  anchor.after(btn);
});

/* -------------------------------------------- */
/*  RESISTÊNCIA DO GIGANTE — Caminho físico 6+   */
/* -------------------------------------------- */

/**
 * Redução de dano fixa atual do ator (0 se inelegível): 1 + acúmulo de combate,
 * capada no nível de personagem. Consumida pela pipeline de dano do sheet.
 */
export function reducaoDoGigante(actor) {
  if ( !ehFisico6(actor) ) return 0;
  const extra = Number(actor.getFlag(SCOPE, GIGANTE_FLAG)?.extra ?? 0);
  return Math.min(1 + extra, Math.max(1, nivelDe(actor)));
}

// Início do turno do Físico em combate: +1 no acúmulo, até o teto = nível.
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  const actor = combat.combatants.get(current?.combatantId)?.actor;
  if ( !actor || !_canAct(actor) || !ehFisico6(actor) ) return;
  const nivel = nivelDe(actor);
  const extra = Number(actor.getFlag(SCOPE, GIGANTE_FLAG)?.extra ?? 0);
  const novo = Math.min(extra + 1, Math.max(0, nivel - 1));   // total = 1 + extra ≤ nível
  if ( novo === extra ) return;   // já no teto: silencioso
  await actor.setFlag(SCOPE, GIGANTE_FLAG, { extra: novo });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `🗿 <b>${actor.name}</b> — Resistência do Gigante: redução de dano <b>${1 + novo}</b>/${nivel}.`
  });
});

// Fim do combate: o acúmulo dissipa (volta à redução base 1).
Hooks.on("deleteCombat", async combat => {
  for ( const c of (combat?.combatants ?? []) ) {
    const actor = c.actor;
    if ( !actor || !_canAct(actor) ) continue;
    if ( actor.getFlag(SCOPE, GIGANTE_FLAG)?.extra ) {
      await actor.unsetFlag(SCOPE, GIGANTE_FLAG).catch(() => null);
    }
  }
});
