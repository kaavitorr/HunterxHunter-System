/**
 * Dump the current state of one or all Moldes Hatsu from the live Foundry world, without
 * touching the live LevelDB store (which is normally locked by a running Foundry process).
 *
 * Works whether Foundry is open or closed: it copies the on-disk LevelDB directories to a
 * scratch folder first (copying .ldb/.log/MANIFEST/CURRENT files is safe even while another
 * process holds them open — only the LOCK file itself is exclusive, and we never touch it),
 * then opens the copy read-only with classic-level. This is the same technique validated
 * against this exact world earlier in the session that built this skill.
 *
 * Reads BOTH stores a molde's data can live in: the Molde item itself is a plain world Item
 * (worldDataDir/items), but every manifestação/técnica lives in the shared "Técnicas de Hatsu"
 * compendium (worldDataDir/../packs/hatsu-tecnicas), not the world Items list — see
 * ensureHatsuPack() in module/data/item/hatsu-template.mjs. An earlier version of this script
 * only read worldDataDir/items and silently reported zero técnicas for every molde once the
 * compendium migration landed — if you're editing this file, keep both reads.
 *
 * Usage:
 *   node read-hatsu-state.mjs <worldDataDir> <scratchDir> [nameFilter]
 *
 *   worldDataDir  Path to the world's "data" folder, e.g.
 *                 C:\Users\<user>\Documents\FoundryVTT\Data\worlds\<world>\data
 *   scratchDir    A writable scratch directory to copy the LevelDB stores into.
 *   nameFilter    Optional case-insensitive substring. When given, only the matching
 *                 molde(s) and their linked técnicas are printed. Omit to list every molde
 *                 (name + id only, no técnicas) so you can find the right one first.
 *
 * Output: JSON on stdout — see the shape at the bottom of this file.
 */
import { ClassicLevel } from "classic-level";
import fs from "node:fs";
import path from "node:path";

const [worldDataDir, scratchDir, nameFilter] = process.argv.slice(2);
if ( !worldDataDir || !scratchDir ) {
  console.error("Usage: node read-hatsu-state.mjs <worldDataDir> <scratchDir> [nameFilter]");
  process.exit(1);
}

function copyDbDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for ( const entry of fs.readdirSync(src) ) {
    if ( entry === "LOCK" ) continue; // never touch the live lock file
    fs.copyFileSync(path.join(src, entry), path.join(dest, entry));
  }
}

async function readAll(dbPath) {
  const db = new ClassicLevel(dbPath, { valueEncoding: "utf8" });
  const docs = [];
  for await ( const [key, value] of db.iterator() ) {
    try {
      docs.push(JSON.parse(value));
    } catch {
      // skip anything that isn't a JSON document — still parses fine for folders/items,
      // this only guards against unrelated binary keys
    }
  }
  await db.close();
  return docs;
}

// worldDataDir is .../worlds/<world>/data — the compendium pack lives at the sibling
// .../worlds/<world>/packs/hatsu-tecnicas, not inside "data" at all.
const worldRoot = path.dirname(worldDataDir);

const itemsCopy = path.join(scratchDir, "items");
copyDbDir(path.join(worldDataDir, "items"), itemsCopy);
const worldItems = await readAll(itemsCopy);

const packPath = path.join(worldRoot, "packs", "hatsu-tecnicas");
let packItems = [];
if ( fs.existsSync(packPath) ) {
  const packCopy = path.join(scratchDir, "pack");
  copyDbDir(packPath, packCopy);
  packItems = await readAll(packCopy);
} // else: pack hasn't been created yet (ensureHatsuPack() never ran) — no técnicas exist yet.

const moldes = worldItems.filter(i => i.type === "hatsuTemplate");
const tecnicaPool = packItems.filter(i => i.type === "spell");

if ( !nameFilter ) {
  console.log(JSON.stringify({
    packExists: fs.existsSync(packPath),
    moldes: moldes.map(m => ({ id: m._id, name: m.name }))
  }, null, 2));
  process.exit(0);
}

const needle = nameFilter.toLowerCase();
const matches = moldes.filter(m => m.name.toLowerCase().includes(needle));

const result = matches.map(molde => {
  const tecnicas = tecnicaPool.filter(i => i.flags?.["hunter-system"]?.hatsuTemplate === molde._id);
  return {
    molde: {
      id: molde._id,
      name: molde.name,
      description: molde.system?.description?.value ?? ""
    },
    tecnicas: tecnicas.map(t => ({
      id: t._id,
      name: t.name,
      hatsu: t.flags?.["hunter-system"]?.hatsu ?? {},
      description: t.system?.description?.value ?? "",
      activities: Object.values(t.system?.activities ?? {}).map(a => ({
        id: a._id,
        name: a.name || "",
        type: a.type,
        activation: a.activation?.type ?? null,
        cost: a.consumption?.targets?.[0]?.value ?? null,
        pool: a.consumption?.targets?.[0]?.target ?? null,
        jjScale: a.jjScale?.enabled ? a.jjScale : null,
        constantCost: a.constantCost?.enabled ? a.constantCost : null,
        damage: a.damage?.parts?.map(p =>
          `${p.custom?.enabled ? p.custom.formula : `${p.number}d${p.denomination}`} ${p.types?.join("/") ?? ""}`
        ) ?? null,
        save: a.save ?? null
      }))
    }))
  };
});

console.log(JSON.stringify({ found: result.length, moldes: result }, null, 2));
