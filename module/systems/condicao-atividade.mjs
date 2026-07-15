/**
 * Condição no Alvo — atividades de Ataque, Salvaguarda e Dano.
 *
 * Config (schema `condicao` em base-activity + parts/condicao.hbs): condição da aba
 * de efeitos (JJ_CONDITIONS) ou customizada, salvaguarda que o alvo rola e CD
 * opcional (vazia = CD da própria atividade, senão CD de técnica do conjurador).
 *
 * Runtime (cards custom, costurado pelo character-sheet):
 *  · Ataque  → acertou: botão "Salv. X (CD n)" — rola pros alvos mirados/selecionados
 *              e aplica a condição em quem falhar.
 *  · Salvag. → o alvo falhou na salvaguarda de dano: emenda a salvaguarda da
 *              condição automaticamente (atributo próprio).
 *  · Dano    → botão direto de salvaguarda da condição.
 *
 * Aplicação = ActiveEffect com `statuses` (idêntico à aba de efeitos): remove por lá,
 * tooltips e ícones funcionam. Aplicar em alvo alheio exige permissão (Narrador).
 */

const SCOPE = "hunter-system";

/* -------------------------------------------- */
/*  Lista de condições                           */
/* -------------------------------------------- */

let _base = null;
async function _condicoesBase() {
  if ( !_base ) ({ JJ_CONDITIONS: _base } = await import("../applications/actor/character-sheet.mjs"));
  return _base;
}

