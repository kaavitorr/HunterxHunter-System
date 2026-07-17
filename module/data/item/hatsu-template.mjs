import ItemDataModel from "../abstract/item-data-model.mjs";
import ItemDescriptionTemplate from "./templates/item-description.mjs";

const HATSU_PACK_ID = "world.hatsu-tecnicas";

/**
 * Get-or-create the world compendium that stores every Molde Hatsu's manifestações/técnicas,
 * keeping them out of the flat world Items sidebar while still being genuine editable Items.
 * @returns {Promise<CompendiumCollection>}
 */
export async function ensureHatsuPack() {
  let pack = game.packs.get(HATSU_PACK_ID);
  if ( !pack ) pack = await foundry.documents.collections.CompendiumCollection.createCompendium({
    type: "Item",
    label: "Técnicas de Hatsu",
    name: "hatsu-tecnicas"
  });
  return pack;
}

/**
 * Data definition for Hatsu Template items. A Molde Hatsu doesn't store its manifestações/técnicas
 * as raw data — it links to real Item documents kept in the shared Hatsu compendium (see
 * `ensureHatsuPack`) via the `hunter-system.hatsuTemplate` flag, the same way containers link
 * their contents via `system.container`. This keeps every técnica/manifestação a genuine editable
 * Item (full activities, damage, etc.) without cluttering the world Items sidebar.
 */
export default class HatsuTemplateData extends ItemDataModel.mixin(ItemDescriptionTemplate) {

  static LOCALIZATION_PREFIXES = ["DND5E.SOURCE"];

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {});
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.prepareDescriptionData();
  }

  /* -------------------------------------------- */

  /**
   * Manifestações/técnicas that belong to this Molde Hatsu. Always async: they live in the
   * shared Hatsu compendium, never as embedded or flat world Items.
   * @type {Promise<Collection<Item5e>>}
   */
  get contents() {
    if ( !this.parent ) return Promise.resolve(new foundry.utils.Collection());
    return this.#fetchContents();
  }

  async #fetchContents() {
    const pack = await ensureHatsuPack();
    const docs = await pack.getDocuments({ type: "spell" });
    return docs.reduce((collection, item) => {
      if ( item.getFlag("hunter-system", "hatsuTemplate") === this.parent.id ) collection.set(item.id, item);
      return collection;
    }, new foundry.utils.Collection());
  }

  /* -------------------------------------------- */

  /**
   * Compendium folder used to keep this Molde's manifestações/técnicas grouped together inside
   * the shared Hatsu pack, creating one (named after the Molde) if it doesn't have one yet.
   * @returns {Promise<Folder|null>}
   */
  async ensureFolder() {
    if ( this.parent.isEmbedded || this.parent.pack ) return null;
    const pack = await ensureHatsuPack();

    const existingId = this.parent.getFlag("hunter-system", "hatsuFolder");
    const existing = existingId ? pack.folders.get(existingId) : null;
    if ( existing ) return existing;

    const folder = await Folder.implementation.create(
      { name: this.parent.name, type: "Item" },
      { pack: pack.metadata.id }
    );
    await this.parent.setFlag("hunter-system", "hatsuFolder", folder.id);
    return folder;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async getSheetData(context) {
    context.subtitles = [{ label: game.i18n.localize("TYPES.Item.hatsuTemplate") }];
  }

  /* -------------------------------------------- */
  /*  Socket Event Handlers                       */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDelete(options, userId) {
    super._onDelete(options, userId);
    if ( userId !== game.user.id ) return;

    const contents = await this.contents;
    if ( contents.size ) {
      const pack = await ensureHatsuPack();
      await Item.deleteDocuments(Array.from(contents.map(i => i.id)), { pack: pack.metadata.id });
    }
  }
}

/* -------------------------------------------- */
/*  Importação: reconstrói os filhos empacotados */
/* -------------------------------------------- */

/**
 * Reconstrói as manifestações/técnicas de um Molde Hatsu que veio empacotado no JSON
 * (`flags.hunter-system.hatsuBundle`, gerado pelo Export Data — ver documents/item.mjs).
 * Recria os filhos no pack deste mundo, religados ao novo Molde, e limpa o pacote.
 * Remove filhos atuais antes (importar sobre um Molde existente não duplica).
 * @param {Item5e} item
 */
async function _importarBundleHatsu(item) {
  const bundle = item.getFlag("hunter-system", "hatsuBundle");
  if ( !Array.isArray(bundle) || !bundle.length ) return;
  try {
    const pack = await ensureHatsuPack();
    const atuais = await item.system.contents;
    if ( atuais.size ) await Item.deleteDocuments([...atuais.keys()], { pack: pack.metadata.id });
    // folder herdado não existe neste mundo: descarta e cria um novo
    await item.unsetFlag("hunter-system", "hatsuFolder").catch(() => null);
    const folder = await item.system.ensureFolder();
    const toCreate = bundle.map(raw => {
      const data = foundry.utils.deepClone(raw);
      delete data._id;
      data.folder = folder?.id ?? null;
      foundry.utils.setProperty(data, "flags.hunter-system.hatsuTemplate", item.id);
      return data;
    });
    await Item.implementation.create(toCreate, { pack: pack.metadata.id });
    await item.update({ "flags.hunter-system.-=hatsuBundle": null });
    ui.notifications.info(`Molde "${item.name}": ${toCreate.length} técnica(s)/manifestação(ões) importada(s).`);
  } catch ( err ) {
    console.error("Hunter | falha ao importar os filhos do Molde Hatsu:", err);
  }
}

// Novo Molde (drag do JSON / criar) OU Import Data sobre um Molde existente.
Hooks.on("createItem", (item, options, userId) => {
  if ( userId === game.user.id && item.type === "hatsuTemplate"
    && item.getFlag("hunter-system", "hatsuBundle") ) _importarBundleHatsu(item);
});
Hooks.on("updateItem", (item, changed, options, userId) => {
  if ( userId === game.user.id && item.type === "hatsuTemplate"
    && foundry.utils.getProperty(changed, "flags.hunter-system.hatsuBundle") ) _importarBundleHatsu(item);
});
