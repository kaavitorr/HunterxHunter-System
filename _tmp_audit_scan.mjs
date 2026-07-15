import { ClassicLevel } from "classic-level";
import fs from "node:fs";

const itemsPath = process.argv[2]; // .../worlds/hunter/data/items
const packPath = process.argv[3];  // .../worlds/hunter/packs/hatsu-tecnicas
const outDir = process.argv[4];    // where to dump result json

// --- molde names ---
const itemsDb = new ClassicLevel(itemsPath, { valueEncoding: "utf8" });
const moldeNames = {};
let moldeCount = 0;
for await (const [key, value] of itemsDb.iterator()) {
  if (!key.startsWith("!items!")) continue;
  let obj; try { obj = JSON.parse(value); } catch { continue; }
  if (obj.type === "hatsuTemplate") { moldeNames[obj._id] = obj.name; moldeCount++; }
}
await itemsDb.close();

// --- técnicas ---
const packDb = new ClassicLevel(packPath, { valueEncoding: "utf8" });
const stripHtml = s => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

const all = [];
for await (const [key, value] of packDb.iterator()) {
  if (!key.startsWith("!items!")) continue;
  let obj; try { obj = JSON.parse(value); } catch { continue; }
  const acts = obj.system?.activities || {};
  const activities = Object.values(acts).map(a => ({
    name: a.name || "", type: a.type,
    hasReductionFormula: !!(a.reduction && a.reduction.formula),
    reductionConstant: !!(a.reduction && a.reduction.constant),
    hasCondicao: !!(a.condicao && a.condicao.id)
  }));
  const desc = stripHtml(obj.system?.description?.value);
  const molde = moldeNames[obj.flags?.["hunter-system"]?.hatsuTemplate] || "???";
  all.push({
    id: obj._id, name: obj.name, molde,
    types: activities.map(a => a.type),
    activities, desc,
    descHtml: obj.system?.description?.value || ""
  });
}
await packDb.close();

console.log(`Moldes: ${moldeCount} | Técnicas: ${all.length}`);

// ---- Detectors ----

// broad reduction wording — includes "redução de Xd8", "reduz Xd8", "reduzindo Xd8"
const reduceShieldRe = /(cria(ndo)?|gera(ndo)?)[^.]{0,60}(escudo|barreira|campo de for[cç]a)[^.]{0,120}reduz|reduz\w*\s+(at[eé]\s+)?\d+d8[^.]{0,40}de dano|redu[cç][aã]o de \d+d8 de dano|voc[eê] recebe uma redu[cç][aã]o de \d+d8/i;

// constant/sustained reduction wording
const constantRe = /(enquanto|durante|até o fim da dura[cç][aã]o)[^.]{0,120}reduz|reduz[^.]{0,60}(a cada|de cada|todo) (dano|golpe|ataque)|no in[ií]cio de cada[^.]{0,60}redu[cç][aã]o|redu[cç][aã]o de \d+d8 de dano que dura/i;

// condition-imposing wording (secondary save -> condição)
const condRe = /salvaguarda de \w+[^.]{0,80}(para n[aã]o|contra)[^.]{0,60}(condi[cç][aã]o|receber)|receber? a condi[cç][aã]o|fica(r|ndo)? (com a condi[cç][aã]o|na condi[cç][aã]o)|a condi[cç][aã]o [“"']/i;

const reductionMissing = [];   // reduction wording but no reduction-type activity
const constantCandidates = []; // has reduction wording that sounds sustained
const conditionCandidates = [];// imposes a condition, activity is attack/save/damage, no condicao yet

for (const t of all) {
  const hasReductionType = t.activities.some(a => a.type === "reduction");
  const hasAttackSaveDamage = t.activities.some(a => ["attack","save","damage"].includes(a.type));
  const hasCondicao = t.activities.some(a => a.hasCondicao);

  if (reduceShieldRe.test(t.desc) && !hasReductionType) {
    reductionMissing.push({ id: t.id, name: t.name, molde: t.molde, types: t.types, desc: t.desc.slice(0, 260) });
  }
  if ((hasReductionType || reduceShieldRe.test(t.desc)) && constantRe.test(t.desc)) {
    constantCandidates.push({ id: t.id, name: t.name, molde: t.molde, types: t.types,
      alreadyConstant: t.activities.some(a => a.reductionConstant), desc: t.desc.slice(0, 300) });
  }
  if (condRe.test(t.desc) && hasAttackSaveDamage && !hasCondicao) {
    conditionCandidates.push({ id: t.id, name: t.name, molde: t.molde, types: t.types, desc: t.desc.slice(0, 300) });
  }
}

console.log(`\n[A] reduction wording but NO reduction activity: ${reductionMissing.length}`);
console.log(`[B] sustained/constant reduction candidates: ${constantCandidates.length}`);
console.log(`[C] condition-imposing on attack/save/damage without condicao: ${conditionCandidates.length}`);

fs.writeFileSync(`${outDir}/audit_reductionMissing.json`, JSON.stringify(reductionMissing, null, 2));
fs.writeFileSync(`${outDir}/audit_constantCandidates.json`, JSON.stringify(constantCandidates, null, 2));
fs.writeFileSync(`${outDir}/audit_conditionCandidates.json`, JSON.stringify(conditionCandidates, null, 2));
fs.writeFileSync(`${outDir}/audit_all_tecnicas.json`, JSON.stringify(all.map(t => ({ id: t.id, name: t.name, molde: t.molde, types: t.types })), null, 2));

console.log("\nDumps written to", outDir);
