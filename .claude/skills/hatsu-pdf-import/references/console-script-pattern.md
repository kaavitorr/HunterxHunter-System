# Generating the console script

Claude Code cannot create valid Foundry Documents directly — activity sub-ids, schema
defaults, and validation all need to go through Foundry's own document-creation pipeline, not
hand-built JSON written straight to disk. The proven approach (used successfully several times
while this skill was built) is: emit a self-contained async JS snippet that the user pastes
into Foundry's dev console (F12) while the world is open, using the exact same
`Item.implementation.create()`/`.update()` calls the system's own UI code uses.

## Shape of the script

```
(async () => {
  const { ensureHatsuPack } = await import("/systems/hunter-system/module/data/item/hatsu-template.mjs");
  const pack = await ensureHatsuPack();

  // upsert helpers (see below)

  // 1. molde: create-or-update, get its folder
  // 2. for each manifestação: create-or-update, keeping its own id if it already exists
  // 3. for each técnica under that manifestação: same

  ui.notifications.info("...")
})();
```

Always dynamically `import()` `ensureHatsuPack` from the live system path rather than
reimplementing the get-or-create-pack logic inline — it's the same function the rest of the
system uses, so there's no risk of ending up with two different compendiums.

## Create-or-update ("PDF always wins")

The user's explicit call: when a molde/técnica with the same name already exists, the PDF's
data overwrites it rather than being skipped or merged field-by-field. Update the existing
document in place (`existing.update(data)`) instead of deleting and recreating — this keeps
ownership, sort order, and the item's `_id` (so anything else that might reference it by id
stays valid) intact, and only touches the fields you're actually setting.

Before generating the script, use `scripts/read-hatsu-state.mjs` (see SKILL.md) to check what
already exists. If you find a field configured in Foundry that has **no counterpart in the
PDF at all** (not just a different value — genuinely absent from the PDF), overwriting it
would silently delete information with no PDF source to restore it from later. Flag this
specific case to the user in your pre-apply summary before generating the script, even though
the general "PDF wins" rule still applies once they've seen it and said to proceed.

## Category folder for the Molde itself

The Molde item (a world Item, not compendium) goes into a shared folder named after its Nen
category — "Aprimoramento", "Emissão", etc. (see data-schema.md). Get-or-create it by name in
`game.folders` before creating/updating the Molde:

```js
async function ensureCategoryFolder(categoryName) {
  let folder = game.folders.find(f => (f.type === "Item") && (f.name === categoryName));
  if (!folder) folder = await Folder.implementation.create({ name: categoryName, type: "Item" });
  return folder;
}
// ...
const categoryFolder = await ensureCategoryFolder("Aprimoramento");
molde = await Item.implementation.create({ name: "...", type: "hatsuTemplate", folder: categoryFolder.id, ... });
```

This is a *different* folder from the one `molde.system.ensureFolder()` creates — that one
lives inside the `hatsu-tecnicas` compendium and organizes the molde's own técnicas. The
category folder lives in the plain world Items list and organizes moldes relative to each
other. Don't confuse the two or reuse one function for both.

```js
async function findInPack(pack, type, name, matchFlags) {
  const docs = await pack.getDocuments({ type });
  return docs.find(d => (d.name === name) && matchFlags(d)) ?? null;
}

async function upsert(pack, folder, type, name, data, matchFlags) {
  const existing = await findInPack(pack, type, name, matchFlags);
  if ( existing ) {
    await existing.update(data);
    return existing;
  }
  const [created] = await Item.implementation.create(
    [{ name, type, folder: folder?.id, ...data }],
    { pack: pack.metadata.id }
  );
  return created;
}
```

## Worked example — representative slice of "Black Raven"

This shows the molde, one manifestação with multiple requirements, a técnica with `jjScale`
damage scaling, and a técnica with several named activities (the "Comum / Técnica / Movimento"
reaction pattern) — the three shapes that cover almost everything you'll encounter. The full
hatsu has more técnicas of the same two shapes; don't feel obliged to reproduce this entire
comment block verbatim in every generated script, just follow the pattern.

