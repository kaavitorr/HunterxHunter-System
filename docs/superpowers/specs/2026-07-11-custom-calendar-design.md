# Calendário Personalizado (Custom Calendar) — hunter-system

Data: 2026-07-11 · Status: aprovado (design + 3× Recommended no AskUserQuestion)

## Objetivo
Permitir que o Narrador defina o próprio calendário (para mundos diferentes):
**quantos meses tem 1 ano, quantos dias tem 1 mês, quantas horas tem 1 dia** —
integrado no SISTEMA (não módulo).

## Decisões (AskUserQuestion)
- **Meses uniformes**: um único "dias por mês"; todos os meses têm esse tamanho.
- **Nomes automáticos, editáveis**: "Mês 1"…"Mês N" e "Dia 1"… gerados, podendo
  renomear cada um.
- **Semana configurável**: `daysPerWeek` (padrão 7) para a grade do mês.

## Arquitetura (Abordagem A)
O init já monta o calendário do mundo a partir do setting `calendar`
(`dnd5e.mjs` ~341): `CONFIG.DND5E.calendar.calendars.find(c => c.value === sel)`
→ `CONFIG.time.worldCalendarConfig = cfg.config`. Adicionamos uma entrada
**"Personalizado"** (`value: "custom"`) nessa lista, cujo `config` é CONSTRUÍDO a
partir de um setting novo. O seletor de calendário (que lista os presets) passa a
mostrar "Personalizado" sozinho. Aplicar mudanças pede reload (igual aos presets,
que já são `requiresReload`).

## Dado novo — setting `customCalendar` (world, DataModel)
- `monthsPerYear`  NumberField int min 1, initial 12
- `daysPerMonth`   NumberField int min 1, initial 30
- `hoursPerDay`    NumberField int min 1, initial 24
- `daysPerWeek`    NumberField int min 1, initial 7
- `monthNames`     ArrayField(StringField) — auto: "Mês {i}", editável
- `weekdayNames`   ArrayField(StringField) — auto: "Dia {i}", editável
- (minutesPerHour / secondsPerMinute fixos em 60)
- `requiresReload: true` (rebuild acontece no init)

## Construtor `buildCustomCalendarConfig(cfg)` → config de calendário Foundry
- `days`: `{ values: weekdayNames(daysPerWeek), daysPerYear: monthsPerYear*daysPerMonth,
  hoursPerDay, minutesPerHour: 60, secondsPerMinute: 60 }`
- `months`: `{ values: [{ name, ordinal: i+1, days: daysPerMonth } × monthsPerYear] }`
- `years`: `{ yearZero: 0, firstWeekday: 0, leapYear: { leapStart: 0, leapInterval: 0 } }`
  (sem bissexto)
- `seasons`: `{ values: [] }` (sem estações; o HUD tolera)
- Nomes: usa `monthNames[i]`/`weekdayNames[i]` quando houver; senão gera fallback.

## Fiação no init (dnd5e.mjs, antes de ler o setting `calendar`)
Registrar/atualizar a entrada custom em `CONFIG.DND5E.calendar.calendars`:
`{ value: "custom", label: "Personalizado", config: buildCustomCalendarConfig(get("customCalendar")) }`.
Se já existir (re-init), substitui o config. Assim, quando `calendar === "custom"`,
`worldCalendarConfig` recebe o config construído.

## UI de configuração
Estender o app existente `calendar-settings.mjs`: quando o calendário selecionado
for "custom", renderizar os campos numéricos (meses/ano, dias/mês, horas/dia,
dias/semana) + as listas de nomes editáveis (N inputs conforme monthsPerYear /
daysPerWeek). Ao salvar, gravar o setting e recarregar. Os arrays de nomes se
ajustam ao tamanho (mantém os existentes, completa/apara conforme os números).

## Arquivos
- `module/data/settings/custom-calendar-setting.mjs` — novo DataModel.
- `module/data/calendar/build-custom-calendar.mjs` — novo `buildCustomCalendarConfig`.
- `dnd5e.mjs` — registrar a entrada "custom" na lista antes de ler o setting.
- `module/settings.mjs` — registrar setting `customCalendar` (requiresReload).
- `module/applications/settings/calendar-settings.mjs` + template — campos custom.
- `lang/en.json` — rótulo "Personalizado" e labels dos campos.

## Fora do escopo (YAGNI)
Ano bissexto, estações customizadas, meses de tamanhos diferentes, fases da lua
específicas do custom. Adicionáveis depois.
