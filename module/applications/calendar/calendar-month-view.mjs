import { MOON_PHASES } from "../../data/calendar/moon-phases.mjs";
import Application5e from "../api/application.mjs";
import CalendarDayNoteDialog from "./calendar-day-note-dialog.mjs";

/**
 * Application showing a full month grid of days. Any user can view it; the GM can additionally
 * assign a moon phase (visible to everyone) or a private note (GM only) to a specific day.
 */
export default class CalendarMonthView extends Application5e {
  constructor(options={}) {
    super(options);
    const { year, month } = game.time.components;
    this.#year = year + game.time.calendar.years.yearZero;
    this.#month = month;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "hxh-calendar-month-view",
    classes: ["hxh-cal-month-view", "themed", "theme-dark"],
    window: {
      title: "Calendário",
      icon: "fa-solid fa-calendar-week",
      resizable: false
    },
    position: {
      width: 400,
      height: "auto"
    },
    actions: {
      prevMonth: CalendarMonthView.#onNavigate,
      nextMonth: CalendarMonthView.#onNavigate,
      today: CalendarMonthView.#onToday,
      editDay: CalendarMonthView.#onEditDay
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    content: {
      template: "systems/hunter-system/templates/apps/calendar-month-view.hbs"
    }
  };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * The single open instance of this application, if any.
   * @type {CalendarMonthView|null}
   */
  static #instance = null;

  /**
   * Display year (with `yearZero` added in) currently being shown.
   * @type {number}
   */
  #year;

  /**
   * Month index currently being shown.
   * @type {number}
   */
  #month;

  /* -------------------------------------------- */
  /*  Static Helpers                              */
  /* -------------------------------------------- */

  /**
   * Open the month view, or bring the already-open instance to the front.
   * @returns {Promise<CalendarMonthView>}
   */
  static async open() {
    if ( !CalendarMonthView.#instance ) {
      CalendarMonthView.#instance = new CalendarMonthView();
    }
    await CalendarMonthView.#instance.render({ force: true });
    CalendarMonthView.#instance.bringToFront();
    return CalendarMonthView.#instance;
  }

  /* -------------------------------------------- */

  /**
   * Re-render the open instance, if any. Called when calendar day data changes.
   */
  static refreshOpen() {
    CalendarMonthView.#instance?.render();
  }

  /* -------------------------------------------- */

  /**
   * Build the canonical storage key for a given date.
   * @param {number} year   Visible year (with `yearZero` added in).
   * @param {number} month  Index of month.
   * @param {number} day    Day within the month (1-based).
   * @returns {string}
   */
  static dayKey(year, month, day) {
    return `${year}-${month}-${day}`;
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = game.time.calendar;
    const monthConfig = calendar.months.values[this.#month];
    const internalYear = this.#year - calendar.years.yearZero;
    const leapYear = calendar.isLeapYear(internalYear);
    const daysInMonth = leapYear ? (monthConfig.leapDays ?? monthConfig.days) : monthConfig.days;
    const daysPerWeek = calendar.days.values.length;

    const today = game.time.components;
    const todayYear = today.year + calendar.years.yearZero;
    const isGM = game.user.isGM;
    const dayData = game.settings.get("hunter-system", "calendarDayData") ?? {};

    const days = [];
    for ( let day = 1; day <= daysInMonth; day++ ) {
      const { dayOfWeek } = calendar.componentsForDate({ year: this.#year, month: this.#month, day });
      const entry = dayData[CalendarMonthView.dayKey(this.#year, this.#month, day)];
      days.push({
        day,
        dayOfWeek,
        isToday: (todayYear === this.#year) && (today.month === this.#month) && (today.dayOfMonth === day - 1),
        moon: entry?.moon ? MOON_PHASES.find(p => p.key === entry.moon) : null,
        hasNote: isGM && !!entry?.note
      });
    }

    context.year = this.#year;
    context.monthIndex = this.#month;
    context.monthName = game.i18n.localize(monthConfig.name);
    context.weekdays = calendar.days.values.map(d => game.i18n.localize(d.name).slice(0, 3));
    context.leading = Array.fromRange(days[0]?.dayOfWeek ?? 0);
    context.days = days;
    context.weekCols = daysPerWeek;
    context.isGM = isGM;
    return context;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClose(options) {
    super._onClose(options);
    if ( CalendarMonthView.#instance === this ) CalendarMonthView.#instance = null;
  }

  /* -------------------------------------------- */

  /**
   * Handle moving to the previous or next month.
   * @this {CalendarMonthView}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #onNavigate(event, target) {
    const delta = target.dataset.action === "nextMonth" ? 1 : -1;
    const monthsCount = game.time.calendar.months.values.length;
    this.#month += delta;
    if ( this.#month < 0 ) {
      this.#month = monthsCount - 1;
      this.#year -= 1;
    } else if ( this.#month >= monthsCount ) {
      this.#month = 0;
      this.#year += 1;
    }
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle jumping back to the current in-world month.
   * @this {CalendarMonthView}
   */
  static #onToday() {
    const { year, month } = game.time.components;
    this.#year = year + game.time.calendar.years.yearZero;
    this.#month = month;
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle opening the day note/moon phase editor. GM only.
   * Ano/mês/dia vêm do dataset da própria célula clicada (gravados no render), e não de
   * this.#year/#month — assim um clique numa grade "velha" logo após navegar de mês (antes
   * do re-render terminar) ainda edita exatamente o dia que estava visível na tela.
   * @this {CalendarMonthView}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Cell that was clicked.
   */
  static #onEditDay(event, target) {
    if ( !game.user.isGM ) return;
    const day = Number(target.dataset.day);
    const year = Number(target.dataset.year);
    const month = Number(target.dataset.month);
    if ( !day || Number.isNaN(year) || Number.isNaN(month) ) return;
    try {
      new CalendarDayNoteDialog({ year, month, day }).render({ force: true });
    } catch(err) {
      console.error("Hunter | Erro ao abrir a nota do dia:", err);
      ui.notifications.error("Não foi possível abrir a nota do dia. Veja o console (F12) para detalhes.");
    }
  }
}
