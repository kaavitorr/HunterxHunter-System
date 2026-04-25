import ActivitySheet from "./activity-sheet.mjs";

/**
 * Sheet for the damage activity.
 */
export default class DamageSheet extends ActivitySheet {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ["damage-activity"]
  };

  /* -------------------------------------------- */

  /** @inheritDoc */
  static PARTS = {
    ...super.PARTS,
    effect: {
      template: "systems/hunter-system/templates/activity/damage-effect.hbs",
      templates: [
        ...super.PARTS.effect.templates,
        "systems/hunter-system/templates/activity/parts/damage-damage.hbs",
        "systems/hunter-system/templates/activity/parts/damage-part.hbs",
        "systems/hunter-system/templates/activity/parts/damage-parts.hbs"
      ]
    }
  };
}
