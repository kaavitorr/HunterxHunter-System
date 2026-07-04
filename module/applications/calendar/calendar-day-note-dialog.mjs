import { MOON_PHASES } from "../../data/calendar/moon-phases.mjs";
import Dialog5e from "../api/dialog.mjs";

/**
 * GM-only dialog for assigning a moon phase (visible to everyone) and a private note (GM only)
 * to a specific calendar day.
 */
export default class CalendarDayNoteDialog extends Dialog5e {
  constructor({ year, month, day, ...options }={}) {
    super(options);
    this.year = year;
    this.month = month;
    this.day = day;
  }

  /* -------------------------------------------- */

  /** @override */
  static DEFAULT_OPTIONS = {
    buttons: [{
      default: true,
      icon: "fa-solid fa-floppy-disk",
      label: "Salvar",
      type: "submit"
    }],
    form: {
      handler: CalendarDayNoteDialog.#onSubmitForm,
      closeOnSubmit: true
    },
    position: {
      width: 360
    },
    window: {
      title: "Nota do Dia",
      icon: "fa-solid fa-note-sticky"
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    ...super.PARTS,
    content: {
      template: "systems/hunter-system/templates/apps/calendar-day-note-dialog.hbs"
    }
  };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Canonical storage key for the day this dialog is editing.
   * @type {string}
   */
  get dayKey() {
    return `${this.year}-${this.month}-${this.day}`;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContentContext(context, options) {
    const calendar = game.time.calendar;
    const monthConfig = calendar.months.values[this.month];
    const dayData = game.settings.get("hunter-system", "calendarDayData") ?? {};
    const entry = dayData[this.dayKey] ?? {};

    context.dateLabel = `${this.day} de ${game.i18n.localize(monthConfig.name)} de ${this.year}`;
    context.moonOptions = MOON_PHASES.map(p => ({
      value: p.key, label: `${p.glyph}  ${p.label}`, selected: p.key === entry.moon
    }));
    context.hasMoon = !!entry.moon;
    context.note = entry.note ?? "";
    return context;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle form submission, saving or clearing the day's data.
   * @this {CalendarDayNoteDialog}
   * @param {SubmitEvent} event          Triggering submit event.
   * @param {HTMLFormElement} form       The form that was submitted.
   * @param {FormDataExtended} formData  Data from the submitted form.
   */
  static async #onSubmitForm(event, form, formData) {
    if ( !game.user.isGM ) return;
    const { moon, note } = formData.object;
    const trimmedNote = note?.trim() ?? "";
    const dayData = foundry.utils.deepClone(game.settings.get("hunter-system", "calendarDayData") ?? {});

    if ( !moon && !trimmedNote ) delete dayData[this.dayKey];
    else dayData[this.dayKey] = { moon: moon || null, note: trimmedNote };

    await game.settings.set("hunter-system", "calendarDayData", dayData);
  }
}
