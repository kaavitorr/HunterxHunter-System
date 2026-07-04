---
name: hatsu-pdf-import
description: Import a Hunter x Hunter "Hatsu" ability PDF (from the user's homebrew hatsu library, usually under Downloads\Hatsus New\...) into this Foundry VTT world as a fully-configured Molde Hatsu — creates the hatsuTemplate item plus real spell Items for every manifestação/técnica with activities, PA cost, damage, and jjScale scaling all wired up, not just pasted-in flavor text. Use this whenever the user hands you a hatsu PDF, points at one, or asks to import/configure/create/atualizar a hatsu ability in Foundry from a PDF — including re-imports when a PDF has been revised and Foundry needs to catch up. Trigger on phrases like "importa esse hatsu", "configura esse PDF de hatsu", "cria esse molde a partir do PDF", "atualiza o hatsu X com esse PDF novo", even if the user doesn't say "skill" or name this file.
---

# Hatsu PDF → Foundry import

Turns a hatsu PDF into a working Molde Hatsu in the `hunter` world: a `hatsuTemplate` item
plus one `spell` item per manifestação and técnica, each with its mechanics actually
configured (attack rolls, damage dice, PA cost, scaling) — the same shape a human would get by
hand-building it in the Molde's own sheet, just automated from the source document.

## Why this needs care, not just OCR-and-paste

A hatsu PDF isn't a flat block of flavor text — it's encoding real game mechanics (costs,
damage dice, scaling caps, category gates) in prose and small tables, and the Foundry side has
specific fields for each of those. Two hatsus were reverse-engineered by hand to build this
skill (Black Raven, 100-Type Guanyin Bodhisattva) and their PDFs were read directly — the
mapping rules below and in `references/` come from comparing PDF text to the resulting Foundry
data field by field, including catching a couple of places where the existing Foundry data
turned out to be incomplete or to have silently drifted from its PDF. Treat every field you
fill in as something with a specific home, not just text to relocate.

## Before you touch anything: re-read the live schema

The `hatsuTemplate`/técnica data model in this codebase is under active development — it
changed mid-session while this skill was being written, without warning, because a different
Claude Code session was also working on it. Before generating a script, read these fresh
rather than trusting `references/data-schema.md` blindly:

- `module/data/item/hatsu-template.mjs`
- `module/applications/item/hatsu-template-sheet.mjs` (`SLOTS`, `CATEGORIES`, and the exact
  `Item.implementation.create()` calls — imitate these, don't invent your own shape)
- `module/data/activity/base-activity.mjs` (`jjScale`/`constantCost` field definitions)

If the code disagrees with `references/`, the code wins — and it's worth a quick update to
`references/` so the next run isn't working from stale notes.

## Workflow

**1. Read the whole PDF.** Read every page — the requirements table and the "ASPECTO INATO"
section are usually on page 1, técnicas can spill onto later pages. If the user gave you
several PDFs in one request, handle each independently (each is its own Molde).

**2. Parse it into molde + manifestações + técnicas.** See `references/data-schema.md` for
the full field mapping (flags, activity schema, ability-code table, what to extract from the
requirements table), `references/activity-type-rules.md` for the decision tree that picks
which Activity type a técnica's effect becomes and how its cost/scaling gets configured (this
is more specific than it looks — the system has real conventions, like attack-roll damage
always being d10/d12, that make most of this mechanical once you know them), and
`references/description-format.md` for how to write the HTML description for each item — there
are two legitimate PDF formatting styles and the skill's job is to detect and mirror whichever
one a given técnica uses, not normalize them. Skip the "ASPECTO INATO" section entirely (it's
category-wide content already represented elsewhere, not hatsu-specific — see data-schema.md
for why this isn't actually a gap).

**3. Check what already exists.** Run the bundled reader to see if this hatsu is already in
the world and what it currently looks like, without needing to touch the live Foundry process:

```
node .claude/skills/hatsu-pdf-import/scripts/read-hatsu-state.mjs \
  "C:\Users\kaa_v\Documents\FoundryVTT\Data\worlds\hunter\data" \
  <a scratch dir> "<hatsu name>"
```

This works whether Foundry is open or closed (it copies the LevelDB store before reading, and
never touches the live LOCK file). Omit the name filter first to list every existing molde if
you're not sure of the exact name to search for.

**4. Build the plan and flag anything that needs a human look before you write the script:**
- Any number you pulled from near a PDF table that you couldn't cross-validate against a
  prose restatement (see description-format.md's extraction-scrambling caveat).
- Any field that's currently set in Foundry but has **no counterpart at all in the PDF** —
  since this project's convention is "PDF always wins" on conflicts, silently applying that
  rule here would delete a value with nothing to fall back to. Show it to the user before you
  overwrite it, even though the general rule is to proceed once they've seen it.
- A manifestação whose `Tipo` column says "Versátil" — every example seen while building this
  skill was "Focado"; the Versátil mapping (per-técnica `Grau`) is implemented per
  data-schema.md but untested against a real PDF. Call this out explicitly the first time it
  comes up.

Present a concise summary — molde name, each manifestação with its slot/requirements/mode,
each técnica with its parent/cost/activity type — and get a go-ahead before generating
anything. This is a fast enough read that skipping the confirmation step to save time isn't
worth the risk of writing 30+ Item creates the user didn't actually want yet.

**5. Generate the console script.** Follow `references/console-script-pattern.md` — it has
the exact create-or-update pattern (existing items get `.update()`'d in place, not deleted and
recreated, to preserve ownership/sort/id) and a worked example covering the three activity
shapes you'll actually run into (simple utility, attack with `jjScale`, and a técnica with
several named activities like a multi-option reaction). Give the user the complete script in
a fenced code block, plus the one-line instruction: open Foundry, F12 for the console, paste,
Enter.

**6. After they run it, suggest a quick check** — open the Molde's sheet and confirm the
manifestação/técnica counts and slots match what you summarized in step 4. If something looks
off, it's much cheaper to fix by re-running an adjusted script than by hand-editing in the
sheet.

## Batch mode (many hatsus at once)

For importing dozens/hundreds of PDFs in one go (first done 2026-07-02, ~350 PDFs across all 6
Nen categories in the user's library), don't run the single-hatsu workflow above 350 times —
use a Workflow to parallelize the read/parse step, then one single sequential write pass:

1. **Discover + dedupe** the PDF list first, in plain shell/Node, before spawning anything:
   exclude any hatsu already in Foundry (check via `read-hatsu-state.mjs`), and watch for
   near-duplicate filenames for the same hatsu name at different revision/proficiency tags
   (e.g. a plain filename vs. one with a `- F` suffix, or the same name at two different
   proficiency words like "Genial" vs "Ultimato" sitting as sibling files, not inside a
   "Genial"/"Versão Genial" subfolder — that subfolder pattern is a *different*, simpler case
   the user already told this skill to always skip). **Confirmed by the user: "Ultimato" is
   always the more complete version** when it's one of the two options; fall back to "Genial"
   only when Ultimato isn't present. Ask before guessing on anything not covered by that rule.
2. **Parse phase — parallel, safe.** One agent per PDF, each reading this SKILL.md + all
   `references/*.md` fresh (don't inline a condensed rule summary into the batch prompt instead
   of pointing at the docs — a condensed copy drifts out of sync with real fixes over time) plus
   its one assigned PDF, returning a structured plan via a JSON schema — see
   `references/console-script-pattern.md`'s "Batch plan schema" section for the exact shape
   that matches `scripts/batch-create-from-plans.mjs`. Use `effort: "medium"` per agent; the
   rule set is mature enough not to need `high`, but `low` risks silently misapplying the
   nuanced parts (activity-type selection especially) without flagging doubt.
3. **Write phase — must be sequential, never parallel.** Multiple processes writing to the
   same LevelDB store (or racing to create the same category folder) risks corruption/
   duplicates. Don't have agents do the writing at all — collect every agent's plan back in
   your own context, then run `scripts/batch-create-from-plans.mjs` **once**, which opens each
   LevelDB store one time and creates everything in a single pass, one hatsu after another,
   with each hatsu wrapped in try/catch so one bad plan doesn't lose the rest of the batch.
4. **Watch for a session/usage limit mid-batch** at this scale (hit at ~88/349 the first time,
   ~6.9M tokens across the parse phase alone) — agents that die on it return `null` from
   `agent()`, not a caught error, so count `total_requested - succeeded.length` rather than
   trusting an explicit "failed" bucket to capture everything. These aren't content failures;
   just re-run the parse workflow with the remaining PDF list once the limit resets.
5. **The doubts report doesn't fit in a chat message at this scale** (801 doubts across 88
   hatsus, first run) — save the full JSON and summarize *patterns* (which hatsus hit the same
   systemic issue) in chat, not every individual doubt. Cross-check the doubts for signs your
   OWN schema has a gap, not just PDF-content ambiguity — see the schema-bug note below.

**Known schema gap (fixed after discovery, but re-check before reusing an old copy of the
batch schema):** the first version of the batch plan schema only offered
`mechanicKind: "utility"|"attack"|"save"|"heal"` — missing dnd5e's native `"damage"` type
(automatic/unconditional damage, not gated by an attack roll or save) and any field for
`constantCost` (per-turn PA upkeep, distinct from a one-time activation cost and from
`jjScale`). Both are real, already-documented parts of the single-hatsu workflow
(`activity-type-rules.md` case "damage", `data-schema.md`'s constantCost entry) that got
dropped when the schema was written from scratch for parallel agents instead of reusing the
existing docs closely enough. Result: 27 of the first 88 hatsus had at least one técnica
force-categorized as `utility` (silently losing its damage config) because `"damage"` wasn't a
valid enum option, and 13 had a stated per-turn drain left as text-only because there was
nowhere to put it. `scripts/batch-create-from-plans.mjs` and the schema in
`console-script-pattern.md` are now fixed — if those 27+13 already-created hatsus haven't been
manually corrected yet, that's still open follow-up work (their names are in the first run's
`batch_report.json`, findable by searching each hatsu's doubts for "not offered" / "constantCost").

## Reference files

- `references/data-schema.md` — flags, activity/consumption/jjScale fields, ability-code
  table, what to extract from the requirements table, what to skip entirely.
- `references/activity-type-rules.md` — the decision tree for picking attack/save/damage/
  utility/summon and configuring cost pool + scaling. Read this before guessing an Activity
  type from first principles; it encodes real system conventions, not just heuristics.
- `references/description-format.md` — the two HTML description styles and when each applies,
  the inline-enricher convention for secondary saves, the PDF-extraction caveat.
- `references/console-script-pattern.md` — the create-or-update helper pattern, a complete
  worked example script, and the batch-plan JSON schema for the workflow-based batch mode.
- `scripts/read-hatsu-state.mjs` — safe, non-destructive dump of a molde's current Foundry
  state (works with Foundry open or closed).
- `scripts/batch-create-from-plans.mjs` — sequential single-pass creator for batch mode; takes
  an array of parsed plans and writes everything directly to the LevelDB stores.

## Resolved decisions worth knowing the history of

- **"Reduction" pattern** ("reduzir NdY de dano para um benefício secundário", e.g. Soco de
  Gratidão / 100 Braços) is *not* the codebase's existing `type: "reduction"` Activity (that's
  an unrelated defensive shield). Confirmed by the user 2026-07-02: no schema exists for this
  yet — configure the damage normally and leave this part as description text until told a
  real mechanism has been built. See activity-type-rules.md.
