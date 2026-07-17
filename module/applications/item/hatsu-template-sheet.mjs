import ItemSheet5e from "./item-sheet.mjs";
import { ensureHatsuPack } from "../../data/item/hatsu-template.mjs";

const SLOTS = [
  { id: "inata", label: "Habilidade Inata", tecnicasLabel: "Técnicas de Inata" },
  { id: "m1",    label: "1ª Manifestação",  tecnicasLabel: "Técnicas da Manifestação" },
  { id: "m2",    label: "2ª Manifestação",  tecnicasLabel: "Técnicas da Manifestação" },
  { id: "m3",    label: "3ª Manifestação",  tecnicasLabel: "Técnicas da Manifestação" }
];

const SLOT_NAMES = Object.fromEntries(SLOTS.map(s => [s.id, s.label]));

const CATEGORIES = [
  { id: "aprimorador",  label: "Aprimorador",  color: "#e86800" },
  { id: "emissor",      label: "Emissor",      color: "#B8860B" },
  { id: "transmutador", label: "Transmutador", color: "#9B59D0" },
  { id: "conjurador",   label: "Conjurador",   color: "#3A8FD4" },
  { id: "manipulador",  label: "Manipulador",  color: "#2ECC71" },
  { id: "especialista", label: "Especialista", color: "#AAAAAA" }
];

/**
 * Sheet for configuring a Molde Hatsu directly — add manifestações/técnicas, assign them to
 * slots, and edit them using their normal (full) spell sheet.
 */
