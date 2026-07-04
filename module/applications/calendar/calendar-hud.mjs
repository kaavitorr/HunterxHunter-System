import CalendarData5e from "../../data/calendar/calendar-data.mjs";
import { formatTime } from "../../utils.mjs";
import BaseCalendarHUD from "./base-calendar-hud.mjs";
import CalendarMonthView from "./calendar-month-view.mjs";
import SetDateDialog from "./set-date-dialog.mjs";

/**
 * @import { CalendarTimeDeltas } from "../../data/calendar/_types.mjs";
 * @import { CalendarHUDButton } from "./_types.mjs";
 */

/**
 * Application for showing a date and time interface on the screen.
 */
export default class CalendarHUD extends BaseCalendarHUD {
  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    actions: {
      openCharacterSheet: CalendarHUD.#openCharacterSheet,
      openMonthView: CalendarHUD.#openMonthView,
      openPartySheet: CalendarHUD.#openPartySheet,
      setDate: CalendarHUD.#setDate,
      toggleAutoTime: CalendarHUD.#onToggleAutoTime
    },
    classes: ["faded-ui", "ui-control"]
  };

  /**
   * How many real-world milliseconds between each automatic time tick.
   * @type {number}
   */
  static AUTO_TIME_INTERVAL_MS = 10000;

  /**
   * How many in-world minutes are advanced per automatic tick. At the default interval
   * (5 min a cada 10s) uma hora do mundo passa a cada ~2 minutos reais.
   * @type {number}
   */
  static AUTO_TIME_MINUTES_PER_TICK = 5;

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    startButtons: {
      classes: ["calendar-buttons"],
      template: "systems/hunter-system/templates/apps/calendar-buttons.hbs"
    },
    core: {
      classes: ["calendar-core"],
      template: "systems/hunter-system/templates/apps/calendar-dial.hbs"
    },
    endButtons: {
      classes: ["calendar-buttons"],
      template: "systems/hunter-system/templates/apps/calendar-buttons.hbs"
    }
  };

  /* -------------------------------------------- */

  /**
   * Default time periods to display for controlling time.
   * @type {{ value: number, unit: string, [default]: boolean }}
   */
  static TIME_CONTROL_VALUES = [
    { value: 7, unit: "day" },
    { value: 1, unit: "day" },
    { value: 8, unit: "hour" },
    { value: 1, unit: "hour", default: true },
    { value: 10, unit: "minute" },
    { value: 1, unit: "minute" }
  ];

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Prepared calendar buttons to display.
   * @type {CalendarHUDButton[]}
   */
  #buttons = [];

  /**
   * Handle of the active automatic-time interval, if any. O estado "tocando" em si vive
   * no setting mundial `calendarAutoTime` ({ active, userId }) — fonte única de verdade
   * compartilhada entre clientes; apenas o cliente cujo userId consta no setting roda o
   * intervalo, evitando que dois GMs conectados avancem o relógio em dobro.
   * @type {number|null}
   */
  #autoTimeIntervalId = null;

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _configureRenderOptions(options) {
    super._configureRenderOptions(options);
    if ( this.rendered ) options.parts = options.parts.filter(p => p !== "core");
  }

  /* -------------------------------------------- */

  /**
   * Build the list of default calendar buttons.
   * @returns {CalendarHUDButton[]}
   * @protected
   */
  _getCalendarButtons() {
    const defaultTime = CalendarHUD.TIME_CONTROL_VALUES.find(v => v.default) ?? { value: 1, unit: "hour" };
    const defaultAmount = formatTime(defaultTime.value, defaultTime.unit).titleCase();
    return [
      {
        action: "reverse",
        dataset: defaultTime,
        icon: "fa-solid fa-angles-left",
        position: "start",
        tooltip: game.i18n.format("DND5E.CALENDAR.Action.ReverseTime", { amount: defaultAmount }),
        visible: game.user.isGM,
        additional: CalendarHUD.TIME_CONTROL_VALUES.map(({ value, unit }) => ({
          action: "reverse",
          dataset: { value, unit },
          label: `-${formatTime(value, unit, { unitDisplay: "narrow" })}`,
          tooltip: game.i18n.format("DND5E.CALENDAR.Action.ReverseTime", {
            amount: formatTime(value, unit).titleCase()
          })
        }))
      },
      {
        action: "setDate",
        icon: "fa-solid fa-calendar-days",
        position: "start",
        tooltip: game.i18n.localize("DND5E.CALENDAR.Action.SetDate"),
        visible: game.user.isGM
      },
      {
        action: "openMonthView",
        icon: "fa-solid fa-calendar-week",
        position: "start",
        tooltip: "Ver o mês",
        visible: true
      },
      {
        action: "openCharacterSheet",
        icon: "fa-solid fa-user",
        position: "start",
        tooltip: game.i18n.localize("DND5E.CALENDAR.Action.OpenCharacterSheet"),
        visible: !!game.user.character
      },
      {
        action: "advance",
        dataset: defaultTime,
        icon: "fa-solid fa-angles-right",
        position: "end",
        tooltip: game.i18n.format("DND5E.CALENDAR.Action.AdvanceTime", { amount: defaultAmount }),
        visible: game.user.isGM,
        additional: CalendarHUD.TIME_CONTROL_VALUES.map(({ value, unit }) => ({
          action: "advance",
          dataset: { value, unit },
          label: `+${formatTime(value, unit, { unitDisplay: "narrow" })}`,
          tooltip: game.i18n.format("DND5E.CALENDAR.Action.AdvanceTime", {
            amount: formatTime(value, unit).titleCase()
          })
        }))
      },
      {
        action: "openPartySheet",
        icon: "fa-solid fa-users",
        position: "end",
        tooltip: game.user.isGM
          ? (game.actors.party
            ? `${game.i18n.localize("DND5E.CALENDAR.Action.OpenPartySheet")} — botão direito para trocar`
            : "Vincular uma ficha de grupo — botão direito")
          : game.i18n.localize("DND5E.CALENDAR.Action.OpenPartySheet"),
        visible: game.actors.party?.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED)
      }
    ];
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this._prepareButtonsContext(context, options);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare the buttons that can be displayed around the calendar UI.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   */
  async _prepareButtonsContext(context, options) {
    /**
     * A hook event that fires when preparing the buttons displayed around the calendar HUD. Buttons in each list
     * are sorted with those closest to the center first.
     * @function dnd5e.prepareCalendarButtons
     * @memberof hookEvents
     * @param {CalendarHUD} app              The Calendar HUD application being rendered.
     * @param {CalendarHUDButton[]} buttons  Buttons displayed around the calendar UI.
     */
    const controls = this._doEvent(this._getCalendarButtons, {
      async: false,
      debugText: "Calendar Control Buttons",
      hookName: "dnd5e.prepareCalendarButtons",
      hookResponse: true,
      parentClassHooks: false
    });

    const prepareCalendarButton = (data, index, parent) => ({
      ...data, index,
      additional: data.additional ? data.additional.map((a, i) => prepareCalendarButton(a, i, data)) : undefined,
      tooltipDirection: (parent?.position ?? data.position) === "start" ? "LEFT" : "RIGHT"
    });

    this.#buttons = context.buttons = controls
      .filter(b => typeof b.visible === "function" ? b.visible.call(this) : b.visible ?? true)
      .map(prepareCalendarButton);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch ( partId ) {
      case "endButtons":
        context.buttons = context.buttons.filter(b => b.position === "end");
        break;
      case "startButtons":
        context.buttons = context.buttons.filter(b => b.position === "start").reverse();
        break;
      case "core":
        context.isGM = game.user.isGM;
        context.isPlaying = !!(game.settings.get("hunter-system", "calendarAutoTime")?.active);
        break;
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Adjust the date, time, and wheel rotation without a full re-render to allow animation.
   * Wrapped defensively — an error here must never block the rest of Foundry's render cycle.
   * @param {CalendarTimeDeltas} [deltas={}]  Information on the time change deltas.
   */
  async renderCore(deltas={}) {
    try {
      const prefs = game.settings.get("hunter-system", "calendarPreferences");
      const dateFormatter = CONFIG.DND5E.calendar.formatters.find(f => f.value === prefs.formatters.date);
      const dateEl = this.element.querySelector(".calendar-date");
      if ( dateEl ) dateEl.innerText = dateFormatter ? game.time.calendar.format(
        game.time.components, dateFormatter.formatter
      ) : "";
      const timeFormatter = CONFIG.DND5E.calendar.formatters.find(f => f.value === prefs.formatters.time);
      const timeEl = this.element.querySelector(".calendar-time");
      if ( timeEl ) timeEl.innerText = timeFormatter ? game.time.calendar.format(
        game.time.components, timeFormatter.formatter
      ) : "";

      this._renderWheelAngle();
      this._renderDayNightState();
      this._syncAutoTimeState();
    } catch(err) {
      console.error("Hunter | Erro ao renderizar a roda do calendário:", err);
    }
  }

  /* -------------------------------------------- */

  /**
   * Rotate the sun/moon dial to reflect the current hour of a full 24-hour cycle.
   * Hour 0 (midnight) places the moon at the top; hour 12 (noon) places the sun there.
   * @protected
   */
  _renderWheelAngle() {
    const dial = this.element.querySelector(".hxh-cal-dial");
    if ( !dial ) return;
    const hoursOfDay = CalendarData5e.hoursOfDay(game.time.components, game.time.calendar);
    const hoursPerDay = game.time.calendar.days.hoursPerDay;
    const angle = (((hoursOfDay / hoursPerDay) * 360) + 180) % 360;
    dial.style.setProperty("--hxh-cal-angle", `${angle}deg`);
  }

  /* -------------------------------------------- */

  /**
   * Mark the dial as day or night so the currently-active icon (sun by day, moon by night)
   * lights up while the other stays dim.
   * @protected
   */
  _renderDayNightState() {
    const dial = this.element.querySelector(".hxh-cal-dial");
    if ( !dial ) return;
    const dayProgress = game.time.calendar.progressDay(game.time.components);
    const isDaytime = (dayProgress >= 0) && (dayProgress <= 1);
    dial.classList.toggle("is-day", isDaytime);
    dial.classList.toggle("is-night", !isDaytime);
  }

  /* -------------------------------------------- */
  /*  Life-Cycle Handlers                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);
    await this.renderCore();
    this.#attachPartyContextMenu();
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */
  // NOTA: esconder o widget (fecha a app) não para o auto-tempo deste cliente de propósito —
  // é preferência visual (calendarPreferences.visible, por usuário), não deveria congelar o
  // relógio do mundo se este cliente ainda é o responsável (calendarAutoTime.userId). Quem
  // decide se o intervalo roda é sempre _syncAutoTimeState, recalculado a cada evento
  // relevante (render, mudança do setting, pauseGame) — não o ciclo de vida da app.

  /**
   * Handle opening the player's character sheet.
   * @this {CalendarHUD}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #openCharacterSheet(event, target) {
    game.user.character?.sheet.render({ force: true });
  }

  /* -------------------------------------------- */

  /**
   * Handle opening the month view calendar grid.
   * @this {CalendarHUD}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #openMonthView(event, target) {
    CalendarMonthView.open();
  }

  /* -------------------------------------------- */

  /**
   * Handle opening the primary party's sheet. Se nenhum grupo estiver vinculado ainda,
   * avisa em vez de simplesmente não fazer nada (o GM pode vincular um pelo botão direito).
   * @this {CalendarHUD}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #openPartySheet(event, target) {
    const party = game.actors.party;
    if ( !party ) {
      ui.notifications.warn(game.user.isGM
        ? "Nenhuma ficha de grupo vinculada. Clique com o botão direito neste botão para vincular uma."
        : "Nenhuma ficha de grupo foi vinculada ainda.");
      return;
    }
    party.sheet.render({ force: true });
  }

  /* -------------------------------------------- */

  /**
   * Liga o clique com o botão direito no botão "Abrir Ficha do Grupo" a um diálogo para
   * vincular (ou desvincular) qual ator do tipo Grupo conta como grupo primário. Só o GM
   * pode alterar essa configuração (é um setting de mundo, `primaryParty`) — para outros
   * usuários o botão direito continua abrindo o menu padrão do navegador.
   */
  #attachPartyContextMenu() {
    if ( !game.user.isGM ) return;
    const btn = this.element?.querySelector('[data-action="openPartySheet"]');
    btn?.addEventListener("contextmenu", event => {
      event.preventDefault();
      this.#linkPartySheet();
    });
  }

  /* -------------------------------------------- */

  /**
   * Abre um diálogo para escolher qual ator do tipo Grupo vincular como grupo primário
   * (ou remover a vinculação atual, selecionando "Nenhum").
   */
  async #linkPartySheet() {
    const current = game.actors.party;
    const groups = game.actors.filter(a => a.type === "group");
    const options = groups.map(a => `
      <option value="${a.id}" ${a === current ? "selected" : ""}>${foundry.utils.escapeHTML(a.name)}</option>
    `).join("");
    const hint = groups.length ? "" : `
      <p style="margin:0 0 4px; font-size:11px; color:#e0a050;">
        Nenhuma ficha de Grupo encontrada — crie uma na aba de Atores primeiro.
      </p>`;

    const content = `
      <div style="display:flex; flex-direction:column; gap:8px; padding:2px 0 4px;">
        <p style="margin:0; font-size:12px; color:#aaa;">
          Escolha qual ficha de grupo vincular como grupo primário.
        </p>
        ${hint}
        <select id="jj-party-select" style="width:100%; padding:6px 8px;">
          <option value="">— Nenhum —</option>
          ${options}
        </select>
      </div>`;

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Vincular Ficha de Grupo" },
      content,
      buttons: [
        {
          action: "link", label: "Vincular", icon: "fa-solid fa-check", default: true,
          callback: (event, button, dialog) => ({
            actorId: dialog.element.querySelector("#jj-party-select")?.value || null
          })
        },
        { action: "cancel", label: "Cancelar", icon: "fa-solid fa-xmark" }
      ],
      rejectClose: false,
      close: () => null
    });
    if ( !result ) return;

    const actor = result.actorId ? game.actors.get(result.actorId) : null;
    await game.settings.set("hunter-system", "primaryParty", { actor });
    ui.notifications.info(actor
      ? `"${actor.name}" vinculado como grupo primário.`
      : "Vinculação de grupo primário removida.");
  }

  /* -------------------------------------------- */

  /**
   * Handle opening the set date dialog.
   * @this {CalendarHUD}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #setDate(event, target) {
    if ( !game.user.isGM ) return;
    const dialog = new SetDateDialog();
    dialog.render({ force: true });
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling automatic time advancement on or off. Só grava o setting mundial —
   * o onChange do setting (que dispara em todos os clientes, incluindo este) é quem
   * liga/desliga o intervalo e sincroniza o botão, via _syncAutoTimeState().
   * @this {CalendarHUD}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static async #onToggleAutoTime(event, target) {
    if ( !game.user.isGM ) return;
    const current = game.settings.get("hunter-system", "calendarAutoTime") ?? {};
    await game.settings.set("hunter-system", "calendarAutoTime",
      current.active ? { active: false, userId: null } : { active: true, userId: game.user.id });
  }

  /* -------------------------------------------- */

  /**
   * Reconcilia o estado local (intervalo + botão) com o setting mundial `calendarAutoTime`
   * e com o pause do jogo. Chamado no render, no onChange do setting (todos os clientes)
   * e no hook pauseGame. A "core" part não re-renderiza após o primeiro render (ver
   * _configureRenderOptions), então o botão é atualizado direto no DOM.
   */
  _syncAutoTimeState() {
    const { active, userId } = game.settings.get("hunter-system", "calendarAutoTime") ?? {};

    // Intervalo: apenas o cliente dono avança o relógio.
    if ( active && (userId === game.user.id) ) this.#startAutoTime();
    else this.#stopAutoTime();

    // Botão (só existe para GM, e só depois do primeiro render).
    const btn = this.element?.querySelector(".hxh-cal-play");
    if ( !btn ) return;
    const paused = !!active && game.paused;
    btn.classList.toggle("is-playing", !!active);
    btn.classList.toggle("is-game-paused", paused);
    btn.dataset.tooltip = !active ? "Deixar o tempo correr"
      : paused ? "Tempo automático pausado junto com o jogo"
      : "Pausar o tempo";
    const icon = btn.querySelector("i");
    if ( icon ) {
      icon.classList.toggle("fa-play", !active);
      icon.classList.toggle("fa-pause", !!active);
    }
  }

  /* -------------------------------------------- */

  /**
   * Begin automatically advancing world time at a fixed real-world interval.
   */
  #startAutoTime() {
    if ( this.#autoTimeIntervalId !== null ) return;
    this.#autoTimeIntervalId = window.setInterval(() => {
      if ( game.paused ) return;
      try {
        game.time.advance({ minute: CalendarHUD.AUTO_TIME_MINUTES_PER_TICK });
      } catch(err) {
        console.error("Hunter | Erro ao avançar o tempo automaticamente:", err);
        this.#stopAutoTime();
      }
    }, CalendarHUD.AUTO_TIME_INTERVAL_MS);
  }

  /* -------------------------------------------- */

  /**
   * Stop any active automatic time advancement on this client.
   */
  #stopAutoTime() {
    if ( this.#autoTimeIntervalId !== null ) {
      window.clearInterval(this.#autoTimeIntervalId);
      this.#autoTimeIntervalId = null;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  _onClickAction(event, target) {
    if ( !target.parentElement.classList.contains("calendar-button") ) return;
    const topLevelButton = target.closest(".calendar-buttons > .calendar-button").querySelector(":scope > button");
    let config = this.#buttons[topLevelButton.dataset.index];
    if ( topLevelButton !== target ) config = config?.additional?.[target.dataset.index];
    if ( typeof config?.onClick === "function" ) config.onClick(event);
  }

  /* -------------------------------------------- */

  // TODO: Respond to updates to primary party
  // TODO: Respond to updates to player's character

  /** @override */
  static onUpdateWorldTime(worldTime, deltaTime, options, userId) {
    if ( this.shouldDisplay ) dnd5e.ui.calendar?.renderCore(options.dnd5e?.deltas);
  }
}

