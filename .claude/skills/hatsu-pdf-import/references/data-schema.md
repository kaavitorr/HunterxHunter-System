# Data schema reference

This documents how a Molde Hatsu (a Nen ability tree) is represented in this Foundry world's
data, as reverse-engineered from the two hatsus that existed when this skill was built (Black
Raven, 100-Type Guanyin Bodhisattva) plus their source PDFs.

**Re-read the live source before trusting field names below.** This schema is under active
development — a `mode`/`Grau` system was added to it mid-session by a different Claude Code
session while this skill was being built, with no warning. Before generating a console script,
open these three files fresh and diff what you find against this document:

- `module/data/item/hatsu-template.mjs` — the Molde item type, `ensureHatsuPack()`
- `module/applications/item/hatsu-template-sheet.mjs` — `SLOTS`, `CATEGORIES`, and the exact
  `Item.implementation.create(...)` calls to imitate
- `module/data/activity/base-activity.mjs` — `jjScale` / `constantCost` field definitions

If something here is stale, trust the code, not this file — and consider updating this file
to match while you're at it.

## The Molde (hatsuTemplate item)

A Molde doesn't store its manifestações/técnicas as data — it's a lightweight container that
links to real `spell`-type Items via a flag, the same way a dnd5e container links its contents
via `system.container` instead of embedding them. This means every técnica gets the *real*
spell item sheet (activities, damage, everything) instead of a flattened data blob, at the
cost of the técnicas being separate documents you have to look up by flag.

Those técnicas live in a shared world compendium (`world.hatsu-tecnicas`), not the flat world
Items list — `ensureHatsuPack()` gets-or-creates it. Never put a técnica directly in
`game.items`; always create it inside that pack (see console-script-pattern.md).

Fields on the Molde item itself:
- `name` — prefer the filename's spelling over the PDF's internal section header if they
  disagree (seen once: a PDF's internal header said "Boshisattva", the filename and the
  already-correct Foundry name said "Bodhisattva" — the filename seems to be the cleaned-up
  canonical version).
- `system.description.value` — HTML. Fill this from the hatsu's own intro paragraph in the
  PDF (the text between the "ASPECTO INATO" section and the first manifestação header). Both
  example hatsus had this field empty in Foundry, which is a real gap, not the intended state.
