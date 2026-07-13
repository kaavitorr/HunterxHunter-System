/**
 * Constrói o objeto de configuração de calendário do Foundry a partir dos
 * valores do Calendário Personalizado (meses UNIFORMES — todos com o mesmo
 * número de dias). Função PURA: não toca em game/CONFIG, testável isolada.
 *
 * @param {object} cfg  Valores do setting `customCalendar`.
 * @returns {object}    Config no formato de CONFIG.time.worldCalendarConfig.
 */
export function buildCustomCalendarConfig(cfg = {}) {
  const monthsPerYear = Math.max(1, Math.round(Number(cfg.monthsPerYear) || 12));
  const daysPerMonth  = Math.max(1, Math.round(Number(cfg.daysPerMonth)  || 30));
  const hoursPerDay   = Math.max(1, Math.round(Number(cfg.hoursPerDay)   || 24));
  const daysPerWeek   = Math.max(1, Math.round(Number(cfg.daysPerWeek)   || 7));
  const monthNames    = Array.isArray(cfg.monthNames)   ? cfg.monthNames   : [];
  const weekdayNames  = Array.isArray(cfg.weekdayNames) ? cfg.weekdayNames : [];

  const months = Array.from({ length: monthsPerYear }, (_, i) => ({
    name: String(monthNames[i] ?? "").trim() || `Mês ${i + 1}`,
    ordinal: i + 1,
    days: daysPerMonth
  }));

  const weekdays = Array.from({ length: daysPerWeek }, (_, i) => ({
    name: String(weekdayNames[i] ?? "").trim() || `Dia ${i + 1}`,
    ordinal: i + 1
  }));

  return {
    name: "Calendário Personalizado",
    years: { yearZero: 0, firstWeekday: 0 },
    months: { values: months },
    days: {
      values: weekdays,
      daysPerYear: monthsPerYear * daysPerMonth,
      hoursPerDay,
      minutesPerHour: 60,
      secondsPerMinute: 60
    },
    // Uma estação cobrindo o ano inteiro: o HUD não usa estações, mas o
    // formatador opcional "data aproximada" acessa seasons.values[season] e
    // quebraria com a lista vazia.
    seasons: { values: [{ name: "Ano", monthStart: 1, monthEnd: monthsPerYear }] }
  };
}
