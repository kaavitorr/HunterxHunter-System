/**
 * jj/constant-cost.mjs
 * Custo Constante / Concentração: manutenção de PA por turno enquanto a técnica
 * estiver ativa. Liga ao USAR a atividade; drena no início de cada turno do dono;
 * desativa por falta de PA, pelo HUD de combate, ou ao fim do combate.
 * O custo efetivo é resolvido pela própria atividade (getConstantUpkeep):
 * Custo Constante (value) sobrepõe a Concentração (2 PA).
 */

const SCOPE = "hunter-system";
const FLAG = "upkeep";   // flag no ATOR: { [activityId]: { itemId, label } }

/** Só um cliente age: GM ativo (se houver) ou o dono do ator. */
function _canAct(actor) {
  const gm = game.users?.activeGM;
  return gm ? (gm === game.user) : (actor?.isOwner === true);
}

/** Resolve a atividade viva a partir de uma entrada de upkeep. */
function _activity(actor, info, activityId) {
  return actor.items.get(info?.itemId)?.system?.activities?.get(activityId) ?? null;
}

/**
 * Resolve se a atividade é "ativa/sustentada" e qual o custo. Prioridade:
 *   Custo Constante > Concentração > Duração não-instantânea (sem custo).
 * @param {Activity} activity
 * @returns {{active:boolean, value:number, pool:string, type:("constant"|"concentration"|"duration"|null)}}
 */
export function resolveSustained(activity) {
  // Redução Constante: sustentada por si só (independe de ter Custo Constante).
  // Drena o Custo Constante se houver; carrega a fórmula para a pipeline de dano.
  if ( activity?.type === "reduction" && activity.reduction?.constant ) {
    const cc = activity.getConstantUpkeep?.() ?? {};
    return {
      active: true,
      value: cc.active ? cc.value : 0,
      pool: cc.pool ?? "generated",
      type: "reduction",
      formula: (activity.reduction?.formula ?? "").trim() || "0"
    };
  }
  const up = activity?.getConstantUpkeep?.();
  if ( up?.active ) return up; // type: "constant" | "concentration"
  // Duração não-instantânea (na atividade OU no item/feitiço) → técnica ativa, sem custo.
  const units = [activity?.duration?.units, activity?.item?.system?.duration?.units];
  if ( units.some(u => u && u !== "inst") ) return { active: true, value: 0, pool: "generated", type: "duration" };
  return { active: false, value: 0, pool: "generated", type: null };
}

/**
 * Upkeeps ATIVOS e resolvidos do ator (para o HUD).
 * @returns {Array<{activityId:string, itemId:string, label:string, value:number, pool:string, type:string}>}
 */
export function getActorUpkeeps(actor) {
  const flag = actor?.getFlag(SCOPE, FLAG);
  if ( !flag ) return [];
  const out = [];
  for ( const [activityId, info] of Object.entries(flag) ) {
    const act = _activity(actor, info, activityId);
    const up = resolveSustained(act);
    if ( !up?.active ) continue;
    out.push({ activityId, itemId: info.itemId, label: info.label ?? act.item.name,
               value: up.value, pool: up.pool, type: up.type, formula: up.formula });
  }
  return out;
}

/** Desativa um upkeep específico (remove a entrada da flag). */
export async function deactivateUpkeep(actor, activityId) {
  const flag = actor?.getFlag(SCOPE, FLAG);
  if ( !flag || !(activityId in flag) ) return;
  const label = flag[activityId]?.label;
  await actor.update({ [`flags.${SCOPE}.${FLAG}.-=${activityId}`]: null });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `🌀 <b>${actor.name}</b> desativou a manutenção de <b>${label ?? "técnica"}</b>.`
  });
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

/**
 * Ativa o upkeep (Custo Constante / Concentração) de uma atividade. Chamado no
 * `dnd5e.preUseActivity` para cobrir TODOS os caminhos de uso — inclusive os
 * cards customizados (ataque, redução, extras) que vetam o fluxo padrão.
 */
