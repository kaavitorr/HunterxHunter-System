import BaseSettingsConfig from "./base-settings.mjs";

/**
 * An application for configuring variant rules settings.
 */
export default class VariantRulesSettingsConfig extends BaseSettingsConfig {
  /** @override */
  static DEFAULT_OPTIONS = {
    window: {
      title: "SETTINGS.DND5E.VARIANT.Label"
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    general: {
      template: "systems/hunter-system/templates/settings/base-config.hbs"
    },
    encumbrance: {
      template: "systems/hunter-system/templates/settings/base-config.hbs"
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch ( partId ) {
      case "general":
        context.fields = [
          dnd5e.settings.rulesVersion === "legacy" ? this.createSettingField("allowFeats") : null,
          this.createSettingField("restVariant"),
          this.createSettingField("proficiencyModifier"),
          this.createSettingField("levelingMode")
        ].filter(_ => _);
        context.legend = game.i18n.localize("SETTINGS.DND5E.General");
        break;
      case "encumbrance":
        context.fields = [
          this.createSettingField("encumbrance"),
          this.createSettingField("currencyWeight")
        ];
        context.legend = game.i18n.localize("DND5E.Encumbrance");
        break;
      // Honra/Sanidade removidos da UI — os settings honorScore/sanityScore seguem
      // registrados (desligados) para o código do dnd5e que os lê continuar íntegro.
    }
    return context;
  }
}
