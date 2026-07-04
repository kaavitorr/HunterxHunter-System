/**
 * Take an array of {relPath, plan} entries (the structured output from parse agents matching
 * the HATSU_PLAN_SCHEMA shape used in the batch-import workflow) and create every molde/
 * manifestação/técnica directly in the live LevelDB stores — Foundry must be closed.
 *
 * Built and validated 2026-07-02 during the first 349-hatsu batch import run (88/349 processed
 * before hitting a session usage limit; this harness created all 88 correctly with zero
 * errors). Reuse this for future batch runs rather than hand-writing per-hatsu creation scripts
 * — it already encodes every lesson from this session's individual imports (top-level/activity
 * field mirroring for activation/range/duration/target, the `radius` enum-key gotcha, the
 * singular `healing`-shaped damage parts for heal activities, category + per-hatsu folder
 * get-or-create, etc.).
 *
 * Usage:
 *   node batch-create-from-plans.mjs <plansJsonPath> <worldItemsPath> <worldFoldersPath> <packItemsPath> <reportJsonPath>
 *
 *   plansJsonPath    JSON array of {relPath, plan} — plan matches the schema documented in
 *                    references/console-script-pattern.md's batch section (durationUnits/Value,
 *                    rangeUnits/Value/Long/Special, mechanicKind, damageParts, healParts,
 *                    saveAbility, onSave, areaType/Units/Size, jjScale*, constantCost*,
 *                    criticalBonus, namedSubActivities).
 *   worldItemsPath   .../worlds/<world>/data/items
 *   worldFoldersPath .../worlds/<world>/data/folders — dedicated store for ALL world Folder
 *                    docs regardless of content type; category folders for moldes go here, NOT
 *                    in worldItemsPath (see ensureCategoryFolder for why this matters).
 *   packItemsPath    .../worlds/<world>/packs/hatsu-tecnicas
 *   reportJsonPath   where to write {created, errors, doubts} for the human report
 *
 * One bad plan doesn't stop the batch — each hatsu is wrapped in try/catch and logged to
 * report.errors, everything else still gets created.
 */
import { ClassicLevel } from "classic-level";
import fs from "node:fs";

function randomID(length = 16) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

const now = Date.now();
const USER_ID = "uligtGwGRLnLneXd";

function itemStats() {
  return {
    coreVersion: "14.364", systemId: "hunter-system", systemVersion: "1.0.3",
    createdTime: now, modifiedTime: now, lastModifiedBy: USER_ID,
    compendiumSource: null, duplicateSource: null, exportSource: null
  };
}
function folderStats() {
  return {
    coreVersion: "14.364", systemId: null, systemVersion: null,
    createdTime: now, modifiedTime: now, lastModifiedBy: USER_ID,
    compendiumSource: null, duplicateSource: null, exportSource: null
  };
}

function rangeObj(units, value, long, special) {
  const r = { units: units || "self", special: special || "" };
  if (value) r.value = value;
  if (long) r.long = long;
  return r;
}
function durationObj(units, value) {
  const d = { units: units || "inst" };
  if (value) d.value = value;
  return d;
}