- `folder` — the Molde item (a world Item, not compendium) goes in a **category folder**
  matching the hatsu's primary Nen category, e.g. "Aprimoramento", "Emissão" — the same
  category word that appears after the en-dash in the PDF's own title line ("Assassin's Cross
  – Aprimoramento") and matches the PDF library's own directory structure
  (`Hatsus 3.0\Aprimorador\...`, `Hatsus 3.0\Emissor\...`). One shared folder per category,
  not one folder per hatsu — get-or-create it by name before creating the Molde, the same way
  `ensureFolder()` gets-or-creates the compendium folder for técnicas. Rule from the user
  2026-07-02, applied retroactively to move all 4 existing Aprimoramento moldes (including the
  pre-existing 100-Type Guanyin Bodhisattva, which had its own now-empty legacy folder from
  before the compendium migration — that empty leftover folder was not deleted, just emptied;
  clean it up manually if it's bothering you).
  **Category Folder documents belong in the world's dedicated `data/folders` LevelDB store, NOT
  in `data/items` alongside the `!items!` keys.** This was a real bug (2026-07-02): the first
  batch run's `ensureCategoryFolder()` wrote `!folders!<id>` keys into `data/items`, which made
  the moldes' `folder` field technically valid-looking on direct inspection but invisible to
  Foundry's real folder tree — Foundry loads ALL world Folder documents (Item, Actor, Journal,
  Scene, etc. — distinguished by the Folder's own `type` field) from one shared `data/folders`
  store, separate from every content type's own store. Symptom was moldes rendering as a flat,
  alphabetically-sorted list in the Items sidebar with no visible folder grouping — confirmed
  NOT a UI sort/view-mode issue (an earlier note here wrongly concluded that once; don't trust
  that shortcut, always verify the folder doc actually lives in `data/folders` if this recurs).
  Compendium-internal folders (the per-molde técnica folders inside `world.hatsu-tecnicas`) are
  a different, unaffected case — a compendium pack is a single self-contained LevelDB store, so
  its own Folder docs legitimately co-locate with its `!items!` keys there.
  `batch-create-from-plans.mjs` now takes a separate `worldFoldersPath` argument for this.
- `img` — set per the hatsu's category, not a single hardcoded icon for every molde:
  `CATEGORY_ICONS` in `scripts/batch-create-from-plans.mjs`. These are **best-effort guesses at
  real Foundry core icon paths, not verified** against an actual Foundry icons browse (this
  skill doesn't have a reliable way to enumerate the core icon set from outside a running
  Foundry) — the one exception is `icons/skills/melee/strike-hammer-destructive-blue.webp`
  (Aprimoramento), which is confirmed working since every molde used it as the default before
  categories got their own icons. If the user reports a broken/missing image for a category,
  ask them to pick a replacement via Foundry's own file picker rather than guessing again.
- **`name` (on the Molde, and every manifestação/técnica) is plain text, never HTML** — a real
  bug (2026-07-02): one batch run's agent output HTML-escaped an ampersand in a hatsu's own name
  ("Veritas &amp; Vincit" instead of "Veritas & Vincit"), which then showed the literal escaped
  text in Foundry's sidebar. `descriptionValue` fields DO need real HTML tags/entities;
  `name` fields never do. `batch-create-from-plans.mjs` now runs a defensive `decodeEntities()`
  on every name field as a safety net, but the parse-agent prompt was also fixed not to escape
  names in the first place — don't rely on the safety net alone if you're hand-writing a
  console script instead of using the batch harness.

## Flags on manifestação/técnica items (type `spell`)

| Flag | Meaning |
|---|---|
| `flags.hunter-system.hatsuTemplate` | id of the Molde this item belongs to |
| `flags.hunter-system.hatsu.slot` | `"inata"` \| `"m1"` \| `"m2"` \| `"m3"` — this item *is* the manifestação occupying that tier |
| `flags.hunter-system.hatsu.parent` | same values — this item is a técnica subordinate to the manifestação in that slot. Mutually exclusive with `.slot`. |
| `flags.hunter-system.hatsu.requirements` | `[{category, level}]`, only on a `.slot` item, max 6. Gates the manifestação behind the character having that Nen category at that level. `category` is one of `aprimorador`/`emissor`/`transmutador`/`conjurador`/`manipulador`/`especialista`. |
| `flags.hunter-system.hatsu.mode` | `"focado"` (default) \| `"versatil"`, only on a `.slot` item. This is the PDF's **Tipo** column. Every example PDF read so far says Focado — if you hit a real Versátil PDF, double check the result with the user since this path is unvalidated. |

`inata` is a real, reserved slot for a técnica that's unique and specific to *this* hatsu (an
"Habilidade Inata") — but do **not** use it for the PDF's "ASPECTO INATO" section (see "What to
skip" below), which is a *different* thing: a trait shared by every hatsu of that Nen category,
not specific to this one. Neither example hatsu had a técnica in the `inata` slot, so this path
is unvalidated against a real PDF — if a PDF's table has a manifestação-like row that isn't
under the usual m1/m2/m3 progression, it might belong here; ask the user if it's unclear.
Content in this slot uses `energy.total` for its cost, not `energy.generated` (see the Cost
bullet below) — that's the one signal that reliably distinguishes "this is an Habilidade Inata"
from an ordinary manifestação if the PDF doesn't label it obviously.

## Requirements table extraction

Every PDF has a table near the top: `Prof. | Habilidades | Tipo | Subcategoria | Categorias |
Treinamentos`. One row group per manifestação. `Categorias`/`Treinamentos` are the
`requirements` source — a manifestação can have several stacked category/level pairs in the
same row (e.g. Hyakushiki Kannon: Aprimoramento 1 + Emissão 3 + Manipulação 3 → three entries).

Nen category names in the PDF are the long form (Aprimoramento, Emissão, Transmutação,
Conjuração, Manipulação, Especialização or similar) — map to the short `category` id used in
code (aprimorador/emissor/transmutador/conjurador/manipulador/especialista). `Tipo` in this
same table (Focado/Versátil) is the one other column that matters — it's `hatsu.mode`.