/* -------------------------------------------- */

// Pausar/despausar o jogo muda o estado visual do botão de auto-tempo (o intervalo em si
// já ignora ticks com o jogo pausado; aqui só refletimos isso no botão).
Hooks.on("pauseGame", () => dnd5e.ui.calendar?._syncAutoTimeState?.());

/* -------------------------------------------- */

/**
 * Handle da reivindicação de auto-tempo pendente, se houver — cancelado se o GM responsável
 * reconectar antes do atraso terminar.
 * @type {number|null}
 */
let _calendarAutoTimeReclaimId = null;

/**
 * Se o GM responsável por avançar o tempo automaticamente cair da conexão (crash, aba
 * fechada, queda de rede), ninguém mais avança o relógio e o setting fica "preso" em
 * {active:true, userId:<desconectado>} — o mundo congela silenciosamente, sem que nenhum
 * outro GM perceba (o botão de qualquer outro cliente continua mostrando "tocando").
 * Aqui, qualquer outro GM conectado detecta a queda e reivindica o posto após um pequeno
 * atraso (com jitter) para deixar outros GMs também conectados perceberem a queda antes —
 * como o setting usa "o último a escrever vence", só o primeiro a disparar realmente escreve;
 * os demais, ao verificar de novo no disparo, veem que o setting já mudou e desistem.
 */
Hooks.on("userConnected", (user, active) => {
  const current = game.settings.get("hunter-system", "calendarAutoTime") ?? {};

  // O usuário reconectou: se era ele quem tocava o tempo, cancela qualquer reivindicação
  // pendente (agendada por outro cliente enquanto ele estava fora) — ele mesmo retoma a
  // condução ao renderizar (_syncAutoTimeState vê que o userId ainda é o dele).
  if ( active ) {
    if ( current.active && (current.userId === user?.id) ) {
      window.clearTimeout(_calendarAutoTimeReclaimId);
      _calendarAutoTimeReclaimId = null;
    }
    return;
  }

  if ( !game.user.isGM || !current.active || (current.userId !== user?.id) ) return;

  window.clearTimeout(_calendarAutoTimeReclaimId);
  _calendarAutoTimeReclaimId = window.setTimeout(() => {
    const stillStale = game.settings.get("hunter-system", "calendarAutoTime") ?? {};
    if ( stillStale.active && (stillStale.userId === user?.id) ) {
      game.settings.set("hunter-system", "calendarAutoTime", { active: true, userId: game.user.id });
    }
  }, 200 + Math.random() * 300);
});