```js
(async () => {
  const { ensureHatsuPack } = await import("/systems/hunter-system/module/data/item/hatsu-template.mjs");
  const pack = await ensureHatsuPack();

  async function findInPack(type, name, matchFlags) {
    const docs = await pack.getDocuments({ type });
    return docs.find(d => (d.name === name) && matchFlags(d)) ?? null;
  }
  async function upsert(folder, type, name, data, matchFlags) {
    const existing = await findInPack(type, name, matchFlags);
    if ( existing ) { await existing.update(data); return existing; }
    const [created] = await Item.implementation.create(
      [{ name, type, folder: folder?.id, ...data }], { pack: pack.metadata.id }
    );
    return created;
  }

  // ---- Molde ----
  const categoryFolder = await ensureCategoryFolder("Emissão"); // matches the PDF's own title suffix
  let molde = game.items.find(i => (i.type === "hatsuTemplate") && (i.name === "Black Raven"));
  const moldeDesc = "<p>Sua habilidade permite criar corvos de aura que podem ser utilizados "
    + "tanto como apoio para teletransporte quanto para realizar poderosos ataques mentais "
    + "contra criaturas que entrarem em contato com eles.</p>";
  if ( molde ) await molde.update({ "system.description.value": moldeDesc, folder: categoryFolder.id });
  else molde = await Item.implementation.create({
    name: "Black Raven", type: "hatsuTemplate", folder: categoryFolder.id,
    img: "icons/skills/melee/strike-hammer-destructive-blue.webp",
    system: { description: { value: moldeDesc } }
  });
  const folder = await molde.system.ensureFolder(); // técnica folder INSIDE the compendium — different from categoryFolder above

  // ---- Manifestação: Black Crows (slot m1), Focado, requires Emissor 1 ----
  const bcActId = foundry.utils.randomID();
  const blackCrows = await upsert(folder, "spell", "Black Crows", {
    system: {
      level: 0, method: "atwill",
      description: { value: "<p>Ao utilizar uma ação de poder, ... (full flavor text) ...</p>" },
      // system.activation is a SEPARATE field from the activity's own — the item's Detalhes
      // tab reads THIS one, not activities.<id>.activation. Always set both to the same
      // value or the sheet shows "Nenhum" even though the activity itself is configured
      // right. See the callout below the full example for how this was found.
      activation: { type: "power", condition: "" },
      activities: {
        [bcActId]: {
          _id: bcActId, type: "utility",
          activation: { type: "power" },
          consumption: { targets: [{ type: "attribute", target: "energy.generated", value: "2" }] }
        }
      }
    },
    flags: { "hunter-system": {
      hatsuTemplate: molde.id,
      hatsu: { slot: "m1", mode: "focado", requirements: [{ category: "emissor", level: 1 }] }
    } }
  }, d => d.getFlag("hunter-system", "hatsu.slot") === "m1"
        && d.getFlag("hunter-system", "hatsuTemplate") === molde.id);

  // ---- Técnica with jjScale: Black Cloud (parent m1), attack + scaling damage ----
  const bclActId = foundry.utils.randomID();
  await upsert(folder, "spell", "Black Cloud", {
    system: {
      level: 0,
      description: { value: "<p>Ao usar uma ação de poder, ... 2d10 de dano Cortante em caso "
        + "de acerto. A criatura deve realizar uma Salvaguarda de "
        + "[[/save dex dc=@attributes.spell.dc]] para não receber a condição “Cego” "
        + "até o fim do próximo turno dela.</p>" },
      activation: { type: "power", condition: "" },
      activities: {
        [bclActId]: {
          _id: bclActId, type: "attack",
          activation: { type: "power" },
          consumption: { targets: [{ type: "attribute", target: "energy.generated", value: "1" }] },
          jjScale: { enabled: true, formula: "1d10", cost: 1, maxPA: 9 },
          range: { units: "m", value: "36" },
          damage: { parts: [{ number: 2, denomination: 10, types: ["slashing"] }] }
        }
      }
    },
    flags: { "hunter-system": { hatsuTemplate: molde.id, hatsu: { parent: "m1" } } }
  }, d => d.getFlag("hunter-system", "hatsu.parent") === "m1" && (d.name === "Black Cloud"));

  // ---- Técnica with several named activities: Black Assault (parent m1) ----
  const [comumId, tecnicaId, movId] = [foundry.utils.randomID(), foundry.utils.randomID(), foundry.utils.randomID()];
  await upsert(folder, "spell", "Black Assault", {
    system: {
      level: 0,
      description: { value: "<p>Quando você for alvo de uma jogada de ataque ... use sua "
        + "reação para ativar um dos seguintes efeitos: ...</p>" },
      // All three named activities below share "reaction", so that's also the top-level
      // mirror. If a técnica's named activities had different types, use whichever is the
      // primary/first one — there's only one system.activation slot to fill.
      activation: { type: "reaction", condition: "" },
      activities: {
        [comumId]:   { _id: comumId,   type: "utility", name: "Comum",     activation: { type: "reaction" },
                        consumption: { targets: [{ type: "attribute", target: "energy.generated", value: "2" }] } },
        [tecnicaId]: { _id: tecnicaId, type: "utility", name: "Técnica",  activation: { type: "reaction" },
                        consumption: { targets: [{ type: "attribute", target: "energy.generated", value: "3" }] } },
        [movId]:     { _id: movId,     type: "utility", name: "Movimento", activation: { type: "reaction" },
                        consumption: { targets: [{ type: "attribute", target: "energy.generated", value: "3" }] } }
      }
    },
    flags: { "hunter-system": { hatsuTemplate: molde.id, hatsu: { parent: "m1" } } }
  }, d => d.getFlag("hunter-system", "hatsu.parent") === "m1" && (d.name === "Black Assault"));

  ui.notifications.info("Black Raven: molde e técnicas atualizados.");
  console.log("Done.");
})();
```