**What to skip from this table:** `Prof.` (Ótimo/Excelente/Ultimato — appears to track slot
tier 1:1 in every example so far, not separately meaningful), `Subcategoria`, and the
"Proficiência do Hatsu (X)" banner below the table. The user explicitly asked not to build
new schema for these — another effort is handling related pieces of this. Don't fold them
into the description text either; just drop them.

**What to skip entirely:** the "ASPECTO INATO" section (e.g. "Aura Distante", "Aura
Vigorosa"). Every PDF has one, and it looks like hatsu-specific content, but it's actually
fixed per Nen category (already represented elsewhere, e.g.
`module/systems/nen-categories-data.mjs`) — importing it would create a duplicate, not fill a
gap. Confirmed explicitly by the user; do not import it even though it's tempting to treat its
absence as a completeness gap.

## Activity / mechanical schema (inside `system.activities.<id>` on a técnica)

- **Cost**: `consumption.targets = [{type:"attribute", target:"energy.generated", value:"<N>",
  scaling:{mode:"",formula:""}}]`. Defaults to `energy.generated` (the "activated" PA pool a
  character generates each turn) — see `module/systems/energy.mjs` for the two-pool model.
  **Exception**: a técnica/manifestação in the `"inata"` slot uses `energy.total` instead
  (target `"energy.total"`), and so does anything whose PDF text explicitly says "Aura Total"
  rather than just "Pontos de Aura". This is how "Custo: N PA" becomes mechanically enforced —
  the number itself always comes straight from the PDF's cost line/parenthetical.
- **jjScale** (the PDF's "Você pode gastar N PA para aumentar XdY de dano até um máximo de
  ZdY" pattern): `{enabled:true, formula:"XdY", cost:N, maxPA:(Z-baseDiceCount)*N}`. Doesn't
  apply to attack-roll bonuses — only damage/healing/save-DC-shaped numeric bonuses.
- **constantCost** (per-turn upkeep for a toggle, distinct from a one-time activation cost):
  `{enabled, value:"<formula>", pool:"generated"|"total", concentration}`. None of the
  técnicas in either example hatsu use this — everything is either instant or a fixed-duration
  effect paid once. Only wire it up if a PDF explicitly describes a per-turn drain while a
  toggle stays active; don't assume every "Duração: X minutos" ability needs it (it doesn't —
  both example hatsus have several fixed-duration técnicas that just pay once).
- **reduction** (only on `type: "reduction"` activities): `reduction:{formula:"<NdM or fixed>",
  constant:<bool>}`. `formula` is the shield/reduction amount (dice or flat, e.g. `"6d8"` or
  `"5"`). `constant:false` (default) = a one-shot shield rolled once per use that absorbs like
  armor points and depletes as hits land — the reaction "reduz Xd8 de dano até o início do
  próximo turno" case. `constant:true` = a **sustained per-hit reduction**: once used it stays
  ACTIVE (shows in the combat HUD, toggled off there) and reduces *all* damage taken by the
  formula, **re-rolled fresh on every hit**, never depleting — the "enquanto ativa, reduz Xd8 de
  cada dano sofrido" case (e.g. Star Shield). Pair `constant:true` with `constantCost` when the
  PDF says it drains PA per turn while active. Added by the user 2026-07 — the earlier deferred
  Star Shield ("a cada dano recebido rola xd8 e reduz automaticamente") is exactly this case.
- **condicao** (only on `type` attack/save/damage — the only three sheets that render it):
  `condicao:{id:"<jj-status-id>", ability:"<save code>", dc:"<formula or ''>",
  semSalvaguarda:<bool>, gatilho:"<'' | 'crit' | 'nat20'>"}`. Structured way to make a
  damaging/attacking técnica also impose a **condition** on the target. Fields:
  - `id` — the condition's status id. Built-in conditions all use the `jj-` prefix (see the
    JJ_CONDITIONS table below). Empty = no condition. Must match an existing status id or a
    custom condition defined on a world actor, or it won't resolve — if the PDF's condition isn't
    in the table and isn't a known custom one, fall back to an inline enricher/text and flag it.
  - `ability` — the save the target rolls to resist (`str`/`dex`/`con`/`int`/`wis`/`cha`, default
    `con`; PT→code map is the same ability table below).
  - `dc` — optional DC formula. Empty = auto (the activity's own save DC on a `save` activity,
    else the caster's technique DC `@attributes.spell.dc`). Only set it if the PDF states a fixed
    CD that differs from the caster's normal técnica DC.
  - `semSalvaguarda` — `true` when the condition applies with NO save (PDF says it just happens,
    "sem salvaguarda"/"automaticamente").
  - `gatilho` — trigger, **only meaningful on Attack**: `""` = on any hit, `"crit"` = only on a
    crit, `"nat20"` = only on a natural 20. Save and Damage activities ignore it.
  Runtime: Attack → on-hit button "Salv. X · CD n" rolls for targets, applies to failures; Save
  → auto-stitched when the target fails the damage save; Damage → a direct condition-save button.
  **This replaces the old "secondary condition-save becomes an inline `[[/save]]` enricher"
  convention** whenever the condition maps to a known `jj-*` status — prefer the structured
  `condicao` field now; keep enrichers only for conditions with no matching status id, or for a
  *second* condition on the same activity (the field holds only one).

  Common PT condition → `jj-` id (from JJ_CONDITIONS in `character-sheet.mjs`; re-check the source
  for the full list, it's user-extensible): Agarrado=`jj-agarrado`, Alucinado=`jj-alucinado`,
  Amedrontado=`jj-amedrontado`, Apaixonado=`jj-apaixonado`, Atordoado=`jj-atordoado`,
  Bêbado=`jj-bebado`, Caído=`jj-caido`, Cego=`jj-cego`, Congelado=`jj-congelado`,
  Desidratado=`jj-desidratado`, Empoderado=`jj-empoderado`, Enfeitiçado=`jj-enfeiticado`,
  Enfurecido=`jj-enfurecido`, Energia Esgotada=`jj-energia-esgotada`, Estremecido=`jj-estremecido`,
  Exausto=`jj-exausto`, Envenenado=`jj-envenenado`, Hipotérmico=`jj-hipotermico`,
  Impedido=`jj-impedido`, Incapacitado=`jj-incapacitado`, Inconsciente=`jj-inconsciente`,
  Invisível=`jj-invisivel`, Letárgico=`jj-letargico`, Mudo=`jj-mudo`, Paralisado=`jj-paralisado`,
  Pesado=`jj-pesado`, Petrificado=`jj-petrificado`, Queimado=`jj-queimado`,
  Queimadura=`jj-queimadura`, Sangramento=`jj-sangramento`, Sonolento=`jj-sonolento`,
  Sufocado=`jj-sufocado`, Surdo=`jj-surdo`.
- **Activity `type` selection** is its own decision tree with several PDF-phrasing triggers —
  see `references/activity-type-rules.md`, don't guess this from first principles each time.
- **`system.identifier`** is cosmetic slug residue Foundry auto-generates from whatever
  placeholder name an item had at creation time (e.g. "Nova Técnica" → `nova-tecnica`), and it
  doesn't update on rename. It is not hand-curated anywhere in the existing data — don't invent
  a naming convention for it, just let Foundry default it.

## Ability code mapping

The system reskins DnD's six abilities but keeps their underlying `str`/`dex`/`con`/`int`/
`wis`/`cha` codes internally — the Portuguese names are a front-end display layer over the
original DnD attributes, not a new set of abilities. Confirmed against `lang/en.json` (re-verify
before relying on it, since it's user-editable localization, not a stable enum) and directly by
the user:

| DnD | dnd5e code | Portuguese | UI abbreviation |
|---|---|---|---|
| Strength | `str` | Força | For |
| Dexterity | `dex` | Agilidade | Agi |
| Constitution | `con` | Constituição | Con |
| Intelligence | `int` | Espírito | Esp |
| Wisdom | `wis` | Sabedoria | Sab |
| Charisma | `cha` | Presença | Pre |

For inline save enrichers (see description-format.md), use the `dnd5e code` column:
`[[/save <code> dc=@attributes.spell.dc]]` — e.g. `[[/save dex dc=@attributes.spell.dc]]` for
a Salvaguarda de Agilidade. Note **`attributes` is plural** — confirmed against the two
enrichers already live in this world's data (Black Cloud, Kill Yourself both use
`@attributes.spell.dc`), even though it's easy to mistype as singular.
