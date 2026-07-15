/**
 * jj/categoria-manipulador.mjs
 * Regras AUTOMÁTICAS da categoria Manipulador — ligam sozinhas pelo nível do
 * treinamento, sem depender de itens no compêndio:
 *
 *   · AURA CONTROLADA (treinamento Manipulador nv 2/5/8 — ★/★★/★★★): ao rolar
 *     dano nos cards custom, aparece um botão que re-rola o dado de dano MAIS
 *     BAIXO e fica com o maior resultado (uma vez por rolagem de dano).
 *     ★ = até 3 usos por descanso longo · ★★ = até 5 · ★★★ = ilimitado.
 *     Usos ficam no flag do ator e restauram no descanso longo.
 */

const SCOPE = "hunter-system";
const AC_FLAG = "auraControlada";      // flag do ator: { usadas }

const nivelManipulador = actor => Number(actor?.system?.nenCategories?.manipulador?.level ?? 0);

/** Rank do Aura Controlada pelo nível do treinamento Manipulador (2/5/8 → ★/★★/★★★). */
export function rankAuraControlada(actor) {
  const lvl = nivelManipulador(actor);
  return lvl >= 8 ? 3 : lvl >= 5 ? 2 : lvl >= 2 ? 1 : 0;
}

const tetoUsos = rank => rank === 1 ? 3 : rank === 2 ? 5 : Infinity;

function usosRestantes(actor, rank) {
  if ( rank >= 3 ) return Infinity;
  const usadas = Number(actor.getFlag(SCOPE, AC_FLAG)?.usadas ?? 0);
  return Math.max(0, tetoUsos(rank) - usadas);
}

/** Mesma conta do "Aplicar" do card (não é exportada pelo sheet — duplicada aqui). */
function _totalComMod(base, mod, critBonus = 0) {
  switch ( mod ) {
    case "half":    return Math.floor(base / 2);
    case "quarter": return Math.floor(base / 4);
    case "crit":    return base + critBonus;
    case "kokusen": return Math.ceil((base + critBonus) * 2.5);
    default:        return base;
  }
}

/* -------------------------------------------- */
/*  Injeção do botão no card de dano             */
/* -------------------------------------------- */

// O sheet chama hunterDamageRolled ao fim da rolagem de dano do card principal,
// com `rolls` = todas as rolagens (partes + PA + foco + estágio + escala). O
// _updateCardMessage logo depois re-renderiza a mensagem — o clique é ligado lá.
Hooks.on("hunterDamageRolled", (actor, { card = null, rolls = null } = {}) => {
  if ( !actor || !card?.dataset || !rolls?.length ) return;
  if ( card.dataset.acOferecido === "1" ) return;
  const rank = rankAuraControlada(actor);
  if ( rank < 1 ) return;
  const restantes = usosRestantes(actor, rank);
  if ( restantes <= 0 ) return;

  // Dados MANTIDOS de todas as rolagens (faces + resultado) p/ achar o pior no clique.
  const dados = [];
  for ( const roll of rolls ) {
    for ( const die of (roll?.dice ?? []) ) {
      for ( const r of (die.results ?? []) ) {
        if ( r.active === false || r.discarded ) continue;
        dados.push({ f: die.faces, r: r.result });
      }
    }
  }
  if ( !dados.length ) return;                    // dano fixo, sem dados: nada a re-rolar
  card.dataset.acOferecido = "1";
  card.dataset.acDados = JSON.stringify(dados);

  const alvo = card.querySelector("#jj-footer .jj-mods") ?? card.querySelector("#jj-footer");
  if ( !alvo ) return;
  // Chip discreto, no mesmo tom dos modificadores ½/¼/Crit — nome completo no tooltip.
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "jj-mod-check jj-ac-chip";
  btn.dataset.action = "jj-aura-controlada";
  btn.innerHTML = `<i class="fas fa-rotate" inert></i>${rank >= 3 ? "" : `<span>${restantes}</span>`}`;
  btn.dataset.tooltip = `Aura Controlada — re-rola o dado de dano mais baixo e fica com o maior`
    + `${rank >= 3 ? "" : ` (${restantes} uso(s) até o descanso longo)`}.`;
  alvo.appendChild(btn);
});

