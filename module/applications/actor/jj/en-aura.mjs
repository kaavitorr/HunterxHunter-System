/**
 * en-aura.mjs — Automação do En (Nen).
 *
 * Ao ativar o En, cria uma zona circular (MeasuredTemplate) centrada no token, com
 * raio = área do En (base 3m; +6m por aquisição de "Expansão de Aura"). A zona segue
 * o token quando ele se move. No modo "total", drena 2 PA na ativação e no início de
 * cada turno; no modo "terco" (⅓ do alcance) não custa aura.
 *
 * Estado no ator (flags hunter-system): enAtivo, enModo, enTemplateId, enSceneId.
 * Importado por character-sheet.mjs — os Hooks abaixo se registram como efeito colateral.
 */
import { enAreaMeters } from "../../../systems/manipulation-data.mjs";

const SCOPE = "hunter-system";
const AURA_COLOR = "#c8a84b";

/** Token do ator na cena atual (linkado), ou null. */
function actorToken(actor) {
  return actor?.getActiveTokens?.(true)?.[0] ?? actor?.token?.object ?? null;
}

/** Raio da zona (em unidades da cena — o sistema usa metros) para o modo dado. */
function enRadius(actor, mode) {
  const full = enAreaMeters(actor);
  return mode === "terco" ? Math.max(1, Math.round(full / 3)) : full;
}

/** Ator está numa luta ativa (iniciada)? */
function actorInCombat(actor) {
  return !!(game.combat?.started && game.combat.combatants.some(c => c.actorId === actor.id));
}

/** Desconta 2 PA do En: em combate sai da Aura Gerada; fora de combate, da Aura Total. */
async function payEnUpkeep(actor, quando) {
  const emCombate = actorInCombat(actor);
  const path = emCombate ? "system.energy.generated" : "system.energy.total";
  const pool = emCombate ? "Aura Gerada" : "Aura Total";
  const cur = (emCombate ? actor.system.energy?.generated : actor.system.energy?.total) ?? 0;
  if ( cur < 2 ) {
    ui.notifications.warn(`${actor.name} não tem 2 de ${pool} para ${quando} o En.`);
    return false;
  }
  await actor.update({ [path]: cur - 2 });
  return true;
}

/** Ativa o En: cria a zona no token e liga o estado (+ dreno de ativação no modo total). */
export async function activateEn(actor, mode = "total") {
  const token = actorToken(actor);
  if ( !token || !canvas?.scene ) {
    ui.notifications.warn("Coloque um token do personagem na cena para ativar o En.");
    return;
  }
  await deactivateEn(actor, { silent: true });                 // limpa zona anterior
  if ( mode === "total" && !(await payEnUpkeep(actor, "ativar")) ) return;

  const radius = enRadius(actor, mode);
  // author = dono (jogador) do ator: no v14 só o autor ou um GM podem editar o
  // MeasuredTemplate. Se o GM ativa o En pro jogador e depois sai, sem isso a zona
  // travaria (o jogador não conseguiria movê-la). Cai pro ativador se não houver dono.
  const dono = game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"))
    ?? game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
  const [tpl] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
    t: "circle",
    x: token.center.x, y: token.center.y,
    distance: radius, direction: 0, angle: 0,
    borderColor: AURA_COLOR, fillColor: AURA_COLOR,
    author: dono?.id ?? game.user.id,
    flags: { [SCOPE]: { enAura: actor.id } }
  }]);

  await actor.update({
    [`flags.${SCOPE}.enAtivo`]: true,
    [`flags.${SCOPE}.enModo`]: mode,
    [`flags.${SCOPE}.enTemplateId`]: tpl.id,
    [`flags.${SCOPE}.enSceneId`]: canvas.scene.id
  });
  ui.notifications.info(
    `En ativado — ${radius}m${mode === "terco" ? " (⅓ alcance · sem custo de aura)" : " · 2 PA por turno"}.`
  );
}

/** Desativa o En: remove a zona e desliga o estado. */
export async function deactivateEn(actor, { silent = false } = {}) {
  const sceneId = actor.getFlag(SCOPE, "enSceneId");
  const tplId = actor.getFlag(SCOPE, "enTemplateId");
  const scene = sceneId ? game.scenes.get(sceneId) : null;
  if ( scene && tplId && scene.getEmbeddedDocument("MeasuredTemplate", tplId) ) {
    await scene.deleteEmbeddedDocuments("MeasuredTemplate", [tplId]);
  }
  const wasOn = !!actor.getFlag(SCOPE, "enAtivo");
  await actor.update({
    [`flags.${SCOPE}.enAtivo`]: false,
    [`flags.${SCOPE}.-=enTemplateId`]: null,
    [`flags.${SCOPE}.-=enSceneId`]: null
  });
  if ( !silent && wasOn ) ui.notifications.info("En desativado.");
}