export default class HatsuTemplateSheet extends ItemSheet5e {

  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      hatsuCreateManif: HatsuTemplateSheet.#onHatsuCreateManif,
      hatsuCreateTecnica: HatsuTemplateSheet.#onHatsuCreateTecnica,
      hatsuEdit: HatsuTemplateSheet.#onHatsuEdit,
      hatsuRemove: HatsuTemplateSheet.#onHatsuRemove,
      hatsuReqAdd: HatsuTemplateSheet.#onHatsuReqAdd,
      hatsuReqRemove: HatsuTemplateSheet.#onHatsuReqRemove,
      hatsuToggleMode: HatsuTemplateSheet.#onHatsuToggleMode
    },
    position: {
      width: 520,
      height: 700
    },
    window: {
      resizable: true
    }
  };

  /** @override */
  static PARTS = {
    header: super.PARTS.header,
    tabs: super.PARTS.tabs,
    hatsu: {
      template: "systems/hunter-system/templates/items/hatsu-template-hatsu.hbs",
      scrollable: [""]
    },
    description: super.PARTS.description
  };

  /** @override */
  static TABS = [
    { tab: "hatsu", label: "Hatsu" },
    { tab: "description", label: "DND5E.ITEM.SECTIONS.Description" }
  ];

  /** @override */
  tabGroups = {
    primary: "hatsu"
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if ( partId === "hatsu" ) context = await this._prepareHatsuContext(context, options);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the Hatsu tab.
   * @param {ApplicationRenderContext} context
   * @param {HandlebarsRenderOptions} options
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareHatsuContext(context, options) {
    context.tab = context.tabs.hatsu;

    const items = Array.from(await this.item.system.contents);

    // Graus de técnica (0 = Auxiliar, 1-9) — mesma escala do system.level do spell.
    const grauOptions = Array.fromRange(10).map(lvl => ({
      value: lvl,
      label: game.i18n.localize(CONFIG.DND5E.spellLevels?.[lvl] ?? String(lvl))
    }));

    const slots = SLOTS.map(def => {
      const manifestacao = items.find(i => i.getFlag("hunter-system", "hatsu.slot") === def.id) ?? null;
      const tecnicas = items
        .filter(i => (i.getFlag("hunter-system", "hatsu.parent") === def.id) && (i !== manifestacao))
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

      const rawReqs = manifestacao?.getFlag("hunter-system", "hatsu.requirements") ?? [];
      const manifestacaoId = manifestacao?.id ?? null;
      const mode = manifestacao?.getFlag("hunter-system", "hatsu.mode") ?? "focado";
      const isVersatil = mode === "versatil";
      const requirements = rawReqs.map((req, idx) => {
        const cat = CATEGORIES.find(c => c.id === req.category) ?? CATEGORIES[0];
        return {
          index: idx,
          manifestacaoId,
          category: cat.id,
          categoryLabel: cat.label,
          color: cat.color,
          level: req.level ?? 1
        };
      });

      const _lite = s => s ? {
        id: s.id,
        name: s.name,
        img: s.img,
        subtitle: s.system?.school ? CONFIG.DND5E.spellSchools?.[s.system.school]?.label : "",
        grau: s.system?.level ?? 0
      } : null;

      const reqsCols = requirements.length <= 1 ? 1 : requirements.length <= 4 ? 2 : 3;

      // Duas colunas dentro da manifestação (mesmo padrão da ficha do personagem):
      // técnicas com Grau (>=1) à esquerda, Auxiliares (grau 0) à direita. isVersatil e
      // grauChoices (com "selected" já resolvido) vão em cada técnica — o <select> do
      // chip não depende de contexto pai dentro dos #each aninhados (bug do Handlebars).
      const tecnicasLite = tecnicas.map(t => {
        const lite = _lite(t);
        lite.isVersatil = isVersatil;
        lite.grauChoices = grauOptions.map(g => ({ value: g.value, label: g.label, selected: g.value === lite.grau }));
        return lite;
      });
      let tecnicasGrau = tecnicasLite.filter(t => (t.grau ?? 0) >= 1);
      let tecnicasAux  = tecnicasLite.filter(t => (t.grau ?? 0) === 0);
      // Sem técnicas de Grau (só Auxiliares): elas ocupam a coluna da esquerda para
      // não flutuarem à direita numa manifestação Focada.
      if ( !tecnicasGrau.length ) { tecnicasGrau = tecnicasAux; tecnicasAux = []; }

      return {
        ...def,
        manifestacao: _lite(manifestacao),
        tecnicas: tecnicasLite,
        tecnicasGrau,
        tecnicasAux,
        hasTecnicas: tecnicasLite.length > 0,
        requirements,
        reqsCols,
        canAddReq: !!manifestacao && (requirements.length < 6),
        mode,
        isVersatil
      };
    });

    context.hatsu = { slots, categoryOptions: CATEGORIES, grauOptions };
    return context;
  }

  /* -------------------------------------------- */
  /*  Life-Cycle Handlers                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element.querySelectorAll(".hatsu-drop-zone").forEach(zone => {
      zone.addEventListener("dragenter", e => { e.preventDefault(); zone.classList.add("drag-hover"); });
      zone.addEventListener("dragover",  e => e.preventDefault());
      zone.addEventListener("dragleave", e => {
        if ( !zone.contains(e.relatedTarget) ) zone.classList.remove("drag-hover");
      });
      zone.addEventListener("drop", () => zone.classList.remove("drag-hover"));
    });

    this.element.querySelectorAll("[data-hatsu-req]").forEach(el => {
      el.addEventListener("change", e => {
        const field = el.dataset.hatsuReq;
        const itemId = el.dataset.itemId;
        const index = parseInt(el.dataset.index);
        this._onHatsuReqChange(itemId, index, field, el.value);
      });
    });

    this.element.querySelectorAll("[data-hatsu-grau]").forEach(el => {
      el.addEventListener("change", () => {
        this._onHatsuGrauChange(el.dataset.itemId, el.value);
      });
    });

    this._syncContentsFolder();
  }

  /* -------------------------------------------- */

  /**
   * Move any manifestação/técnica that isn't in the Molde's folder into it — catches items
   * created before this Molde had a folder, or ones dragged in some other way.
   */
  async _syncContentsFolder() {
    const folder = await this.item.system.ensureFolder();
    if ( !folder ) return;
    const items = await this.item.system.contents;
    const stray = items.filter(i => i.folder?.id !== folder.id);
    if ( stray.length ) {
      const pack = await ensureHatsuPack();
      await Item.updateDocuments(stray.map(i => ({ _id: i.id, folder: folder.id })), { pack: pack.metadata.id });
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  static async #onHatsuCreateManif(event, target) {
    const slotId = target.dataset.slot;
    const items = await this.item.system.contents;
    const existing = items.find(i => i.getFlag("hunter-system", "hatsu.slot") === slotId);
    if ( existing ) return existing.sheet?.render(true);

    const folder = await this.item.system.ensureFolder();
    const pack = await ensureHatsuPack();
    const created = await Item.implementation.create([{
      name: SLOT_NAMES[slotId] ?? "Nova Manifestação",
      type: "spell",
      folder: folder?.id,
      system: { level: 0, method: "atwill" },
      flags: { "hunter-system": { hatsuTemplate: this.item.id, hatsu: { slot: slotId } } }
    }], { pack: pack.metadata.id });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
    this.render();
  }

  /* -------------------------------------------- */

  static async #onHatsuCreateTecnica(event, target) {
    const slotId = target.dataset.slot;
    const folder = await this.item.system.ensureFolder();
    const pack = await ensureHatsuPack();
    const created = await Item.implementation.create([{
      name: "Nova Técnica",
      type: "spell",
      folder: folder?.id,
      system: { level: 0 },
      flags: { "hunter-system": { hatsuTemplate: this.item.id, hatsu: { parent: slotId } } }
    }], { pack: pack.metadata.id });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
    this.render();
  }

  /* -------------------------------------------- */

  static async #onHatsuEdit(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    item?.sheet?.render(true);
  }

  /* -------------------------------------------- */

  static async #onHatsuRemove(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    if ( !item ) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Remover do Molde" },
      content: `<p>Remover "<strong>${item.name}</strong>" deste Molde Hatsu? O item será excluído permanentemente.</p>`
    });
    if ( !confirmed ) return;
    await item.delete();
    this.render();
  }

  /* -------------------------------------------- */

  static async #onHatsuReqAdd(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    if ( !item ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("hunter-system", "hatsu.requirements") ?? []);
    if ( reqs.length >= 6 ) {
      ui.notifications.warn("Máximo de 6 requisitos por manifestação.");
      return;
    }
    reqs.push({ category: "aprimorador", level: 1 });
    await item.setFlag("hunter-system", "hatsu.requirements", reqs);
    this.render();
  }

  /* -------------------------------------------- */

  static async #onHatsuReqRemove(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    if ( !item ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("hunter-system", "hatsu.requirements") ?? []);
    reqs.splice(Number(target.dataset.index), 1);
    await item.setFlag("hunter-system", "hatsu.requirements", reqs);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Handle a change to a category requirement's select/input.
   * @param {string} itemId
   * @param {number} index
   * @param {string} field
   * @param {string} rawValue
   */
  async _onHatsuReqChange(itemId, index, field, rawValue) {
    const items = await this.item.system.contents;
    const item = items.get(itemId);
    if ( !item || Number.isNaN(index) ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("hunter-system", "hatsu.requirements") ?? []);
    if ( !reqs[index] ) return;
    if ( field === "level" ) reqs[index].level = Math.max(1, Math.min(10, parseInt(rawValue) || 1));
    else if ( field === "category" ) reqs[index].category = String(rawValue);
    await item.setFlag("hunter-system", "hatsu.requirements", reqs);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Alterna uma manifestação entre Focado e Versátil.
   * @this {HatsuTemplateSheet}
   */
  static async #onHatsuToggleMode(event, target) {
    const items = await this.item.system.contents;
    const item = items.get(target.dataset.itemId);
    const mode = target.dataset.mode;
    if ( !item || !["focado", "versatil"].includes(mode) ) return;
    await item.setFlag("hunter-system", "hatsu", {
      ...(item.getFlag("hunter-system", "hatsu") ?? {}),
      mode
    });
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Define o Grau (system.level) de uma técnica em manifestação Versátil.
   * @param {string} itemId
   * @param {string} rawValue
   */
  async _onHatsuGrauChange(itemId, rawValue) {
    const items = await this.item.system.contents;
    const item = items.get(itemId);
    if ( !item ) return;
    const level = Math.max(0, Math.min(9, parseInt(rawValue) || 0));
    await item.update({ "system.level": level });
    this.render();
  }

  /* -------------------------------------------- */
  /*  Drag & Drop                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropItem(event, data) {
    const hatsuTarget = event.target.closest("[data-hatsu-drop]");
    if ( !hatsuTarget ) return super._onDropItem(event, data);

    const item = await Item.implementation.fromDropData(data);
    if ( !item || (item.type !== "spell") ) return super._onDropItem(event, data);

    const slotId = hatsuTarget.closest("[data-hatsu-slot]")?.dataset.hatsuSlot;
    if ( !slotId ) return;

    const folder = await this.item.system.ensureFolder();
    const pack = await ensureHatsuPack();
    const itemData = item.toObject();
    delete itemData._id;
    itemData.folder = folder?.id;
    foundry.utils.setProperty(itemData, "flags.hunter-system.hatsuTemplate", this.item.id);

    if ( hatsuTarget.dataset.hatsuDrop === "manif" ) {
      foundry.utils.setProperty(itemData, "system.method", "atwill");
      foundry.utils.setProperty(itemData, "flags.hunter-system.hatsu", { slot: slotId });

      const items = await this.item.system.contents;
      const existing = items.find(i => i.getFlag("hunter-system", "hatsu.slot") === slotId);
      if ( existing ) await existing.delete();
    } else {
      foundry.utils.setProperty(itemData, "flags.hunter-system.hatsu", { parent: slotId });
    }

    await Item.implementation.create([itemData], { pack: pack.metadata.id });
    this.render();
  }
}
