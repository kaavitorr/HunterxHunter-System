/**
 * Idioma do Sistema (Hunter).
 *
 * O Foundry escolhe o idioma pelo core (Settings → Core → Language) e carrega os
 * arquivos de idioma UMA vez, no boot. Este módulo dá ao sistema Hunter um seletor
 * PRÓPRIO de idioma (config "interfaceLanguage"): as strings DO SISTEMA passam a
 * seguir essa escolha, independente do idioma do Foundry.
 *
 * Como funciona: pré-carregamos os dois arquivos de idioma no import (top-level
 * await → prontos antes de qualquer hook) e, no `i18nInit`, sobrepomos o idioma
 * escolhido em `game.i18n.translations`. Este arquivo é importado ANTES do corpo do
 * dnd5e.mjs, então nosso hook roda ANTES da pré-localização do CONFIG — assim os
 * rótulos de atributos/perícias/etc. também seguem a escolha. Trocar exige reload
 * (requiresReload) para o merge rodar de novo com o novo idioma.
 */

const IDIOMAS = ["pt-BR", "en"];

/** Cache dos arquivos de idioma do sistema, carregados no import (antes do boot). */
const CACHE = {};
for ( const lang of IDIOMAS ) {
  try {
    const resp = await fetch(`systems/hunter-system/lang/${lang}.json`);
    if ( resp.ok ) CACHE[lang] = await resp.json();
  } catch ( err ) {
    console.error(`Hunter | falha ao pré-carregar idioma "${lang}":`, err);
  }
}

Hooks.once("i18nInit", () => {
  let lang;
  try { lang = game.settings.get("hunter-system", "interfaceLanguage"); }
  catch { return; }                       // setting ainda não registrada (não deve ocorrer)
  const data = CACHE[lang];
  if ( !data ) return;                    // sem dados (preload falhou) → fica no idioma do core
  // Sobrepõe as strings do sistema; chaves ausentes caem no fallback do Foundry.
  foundry.utils.mergeObject(game.i18n.translations, data, { inplace: true });
  console.log(`Hunter | idioma do sistema aplicado: ${lang}`);
});