function spellShell({ id, name, descriptionValue, activities, level = 0, method, folder, topActivation, topDuration, topRange, topTarget }) {
  return {
    name, type: "spell", _id: id,
    img: "systems/hunter-system/icons/svg/items/spell.svg",
    system: {
      level,
      ...(method ? { method } : {}),
      activities,
      uses: { spent: 0, recovery: [], max: "" },
      description: { value: descriptionValue || "", chat: "" },
      identifier: (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || randomID(8),
      source: { revision: 1, rules: "2024" },
      activation: topActivation ?? { type: "", condition: "" },
      duration: topDuration ?? { units: "inst" },
      materials: { value: "", consumed: false, cost: 0, supply: 0 },
      prepared: 0,
      properties: [],
      range: topRange ?? { units: "self", special: "" },
      school: "",
      target: topTarget ?? { template: { contiguous: false, stationary: false, units: "ft", type: "" }, affects: { choice: false, type: "" } }
    },
    effects: [], folder, sort: 0,
    ownership: { default: 0, [USER_ID]: 3 },
    flags: {},
    _stats: itemStats()
  };
}

const baseFields = (id, activationType, cost) => ({
  _id: id, img: "", sort: 0,
  activation: { type: activationType || "action", override: false },
  consumption: { scaling: { allowed: false }, spellSlot: true, targets: [{ type: "attribute", value: String(cost ?? 0), target: "energy.generated", scaling: {} }] },
  description: { chatFlavor: "" },
  jjScale: { enabled: false, cost: 1, maxPA: 0 },
  constantCost: { enabled: false, pool: "generated", concentration: false },
  duration: { units: "inst", concentration: false, override: false },
  effects: [], flags: {},
  uses: { spent: 0, recovery: [], max: "" },
  visibility: { level: { min: null, max: null }, requireAttunement: false, requireIdentification: false, requireMagic: false },
  name: ""
});

function partsFromPlan(parts) {
  if (!Array.isArray(parts)) return [];
  return parts.map(p => {
    if (p.customFormula) {
      return { custom: { enabled: true, formula: p.customFormula }, number: 0, denomination: 0, bonus: "", types: p.types || [], scaling: { mode: "", number: 1 } };
    }
    return { custom: { enabled: false, formula: "" }, number: p.number ?? 1, denomination: p.denomination ?? 6, bonus: "", types: p.types || [], scaling: { mode: "", number: 1 } };
  });
}

function jjScaleFromPlan(t) {
  if (!t.jjScaleEnabled) return undefined;
  return { enabled: true, formula: t.jjScaleFormula || "1d6", cost: t.jjScaleCost ?? 1, maxPA: t.jjScaleMaxPA ?? 0 };
}

function areaTemplate(t) {
  if (!t.areaType) return null;
  return { contiguous: false, stationary: false, units: t.areaUnits || "m", type: t.areaType, size: t.areaSize || "" };
}

// Best-effort guesses (2026-07-02), unverified against Foundry's actual core icon set — flag
// to the user if any of these show as a broken image and swap for a confirmed path.
const CATEGORY_ICONS = {
  "Aprimoramento": "icons/skills/melee/strike-hammer-destructive-blue.webp",
  "Emissão": "icons/magic/light/projectile-smoke-blue.webp",
  "Conjuração": "icons/magic/symbols/runes-star-pentagon-blue.webp",
  "Transmutação": "icons/magic/nature/leaf-glow-green.webp",
  "Manipulação": "icons/magic/control/hand-open-fire-blue.webp",
  "Especialização": "icons/magic/symbols/question-stone-yellow.webp"
};
const DEFAULT_ICON = "icons/skills/melee/strike-hammer-destructive-blue.webp";

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function buildActivity(id, t) {
  const jjScale = jjScaleFromPlan(t);
  const area = areaTemplate(t);
  const kind = t.mechanicKind || "utility";

  const rangeField = area
    ? { units: "self", override: false }
    : rangeObj(t.rangeUnits, t.rangeValue, t.rangeLong, t.rangeSpecial);

  const targetField = area
    ? { template: area, affects: { choice: false }, override: false, prompt: true }
    : { template: { contiguous: false, stationary: false, units: "m" }, affects: { choice: false }, override: false, prompt: true };

  const base = { ...baseFields(id, t.activationType, t.cost), range: rangeField, target: targetField };
  if (jjScale) base.jjScale = jjScale;
  if (t.constantCostEnabled) {
    base.constantCost = { enabled: true, value: t.constantCostValue || "1", pool: t.constantCostPool || "generated", concentration: false };
  }

  if (kind === "attack") {
    base.type = "attack";
    base.attack = { critical: { threshold: null }, flat: false, type: { value: "", classification: "" }, ability: "spellcasting", bonus: "" };
    base.damage = { critical: { bonus: t.criticalBonus || "" }, includeBase: true, parts: partsFromPlan(t.damageParts) };
  } else if (kind === "save") {
    base.type = "save";
    base.damage = { onSave: t.onSave || "none", parts: partsFromPlan(t.damageParts) };
    base.save = { ability: [t.saveAbility || "con"], dc: { calculation: "spellcasting", formula: "" } };
  } else if (kind === "heal") {
    base.type = "heal";
    base.damage = { critical: { bonus: "" }, includeBase: true, parts: partsFromPlan(t.healParts && t.healParts.length ? t.healParts : t.damageParts) };
  } else if (kind === "damage") {
    base.type = "damage";
    base.damage = { critical: { allow: false }, parts: partsFromPlan(t.damageParts) };
  } else {
    base.type = "utility";
  }
  return base;
}

function buildActivities(t) {
  if (Array.isArray(t.namedSubActivities) && t.namedSubActivities.length) {
    const acts = {};
    for (const sub of t.namedSubActivities) {
      const id = randomID();
      const merged = { ...t, ...sub };
      const act = buildActivity(id, merged);
      act.name = sub.name || "";
      acts[id] = act;
    }
    return acts;
  }
  const id = randomID();
  return { [id]: buildActivity(id, t) };
}

// IMPORTANT: Folder documents for ANY content type (Item, Actor, JournalEntry, ...) live in
// their own dedicated LevelDB store at worldDataDir/folders — NOT inside worldDataDir/items
// alongside the !items! keys. Confirmed 2026-07-02 after category folders written into the
// items store were invisible to Foundry's real folder tree (moldes' `folder` field pointed to
// a technically-valid-looking ID, but Foundry never loaded a Folder document with that ID from
// the store it actually reads folders from, so the sidebar rendered everything flat). Pass the
// foldersDb (opened on worldDataDir/folders) here, never itemsDb.
async function ensureCategoryFolder(foldersDb, folderCache, categoryName) {
  if (folderCache.has(categoryName)) return folderCache.get(categoryName);
  for await (const [key, value] of foldersDb.iterator()) {
    if (!key.startsWith("!folders!")) continue;
    let obj;
    try { obj = JSON.parse(value); } catch { continue; }
    if (obj.type === "Item" && obj.name === categoryName) {
      folderCache.set(categoryName, obj._id);
      return obj._id;
    }
  }
  const id = randomID();
  const folder = {
    _id: id, name: categoryName, type: "Item", sorting: "a", sort: 0, color: null, folder: null, flags: {},
    _stats: { ...folderStats(), systemId: "hunter-system", systemVersion: "1.0.3" }
  };
  await foldersDb.put(`!folders!${id}`, JSON.stringify(folder));
  folderCache.set(categoryName, id);
  return id;
}

// Compendium packs are self-contained single LevelDB stores (unlike the world), so a
// compendium's own Folder documents legitimately live alongside its !items! keys in the same
// store — this one is NOT affected by the world-level folders/items split above.
async function ensureHatsuFolder(packDb, hatsuName) {
  for await (const [key, value] of packDb.iterator()) {
    if (!key.startsWith("!folders!")) continue;
    let obj;
    try { obj = JSON.parse(value); } catch { continue; }
    if (obj.type === "Item" && obj.name === hatsuName) return obj._id;
  }
  const id = randomID();
  const folder = { _id: id, name: hatsuName, type: "Item", sorting: "a", sort: 0, color: null, folder: null, flags: {}, _stats: folderStats() };
  await packDb.put(`!folders!${id}`, JSON.stringify(folder));
  return id;
}

async function main() {
  const plansPath = process.argv[2];
  const worldItemsPath = process.argv[3];
  const worldFoldersPath = process.argv[4];
  const packItemsPath = process.argv[5];
  const reportPath = process.argv[6];

  const entries = JSON.parse(fs.readFileSync(plansPath, "utf8"));

  const itemsDb = new ClassicLevel(worldItemsPath, { valueEncoding: "utf8" });
  const foldersDb = new ClassicLevel(worldFoldersPath, { valueEncoding: "utf8" });
  const packDb = new ClassicLevel(packItemsPath, { valueEncoding: "utf8" });

  const folderCache = new Map();
  const report = { created: [], errors: [], doubts: [] };

  for (const entry of entries) {
    const plan = entry.plan;
    if (!plan || plan.skipped) continue;
    try {
      const categoryName = plan.categoryFolderName || "Sem Categoria";
      const categoryFolderId = await ensureCategoryFolder(foldersDb, folderCache, categoryName);
      const moldeId = randomID();
      const molde = {
        name: decodeEntities(plan.hatsuName), type: "hatsuTemplate", _id: moldeId,
        img: CATEGORY_ICONS[categoryName] || DEFAULT_ICON,
        system: {
          description: { value: plan.moldeDescription || "", chat: "" },
          identifier: (plan.hatsuName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || randomID(8),
          source: { revision: 1, rules: "2024" }
        },
        effects: [], folder: categoryFolderId, sort: 0,
        ownership: { default: 0, [USER_ID]: 3 },
        flags: {},
        _stats: itemStats()
      };
      await itemsDb.put(`!items!${moldeId}`, JSON.stringify(molde));

      const hatsuFolderId = await ensureHatsuFolder(packDb, plan.hatsuName);
      molde.flags = { "hunter-system": { hatsuFolder: hatsuFolderId } };
      await itemsDb.put(`!items!${moldeId}`, JSON.stringify(molde));

      let tecnicaCount = 0;
      for (const m of (plan.manifestacoes || [])) {
        const id = randomID();
        const activities = buildActivities(m);
        const item = spellShell({
          id, name: decodeEntities(m.name), folder: hatsuFolderId, method: "atwill",
          descriptionValue: m.descriptionValue,
          activities,
          topActivation: { type: m.activationType || "power", condition: "" },
          topDuration: durationObj(m.durationUnits, m.durationValue),
          topRange: rangeObj(m.rangeUnits, m.rangeValue, m.rangeLong, m.rangeSpecial)
        });
        item.flags = { "hunter-system": { hatsuTemplate: moldeId, hatsu: {
          slot: m.slot, mode: m.mode || "focado", requirements: m.requirements || []
        } } };
        await packDb.put(`!items!${id}`, JSON.stringify(item));
        tecnicaCount++;
      }

      for (const t of (plan.tecnicas || [])) {
        const id = randomID();
        const activities = buildActivities(t);
        const area = areaTemplate(t);
        const item = spellShell({
          id, name: decodeEntities(t.name), folder: hatsuFolderId, level: t.grau || 0,
          descriptionValue: t.descriptionValue,
          activities,
          topActivation: { type: t.activationType || "action", condition: "" },
          topDuration: durationObj(t.durationUnits, t.durationValue),
          topRange: area ? { units: "self", special: "" } : rangeObj(t.rangeUnits, t.rangeValue, t.rangeLong, t.rangeSpecial),
          topTarget: area ? { template: area, affects: { choice: false, type: "" } } : undefined
        });
        item.flags = { "hunter-system": { hatsuTemplate: moldeId, hatsu: { parent: t.parent } } };
        await packDb.put(`!items!${id}`, JSON.stringify(item));
        tecnicaCount++;
      }

      report.created.push({ hatsuName: plan.hatsuName, category: plan.categoryFolderName, tecnicaCount, moldeId });
      if (Array.isArray(plan.doubts) && plan.doubts.length) {
        report.doubts.push({ hatsuName: plan.hatsuName, doubts: plan.doubts });
      }
    } catch (err) {
      report.errors.push({ hatsuName: plan?.hatsuName ?? entry.relPath, error: String(err?.stack || err) });
    }
  }

  await itemsDb.close();
  await foldersDb.close();
  await packDb.close();

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Created: ${report.created.length}, Errors: ${report.errors.length}, With doubts: ${report.doubts.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