/* -------------------------------------------- */
/*  Hooks (processados só no cliente que originou a mudança — sem duplo efeito) */
/* -------------------------------------------- */

// A zona segue o token quando ele se move.
Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
  if ( !("x" in changes || "y" in changes) ) return;                 // só mudança de posição
  // A flag do En vive no ator que ativou. Em token NÃO-vinculado, tokenDoc.actor é o
  // ator-delta (sem a flag) → checa também o ator-base.
  const enActor = [tokenDoc.actor, tokenDoc.baseActor].find(a => a?.getFlag(SCOPE, "enAtivo"));
  if ( !enActor ) return;
  // Único escritor COM PERMISSÃO: no v14 só o autor do MeasuredTemplate (ou o GM) pode
  // atualizá-lo. O Narrador ativo pode editar qualquer template → deixa ELE mover a zona
  // (o hook dispara em todos os clientes). Sem GM online, quem moveu (autor, se ativou o
  // próprio En) faz o update. Antes: só o cliente que moveu tentava, e se ele não fosse o
  // autor do template (ex.: GM ativou pro jogador) o update era NEGADO em silêncio.
  const activeGM = game.users.activeGM;
  if ( activeGM ) { if ( activeGM.id !== game.user.id ) return; }
  else if ( userId !== game.userId ) return;

  const tplId = enActor.getFlag(SCOPE, "enTemplateId");
  const scene = tokenDoc.parent;
  const tpl = tplId ? scene?.getEmbeddedDocument("MeasuredTemplate", tplId) : null;
  if ( !scene || !tpl ) return;
  if ( !tpl.canUserModify(game.user, "update") ) return;   // v14: sem permissão → não tenta (evita erro a cada passo)
  // centro pela posição ATUAL do documento (v14: getCenterPoint reflete o x/y já atualizado)
  const c = tokenDoc.getCenterPoint?.() ?? tokenDoc.object?.center ?? {
    x: tokenDoc.x + (tokenDoc.width * (scene.grid?.size ?? 100)) / 2,
    y: tokenDoc.y + (tokenDoc.height * (scene.grid?.size ?? 100)) / 2
  };
  await scene.updateEmbeddedDocuments("MeasuredTemplate", [{ _id: tplId, x: c.x, y: c.y }]);
});

// Dreno de 2 PA no início de cada turno (modo total). ⅓ não custa.
Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  if ( !("turn" in changed || "round" in changed) ) return;
  const actor = combat.combatant?.actor;
  if ( !actor?.getFlag(SCOPE, "enAtivo") ) return;
  if ( actor.getFlag(SCOPE, "enModo") === "terco" ) return;   // ⅓ do alcance = sem custo
  // Único escritor: GM ativo (pode editar qualquer ator) ou, sem GM, o dono ativo do
  // combatente. Antes o gate era `userId === game.userId` (quem AVANÇOU o turno) — se esse
  // cliente não possuísse o próximo combatente, o `actor.update` era negado e o dreno sumia.
  const activeGM = game.users.activeGM;
  const escritor = activeGM ?? game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"));
  if ( !escritor || escritor.id !== game.user.id ) return;
  // Início de turno = em combate → sai da Aura Gerada.
  const cur = actor.system.energy?.generated ?? 0;
  if ( cur < 2 ) {
    await deactivateEn(actor, { silent: true });
    ui.notifications.warn(`${actor.name}: Aura Gerada insuficiente — En desativado.`);
    return;
  }
  await actor.update({ "system.energy.generated": cur - 2 });
});

// ── Migração: remove ActiveEffects "abilityEffect" antigos (versão bugada que setava ──
// flags.HunterLegacy via AE e corrompia a preparação de dados, causando desfazer/estorno
// infinito). O efeito real agora é flag direta (ver _applyAbilityEffect). Roda 1× por
// cliente, só nos atores que ele possui.
Hooks.once("ready", async () => {
  for ( const actor of game.actors ) {
    try {
      if ( !actor.isOwner ) continue;
      // acesso direto (não getFlag) — ficha corrompida pelo AE antigo não pode derrubar o loop
      const stale = actor.effects.filter(e => foundry.utils.getProperty(e, `flags.${SCOPE}.abilityEffect`));
      if ( stale.length ) {
        await actor.deleteEmbeddedDocuments("ActiveEffect", stale.map(e => e.id));
        console.log(`Hunter | En-migração: ${stale.length} AE(s) de habilidade removido(s) de "${actor.name}".`);
      }
    } catch ( err ) {
      console.error(`Hunter | En-migração falhou em "${actor.name}":`, err);
    }
  }
});