Notes on things easy to get wrong:
- **`system.activation` (top-level, on the spell item itself) is a separate field from
  `system.activities.<id>.activation` (the activity's own copy) — they don't sync
  automatically, and the item's Detalhes tab reads the top-level one.** Confirmed by a real
  bug (2026-07-02): all four técnicas created for the Adrenalin hatsu had their activity's
  `activation.type` set correctly, but the top-level `system.activation` was left at its
  blank default — the Detalhes tab showed "Nenhum" for every one of them even though the
  activity itself worked fine. Always set both to the same value. **The same duplication is now
  confirmed for `target` too** (2026-07-02, Beattle Bomb from Black Beattle): its activity had
  `target.template.type: "emanation"` set correctly, but the top-level `system.target` was
  left at the generic blank default from the spell shell — the Detalhes tab's "ÁREA" section
  showed an empty Tipo dropdown even though the activity's own AoE config was right. Any
  técnica with an area effect (not just single-target) needs `system.target` mirrored the same
  way as `system.activation`/`range`/`duration` — don't just default it and move on. The AoE
  template also needs a **`size`** field alongside `type`/`units` (e.g.
  `{type:"radius", units:"m", size:"12"}`). `duration` hasn't produced a concrete bug of its
  own yet, but keep mirroring it too rather than assuming it's the exception.

  **`target.template.type` enum keys don't match their own display labels** — confirmed via
  `dnd5e-compiled.mjs`'s `DND5E.areaTargetTypes` (search that name if you need another shape).
  What the PDF calls "Emanação"/Emanation is internally keyed **`radius`**, not `"emanation"` —
  using the guessable-but-wrong key silently leaves the sheet's Tipo dropdown empty instead of
  erroring, so this doesn't fail loud. Known mappings so far: Emanação → `radius`, Esfera →
  `sphere`, Cone → `cone`, Cubo → `cube`, Cilindro → `cylinder`, Linha → `line`, Quadrado →
  `square`, Parede → `wall`, Círculo → `circle`. When in doubt, check the enum rather than
  guessing the obvious English word.

  **Why the two levels exist at all** (clarified by the user 2026-07-02, so this isn't just
  "always copy-paste the same value twice"): the top-level `system.*` fields are the técnica's
  *default* activation/range/duration/target — set these to match whatever the técnica's
  primary activity uses. The per-activity copies are allowed to diverge specifically for
  técnicas that have **an alternate form of themselves with a different range and/or cost** —
  e.g. "you can use this at 9m for 2 PA, or at 18m for 4 PA." When you hit that pattern, don't
  try to cram both into one activity's fields — create a **second named activity** on the same
  spell Item (same pattern as Black Assault's Comum/Técnica/Movimento below) with its own
  range/cost, and leave the top-level `system.*` fields matching whichever activity is the
  primary/first one. If a técnica is single-mode (the overwhelming majority so far), the two
  levels should just match — that's not a coincidence to preserve, it's the normal case.
- Every activity needs its own `foundry.utils.randomID()` — don't reuse a short literal key
  like `"act1"`; real activities in this data always use the same 16-char random id style as
  document `_id`s, and the activity's own `_id` field must match its key in the `activities`
  map.
- `foundry.utils.randomID()` is available globally in the console, no import needed.
- Non-ASCII characters (é, ã, ç, ô, "curly quotes") are fine directly in the script — but if
  you're worried about console paste mangling encoding, `\uXXXX` escapes work too (used above
  for the em/curly quote in one description as an example; you don't need to do this for every
  accented character, plain UTF-8 pastes fine into Foundry's console in practice).
- `pack.getDocuments({ type: "spell" })` filters by the compendium index before fully loading
  documents — much cheaper than loading the whole pack and filtering in JS once a world has
  more than a couple of hatsus in it.

## Batch plan schema (for the Workflow-based batch mode)

When parsing many PDFs in parallel via `agent()` calls with a `schema` option (see SKILL.md's
Batch mode section), each agent should return one object of this shape instead of raw JS — a
single harness (`scripts/batch-create-from-plans.mjs`) then turns every plan into the real
Foundry documents in one sequential pass, so 349 different agents can't each write slightly
different (and possibly buggy) JS.

```
{
  skipped: boolean, skipReason?: string,
  hatsuName: string,
  categoryFolderName: string,       // "Aprimoramento", "Emissão", etc.
  moldeDescription: string,          // HTML
  manifestacoes: [{
    name, slot: "m1"|"m2"|"m3"|"inata", mode: "focado"|"versatil",
    requirements: [{category, level}],
    cost: number, activationType: string, descriptionValue: string,
    durationUnits, durationValue?, rangeUnits, rangeValue?, rangeLong?, rangeSpecial?,
    constantCostEnabled?, constantCostValue?, constantCostPool?
  }],
  tecnicas: [{
    name, parent: "m1"|"m2"|"m3"|"inata", grau: number,
    cost: number, activationType: string, descriptionValue: string,
    durationUnits, durationValue?, rangeUnits, rangeValue?, rangeLong?, rangeSpecial?,
    mechanicKind: "utility"|"attack"|"save"|"heal"|"damage",   // "damage" was missing from the
                                                                 // first version — always include it
    damageParts?: [{number, denomination, types: [], customFormula?}],
    healParts?: [...same shape, types:["healing"|"temphp"|"maximum"]],
    saveAbility?, onSave?: "none"|"half",
    areaType?, areaUnits?, areaSize?,          // target.template shape — see the enum-key table above
    jjScaleEnabled?, jjScaleFormula?, jjScaleCost?, jjScaleMaxPA?,
    constantCostEnabled?, constantCostValue?, constantCostPool?,
    criticalBonus?,
    namedSubActivities?: [{ name, cost, activationType, mechanicKind, damageParts }]
  }],
  doubts: string[]   // be specific — name the técnica and exactly what's uncertain
}
```

The harness (`scripts/batch-create-from-plans.mjs`) consumes an array of `{relPath, plan}` and
handles everything from here — get-or-create the category folder and per-hatsu compendium
folder, mirror activation/range/duration at both levels, build activities from `mechanicKind`,
apply `jjScale`/`constantCost` when present. Don't hand-write the Foundry document shape again
per hatsu in batch mode; feed data into this schema and let the harness do the construction —
that's what keeps 349 independently-generated plans from becoming 349 independently-buggy
scripts.
