/**
 * jj/heal-limit.mjs
 * Gatilhos de reset do "Limite Total de Cura" da atividade Cura:
 *   • Descanso Curto / Longo (com contagem de N descansos longos)
 *   • Técnica específica (reseta ao ser usada)
 * O consumo e o cap ao saldo ficam na própria atividade (heal-data / heal.mjs)
 * e, para o card customizado, em character-sheet.mjs (_applyHealLimit).
 * Também trata a CURA AUTOMÁTICA por turno (healLimit.autoHeal).
 */

const SCOPE = "hunter-system";

/** Só um cliente age: GM ativo (se houver) ou o dono do ator. */
function _canAct(actor) {
  const gm = game.users?.activeGM;
  return gm ? (gm === game.user) : (actor?.isOwner === true);
}

/** Gera as atividades de cura COM limite configurado de um ator. */
function* _healActivities(actor) {
  for ( const item of actor.items ) {
    const acts = item.system?.activities;
    if ( !acts ) continue;
    for ( const act of acts ) {
      if ( act.type === "heal" && act.healLimit?.formula?.trim() ) yield act;
    }
  }
}

async function _reset(act, motivo) {
  const lim = act.healLimit ?? {};
  if ( (lim.spent ?? 0) === 0 && (lim.restCount ?? 0) === 0 ) return;
  await act.update({ "healLimit.spent": 0, "healLimit.restCount": 0 });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: act.item.actor }),
    content: `💚 Limite de cura de <b>${act.item.name}</b> foi resetado (${motivo}).`
  });
}

// ── Descansos: reseta Descanso Curto / Descanso Longo (com contagem) ─────────
Hooks.on("dnd5e.restCompleted", async (actor, result) => {
  if ( !actor || !_canAct(actor) ) return;
  const isLong = result?.longRest ?? (result?.type === "long");
  for ( const act of _healActivities(actor) ) {
    const reset = act.healLimit.reset;
    if ( reset === "shortRest" ) {
      // Descanso longo também concede o benefício do curto.
      await _reset(act, "descanso");
    } else if ( reset === "longRest" && isLong ) {
      const need = Math.max(1, act.healLimit.longRests ?? 1);
      const cnt = (act.healLimit.restCount ?? 0) + 1;
      if ( cnt >= need ) await _reset(act, need > 1 ? `${need} descansos longos` : "descanso longo");
      else await act.update({ "healLimit.restCount": cnt });
    }
  }
});

/**
 * Reseta os Limites de Cura configurados com "Resetar com: Técnica específica"
 * quando o item dessa técnica é usado. Exportado porque o `dnd5e.preUseActivity`
 * usa `Hooks.call` (para no 1º listener que retorna false), e os cards
 * customizados (ataque/cura/dano/save/utility/redução) vetam antes do listener
 * global — então este reset é chamado também de dentro de cada card.
 * @param {Activity} activity  Atividade usada (a técnica gatilho).
 */
export function resetHealLimitsByTechnique(activity) {
  const usedItem = activity?.item;
  const actor = usedItem?.actor;
  if ( !actor || !_canAct(actor) ) return;
  for ( const act of _healActivities(actor) ) {
    if ( (act.healLimit.reset === "technique")
      && act.healLimit.technique
      && (act.healLimit.technique === usedItem.id)
      && (act.id !== activity.id) ) {
      _reset(act, `técnica: ${usedItem.name}`);
    }
  }
}

// ── preUseActivity (caminho padrão / tipos sem card customizado, ex.: transform):
//    veta a Cura com limite esgotado e dispara o reset-por-técnica. Para os tipos
//    com card customizado, isto é coberto pelos próprios cards (ver chamadas a
//    resetHealLimitsByTechnique em character-sheet.mjs). ─────────────────────────
Hooks.on("dnd5e.preUseActivity", (activity) => {
  if ( activity?.type === "heal" ) {
    const lim = activity.getHealLimit?.();
    if ( lim?.enabled && lim.remaining <= 0 ) {
      ui.notifications.warn(`${activity.item?.name}: limite de cura esgotado — é preciso resetar para curar novamente.`);
      return false;
    }
  }
  resetHealLimitsByTechnique(activity);
});

/* -------------------------------------------- */
/*  Cura automática por turno                   */
/* -------------------------------------------- */

/** Rola a cura (capada pelo limite) e aplica no ator. */
async function _autoHeal(actor, activity) {
  const formula = activity.healing?.formula?.trim();
  if ( !formula ) return;
  const lim = activity.getHealLimit?.() ?? { enabled: false };
  if ( lim.enabled && lim.remaining <= 0 ) return; // limite esgotado

  const rollData = actor.getRollData();
  const expr = lim.enabled ? `min(${lim.remaining}, (${formula}))` : `(${formula})`;
  let roll;
  try { roll = await new Roll(expr, rollData).evaluate(); }
  catch(e) { console.error("HunterLegacy | auto-cura: fórmula inválida:", formula, e); return; }
  game.dice3d?.showForRoll(roll, game.user, true);

  const curado = lim.enabled ? Math.max(0, Math.min(roll.total, lim.remaining)) : Math.max(0, roll.total);
  if ( curado <= 0 ) return;

  const hp = actor.system.attributes?.hp ?? {};
  const novoHP = Math.min(hp.max ?? Infinity, (hp.value ?? 0) + curado);
  await actor.update({ "system.attributes.hp.value": novoHP });
  if ( lim.enabled ) await activity.update({ "healLimit.spent": Math.min(lim.max, lim.spent + curado) });

  const restante = lim.enabled ? Math.max(0, lim.max - Math.min(lim.max, lim.spent + curado)) : null;
  const msg = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `💚 <b>${activity.item.name}</b> curou automaticamente <b>${curado}</b> no início do turno.`
      + (restante !== null ? ` (limite: ${restante} restante)` : "")
  };
  ChatMessage.applyRollMode(msg, game.settings.get("core", "rollMode"));   // respeita Público/Privado/Cego
  ChatMessage.create(msg);
}

// No início do turno do dono, cura as técnicas ATIVAS com autoHeal marcado.
Hooks.on("combatTurnChange", async (combat, prior, current) => {
  const actor = combat.combatants.get(current?.combatantId)?.actor;
  if ( !actor || !_canAct(actor) ) return;
  const upkeep = actor.getFlag(SCOPE, "upkeep");
  if ( !upkeep || foundry.utils.isEmpty(upkeep) ) return;
  for ( const [activityId, info] of Object.entries(upkeep) ) {
    const act = actor.items.get(info.itemId)?.system?.activities?.get(activityId);
    if ( act?.type === "heal" && act.healLimit?.autoHeal ) await _autoHeal(actor, act);
  }
});
