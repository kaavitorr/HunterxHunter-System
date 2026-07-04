/**
 * journal-skin.mjs
 * Opção no menu (⋮) do cabeçalho do Journal pra ligar/desligar o visual customizado (banner,
 * moldura dourada, guias). Ao desativar, a classe `.no-journal-skin` é posta na janela e o CSS
 * (todo gated com `:not(.no-journal-skin)`) deixa de aplicar, voltando ao visual original.
 * Preferência por usuário (setting client), persistida entre reaberturas.
 */
const SCOPE = "hunter-system";
const SETTING = "journalSkinDisabled";

Hooks.once("init", () => {
  game.settings.register(SCOPE, SETTING, {
    name: "Desativar visual customizado do Journal",
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: () => applyToAllJournals()
  });
});

function isDisabled() {
  return game.settings.get(SCOPE, SETTING) === true;
}

function applyToJournal(app) {
  app?.element?.classList.toggle("no-journal-skin", isDisabled());
}

function applyToAllJournals() {
  for ( const app of foundry.applications.instances.values() ) {
    if ( app?.element?.classList?.contains("dnd5e2-journal") ) applyToJournal(app);
  }
}

// Aplica a preferência salva sempre que um journal renderiza.
Hooks.on("renderJournalEntrySheet", app => applyToJournal(app));

// Adiciona a opção no menu (⋮) do cabeçalho do journal (escutamos a classe-base
// JournalEntrySheet, que dispara uma vez na cadeia de herança).
Hooks.on("getHeaderControlsJournalEntrySheet", (app, controls) => {
  controls.push({
    icon: "fa-solid fa-wand-magic-sparkles",
    label: isDisabled() ? "Ativar visual customizado" : "Desativar visual customizado",
    action: "toggleJournalSkin",
    onClick: () => game.settings.set(SCOPE, SETTING, !isDisabled())
  });
});
