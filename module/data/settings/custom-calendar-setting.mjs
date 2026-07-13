const { NumberField, ArrayField, StringField } = foundry.data.fields;

/**
 * Valores do Calendário Personalizado do mundo (meses uniformes). O construtor
 * `buildCustomCalendarConfig` transforma isto no config do Foundry.
 */
export default class CustomCalendarSetting extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      monthsPerYear: new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 12 }),
      daysPerMonth:  new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 30 }),
      hoursPerDay:   new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 24 }),
      daysPerWeek:   new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 7 }),
      monthNames:    new ArrayField(new StringField({ required: true, blank: true }), { initial: [] }),
      weekdayNames:  new ArrayField(new StringField({ required: true, blank: true }), { initial: [] })
    };
  }
}