/** Condições da aba de efeitos + customizadas salvas nas fichas dos atores do mundo. */
export async function listaCondicoes() {
  const base = (await _condicoesBase()).map(c => ({ value: c.id, label: c.label }));
  const custom = new Map();
  for ( const a of game.actors ) {
    // Fonte principal: definições salvas na ficha (flag)
    for ( const def of (a.getFlag(SCOPE, "customConditions") ?? []) ) {
      if ( def?.id && !custom.has(def.id) ) custom.set(def.id, def.label);
    }
    // Legado: condições que só existem como efeito ativo antigo
    for ( const e of a.effects ) {
      if ( !e.getFlag(SCOPE, "isCustomCondition") ) continue;
      for ( const s of (e.statuses ?? []) ) if ( !custom.has(s) ) custom.set(s, e.name);
    }
  }
  const extras = [...custom.entries()]
    .filter(([id]) => !base.some(b => b.value === id))
    .map(([id, label]) => ({ value: id, label: `${label} (customizada)` }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...base, ...extras];
}

async function _rotulo(id) {
  const lista = await listaCondicoes();
  return lista.find(c => c.value === id)?.label?.replace(" (customizada)", "")
    ?? id.replace(/^jj-(custom-)?/, "").replace(/-/g, " ");
}

/* -------------------------------------------- */
/*  Leitura da config                            */
/* -------------------------------------------- */

/** Config normalizada da condição da atividade, ou null se desligada. */
export function condicaoDe(activity) {
  const c = activity?.condicao;
  if ( !c?.id ) return null;
  return {
    id: c.id,
    ability: c.ability || "con",
    dc: c.dc ?? "",
    semSalvaguarda: !!c.semSalvaguarda,
    gatilho: c.gatilho || ""            // "" = sempre | "crit" | "nat20" (só Ataque)
  };
}

/** CD resolvida: fórmula própria → CD da atividade (Salvaguarda) → CD de técnica. */
export function cdCondicao(activity, actor) {
  const cfg = condicaoDe(activity);
  if ( cfg?.dc ) {
    try {
      return Math.max(1, new Roll(String(cfg.dc), actor?.getRollData?.() ?? {}).evaluateSync({ strict: false }).total);
    } catch ( e ) { console.warn("Hunter | CD de condição inválida:", cfg.dc, e); }
  }
  const dcAtv = Number(activity?.save?.dc?.value);
  if ( Number.isFinite(dcAtv) && dcAtv > 0 ) return dcAtv;
  // CD de técnica do conjurador (derivada em attributes.mjs: habilidade de conjuração ou 8+prof)
  return Number(actor?.system?.attributes?.spell?.dc ?? 10);
}

/* -------------------------------------------- */
/*  Botão no card + rolagem/aplicação            */
/* -------------------------------------------- */

/**
 * Injeta a linha discreta com o botão da condição (idempotente).
 * `crit`/`nat20` (opcionais) vêm da rolagem de acerto — quando presentes, o
 * gatilho configurado ("crit"/"nat20") decide se a condição dispara.
 */
export async function injetarBotaoCondicao({ card, activity, actor, crit = null, nat20 = null }) {
  const cfg = condicaoDe(activity);
  if ( !cfg || !card || card.querySelector("[data-action='jj-cond-save']") ) return;
  // Gatilho (só faz sentido quando o chamador informa o resultado do acerto)
  if ( cfg.gatilho === "crit" && crit === false ) return;
  if ( cfg.gatilho === "nat20" && nat20 === false ) return;
  const rot = await _rotulo(cfg.id);
  const linha = document.createElement("div");
  linha.className = "jj-cond-line";
  let botao;
  if ( cfg.semSalvaguarda ) {
    botao = `<button type="button" data-action="jj-cond-save"
            data-tooltip="Aplica a condição direto nos alvos mirados/selecionados — sem salvaguarda.">
      Aplicar (sem salv.)
    </button>`;
  } else {
    const abrev = game.i18n.localize(CONFIG.DND5E.abilities[cfg.ability]?.abbreviation ?? cfg.ability).toUpperCase();
    const cd = cdCondicao(activity, actor);
    botao = `<button type="button" data-action="jj-cond-save"
            data-tooltip="Rola a salvaguarda dos alvos mirados/selecionados; quem falhar recebe a condição.">
      Salv. ${foundry.utils.escapeHTML(abrev)} · CD ${cd}
    </button>`;
  }
  linha.innerHTML = `
    <i class="fas fa-link" style="font-size:9px;opacity:.65" inert></i>
    <span>${foundry.utils.escapeHTML(rot)}</span>
    ${botao}`;
  card.appendChild(linha);
}

/** Cria o ActiveEffect da condição no alvo (mesmo formato da aba de efeitos). */
async function _aplicar(alvo, condId, rot) {
  if ( alvo.statuses?.has(condId) ) return "já estava com a condição";
  try {
    await alvo.createEmbeddedDocuments("ActiveEffect", [{
      name: rot,
      icon: "icons/svg/aura.svg",
      statuses: [condId],
      flags: { [SCOPE]: { isJujutsuCondition: true } }
    }]);
    return "aplicada";
  } catch ( e ) {
    ui.notifications.warn(`Sem permissão para aplicar "${rot}" em ${alvo.name} — peça ao Narrador.`);
    return "sem permissão";
  }
}

/**
 * Rola a salvaguarda da condição para os alvos e aplica em quem falhar.
 * @param {object} p
 * @param {Activity} p.activity   Atividade com a condição configurada.
 * @param {Actor} p.actor         Conjurador (resolve a CD).
 * @param {Array} [p.alvos]       Tokens ou Actors; padrão = mirados, senão selecionados.
 * @param {HTMLElement} p.card    Card no chat (recebe as linhas de resultado).
 * @param {ChatMessage} [p.message]  Se vier, persiste o card ao final.
 */
export async function rolarSalvaguardaCondicao({ activity, actor, alvos = null, card, message = null }) {
  const cfg = condicaoDe(activity);
  if ( !cfg || !card ) return;
  const rot = await _rotulo(cfg.id);
  const cd = cdCondicao(activity, actor);
  const ablLabel = game.i18n.localize(CONFIG.DND5E.abilities[cfg.ability]?.label ?? cfg.ability.toUpperCase());

  let lista = alvos ?? [...(game.user.targets ?? [])];
  if ( !lista.length ) lista = canvas.tokens?.controlled ?? [];
  if ( !lista.length ) {
    ui.notifications.warn("Mire (alvo) ou selecione o(s) token(s) que devem salvar contra a condição.");
    return;
  }

  let area = card.querySelector(".jj-cond-results");
  if ( !area ) {
    area = document.createElement("div");
    area.className = "jj-cond-results";
    area.style.cssText = "display:flex;flex-direction:column;gap:2px;padding:4px 10px 6px;font-size:11px;";
    card.appendChild(area);
  }

  for ( const alvoRaw of lista ) {
    const alvo = alvoRaw?.actor ?? alvoRaw;              // aceita Token ou Actor
    if ( !alvo?.system?.abilities ) continue;

    // Pular Salvaguarda: recebe a condição automaticamente
    if ( cfg.semSalvaguarda ) {
      const resultado = await _aplicar(alvo, cfg.id, rot);
      area.innerHTML += `<span style="color:#e05050">`
        + `⛓ ${foundry.utils.escapeHTML(alvo.name)} — <b>${foundry.utils.escapeHTML(rot)}</b> `
        + `${resultado} (sem salvaguarda)</span>`;
      continue;
    }

    const mod = alvo.system.abilities[cfg.ability]?.save?.value
      ?? alvo.system.abilities[cfg.ability]?.mod ?? 0;
    const roll = await new Roll(`1d20 + ${Number(mod)}`).evaluate();
    game.dice3d?.showForRoll(roll, game.user, true);
    const ok = roll.total >= cd;
    const resultado = ok ? "" : await _aplicar(alvo, cfg.id, rot);
    area.innerHTML += `<span style="color:${ok ? "#60c080" : "#e05050"}">`
      + `⛓ ${foundry.utils.escapeHTML(alvo.name)} — Salv. ${foundry.utils.escapeHTML(ablLabel)} `
      + `<b>${roll.total}</b> vs CD ${cd}: `
      + (ok ? "✓ resistiu" : `✗ falhou — <b>${foundry.utils.escapeHTML(rot)}</b> ${resultado}`)
      + `</span>`;
  }

  // Botão vira registro: some depois de rolado
  card.querySelector("[data-action='jj-cond-save']")?.closest(".jj-cond-line, .jj-footer")?.remove();
  if ( message ) await message.update({ content: card.outerHTML }).catch(() => null);
}

/* -------------------------------------------- */
/*  Clique do botão — religa a cada render       */
/* -------------------------------------------- */

function _resolver(card) {
  const token = card.dataset.tokenId ? canvas.tokens?.get(card.dataset.tokenId) : null;
  const actor = token?.actor ?? game.actors.get(card.dataset.actorId ?? "") ?? null;
  const item = actor?.items.get(card.dataset.itemId ?? "") ?? null;
  const activity = item?.system?.activities?.get?.(card.dataset.activityId ?? "") ?? null;
  return { actor, activity };
}

// Delegação no document: imune a re-render/replace do HTML da mensagem.
document.addEventListener("click", async ev => {
  const btn = ev.target?.closest?.("[data-action='jj-cond-save']");
  if ( !btn ) return;
  ev.preventDefault();
  ev.stopPropagation();
  const card = btn.closest(".jujutsu-card");
  const li = btn.closest("[data-message-id]");
  const message = game.messages?.get(li?.dataset.messageId ?? "") ?? null;
  const { actor, activity } = _resolver(card ?? { dataset: {} });
  if ( !card || !actor || !activity ) {
    ui.notifications.warn("Não consegui resolver a atividade deste card (ator/item removido?).");
    return;
  }
  await rolarSalvaguardaCondicao({ activity, actor, card, message });
});