export async function activateUpkeep(activity) {
  const actor = activity?.item?.actor;
  if ( !actor || !actor.isOwner ) return;
  const up = resolveSustained(activity);
  if ( !up?.active ) return;
  if ( actor.getFlag(SCOPE, FLAG)?.[activity.id] ) return; // já ativo

  const label = `${activity.item.name}${activity.name ? " — " + activity.name : ""}`;
  await actor.update({ [`flags.${SCOPE}.${FLAG}.${activity.id}`]: { itemId: activity.item.id, label } });

  const detalhe = up.type === "concentration" ? "<b>Concentração</b> 🧠"
    : up.type === "duration" ? "<b>Técnica Ativa</b> (duração)"
    : up.type === "reduction" ? `<b>Redução Constante</b> 🛡️ — <b>${up.formula}</b> por golpe${up.value > 0 ? ` (<b>${up.value} PA/turno</b>, ${up.pool === "total" ? "Total" : "Gerada"})` : ""}`
    : `<b>Custo Constante</b> — <b>${up.value} PA/turno</b> (${up.pool === "total" ? "Total" : "Gerada"})`;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `🌀 <b>${actor.name}</b> ativou ${detalhe} em ${label}. Desative no HUD de combate.`
  });
}

// preUseActivity usa Hooks.call, que PARA no primeiro listener que retorna false —
// os listeners seguintes (registrados depois deste, na ordem de import) não rodam.
// Por isso os cards customizados (ataque/cura/dano/salvaguarda/perícia/utilidade),
// que vetam o fluxo nativo, chamam activateUpkeep() diretamente ANTES do próprio
// veto — não dá pra depender deste hook aqui rodar depois deles.
Hooks.on("dnd5e.preUseActivity", (activity) => { activateUpkeep(activity); });

// Drena o custo no início do turno do dono; desativa quem não puder pagar.
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  const actor = combat.combatants.get(current?.combatantId)?.actor;
  if ( !actor || !_canAct(actor) ) return;
  const flag = actor.getFlag(SCOPE, FLAG);
  if ( !flag || foundry.utils.isEmpty(flag) ) return;

  let genLeft = actor.system.energy?.generated ?? 0;
  let totLeft = actor.system.energy?.total ?? 0;
  const gen0 = genLeft, tot0 = totLeft;
  const updates = {};
  const drained = [], deactivated = [];

  for ( const [activityId, info] of Object.entries(flag) ) {
    const act = _activity(actor, info, activityId);
    // resolveSustained (não getConstantUpkeep) para não purgar upkeeps sem custo
    // por turno — Redução Constante e Duração drenam 0 e permanecem ativos.
    const up = resolveSustained(act);
    const label = info.label ?? act?.item?.name ?? "técnica";
    if ( !up?.active ) { updates[`flags.${SCOPE}.${FLAG}.-=${activityId}`] = null; continue; }
    if ( up.pool === "total" ) {
      if ( totLeft >= up.value ) { totLeft -= up.value; drained.push(`${label}: −${up.value} (Total)`); }
      else { updates[`flags.${SCOPE}.${FLAG}.-=${activityId}`] = null; deactivated.push(label); }
    } else {
      if ( genLeft >= up.value ) { genLeft -= up.value; drained.push(`${label}: −${up.value} (Gerada)`); }
      else { updates[`flags.${SCOPE}.${FLAG}.-=${activityId}`] = null; deactivated.push(label); }
    }
  }

  if ( genLeft !== gen0 ) updates["system.energy.generated"] = genLeft;
  if ( totLeft !== tot0 ) updates["system.energy.total"] = totLeft;
  if ( foundry.utils.isEmpty(updates) ) return;
  await actor.update(updates, { isEnergySystem: true });

  if ( drained.length || deactivated.length ) {
    let content = `🌀 <b>${actor.name}</b> — manutenção de técnicas:`;
    if ( drained.length ) content += `<br>${drained.join("<br>")}`;
    if ( deactivated.length ) content += `<br><span style="color:#b22222;">Desativada(s) por falta de PA: ${deactivated.join(", ")}</span>`;
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
  }
});

// Limpa upkeeps ao encerrar o combate.
Hooks.on("deleteCombat", async (combat) => {
  for ( const c of (combat?.combatants ?? []) ) {
    const actor = c.actor;
    if ( !actor || !_canAct(actor) ) continue;
    const flag = actor.getFlag(SCOPE, FLAG);
    if ( flag && !foundry.utils.isEmpty(flag) ) await actor.unsetFlag(SCOPE, FLAG);
  }
});
