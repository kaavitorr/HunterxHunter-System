import Application5e from "../api/application.mjs";

/**
 * Configuração do Calendário Personalizado: meses/ano, dias/mês, horas/dia,
 * dias/semana e os nomes (auto-gerados, editáveis). Salva o setting
 * `customCalendar` e pede reload — o calendário do mundo é montado no init.
 */
export default class CustomCalendarConfig extends Application5e {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "custom-calendar-config",
    tag: "form",
    classes: ["standard-form", "custom-calendar-config"],
    window: { title: "Calendário Personalizado", icon: "fas fa-calendar-days" },
    position: { width: 540, height: "auto" },
    form: { handler: CustomCalendarConfig.#onSubmit, closeOnSubmit: true }
  };

  /** @override */
  static PARTS = {
    body: { template: "systems/hunter-system/templates/settings/custom-calendar.hbs", scrollable: [""] },
    footer: { template: "templates/generic/form-footer.hbs" }
  };

  /** Estado de trabalho (não persiste até Salvar). */
  #working = null;

  /* -------------------------------------------- */

  #init() {
    if ( this.#working ) return;
    const s = game.settings.get("hunter-system", "customCalendar");
    this.#working = {
      monthsPerYear: s.monthsPerYear ?? 12,
      daysPerMonth:  s.daysPerMonth ?? 30,
      hoursPerDay:   s.hoursPerDay ?? 24,
      daysPerWeek:   s.daysPerWeek ?? 7,
      monthNames:    [...(s.monthNames ?? [])],
      weekdayNames:  [...(s.weekdayNames ?? [])]
    };
  }

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.#init();
    const w = this.#working;
    const clamp = v => Math.max(1, Math.round(Number(v) || 1));
    w.monthsPerYear = clamp(w.monthsPerYear);
    w.daysPerMonth  = clamp(w.daysPerMonth);
    w.hoursPerDay   = clamp(w.hoursPerDay);
    w.daysPerWeek   = clamp(w.daysPerWeek);

    context.w = w;
    context.daysPerYear = w.monthsPerYear * w.daysPerMonth;
    context.months = Array.from({ length: w.monthsPerYear }, (_, i) => ({
      i, value: w.monthNames[i] ?? "", placeholder: `Mês ${i + 1}`
    }));
    context.weekdays = Array.from({ length: w.daysPerWeek }, (_, i) => ({
      i, value: w.weekdayNames[i] ?? "", placeholder: `Dia ${i + 1}`
    }));
    context.buttons = [{ type: "submit", icon: "fas fa-save", label: "Salvar e recarregar" }];
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    // Mudar meses/ano ou dias/semana redimensiona as listas de nomes → re-render.
    for ( const el of this.element.querySelectorAll("[data-count]") ) {
      el.addEventListener("change", () => {
        this.#captureNames();
        const w = this.#working;
        w.monthsPerYear = Math.max(1, Math.round(Number(this.element.querySelector("[data-count='monthsPerYear']")?.value) || 1));
        w.daysPerMonth  = Math.max(1, Math.round(Number(this.element.querySelector("[data-count='daysPerMonth']")?.value) || 1));
        w.hoursPerDay   = Math.max(1, Math.round(Number(this.element.querySelector("[data-count='hoursPerDay']")?.value) || 1));
        w.daysPerWeek   = Math.max(1, Math.round(Number(this.element.querySelector("[data-count='daysPerWeek']")?.value) || 1));
        this.render();
      });
    }
  }

  /** Lê os nomes digitados agora para o estado (não perder ao re-render/salvar). */
  #captureNames() {
    const w = this.#working;
    for ( const el of this.element.querySelectorAll("[data-month]") ) w.monthNames[Number(el.dataset.month)] = el.value;
    for ( const el of this.element.querySelectorAll("[data-weekday]") ) w.weekdayNames[Number(el.dataset.weekday)] = el.value;
  }

  /* -------------------------------------------- */

  /** @this {CustomCalendarConfig} */
  static async #onSubmit(event, form, formData) {
    this.#captureNames();
    const w = this.#working;
    const monthNames   = Array.from({ length: w.monthsPerYear }, (_, i) => String(w.monthNames[i] ?? "").trim());
    const weekdayNames = Array.from({ length: w.daysPerWeek }, (_, i) => String(w.weekdayNames[i] ?? "").trim());
    await game.settings.set("hunter-system", "customCalendar", {
      monthsPerYear: w.monthsPerYear, daysPerMonth: w.daysPerMonth,
      hoursPerDay: w.hoursPerDay, daysPerWeek: w.daysPerWeek,
      monthNames, weekdayNames
    });
    const sel = game.settings.get("hunter-system", "calendar");
    if ( sel !== "custom" ) {
      ui.notifications.info("Calendário Personalizado salvo. Selecione \"Personalizado\" na configuração de calendário para usá-lo.");
    }
    return foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
  }
}