/* -------------------------------------------- */
/*  Clique — religa a cada render da mensagem    */
/* -------------------------------------------- */

Hooks.on("renderChatMessageHTML", (message, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const btn = root?.querySelector("[data-action='jj-aura-controlada']");
  if ( !btn || btn.dataset.acBound === "1" ) return;
  btn.dataset.acBound = "1";
  btn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    usarAuraControlada(btn, message);
  });
});

async function usarAuraControlada(btn, message) {
  const card = btn.closest(".jujutsu-card");
  const actor = game.actors.get(message.speaker?.actor) ?? null;
  if ( !card || !actor ) return;
  if ( card.dataset.acUsado === "1" ) return;

  const rank = rankAuraControlada(actor);
  const restantes = usosRestantes(actor, rank);
  if ( rank < 1 || restantes <= 0 ) {
    ui.notifications.warn("Aura Controlada sem usos até o descanso longo.");
    btn.remove();
    return;
  }

  let dados = [];
  try { dados = JSON.parse(card.dataset.acDados || "[]"); } catch { /* ignore */ }
  if ( !dados.length ) return;

  // Re-rola o PIOR dado mantido e fica com o maior dos dois.
  const pior = dados.reduce((a, b) => (b.r < a.r ? b : a));
  const roll = await new Roll(`1d${pior.f}`).evaluate();
  game.dice3d?.showForRoll(roll, game.user, true);
  const novo = roll.total;
  const ganho = Math.max(0, novo - pior.r);

  card.dataset.acUsado = "1";
  if ( rank < 3 ) {
    const usadas = Number(actor.getFlag(SCOPE, AC_FLAG)?.usadas ?? 0) + 1;
    await actor.setFlag(SCOPE, AC_FLAG, { usadas });
  }

  // Aplica o ganho no total base e refaz o rodapé com o modificador ativo.
  const base = Number(card.dataset.totalDmg ?? 0) + ganho;
  card.dataset.totalDmg = String(base);
  const dmgVal = card.querySelector("#jj-dmg-val");
  if ( dmgVal && ganho > 0 ) dmgVal.textContent = base;
  const breakEl = card.querySelector("#jj-dmg-break");
  if ( breakEl ) {
    breakEl.innerHTML += `<span class="jj-pa-badge" style="color:#7ee2a8;border-color:#2ECC71">`
      + `🌀 d${pior.f}: ${pior.r} → ${novo}${ganho > 0 ? "" : " (manteve o original)"}</span>`;
  }
  const mod = card.querySelector(".jj-mod-check input:checked")?.dataset.mod ?? null;
  const critBonus = Number(card.dataset.critBonus ?? 0);
  const totalEl = card.querySelector("#jj-total-display");
  if ( totalEl ) totalEl.textContent = _totalComMod(base, mod, critBonus);
  btn.remove();

  await message.update({ content: card.outerHTML }).catch(() => null);
}

/* -------------------------------------------- */
/*  Descanso longo restaura os usos              */
/* -------------------------------------------- */

Hooks.on("dnd5e.restCompleted", async (actor, result) => {
  if ( !actor || actor.type !== "character" ) return;
  const isLong = result?.longRest ?? (result?.type === "long");
  if ( !isLong ) return;
  const usadas = Number(actor.getFlag(SCOPE, AC_FLAG)?.usadas ?? 0);
  const rank = rankAuraControlada(actor);
  if ( usadas > 0 && rank >= 1 ) {
    await actor.unsetFlag(SCOPE, AC_FLAG).catch(() => null);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🌀 <b>${actor.name}</b> — Aura Controlada restaurada `
        + `(${rank >= 3 ? "ilimitado" : `${tetoUsos(rank)} usos`}).`
    });
  }
});
