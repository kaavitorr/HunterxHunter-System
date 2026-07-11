/**
 * narrator-logs.mjs
 * Registros automáticos pro Narrador: toda mudança de DINHEIRO na ficha de um
 * personagem de jogador vira uma linha num Journal que só o GM enxerga
 * ("Log do Narrador" › "💰 Dinheiro dos Jogadores"), com de → para, quem mexeu
 * e quando. O "antes" chega pelas options, gravado no _preUpdate do ator
 * (options viajam no socket junto com o update) — e só o GM ATIVO escreve.
 */

const JOURNAL_NAME = "Log do Narrador";
const PAGE_NAME = "💰 Dinheiro dos Jogadores";
const MAX_LINHAS = 400;

async function garantirPagina() {
  let journal = game.journal.getName(JOURNAL_NAME);
  if ( !journal ) {
    journal = await JournalEntry.implementation.create({
      name: JOURNAL_NAME,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE }   // só o GM vê
    });
  }
  let page = journal.pages.getName(PAGE_NAME);
  if ( !page ) {
    [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
      name: PAGE_NAME, type: "text",
      text: { content: "", format: CONST.JOURNAL_ENTRY_PAGE_FORMATS.HTML }
    }]);
  }
  return page;
}

// Serializa as escritas: duas mudanças quase simultâneas não podem se atropelar.
let fila = Promise.resolve();

Hooks.on("updateActor", (actor, changes, options, userId) => {
  if ( game.users.activeGM?.id !== game.user.id ) return;        // só o GM ativo escreve
  if ( actor.type !== "character" || !actor.hasPlayerOwner ) return;
  const depois = foundry.utils.getProperty(changes, "system.currency");
  if ( !depois || typeof depois !== "object" ) return;
  const antes = foundry.utils.getProperty(options, "hunterSystem.moedasAntes") ?? {};

  const esc = foundry.utils.escapeHTML;
  const fmt = n => Number(n ?? 0).toLocaleString("pt-BR");
  const linhas = [];
  for ( const [moeda, valor] of Object.entries(depois) ) {
    const de = Number(antes[moeda] ?? 0);
    const para = Number(valor ?? 0);
    if ( !Number.isFinite(para) || de === para ) continue;
    const delta = para - de;
    const rotulo = CONFIG.DND5E.currencies?.[moeda]?.label ?? moeda;
    linhas.push(
      `<b>${esc(actor.name)}</b> — ${esc(rotulo)}: ${fmt(de)} → ${fmt(para)}`
      + ` <b style="color:${delta > 0 ? "#2e7d32" : "#c62828"}">(${delta > 0 ? "+" : ""}${fmt(delta)})</b>`
    );
  }
  if ( !linhas.length ) return;

  const quem = game.users.get(userId)?.name ?? "?";
  const quando = new Date().toLocaleString("pt-BR");
  const novas = linhas.map(l =>
    `<p>${l} <em style="color:#888">· ${esc(quando)} · por ${esc(quem)}</em></p>`
  ).join("");

  fila = fila.then(async () => {
    const page = await garantirPagina();
    // novas no topo; poda o excesso (cada linha é um <p>…</p> nosso)
    const paras = (novas + (page.text?.content ?? "")).split("</p>").filter(p => p.trim());
    const conteudo = paras.slice(0, MAX_LINHAS).join("</p>") + "</p>";
    await page.update({ "text.content": conteudo });
  }).catch(err => console.error("hunter-system | log de dinheiro do Narrador:", err));
});
