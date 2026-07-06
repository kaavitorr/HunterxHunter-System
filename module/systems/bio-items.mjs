/**
 * Carregamento de Talentos e Defeitos do compêndio para o seletor da aba Biografia.
 * A lógica de varrer pastas espelha a da criação (character-creation.mjs `_collectFolderItems`).
 * Talento/Defeito adicionados pelo seletor ganham a flag `hunter-system.bioKind` p/ identificação.
 */

export const norm = s => (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Cache por sessão (o compêndio não muda no meio do jogo). Limpado por invalidateBioCache().
let _talCache = null, _defCache = null;
export function invalidateBioCache() { _talCache = _defCache = null; }

/** Coleta itens de compêndio/mundo em pastas cujo nome (ou de um ancestral) casa `leaf`. */
async function collectFolderItems({ leaf, exclude = null }) {
  const out = [];
  const parentId = f => f.folder?.id ?? (typeof f.folder === "string" ? f.folder : f.folder?._id) ?? null;
  const wantedIds = folders => {
    const byId = new Map(folders.map(f => [f.id, f]));
    const underName = (f, name) => {
      let cur = f, g = 0;
      while ( cur && g++ < 12 ) { if ( norm(cur.name).includes(name) ) return true; cur = byId.get(parentId(cur)); }
      return false;
    };
    const matched = folders.filter(f => norm(f.name).includes(leaf));
    const wanted = new Set();
    const addTree = id => {
      if ( !id || wanted.has(id) ) return;
      wanted.add(id);
      for ( const f of folders ) if ( parentId(f) === id ) addTree(f.id);
    };
    for ( const f of matched ) addTree(f.id);
    if ( exclude ) for ( const f of folders ) if ( wanted.has(f.id) && underName(f, exclude) ) wanted.delete(f.id);
    return wanted;
  };
  for ( const pack of game.packs ) {
    if ( pack.metadata.type !== "Item" ) continue;
    const folders = Array.from(pack.folders ?? []);
    if ( !folders.length ) continue;
    const ids = wantedIds(folders);
    if ( !ids.size ) continue;
    const index = await pack.getIndex({ fields: ["img", "name", "folder", "type"] });
    for ( const e of index ) {
      if ( e.type === "folder" || !ids.has(e.folder) ) continue;
      out.push({ uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`, name: e.name, img: e.img });
    }
  }
  const wf = (game.folders ?? []).filter(f => f.type === "Item");
  if ( wf.length ) {
    const ids = wantedIds(wf);
    if ( ids.size ) for ( const i of game.items ) if ( ids.has(i.folder?.id) )
      out.push({ uuid: i.uuid, name: i.name, img: i.img });
  }
  // dedup por nome + ordena
  const seen = new Set();
  return out.filter(x => x.name && !seen.has(norm(x.name)) && seen.add(norm(x.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const DEFEITO_RX = /\(\s*\d+\s*pontos?\s*\)/i;
const JUNK_RX = /=|\(npc\)/i;

/** Talentos escolhíveis (pasta "Talentos", sem os defeitos "(N Pontos)" nem cabeçalhos). */
export async function getBioTalentos() {
  if ( _talCache ) return _talCache;
  const list = (await collectFolderItems({ leaf: "talento" }))
    .filter(t => !JUNK_RX.test(t.name) && !DEFEITO_RX.test(t.name));
  return (_talCache = list);
}

/** Defeitos escolhíveis (pasta "Defeitos"), com os pontos extraídos do nome. */
export async function getBioDefeitos() {
  if ( _defCache ) return _defCache;
  const list = (await collectFolderItems({ leaf: "defeito" }))
    .filter(d => !JUNK_RX.test(d.name))
    .map(d => ({ ...d, pts: Number(d.name.match(/(\d+)\s*ponto/i)?.[1]) || null }));
  return (_defCache = list);
}

/** true se um item (feat) da ficha é um defeito (pelo nome "(N Pontos)" ou pela flag). */
export function isDefeitoItem(item) {
  return item?.getFlag?.("hunter-system", "bioKind") === "defeito" || DEFEITO_RX.test(item?.name ?? "");
}
