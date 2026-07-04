import ActivitySheet from "./activity-sheet.mjs";

/**
 * Ficha de configuração da atividade de Redução de Dano.
 * Adiciona o campo de fórmula do escudo na aba Efeito.
 */
export default class ReductionSheet extends ActivitySheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["reduction-activity"]
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS,
    effect: {
      template: "systems/hunter-system/templates/activity/reduction-effect.hbs",
      templates: [
        ...super.PARTS.effect.templates,
        // jj-scale.hbs e constant-cost.hbs já vêm registrados na base (ActivitySheet);
        // o reduction-effect.hbs os inclui via {{>}}.
        "systems/hunter-system/templates/activity/parts/jj-scale.hbs"
      ]
    }
  };
}
