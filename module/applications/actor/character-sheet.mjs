import { formatNumber } from "../../utils.mjs";
import AdvancementManager from "../advancement/advancement-manager.mjs";
import EnergyGenerationDialog from "./energy-generation-dialog.mjs";
import { EnergySystem } from "../../systems/energy.mjs";
import CompendiumBrowser from "../compendium-browser.mjs";
import ContextMenu5e from "../context-menu.mjs";
import BaseActorSheet from "./api/base-actor-sheet.mjs";
import { prepareManipulationAbilities, preparePrinciples, TREE_DATA, prepareTrainings, canUnlockAbility, MANIPULATION_ABILITIES, PRINCIPLES_DATA, getAvailableTrainingPoints } from "../../systems/manipulation-data.mjs";
import { CAMINHO_OBJETIVOS, CAMINHO_MEIOS, getCaminho } from "../../systems/caminhos.mjs";
import { getBioTalentos, getBioDefeitos, isDefeitoItem, norm as bioNorm } from "../../systems/bio-items.mjs";
import { NEN_CATEGORIES_DATA, NEN_LEVEL_COSTS, NEN_AFFINITY, getMaxLevelForCategory, getUnlockedMinorAbilities, getAvailableMajorAbilities, NEN_HYBRIDS, NEN_HYBRID_OPTIONS_BY_PRIMARY, getHybridSecondary } from "../../systems/nen-categories-data.mjs";
import Item5e from "../../documents/item.mjs";
import * as Trait from "../../documents/actor/trait.mjs";
import { ensureHatsuPack } from "../../data/item/hatsu-template.mjs";

// ── Módulos JJ (port progressivo do jujutsu-system) ──
import "./jj/reducao-dano.mjs";
import "./jj/constant-cost.mjs";
import { renderSacrificeHud } from "./jj/combat-sacrifice-hud.mjs";
import "./jj/heal-limit.mjs";
import { chooseJJScale, applyScaleChoice, promptJJScale } from "./jj/jj-scale.mjs";
import { resetHealLimitsByTechnique } from "./jj/heal-limit.mjs";

const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * @import { FavoriteData5e } from "../../data/abstract/_types.mjs";
 * @import { ActorFavorites5e } from "../../data/actor/_types.mjs";
 * @import { FacilityOccupants } from "../../data/item/_types.mjs";
 */

/**
 * Extension of base actor sheet for characters.
 */
export default class CharacterActorSheet extends BaseActorSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      deleteFavorite: CharacterActorSheet.#deleteFavorite,
      deleteOccupant: CharacterActorSheet.#deleteOccupant,
      findItem: CharacterActorSheet.#findItem,
      generateEnergy: CharacterActorSheet.#generateEnergy,
      setSpellcastingAbility: CharacterActorSheet.#setSpellcastingAbility,
      toggleAura: CharacterActorSheet.#toggleAura,
      toggleDeathTray: CharacterActorSheet.#toggleDeathTray,
      toggleInspiration: CharacterActorSheet.#toggleInspiration,
      useFacility: CharacterActorSheet.#useFacility,
      useFavorite: CharacterActorSheet.#useFavorite
    },
    classes: ["character", "vertical-tabs"],
    position: {
      width: 800,
      height: 1000
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    header: {
      template: "systems/hunter-system/templates/actors/character-header.hbs"
    },
    sidebar: {
      container: { classes: ["main-content"], id: "main" },
      template: "systems/hunter-system/templates/actors/character-sidebar.hbs",
      templates: ["systems/hunter-system/templates/actors/parts/jj-power-buttons.hbs"]
    },
    details: {
      classes: ["col-2"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/character-details.hbs",
      scrollable: [""]
    },
    inventory: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/character-inventory.hbs",
      templates: [
        "systems/hunter-system/templates/inventory/inventory.hbs", "systems/hunter-system/templates/inventory/activity.hbs",
        "systems/hunter-system/templates/inventory/encumbrance.hbs", "systems/hunter-system/templates/inventory/containers.hbs"
      ],
      scrollable: [""]
    },
    features: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/character-features.hbs",
      templates: ["systems/hunter-system/templates/inventory/inventory.hbs", "systems/hunter-system/templates/inventory/activity.hbs"],
      scrollable: [""]
    },
    spells: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/creature-spells.hbs",
      templates: ["systems/hunter-system/templates/inventory/inventory.hbs", "systems/hunter-system/templates/inventory/activity.hbs"],
      scrollable: [""]
    },
    hatsu: {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/character-hatsu.hbs",
      scrollable: [""]
    },
    effects: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/actor-effects.hbs",
      templates: ["systems/hunter-system/templates/actors/parts/jj-power-buttons.hbs"],
      scrollable: [""]
    },
    biography: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/character-biography.hbs",
      scrollable: [""]
    },
    bastion: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/character-bastion.hbs",
      scrollable: [""]
    },
    // specialTraits: {
    //   classes: ["flexcol"],
    //   container: { classes: ["tab-body"], id: "tabs" },
    //   template: "systems/hunter-system/templates/actors/tabs/creature-special-traits.hbs",
    //   scrollable: [""]
    // },
    manipulation: {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/character-manipulation.hbs",
      scrollable: [""]
    },
    trainings: {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/character-trainings.hbs",
      scrollable: [""]
    },
    abilityScores: {
      template: "systems/hunter-system/templates/actors/character-ability-scores.hbs"
    },
    warnings: {
      template: "systems/hunter-system/templates/actors/parts/actor-warnings-dialog.hbs"
    },
    tabs: {
      id: "tabs",
      classes: ["tabs-right"],
      template: "systems/hunter-system/templates/shared/sidebar-tabs.hbs"
    }
  };

  /* -------------------------------------------- */

  /**
   * Proficiency class names.
   * @enum {string}
   */
  static PROFICIENCY_CLASSES = {
    0: "none",
    0.5: "half",
    1: "full",
    2: "double"
  };

  /* -------------------------------------------- */

  /** @override */
  static TABS = [
    { tab: "details", label: "DND5E.Details", icon: "fas fa-cog" },
    { tab: "inventory", label: "DND5E.Inventory", svg: "systems/hunter-system/icons/svg/backpack.svg" },
    { tab: "features", label: "DND5E.Features", icon: "fas fa-list" },
    { tab: "spells", label: "TYPES.Item.spellPl", icon: "fas fa-book" },
    { tab: "hatsu", label: "JUJUTSU.Hatsu.Tab", icon: "fas fa-hand-fist" },
    { tab: "effects", label: "DND5E.Effects", icon: "fas fa-bolt" },
    { tab: "bastion", label: "DND5E.Bastion.Label", icon: "fas fa-chess-rook", condition: this.hasBastion },
    // { tab: "specialTraits", label: "DND5E.SpecialTraits", icon: "fas fa-star" },
    { 
  tab: "manipulation", 
  label: "JUJUTSU.Manipulation.Tab", 
  icon: "fas fa-hand-sparkles",
  condition: actor => !actor.itemTypes.class.some(c => c.identifier === "restringido")
},
    { tab: "trainings", label: "JUJUTSU.Trainings.Tab", icon: "fas fa-dumbbell" },
    { tab: "biography", label: "DND5E.Biography", icon: "fas fa-feather" }
  ];

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Whether the user has manually opened the death save tray.
   * @type {boolean}
   * @protected
   */
  _deathTrayOpen = false;

  /* -------------------------------------------- */

  /** @override */
  _filters = {
    features: { name: "", properties: new Set() },
    effects: { name: "", properties: new Set() },
    inventory: { name: "", properties: new Set() },
    spells: { name: "", properties: new Set() }
  };

  /* -------------------------------------------- */

  /** @override */
  tabGroups = {
    primary: "details"
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _configureInventorySections(sections) {
    sections.forEach(s => {
      s.minWidth = 250;
      if ( s.id === "weapons" ) s.columns = ["price", "weight", "quantity", "charges", "roll", "formula", "controls"];
    });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = {
      ...await super._prepareContext(options),
      abilityRows: {
        bottom: [], top: [], optional: Object.keys(CONFIG.DND5E.abilities).length - 6
      },
      isCharacter: true
    };
    context.spellbook = this._prepareSpellbook(context);
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  _prepareSpellbook(context) {
    // Esconde spells da aba Hatsu (manifestações e técnicas filhas) da spellbook normal
    const original = context.itemCategories?.spells;
    if ( Array.isArray(original) ) {
      context.itemCategories.spells = original.filter(s => {
        const flag = s.getFlag("hunter-system", "hatsu") ?? {};
        return !flag.slot && !flag.parent;
      });
    }
    const result = super._prepareSpellbook(context);
    if ( original ) context.itemCategories.spells = original;
    return result;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch ( partId ) {
      case "abilityScores": return this._prepareAbilityScoresContext(context, options);
      case "bastion": return this._prepareBastionContext(context, options);
      case "biography": return this._prepareBiographyContext(context, options);
      case "details": return this._prepareDetailsContext(context, options);
      case "effects": return this._prepareEffectsContext(context, options);
      case "features": return this._prepareFeaturesContext(context, options);
      case "header": return this._prepareHeaderContext(context, options);
      case "inventory": return this._prepareInventoryContext(context, options);
      case "sidebar": return this._prepareSidebarContext(context, options);
      case "specialTraits": return this._prepareSpecialTraitsContext(context, options);
      case "spells": return this._prepareSpellsContext(context, options);
      case "hatsu": return this._prepareHatsuContext(context, options);
      case "manipulation": return this._prepareManipulationContext(context, options);
      case "trainings": return this._prepareTrainingsContext(context, options);
      default: return context;
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the ability scores.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareAbilityScoresContext(context, options) {
    for ( const ability of this._prepareAbilities(context) ) {
      if ( context.abilityRows.bottom.length > 5 ) context.abilityRows.top.push(ability);
      else context.abilityRows.bottom.push(ability);
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the bastion tab.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareBastionContext(context, options) {
    context.bastion = {
      description: await TextEditor.enrichHTML(this.actor.system.bastion.description, {
        secrets: this.actor.isOwner, relativeTo: this.actor, rollData: context.rollData
      })
    };
    context.defenders = [];
    context.facilities = { basic: { chosen: [] }, special: { chosen: [] } };

    for ( const facility of context.itemCategories.facilities ?? [] ) {
      const ctx = context.itemContext[facility.id] ?? {};
      context.defenders.push(...ctx.defenders.map(({ actor }) => {
        if ( !actor ) return null;
        const { img, name, uuid } = actor;
        return { img, name, uuid, facility: facility.id };
      }).filter(_ => _));
      if ( ctx.isSpecial ) context.facilities.special.chosen.push(ctx);
      else context.facilities.basic.chosen.push(ctx);
    }

    for ( const [type, facilities] of Object.entries(context.facilities) ) {
      const config = CONFIG.DND5E.facilities.advancement[type];
      let [, available] = Object.entries(config).reverse().find(([level]) => {
        return level <= this.actor.system.details.level;
      }) ?? [];
      facilities.value = facilities.chosen.filter(({ free }) => (type === "basic") || !free).length;
      facilities.max = available ?? 0;
      available = (available ?? 0) - facilities.value;
      facilities.available = Array.fromRange(Math.max(0, available)).map(() => {
        return { label: `DND5E.FACILITY.AvailableFacility.${type}.free` };
      });
    }

    if ( !context.facilities.basic.available.length ) {
      context.facilities.basic.available.push({ label: "DND5E.FACILITY.AvailableFacility.basic.build" });
    }

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the biography tab.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareBiographyContext(context, options) {
    const enrichmentOptions = {
      secrets: this.actor.isOwner, relativeTo: this.actor, rollData: context.rollData
    };
    context.enriched = {
      label: "DND5E.Biography",
      value: await TextEditor.enrichHTML(this.actor.system.details.biography.value, enrichmentOptions)
    };

    // Characteristics (Alinhamento e Fé removidos a pedido)
    context.characteristics = [
      "eyes", "height", "hair", "weight", "gender", "skin", "age"
    ].map(k => {
      const field = this.actor.system.schema.fields.details.fields[k];
      const name = `system.details.${k}`;
      return {
        name, label: field.label,
        value: foundry.utils.getProperty(this.actor, name) ?? "",
        source: foundry.utils.getProperty(this.actor._source, name) ?? ""
      };
    });

    // Personalização: Caminho (Objetivo × Meio) — mesmo framework do OPRPG.
    const cam = this.actor.getFlag("hunter-system", "caminho") ?? {};
    context.personalizacao = {
      objetivos: CAMINHO_OBJETIVOS.map(o => ({ ...o, selected: o.id === cam.objetivo })),
      meios: CAMINHO_MEIOS.map(m => ({ ...m, selected: m.id === cam.meio })),
      caminho: getCaminho(cam.objetivo, cam.meio)
    };

    // Talentos & Defeitos da Biografia — seletor lê do compêndio; guarda como itens (feat).
    const [availTal, availDef] = await Promise.all([getBioTalentos(), getBioDefeitos()]);
    const bioFeats = this.actor.items.filter(i => i.type === "feat");
    const talNames = new Set(availTal.map(t => bioNorm(t.name)));
    const selDef = bioFeats.filter(i => isDefeitoItem(i));
    // Talento tagueado sempre; casamento por nome só p/ feats que NÃO vieram de advancement
    // (evita listar como talento — deletável — um feat concedido por classe/avanço).
    // Ler advancementOrigin por acesso direto aos flags: getFlag("HunterLegacy", …) LANÇA
    // (scope não é um pacote ativo, só um namespace de manifest). O valor é gravado em
    // flags.HunterLegacy (advancement/criação) ou flags.dnd5e (upstream), conforme a origem.
    const fromAdvancement = i => !!(foundry.utils.getProperty(i, "flags.HunterLegacy.advancementOrigin")
      || foundry.utils.getProperty(i, "flags.dnd5e.advancementOrigin")
      || foundry.utils.getProperty(i, "flags.hunter-system.advancementOrigin"));
    const selTal = bioFeats.filter(i => !isDefeitoItem(i) && (
      i.getFlag("hunter-system", "bioKind") === "talento"
      || (talNames.has(bioNorm(i.name)) && !fromAdvancement(i))
    ));
    const ownedNames = new Set([...selTal, ...selDef].map(i => bioNorm(i.name)));
    context.bioChoices = {
      talentos: {
        avail: availTal.filter(t => !ownedNames.has(bioNorm(t.name))),
        selected: selTal.map(i => ({ id: i.id, name: i.name, img: i.img }))
      },
      defeitos: {
        avail: availDef.filter(d => !ownedNames.has(bioNorm(d.name))),
        selected: selDef.map(i => ({ id: i.id, name: i.name, img: i.img,
          pts: Number((i.name.match(/(\d+)\s*ponto/i) ?? [])[1]) || null }))
      }
    };

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the details tab.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareDetailsContext(context, options) {
    const { details, traits } = this.actor.system;

    // Origin
    context.creatureType = {
      class: details.type.value === "custom" ? "none" : "",
      icon: CONFIG.DND5E.creatureTypes[details.type.value]?.icon ?? "icons/svg/mystery-man.svg",
      title: details.type.value === "custom"
        ? details.type.custom
        : CONFIG.DND5E.creatureTypes[details.type.value]?.label,
      reference: CONFIG.DND5E.creatureTypes[details.type.value]?.reference,
      subtitle: details.type.subtype
    };
    if ( details.race instanceof dnd5e.documents.Item5e ) context.species = details.race;
    if ( details.background instanceof dnd5e.documents.Item5e ) context.background = details.background;
    context.labels.size = CONFIG.DND5E.actorSizes[traits.size]?.label ?? traits.size;

    // Saving Throws
    context.saves = {};
    for ( let ability of Object.values(this._prepareAbilities(context)) ) {
      ability = context.saves[ability.key] = { ...ability };
      ability.class = this.constructor.PROFICIENCY_CLASSES[context.editable ? ability.baseProf : ability.proficient];
    }
    if ( this.actor.statuses.has(CONFIG.specialStatusEffects.CONCENTRATING) || context.editable ) {
      context.saves.concentration = {
        isConcentration: true,
        class: "colspan concentration",
        label: game.i18n.localize("DND5E.Concentration"),
        abbr: game.i18n.localize("DND5E.Concentration"),
        save: { value: context.system.attributes.concentration.save }
      };
    }

    // Senses
    context.senses = this._prepareSenses(context);

    // Skills & Tools
    context.skills = this._prepareSkillsTools(context, "skills");
    context.tools = this._prepareSkillsTools(context, "tools");
    for ( const entry of context.skills.concat(context.tools) ) {
      const key = entry.key;
      entry.class = this.constructor.PROFICIENCY_CLASSES[context.editable ? entry.baseValue : entry.value];
      if ( key in CONFIG.DND5E.skills ) entry.reference = CONFIG.DND5E.skills[key].reference;
      else if ( key in CONFIG.DND5E.tools ) entry.reference = Trait.getBaseItemUUID(CONFIG.DND5E.tools[key].id ?? "");
    }

    // Ordenar skills por atributo e adicionar separadores
const abilityOrder = ["str", "dex", "con", "int", "wis", "cha"];
const abilityLabels = {
  str: "Força", dex: "Agilidade", con: "Constituição",
  int: "Espírito", wis: "Sabedoria", cha: "Presença"
};
const skillsSorted = [];
for ( const ab of abilityOrder ) {
  const group = context.skills.filter(s => (s.baseAbility ?? s.ability) === ab);
  if ( !group.length ) continue;
  skillsSorted.push({ isSeparator: true, label: abilityLabels[ab] });
  skillsSorted.push(...group);
}
context.skills = skillsSorted;
    
    // Traits
    context.traits = this._prepareTraits(context);

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareEffectsContext(context, options) {
    context = await super._prepareEffectsContext(context, options);
    context.hasConditions = true;

    // Condições do sistema Jujutsu para injetar via _onRender
    const activeStatuses = new Set(this.actor.statuses ?? []);
    context.jjConditions = JJ_CONDITIONS.map(cond => ({
      ...cond,
      active: activeStatuses.has(cond.id)
    }));

    // Botões de poder (mesmos da sidebar) — sempre exibidos no topo da aba Effects
    this._prepareJJPowersContext(context);

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the features tab.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareFeaturesContext(context, options) {
    // Classes
    context.subclasses = context.itemCategories.subclasses ?? [];
    context.classes = (context.itemCategories.classes ?? [])
      .sort((lhs, rhs) => rhs.system.levels - lhs.system.levels);
    for ( const cls of context.classes ) {
      const ctx = context.itemContext[cls.id] ??= {};
      const subclass = context.subclasses.findSplice(s => s.system.classIdentifier === cls.identifier);
      if ( !subclass ) {
        const subclassAdvancement = cls.advancement.byType.Subclass?.[0];
        if ( subclassAdvancement && (subclassAdvancement.level <= cls.system.levels) ) ctx.needsSubclass = true;
      }
    }

    // List
    const Inventory = customElements.get(this.options.elements.inventory);
    const columns = Inventory.mapColumns([{ id: "uses", order: 200 }, "recovery", "controls"]);
    const sections = [
      { columns, id: "active", label: "DND5E.FeatureActive", order: 100, groups: { activation: "active" }, items: [] },
      { columns, id: "passive", label: "DND5E.FeaturePassive", order: 200, groups: { activation: "passive" } },
      ...Object.values(this.actor.classes ?? {})
        .sort((a, b) => b.system.levels - a.system.levels)
        .map((cls, i) => {
          return {
            columns, id: cls.identifier, order: i * 100, groups: { origin: cls.identifier },
            label: game.i18n.format("DND5E.FeaturesClass", { class: cls.name })
          };
        }),
      this.actor.system.details.race instanceof Item5e ? {
        columns, id: "species", label: "DND5E.Species.Features", order: 1000, groups: { origin: "species" }
      } : null,
      this.actor.system.details.background instanceof Item5e ? {
        columns, id: "background", label: "DND5E.FeaturesBackground", order: 2000, groups: { origin: "background" }
      } : null,
      { columns, id: "other", label: "DND5E.FeaturesOther",      order: 3000, groups: { origin: "other" } },
      { columns, id: "jj-origin",  label: "Classe Hunter",       order: 4000, groups: { origin: "jj-origin"  }, items: [] },
      { columns, id: "jj-combat",  label: "Categoria",   order: 5000, groups: { origin: "jj-combat"  }, items: [] },
      { columns, id: "jj-path",    label: "Caminho",             order: 6000, groups: { origin: "jj-path"    }, items: [] },
      { columns, id: "jj-basic",   label: "Habilidades Básicas", order: 7000, groups: { origin: "jj-basic"   }, items: [] },
      { columns, id: "jj-talents", label: "Talentos",            order: 8000, groups: { origin: "jj-talents" }, items: [] },
      { columns, id: "jj-flaws",   label: "Defeitos",            order: 9000, groups: { origin: "jj-flaws"   }, items: [] },
    ].filter(_ => _);
    sections[0].items = [...(context.itemCategories.features ?? []), ...context.subclasses];
    context.sections = Inventory.prepareSections(sections);
    context.listControls = {
      label: "DND5E.FeatureSearch",
      list: "features",
      filters: [
        { key: "powerAction", label: "DND5E.PowerAction" },
        { key: "action", label: "DND5E.Action" },
        { key: "bonus", label: "DND5E.BonusAction" },
        { key: "reaction", label: "DND5E.Reaction" },
        { key: "sr", label: "DND5E.REST.Short.Label" },
        { key: "lr", label: "DND5E.REST.Long.Label" },
        { key: "concentration", label: "DND5E.Concentration" },
        { key: "mgc", label: "DND5E.ITEM.Property.Magical" }
      ],
      sorting: [
        { key: "m", label: "SIDEBAR.SortModeManual", dataset: { icon: "fa-solid fa-arrow-down-short-wide" } },
        { key: "a", label: "SIDEBAR.SortModeAlpha", dataset: { icon: "fa-solid fa-arrow-down-a-z" } }
      ],
      grouping: [
        {
          key: "origin",
          label: "DND5E.FilterGroupOrigin",
          dataset: { icon: "fa-solid fa-layer-group", classes: "active" }
        },
        { key: "activation", label: "DND5E.FilterGroupOrigin", dataset: { icon: "fa-solid fa-layer-group" } }
      ]
    };

    // TODO: Add this warning during data preparation instead
    // const message = game.i18n.format("DND5E.SubclassMismatchWarn", {
    //   name: subclass.name, class: subclass.system.classIdentifier
    // });
    // context.warnings.push({ message, type: "warning" });
    context.showClassDrop = !context.classes.length || this.isEditMode;
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the header.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareHeaderContext(context, options) {
    if ( this.actor.limited ) {
      context.portrait = await this._preparePortrait(context);
      return context;
    }

    // Classes Label
    context.labels.class = Object.values(this.actor.classes).sort((a, b) => {
      return b.system.levels - a.system.levels;
    }).map(c => `${c.name} ${c.system.levels}`).join(" / ");

    // Experience & Epic Boons
    if ( context.system.details.xp.boonsEarned !== undefined ) {
      const pluralRules = new Intl.PluralRules(game.i18n.lang);
      context.epicBoonsEarned = game.i18n.format(
        `DND5E.ExperiencePoints.Boons.${pluralRules.select(context.system.details.xp.boonsEarned ?? 0)}`,
        { number: formatNumber(context.system.details.xp.boonsEarned ?? 0, { signDisplay: "always" }) }
      );
    }

    // Visibility
    context.showExperience = false;
    context.showRests = game.user.isGM || this.actor.isOwner;

    // Botão de fixar o HUD de Sacrifícios/Recursos fora de combate (mesma permissão dos descansos)
    context.showSacrificeToggle = context.showRests;
    context.sacrificeHudPinned = game.user.getFlag("hunter-system", "sacrificeHudPinnedActorId") === this.actor.id;

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareInventoryContext(context, options) {
    context = await super._prepareInventoryContext(context, options);
    context.size = {
      label: CONFIG.DND5E.actorSizes[this.actor.system.traits.size]?.label ?? this.actor.system.traits.size,
      abbr: CONFIG.DND5E.actorSizes[this.actor.system.traits.size]?.abbreviation ?? "—",
      mod: this.actor.system.attributes.encumbrance.mod
    };

    // Mochila equipada — só a primeira container com equipped=true
    const equipped = this.actor.items.find(i => i.type === "container" && i.system?.equipped);
    if ( equipped ) {
      const cap = await equipped.system.computeCapacity();
      context.equippedBackpack = {
        id: equipped.id,
        uuid: equipped.uuid,
        name: equipped.name,
        img: equipped.img,
        capacityPct: cap?.pct ?? 0,
        capacityValue: cap?.value ?? 0,
        capacityMax: Number.isFinite(cap?.max) ? cap.max : "∞"
      };
    }

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare rendering context for the sidebar.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @param {HandlebarsRenderOptions} options   Options which configure application rendering behavior.
   * @returns {ApplicationRenderContext}
   * @protected
   */
  async _prepareSidebarContext(context, options) {
    const { attributes } = this.actor.system;
    context.portrait = await this._preparePortrait(context);

    // Death Saves
    const plurals = new Intl.PluralRules(game.i18n.lang, { type: "ordinal" });
    context.death = {
      open: this._deathTrayOpen
    };
    // Percentuais para barras customizadas
const ed = this.actor.system.energyDice;
context.energyDicePct = ed?.max > 0 ? ((ed.value / ed.max) * 100).toFixed(2) : 0;

const energy = this.actor.system.energy;
context.energyPct = energy?.max > 0 ? ((energy.total / energy.max) * 100).toFixed(2) : 0;

const armor = this.actor.system.armorPoints;
context.armorPct = armor?.max > 0 ? ((armor.value / armor.max) * 100).toFixed(2) : 0;

context.primaryCategoryColor = this._getPrimaryNenCategory()?.color ?? "#828892";
    for ( const deathSave of ["success", "failure"] ) {
      context.death[deathSave] = [];
      for ( let i = 1; i < 4; i++ ) {
        const n = deathSave === "failure" ? i : 4 - i;
        const i18nKey = `DND5E.DeathSave${deathSave.titleCase()}Label`;
        const filled = attributes.death[deathSave] >= n;
        const classes = ["pip"];
        if ( filled ) classes.push("filled");
        if ( deathSave === "failure" ) classes.push("failure");
        context.death[deathSave].push({
          n, filled,
          tooltip: i18nKey,
          label: game.i18n.localize(`${i18nKey}N.${plurals.select(n)}`),
          classes: classes.join(" ")
        });
      }
    }

    // Exhaustion
    if ( CONFIG.DND5E.conditionTypes.exhaustion ) {
      const max = CONFIG.DND5E.conditionTypes.exhaustion.levels;
      context.exhaustion = Array.fromRange(max, 1).reduce((acc, n) => {
        const label = game.i18n.format("DND5E.ExhaustionLevel", { n });
        const classes = ["pip"];
        const filled = attributes.exhaustion >= n;
        if ( filled ) classes.push("filled");
        if ( n === max ) classes.push("death");
        const pip = { n, label, filled, tooltip: label, classes: classes.join(" ") };

        if ( n <= max / 2 ) acc.left.push(pip);
        else acc.right.push(pip);
        return acc;
      }, { left: [], right: [] });
    }

    // Favorites
    context.favorites = await this._prepareFavorites();

    // Power buttons (Explosão Defensiva, Estágio de Foco, Foco Agressivo/Defensivo)
    this._prepareJJPowersContext(context);

    // Speed
    context.speed = Object.entries(CONFIG.DND5E.movementTypes).reduce((obj, [k, { hidden, label }]) => {
      if ( hidden ) return obj;
      const value = attributes.movement[k];
      if ( (k === "fly") && attributes.movement.hover ) {
        label = game.i18n.format("DND5E.MOVEMENT.HoverSpeed", { speed: label });
      }
      if ( value > obj.value ) Object.assign(obj, { label, value });
      return obj;
    }, { label: CONFIG.DND5E.movementTypes.walk?.label, value: 0 });

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepara dados dos botões de poder (Explosão Defensiva, Estágio de Foco,
   * Foco Agressivo/Defensivo) e flags de pin no sidebar. Usado tanto pela
   * sidebar quanto pela aba Effects.
   */
  _prepareJJPowersContext(context) {
    const ab = this.actor.system.manipulation?.abilities ?? {};
    context.foco = {
      show: !!(ab.focoAgressivo?.unlocked || ab.focoDefensivo?.unlocked),
      agressivoUnlocked: !!ab.focoAgressivo?.unlocked,
      defensivoUnlocked: !!ab.focoDefensivo?.unlocked,
      agressivoAtivo:    !!this.actor.getFlag("hunter-system", "focoAgressivoAtivo"),
      // defensivoAtivo é derivado de armorPoints.value > 0 — fonte única da verdade.
      defensivoAtivo:    (this.actor.system.armorPoints?.value ?? 0) > 0,
      fluxoVeloz:        !!ab.fluxoVeloz?.unlocked,
      fluxoConstante:    !!ab.fluxoConstante?.unlocked
    };
    context.foco.agressivoDie = context.foco.fluxoConstante ? "1d6" : "1d4";
    // Total de Pontos de Armadura do Foco Defensivo (deriva de armorPoints.max
    // calculado em character.mjs prepareDerivedData).
    context.foco.defensivoArmorMax = this.actor.system.armorPoints?.max ?? 0;
    context.foco.defensivoArmorValue = this.actor.system.armorPoints?.value ?? 0;

    const hatsuTier = this.actor.getFlag("hunter-system", "hatsuActiveTier") ?? "none";
    context.estagioFoco = {
      show: hatsuTier === "ultimato",
      ativo: !!this.actor.getFlag("hunter-system", "hatsuEstagioFocoAtivo")
    };

    context.expDef = {
      show: !!this.actor.system.manipulation?.abilities?.explosaoDefensiva?.unlocked
    };

    // Flags de pin (qual botão também aparece na sidebar)
    const pin = this.actor.getFlag("hunter-system", "pinSidebar") ?? {};
    context.pinSidebar = {
      expDef:     pin.expDef     !== false, // default: pinned (compatibilidade)
      estagio:    pin.estagio    !== false,
      agressivo:  pin.agressivo  !== false,
      defensivo:  pin.defensivo  !== false
    };
    // Estado para a layout duo do Foco no sidebar
    context.foco.bothPinned = context.pinSidebar.agressivo && context.pinSidebar.defensivo;
    context.foco.anyPinned  = context.pinSidebar.agressivo || context.pinSidebar.defensivo;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareSpellsContext(context, options) {
    context = await super._prepareSpellsContext(context, options);

    // Spellcasting
    context.spellcasting = [];
    const spellcastingClasses = Object.values(this.actor.spellcastingClasses)
      .sort((lhs, rhs) => rhs.system.levels - lhs.system.levels);
    for ( const item of spellcastingClasses ) {
      const sc = item.spellcasting;
      const ability = this.actor.system.abilities[sc.ability];
      const mod = ability?.mod ?? 0;
      const name = item.system.spellcasting.progression === sc.progression ? item.name : item.subclass?.name;
      context.spellcasting.push({
        label: game.i18n.format("DND5E.SpellcastingClass", { class: name }),
        ability: { mod, ability: sc.ability },
        attack: sc.attack,
        preparation: sc.preparation,
        primary: this.actor.system.attributes.spellcasting === sc.ability,
        save: sc.save
      });
      const key = item.system.spellcasting.progression === sc.progression ? item.identifier : item.subclass?.identifier;
      context.listControls.filters.push({ key, label: name });
    }

    return context;
  }

  /* -------------------------------------------- */
  /*  Actor Preparation Helpers                   */
  /* -------------------------------------------- */

  /**
   * Prepare favorites for display.
   * @param {ApplicationRenderContext} context  Context being prepared.
   * @returns {Promise<object>}
   * @protected
   */
  async _prepareFavorites(context) {
    // Legacy resources
    const resources = Object.entries(this.actor.system.resources).reduce((arr, [k, r]) => {
      const { value, max, sr, lr, label } = r;
      const source = this.actor._source.system.resources[k];
      if ( label && max ) arr.push({
        id: `resources.${k}`,
        type: "resource",
        img: "icons/svg/upgrade.svg",
        resource: { value, max, source },
        css: "uses",
        title: label,
        subtitle: [
          sr ? game.i18n.localize("DND5E.AbbreviationSR") : null,
          lr ? game.i18n.localize("DND5E.AbbreviationLR") : null
        ].filterJoin(" &bull; ")
      });
      return arr;
    }, []);

    return resources.concat(await this.actor.system.favorites.reduce(async (arr, f) => {
      const { id, type, sort } = f;
      const favorite = await fromUuid(id, { relative: this.actor });
      if ( !favorite && ((type === "item") || (type === "effect") || (type === "activity")) ) return arr;
      if ( favorite?.dependentOrigin?.active === false ) return arr;
      arr = await arr;

      let data;
      if ( type === "item" ) data = await favorite.system.getFavoriteData();
      else if ( (type === "effect") || (type === "activity") ) data = await favorite.getFavoriteData();
      else data = await this._getFavoriteData(type, id);
      if ( !data ) return arr;
      let {
        img, title, subtitle, value, uses, quantity, modifier, passive,
        save, range, reference, toggle, suppressed, level
      } = data;

      if ( foundry.utils.getType(save?.ability) === "Set" ) save = {
        ...save, ability: save.ability.size > 2
          ? game.i18n.localize("DND5E.AbbreviationDC")
          : Array.from(save.ability).map(k => CONFIG.DND5E.abilities[k]?.abbreviation).filterJoin(" / ")
      };

      const css = [];
      if ( uses?.max ) {
        css.push("uses");
        uses.value = Math.round(uses.value);
      }
      else if ( modifier !== undefined ) css.push("modifier");
      else if ( save?.dc ) css.push("save");
      else if ( value !== undefined ) css.push("value");

      if ( toggle === false ) css.push("disabled");
      if ( uses?.max > 99 ) css.push("uses-sm");
      if ( modifier !== undefined ) {
        const value = Number(modifier.replace?.(/\s+/g, "") ?? modifier);
        if ( !isNaN(value) ) modifier = value;
      }

      const rollableClass = [];
      if ( this.isEditable && (type !== "slots") ) rollableClass.push("rollable");
      if ( type === "skill" ) rollableClass.push("skill-name");
      else if ( type === "tool" ) rollableClass.push("tool-name");

      if ( suppressed ) subtitle = game.i18n.localize("DND5E.Suppressed");
      const itemId = type === "item" ? favorite.id : type === "activity" ? favorite.item.id : null;
      arr.push({
        id, img, type, title, value, uses, sort, save, modifier, passive, range, reference, suppressed, level, itemId,
        draggable: ["item", "effect"].includes(type),
        effectId: type === "effect" ? favorite.id : null,
        parentId: (type === "effect") && (favorite.parent !== favorite.target) ? favorite.parent.id: null,
        activityId: type === "activity" ? favorite.id : null,
        key: (type === "skill") || (type === "tool") ? id : null,
        toggle: toggle === undefined ? null : { applicable: true, value: toggle },
        quantity: quantity > 1 ? quantity : "",
        rollableClass: rollableClass.filterJoin(" "),
        css: css.filterJoin(" "),
        bareName: type === "slots",
        subtitle: Array.isArray(subtitle) ? subtitle.filterJoin(" &bull; ") : subtitle
      });
      return arr;
    }, [])).sort((a, b) => a.sort - b.sort);
  }

  /* -------------------------------------------- */

  /**
   * Prepare data for a favorited entry.
   * @param {"skill"|"tool"|"slots"} type  The type of favorite.
   * @param {string} id                    The favorite's identifier.
   * @returns {Promise<FavoriteData5e|void>}
   * @protected
   */
  async _getFavoriteData(type, id) {
    // Spell slots
    if ( type === "slots" ) {
      const { value, max, level, type: method } = this.actor.system.spells?.[id] ?? {};
      const model = CONFIG.DND5E.spellcasting[method];
      const uses = { value, max, name: `system.spells.${id}.value` };
      if ( !model || model.isSingleLevel ) return {
        uses, level, method,
        title: game.i18n.localize(`DND5E.SpellSlots${id.capitalize()}`),
        subtitle: [
          game.i18n.localize(`DND5E.SpellLevel${level}`),
          game.i18n.localize(`DND5E.Abbreviation${model?.isSR ? "SR" : "LR"}`)
        ],
        img: model?.img || CONFIG.DND5E.spellcasting.pact.img
      };

      const plurals = new Intl.PluralRules(game.i18n.lang, { type: "ordinal" });
      return {
        uses, level, method,
        title: game.i18n.format(`DND5E.SpellSlotsN.${plurals.select(level)}`, { n: level }),
        subtitle: game.i18n.localize(`DND5E.Abbreviation${model.isSR ? "SR" : "LR"}`),
        img: model.img.replace("{id}", id)
      };
    }

    // Skills & Tools
    else {
      const data = this.actor.system[`${type}s`]?.[id];
      if ( !data ) return;
      const { total, ability, passive } = data ?? {};
      const subtitle = game.i18n.format("DND5E.AbilityPromptTitle", {
        ability: CONFIG.DND5E.abilities[ability].label
      });
      let img;
      let title;
      let reference;
      if ( type === "tool" ) {
        reference = Trait.getBaseItemUUID(CONFIG.DND5E.tools[id]?.id);
        ({ img, name: title } = Trait.getBaseItem(reference, { indexOnly: true }));
      }
      else if ( type === "skill" ) ({ icon: img, label: title, reference } = CONFIG.DND5E.skills[id]);
      return { img, title, subtitle, modifier: total, passive, reference };
    }
  }

  /* -------------------------------------------- */
  /*  Item Preparation Helpers                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _assignItemCategories(item) {
    switch ( item.type ) {
      case "background": return new Set(["background"]);
      case "class": return new Set(["classes"]);
      case "facility": return new Set(["facilities"]);
      case "race": return new Set(["species"]);
      case "subclass": return new Set(["subclasses"]);
      default: return super._assignItemCategories(item);
    }
  }

  /* -------------------------------------------- */

  /**
   * Prepare context for a facility.
   * @param {Item5e} item  Item being prepared for display.
   * @param {object} ctx   Item specific context.
   * @protected
   */
  async _prepareItemFacility(item, ctx) {
    const { id, img, labels, name, system } = item;
    const { building, craft, defenders, disabled, free, hirelings, progress, size, trade, type } = system;
    const subtitle = [
      building.built ? CONFIG.DND5E.facilities.sizes[size].label : game.i18n.localize("DND5E.FACILITY.Build.Unbuilt")
    ];
    if ( trade.stock.max ) subtitle.push(`${trade.stock.value ?? 0} &sol; ${trade.stock.max}`);
    Object.assign(ctx, {
      id, labels, name, building, disabled, free, progress,
      craft: craft.item ? await fromUuid(craft.item) : null,
      creatures: await this._prepareItemFacilityLivestock(trade),
      defenders: await this._prepareItemFacilityOccupants(defenders),
      executing: CONFIG.DND5E.facilities.orders[progress.order]?.icon,
      hirelings: await this._prepareItemFacilityOccupants(hirelings),
      img: foundry.utils.getRoute(img),
      isSpecial: type.value === "special",
      subtitle: subtitle.join(" &bull; ")
    });
  }

  /* -------------------------------------------- */

  /**
   * Prepare facility livestock for display.
   * @param {object} trade  Facility trade information.
   * @returns {Promise<object[]>}
   * @protected
   */
  async _prepareItemFacilityLivestock(trade) {
    const creatures = await this._prepareItemFacilityOccupants(trade.creatures);
    const pending = trade.pending.creatures;
    return [
      ...(await Promise.all((pending ?? []).map(async (uuid, index) => {
        return { index, actor: await fromUuid(uuid), pending: true };
      }))),
      ...creatures
    ];
  }

  /* -------------------------------------------- */

  /**
   * Prepare facility occupants for display.
   * @param {FacilityOccupants} occupants  The occupants.
   * @returns {Promise<object[]>}
   * @protected
   */
  _prepareItemFacilityOccupants(occupants) {
    const { max, value } = occupants;
    return Promise.all(Array.fromRange(max).map(async index => {
      const uuid = value[index];
      if ( uuid ) return { index, actor: await fromUuid(uuid) };
      return { empty: true };
    }));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareItemFeature(item, ctx) {
    if ( item.type === "facility" ) return this._prepareItemFacility(item, ctx);

    await super._prepareItemFeature(item, ctx);

    const [originId] = (item.getFlag("hunter-system", "advancementRoot") ?? item.getFlag("hunter-system", "advancementOrigin"))
      ?.split(".") ?? [];
    const group = item.parent.items.get(originId);
    // Verificar se o item tem seção customizada Jujutsu
    const jjSection = item.getFlag("hunter-system", "featureSection");
    if ( jjSection && ["jj-origin", "jj-combat", "jj-path", "jj-basic", "jj-talents", "jj-flaws"].includes(jjSection) ) {
      ctx.groups.origin = jjSection;
    } else {
      ctx.groups.origin = "other";
      switch ( group?.type ) {
        case "race": ctx.groups.origin = "species"; break;
        case "background": ctx.groups.origin = "background"; break;
        case "class": ctx.groups.origin = group.identifier; break;
        case "subclass": ctx.groups.origin = group.class?.identifier ?? "other"; break;
      }
    }

    ctx.groups.activation = item.system.properties?.has("trait") || !item.system.activities?.size
      ? "passive"
      : "active";
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareItemPhysical(item, ctx) {
    ctx.concealDetails = !game.user.isGM && (item.system.identified === false);
    ctx.isStack = Number.isNumeric(item.system.quantity) && (item.system.quantity !== 1);

    if ( item.system.attunement ) ctx.attunement = item.system.attuned ? {
      icon: "fa-sun",
      cls: "attuned",
      title: "DND5E.AttunementAttuned"
    } : {
      icon: "fa-sun",
      cls: "not-attuned",
      title: CONFIG.DND5E.attunementTypes[item.system.attunement]
    };

    return super._prepareItemPhysical(item, ctx);
  }

  /* -------------------------------------------- */
  /*  Life-Cycle Handlers                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
async _onFirstRender(context, options) {
  await super._onFirstRender(context, options);

  // ... código existente ...

  // Context menus de manipulação e treinamentos
new ContextMenu5e(
  this.element,
  ".ability-card[data-ability-id]",
  [
    {
      name: "Desfazer Habilidade",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const id = element.dataset.abilityId;
        return this.actor.system.manipulation?.abilities?.[id]?.unlocked === true;
      },
      callback: element => this._onUndoManipulationAbility(element.dataset.abilityId)
    }
  ],
  { jQuery: false }
);

new ContextMenu5e(
  this.element,
  ".nen-category-card[data-category]",
  [
    {
      name: "Desfazer Treinamento",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const id = element.dataset.category;
        return (this.actor.system.nenCategories?.[id]?.level ?? 0) > 0;
      },
      callback: element => this._onUndoTrainNenCategory(element.dataset.category)
    }
  ],
  { jQuery: false }
);


}

  /* -------------------------------------------- */

  /** @inheritDoc */
async _onRender(context, options) {
  await super._onRender(context, options);

  // Bolinhas de proficiência (perícias e salvaguardas) e a barra de Pontos de Aura seguem
  // a cor da categoria principal de Nen. --nen-primary-color é lido via var(...) em tab-details.css
  // pelas regras .skills/.saves/.tools e .cursed-energy-bar, que antes tinham cores fixas.
  const primaryNen = this._getPrimaryNenCategory();
  const nenColor = primaryNen?.color ?? "#828892";
  this.element.style.setProperty("--nen-primary-color", nenColor);
  this.element.style.setProperty("--proficiency-cycle-enabled-color", nenColor);
  this.element.style.setProperty("--proficiency-cycle-disabled-color", nenColor);

  if ( !this.actor.limited ) {
    this._renderAttunement(context, options);
    this._renderSpellbook(context, options);
    // Context menus de manipulação e treinamentos
    // Context menus de manipulação e treinamentos
new foundry.applications.ux.ContextMenu.implementation(
  this.element,
  ".ability-card[data-item-id]",
  this._getManipulationContextOptions(),
  { jQuery: false }
);

new foundry.applications.ux.ContextMenu.implementation(
  this.element,
  ".training-card[data-item-id]",
  this._getTrainingContextOptions(),
  { jQuery: false }
);
  }


    // Colapso de seções das abas Features, Spells e Inventory
    setTimeout(() => {
      for ( const tabName of ["features", "spells", "inventory"] ) {
        const tab = this.element.querySelector(`[data-tab="${tabName}"]`);
        if ( !tab ) continue;
        tab.querySelectorAll('.items-header').forEach(header => {
          header.style.cursor = 'pointer';
          header.addEventListener('click', (event) => {
            if ( event.target.closest('.item-controls') ) return;
            const itemList = header.nextElementSibling;
            if ( !itemList || !itemList.classList.contains('item-list') ) return;
            const isCollapsed = header.classList.toggle('collapsed');
            itemList.style.display = isCollapsed ? 'none' : '';
            const indicator = header.querySelector('.accordion-indicator');
            if ( indicator ) indicator.style.transform = isCollapsed ? 'rotate(-90deg)' : '';
          });
        });
      }
    }, 100);

    // Listeners da aba de treinamentos — usa data-bound para evitar duplicatas.
    // unlockNenMajor/undoNenMajor agora vivem no CARD inteiro (sem botão visível):
    // clique esquerdo pergunta se quer aprender, clique direito pergunta se quer desfazer.
    setTimeout(() => {
      const actions = [
        { selector: '[data-action="trainNenCategory"]:not([data-bound])', event: "click",
          handler: btn => this._onTrainNenCategory(btn.dataset.category) },
        { selector: '[data-action="unlockNenMajor"]:not([data-bound])', event: "click",
          handler: btn => this._onConfirmUnlockNenMajor(btn.dataset.category, btn.dataset.ability, btn.dataset.label) },
        { selector: '[data-action="undoNenMajor"]:not([data-bound])', event: "contextmenu",
          handler: btn => this._onConfirmUndoNenMajor(btn.dataset.category, btn.dataset.ability, btn.dataset.label) }
      ];
      for ( const { selector, event, handler } of actions ) {
        this.element.querySelectorAll(selector).forEach(btn => {
          btn.dataset.bound = "1";
          if ( event === "contextmenu" ) {
            btn.addEventListener('contextmenu', (e) => { e.preventDefault(); handler(btn); });
            // Absorve o clique esquerdo sem fazer nada — impede que ele suba até o
            // dispatch nativo do Foundry (que reagiria a este mesmo data-action).
            btn.addEventListener('click', (e) => { if ( e.button === 0 ) e.stopPropagation(); });
          } else {
            btn.addEventListener('click', (e) => {
              if ( e.button !== 0 ) return;
              e.stopPropagation();
              handler(btn);
            });
            btn.addEventListener('contextmenu', (e) => { e.preventDefault(); });
          }
          btn.addEventListener('auxclick', (e) => { if ( e.button !== 0 ) e.preventDefault(); });
        });
      }
    }, 150);

    // Rodas dos Princípios de Nen (anel/raios + abrir no clique). Compartilhado com o NPC.
    setupNenWheels(this.element);

    // Seletor de Talentos/Defeitos (aba Biografia): escolher no dropdown adiciona o item.
    this.element.querySelectorAll("select.hc-bio-select").forEach(sel => {
      if ( sel.dataset.bound ) return;
      sel.dataset.bound = "1";
      sel.addEventListener("change", ev => {
        const uuid = ev.currentTarget.value;
        if ( !uuid ) return;
        this._onAddBioItem(uuid, ev.currentTarget.dataset.kind);
        ev.currentTarget.value = "";
      });
    });

    // Injetar seção de condições Jujutsu na aba Effects
    _injectJJConditions(this.element, this.actor);

    // Seções customizadas de Features (JJ)
    _setupFeatureSectionDrops(this.element, this.actor);
    _unhideFeatureSections(this.element);

    // Botão de Explosão Defensiva — listener no botão do HBS
    this.element.querySelector("[data-action='jj-expdef-trigger']")
      ?.addEventListener("click", () => _onExplosaoDefensiva(this.actor));

    // Botões de Foco Agressivo / Defensivo
    this.element.querySelectorAll("[data-action='jj-toggle-foco']")
      .forEach(btn => btn.addEventListener("click", () => {
        if ( btn.disabled ) return;
        this._onToggleFoco(btn.dataset.foco);
      }));

    // Botão Estágio de Foco (Ultimato)
    this.element.querySelector("[data-action='jj-toggle-estagio-foco']")
      ?.addEventListener("click", () => this._onToggleEstagioFoco());

    // Hatsu — feedback visual de hover nos drop zones
    this.element.querySelectorAll(".hatsu-drop-zone").forEach(zone => {
      zone.addEventListener("dragenter", e => { e.preventDefault(); zone.classList.add("drag-hover"); });
      zone.addEventListener("dragover",  e => { e.preventDefault(); });
      zone.addEventListener("dragleave", e => {
        if ( !zone.contains(e.relatedTarget) ) zone.classList.remove("drag-hover");
      });
      zone.addEventListener("drop", () => zone.classList.remove("drag-hover"));
    });

    // Hatsu — change listeners para requisitos de categoria (select + input)
    this.element.querySelectorAll("[data-hatsu-req]").forEach(el => {
      el.addEventListener("change", e => {
        const field = el.dataset.hatsuReq;
        const itemId = el.dataset.itemId;
        const index = parseInt(el.dataset.index);
        this._onHatsuReqChange(itemId, index, field, el.value);
      });
    });

    // Hatsu — change listener para o Grau de técnicas em manifestação Versátil
    this.element.querySelectorAll("[data-hatsu-grau]").forEach(el => {
      el.addEventListener("change", () => {
        this._onHatsuGrauChange(el.dataset.itemId, el.value);
      });
    });

    // Seis Olhos — listener nos radio buttons
    this.element.querySelectorAll("input[name='flags.hunter-system.seisOlhosMode']")
      .forEach(radio => radio.addEventListener("change", async (event) => {
        const mode = event.target.value;
        await this.actor.setFlag("hunter-system", "seisOlhosMode", mode);
        await _applySeiOlhosEffects(this.actor, mode);
      }));

    // Formatar inputs de Yen com pontuação (ex: 5000 → 5.000)
    const _formatYen = val => {
      const num = parseInt(String(val).replace(/\D/g, "")) || 0;
      return num.toLocaleString("pt-BR");
    };
    this.element.querySelectorAll("input.jj-yen-input, input[name='system.currency.yen']").forEach(input => {
      if ( input.dataset.yenFormatted ) return;
      input.dataset.yenFormatted = "1";

      // Cria um input hidden com o valor numérico puro — é esse que o Foundry lê
      const hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = input.name;
      hidden.value = parseInt(String(input.value).replace(/\D/g, "")) || 0;
      input.parentNode.insertBefore(hidden, input.nextSibling);

      // O input visível vira só display: sem name, tipo text, formatado
      input.removeAttribute("name");
      input.type = "text";
      input.value = _formatYen(hidden.value);

      input.addEventListener("focus", () => {
        input.value = hidden.value;
        input.select();
      });
      input.addEventListener("blur", () => {
        const raw = parseInt(input.value.replace(/\D/g, "")) || 0;
        hidden.value = raw;
        // Dispara change no hidden pro Foundry salvar
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
        input.value = _formatYen(raw);
      });
    });

    // Impede que Enter em inputs de PV/Energia dispare botões do sheet
    this.element.addEventListener("keydown", (event) => {
      if ( event.key !== "Enter" ) return;
      const tag = event.target.tagName;
      if ( tag !== "INPUT" && tag !== "TEXTAREA" ) return;
      // Salva o valor e impede propagação que ativaria botões
      event.preventDefault();
      event.target.blur();
    }, { capture: true });

    // Show death tray at 0 HP
    const renderContext = options.renderContext ?? options.action;
    const renderData = options.renderData ?? options.data;
    const isUpdate = (renderContext === "update") || (renderContext === "updateActor");
    const hp = foundry.utils.getProperty(renderData ?? {}, "system.attributes.hp.value");
    if ( isUpdate && (hp === 0) ) this._toggleDeathTray(true);

    // Sincroniza Active Effect da proficiência Hatsu (apenas dono pra evitar conflito)
    if ( this.actor.isOwner ) this._syncHatsuProficiencyEffect();

    // Re-registra hook do Estágio de Foco caso flag esteja ativa após reload
    if ( this.actor.isOwner
         && this.actor.getFlag("hunter-system", "hatsuEstagioFocoAtivo")
         && !this.actor._estagioFocoHookId ) {
      _registerEstagioFocoHook(this.actor);
    }
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle removing a favorite.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #deleteFavorite(event, target) {
    const { favoriteId } = target.closest("[data-favorite-id]")?.dataset ?? {};
    if ( favoriteId ) this.actor.system.removeFavorite(favoriteId);
  }

  /* -------------------------------------------- */

  /**
   * Handle deleting an occupant from a facility.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static async #deleteOccupant(event, target) {
    const { facilityId } = target.closest("[data-facility-id]")?.dataset ?? {};
    const { prop } = target.closest("[data-prop]")?.dataset ?? {};
    const { index } = target.closest("[data-index]")?.dataset ?? {};
    const facility = this.actor.items.get(facilityId);
    if ( !facility || !prop || (index === undefined) ) return;

    // Prompt to clear a pending trade
    if ( target.closest(".occupant-slot.pending") ) {
      const result = await foundry.applications.api.DialogV2.confirm({
        content: `
          <p>
            <strong>${game.i18n.localize("AreYouSure")}</strong> ${game.i18n.localize("DND5E.Bastion.Trade.Invalid")}
          </p>
        `,
        window: {
          icon: "fa-solid fa-coins",
          title: "DND5E.Bastion.Trade.Cancel"
        },
        position: { width: 400 }
      }, { rejectClose: false });
      if ( result ) facility.update({
        system: {
          progress: { max: null, order: "", value: null },
          trade: {
            pending: { creatures: [], operation: null }
          }
        }
      });
    }

    // Remove the occupant
    else {
      let { value } = foundry.utils.getProperty(facility, prop);
      value = value.filter((_, i) => i !== Number(index));
      facility.update({ [`${prop}.value`]: value });
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle finding an available item of a given type.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static async #findItem(event, target) {
    if ( !this.isEditable ) return;
    const { classIdentifier, facilityType, itemType: type } = target.dataset;
    const filters = { locked: { types: new Set([type]) } };

    if ( classIdentifier ) filters.locked.additional = { class: { [classIdentifier]: 1 } };
    if ( type === "class" ) {
      const existingIdentifiers = new Set(Object.keys(this.actor.classes));
      filters.initial = { additional: { properties: { sidekick: -1 } } };
      filters.locked.arbitrary = [{ o: "NOT", v: { k: "system.identifier", o: "in", v: existingIdentifiers } }];
    }
    if ( type === "facility" ) {
      const otherType = facilityType === "basic" ? "special" : "basic";
      filters.locked.additional = {
        type: { [facilityType]: 1, [otherType]: -1 },
        level: { max: this.actor.system.details.level }
      };
    }

    const result = await CompendiumBrowser.selectOne({ filters }, this._detachOptions());
    if ( result ) this._onDropCreateItems(event, [game.items.fromCompendium(await fromUuid(result), { keepId: true })]);
  }

  /* -------------------------------------------- */

  /**
   * Handle setting the character's spellcasting ability.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #setSpellcastingAbility(event, target) {
    const ability = target.closest("[data-ability]")?.dataset.ability;
    this.submit({ updateData: { "system.attributes.spellcasting": ability } });
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the death saves tray.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #toggleDeathTray(event, target) {
    this._toggleDeathTray();
  }

  /* -------------------------------------------- */

  /**
   * Toggle the death save tray.
   * @param {boolean} [open]  Force a particular open state.
   * @protected
   */
  _toggleDeathTray(open) {
    const tray = this.form.querySelector(".death-tray");
    const tab = tray.querySelector(".death-tab");
    tray.classList.toggle("open", open);
    this._deathTrayOpen = tray.classList.contains("open");
    tab.dataset.tooltip = `DND5E.DeathSave${this._deathTrayOpen ? "Hide" : "Show"}`;
    tab.setAttribute("aria-label", game.i18n.localize(tab.dataset.tooltip));
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling inspiration.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #toggleInspiration(event, target) {
    this.submit({ updateData: { "system.attributes.inspiration": !this.actor.system.attributes.inspiration } });
  }

  /* -------------------------------------------- */

  /**
   * Alterna a Aura ativa (Zetsu). Com aura ativa mostra-se a Vida; em zetsu/esgotada, a Vitalidade.
   * @this {CharacterActorSheet}
   */
  static #toggleAura(event, target) {
    if ( this.actor.system.attributes.auraExhausted ) {
      ui.notifications?.warn("Aura esgotada — não é possível ativar.");
      return;
    }
    this.actor.update({ "system.attributes.auraActive": !this.actor.system.attributes.auraActive });
  }

  /* -------------------------------------------- */

  /**
   * Gera Aura manualmente (mesmo fluxo usado automaticamente na passagem de turno em combate).
   * @this {CharacterActorSheet}
   */
  static async #generateEnergy(event, target) {
    const choices = await EnergyGenerationDialog.configure(this.actor);
    if ( choices ) await EnergySystem.processTurnStartWithChoices(this.actor, choices);
  }

  /* -------------------------------------------- */

  /**
   * Handle using a facility.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #useFacility(event, target) {
    if ( !target.classList.contains("rollable") ) return;
    const { facilityId } = target.closest("[data-facility-id]")?.dataset ?? {};
    const facility = this.actor.items.get(facilityId);
    facility?.use({ legacy: false, chooseActivity: true, event });
  }

  /* -------------------------------------------- */

  /**
   * Handle using a favorited item.
   * @this {CharacterActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static async #useFavorite(event, target) {
    if ( !this.isEditable || (event.target.tagName === "INPUT") ) return;
    const { favoriteId } = target.closest("[data-favorite-id]").dataset;
    const favorite = await fromUuid(favoriteId, { relative: this.actor });
    if ( (favorite instanceof dnd5e.documents.Item5e) || target.dataset.activityId ) {
      if ( favorite.type === "container" ) this._renderChild(favorite.sheet);
      else favorite.use({ event }, { options: { sheet: this } });
    }
    else if ( favorite instanceof dnd5e.dataModels.activity.BaseActivityData ) {
      if ( favorite.canUse ) favorite.use({ event }, { options: { sheet: this } });
    }
    else if ( favorite instanceof dnd5e.documents.ActiveEffect5e ) favorite.update({ disabled: !favorite.disabled });
    else {
      const { key } = target.closest("[data-key]")?.dataset ?? {};
      if ( key ) {
        if ( target.classList.contains("skill-name") ) this.actor.rollSkill({ event, skill: key });
        else if ( target.classList.contains("tool-name") ) this.actor.rollToolCheck({ event, tool: key });
      }
    }
  }

  /* -------------------------------------------- */
  /*  Drag & Drop                                 */
  /* -------------------------------------------- */

  /** @override */
  _defaultDropBehavior(event, data) {
    if ( data.dnd5e?.action === "favorite" || (["Activity", "Item"].includes(data.type)
      && event.target.closest(".favorites")) ) return "link";
    return super._defaultDropBehavior(event, data);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDragStart(event) {
    const methods = CONFIG.DND5E.spellcasting;
    const { key } = event.target.closest("[data-key]")?.dataset ?? {};
    const { level, method } = event.target.closest("[data-level]")?.dataset ?? {};
    const isSlots = event.target.closest("[data-favorite-id]") || event.target.classList.contains("items-header");
    let type;
    if ( key in CONFIG.DND5E.skills ) type = "skill";
    else if ( key in CONFIG.DND5E.tools ) type = "tool";
    else if ( methods[method]?.slots && (level !== "0") && isSlots ) type = "slots";
    if ( !type ) return super._onDragStart(event);

    // Add another deferred deactivation to catch the second pointerenter event that seems to be fired on Firefox.
    requestAnimationFrame(() => game.tooltip.deactivate());
    game.tooltip.deactivate();

    const dragData = { dnd5e: { action: "favorite", type } };
    if ( type === "slots" ) dragData.dnd5e.id = methods[method].getSpellSlotKey(Number(level));
    else dragData.dnd5e.id = key;
    event.dataTransfer.setData("application/json", JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = "link";
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDrop(event) {
    if ( !event.target.closest(".favorites") ) return super._onDrop(event);
    const dragData = event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text/plain");
    if ( !dragData ) return super._onDrop(event);
    let data;
    try {
      data = JSON.parse(dragData);
    } catch(e) {
      console.error(e);
      return;
    }
    const { action, type, id } = data.dnd5e ?? {};
    if ( action === "favorite" ) return this._onDropFavorite(event, { type, id });
    if ( data.type === "Activity" ) {
      const activity = await fromUuid(data.uuid);
      if ( activity ) return this._onDropActivity(event, activity);
    }
    return super._onDrop(event);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropActiveEffect(event, effect) {
    if ( !event.target.closest(".favorites") || (effect.target !== this.actor) ) {
      return super._onDropActiveEffect(event, effect);
    }
    const uuid = effect.getRelativeUUID(this.actor);
    return this._onDropFavorite(event, { type: "effect", id: uuid });
  }

  /* -------------------------------------------- */

  /**
   * Handle dropping an Activity onto the sheet.
   * @param {DragEvent} event    The originating drag event.
   * @param {Activity} activity  The dropped Activity document.
   * @returns {Promise<Actor5e|void>}
   * @protected
   */
  async _onDropActivity(event, activity) {
    if ( !event.target.closest(".favorites") || (activity.actor !== this.actor) ) return;
    const uuid = `${activity.item.getRelativeUUID(this.actor)}.Activity.${activity.id}`;
    return this._onDropFavorite(event, { type: "activity", id: uuid });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropActor(event, actor) {
    if ( !event.target.closest(".facility-occupants") || !actor.uuid ) return super._onDropActor(event, actor);
    const { facilityId } = event.target.closest("[data-facility-id]").dataset;
    const facility = this.actor.items.get(facilityId);
    if ( !facility ) return;
    const { prop } = event.target.closest("[data-prop]").dataset;
    const { max, value } = foundry.utils.getProperty(facility, prop);
    if ( (value.length + 1) > max ) return;
    return facility.update({ [`${prop}.value`]: [...value, actor.uuid] });
  }

  /* -------------------------------------------- */

  /**
   * Handle an owned item or effect being dropped in the favorites area.
   * @param {DragEvent} event            The triggering event.
   * @param {ActorFavorites5e} favorite  The favorite that was dropped.
   * @returns {Promise<Actor5e>|void}
   * @protected
   */
  _onDropFavorite(event, favorite) {
    if ( this.actor.system.hasFavorite(favorite.id) ) return this._onSortFavorites(event, favorite.id);
    return this.actor.system.addFavorite(favorite);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDropItem(event, item) {
    // Instalar Molde Hatsu
    if ( item.type === "hatsuTemplate" ) {
      return this._onHatsuInstallTemplate(item);
    }

    // Aba Hatsu: drop em slot de manifestação ou em lista de técnicas
    const hatsuTarget = event.target.closest("[data-hatsu-drop]");
    if ( hatsuTarget && item.type === "spell" ) {
      return this._onHatsuDropSpell(event, item, hatsuTarget);
    }

    if ( !event.target.closest(".favorites") || (item.parent !== this.actor) ) return super._onDropItem(event, item);
    const uuid = item.getRelativeUUID(this.actor);
    return this._onDropFavorite(event, { type: "item", id: uuid });
  }

  /**
   * Atribui um spell a um slot de manifestação ou como técnica filha de um slot.
   */
  async _onHatsuDropSpell(event, item, dropTarget) {
    const dropType = dropTarget.dataset.hatsuDrop;
    const slotId = dropTarget.closest("[data-hatsu-slot]")?.dataset.hatsuSlot;
    if ( !slotId ) return;

    let owned = item.parent === this.actor ? item : null;

    // Item externo: criar no actor primeiro
    if ( !owned ) {
      const itemData = item.toObject();
      delete itemData._id;
      if ( dropType === "manif" ) {
        foundry.utils.setProperty(itemData, "system.method", "atwill");
      }
      const created = await Item.implementation.create(itemData, { parent: this.actor });
      owned = Array.isArray(created) ? created[0] : created;
      if ( !owned ) return;
    }

    // Limpar flag anterior antes de setar a nova
    await owned.unsetFlag("hunter-system", "hatsu");

    if ( dropType === "manif" ) {
      // Se outra manifestação ocupava esse slot, desocupa
      const previous = this.actor.items.find(i =>
        (i !== owned) && (i.type === "spell") &&
        (i.getFlag("hunter-system", "hatsu.slot") === slotId)
      );
      if ( previous ) await previous.unsetFlag("hunter-system", "hatsu");
      await owned.setFlag("hunter-system", "hatsu", { slot: slotId });
      // Promover método para "atwill" se ainda não for
      if ( owned.system?.method !== "atwill" ) {
        await owned.update({ "system.method": "atwill" });
      }
      ui.notifications.info(`"${owned.name}" atribuída ao slot ${slotId}.`);
    } else {
      await owned.setFlag("hunter-system", "hatsu", { parent: slotId });
      ui.notifications.info(`"${owned.name}" adicionada como técnica de ${slotId}.`);
    }

    return owned;
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropSingleItem(event, itemData, options={}) {
    // Increment the number of class levels a character instead of creating a new item
    if ( itemData.type === "class" ) {
      const charLevel = this.actor.system.details.level;
      itemData.system.levels = Math.min(itemData.system.levels, CONFIG.DND5E.maxLevel - charLevel);
      if ( itemData.system.levels <= 0 ) {
        const err = game.i18n.format("DND5E.MaxCharacterLevelExceededWarn", { max: CONFIG.DND5E.maxLevel });
        ui.notifications.error(err);
        return;
      }

      const cls = this.actor.itemTypes.class.find(c => c.identifier === itemData.system.identifier);
      if ( cls ) {
        const priorLevel = cls.system.levels;
        if ( true ) {
          const manager = AdvancementManager.forLevelChange(this.actor, cls.id, itemData.system.levels);
          if ( manager.steps.length ) {
            manager.render({ force: true });
            return;
          }
        }
        cls.update({ "system.levels": priorLevel + itemData.system.levels });
        return;
      }
    }

    // If a subclass is dropped, ensure it doesn't match another subclass with the same identifier
    else if ( itemData.type === "subclass" ) {
      const other = this.actor.itemTypes.subclass.find(i => i.identifier === itemData.system.identifier);
      if ( other ) {
        const err = game.i18n.format("DND5E.SubclassDuplicateError", { identifier: other.identifier });
        ui.notifications.error(err);
        return;
      }
      const cls = this.actor.itemTypes.class.find(i => i.identifier === itemData.system.classIdentifier);
      if ( cls && cls.subclass ) {
        const err = game.i18n.format("DND5E.SubclassAssignmentError", { class: cls.name, subclass: cls.subclass.name });
        ui.notifications.error(err);
        return;
      }
    }

    return super._onDropSingleItem(event, itemData, options);
  }

  /* -------------------------------------------- */

  /**
   * Handle re-ordering the favorites list.
   * @param {DragEvent} event  The drop event.
   * @param {string} srcId     The identifier of the dropped favorite.
   * @returns {Promise<Actor5e>|void}
   * @protected
   */
  _onSortFavorites(event, srcId) {
    const dropTarget = event.target.closest("[data-favorite-id]");
    if ( !dropTarget ) return;
    let source;
    let target;
    const targetId = dropTarget.dataset.favoriteId;
    if ( srcId === targetId ) return;
    const siblings = this.actor.system.favorites.filter(f => {
      if ( f.id === targetId ) target = f;
      else if ( f.id === srcId ) source = f;
      return f.id !== srcId;
    });
    const updates = foundry.utils.performIntegerSort(source, { target, siblings });
    const favorites = this.actor.system.favorites.reduce((map, f) => map.set(f.id, { ...f }), new Map());
    for ( const { target, update } of updates ) {
      const favorite = favorites.get(target.id);
      foundry.utils.mergeObject(favorite, update);
    }
    return this.actor.update({ "system.favorites": Array.from(favorites.values()) });
  }

  /* -------------------------------------------- */
  /*  Filtering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _filterItem(item, filters) {
    const allowed = super._filterItem(item, filters);
    if ( allowed !== undefined ) return allowed;
    if ( item.type === "container" ) return true;
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  canExpand(item) {
    return !["background", "race", "facility"].includes(item.type) && super.canExpand(item);
  }

  /* -------------------------------------------- */

  /**
   * Determine if the sheet should show a bastion tab.
   * @param {Actor5e} actor
   * @returns {boolean}
   */
  static hasBastion(actor) {
    return false;
  }

  /* -------------------------------------------- */

  /**
   * Prepara o contexto para a aba de Manipulação de Energia (Skill Tree).
   * @param {object} context
   * @param {ApplicationRenderOptions} options
   * @returns {Promise<object>}
   * @protected
   */
  async _prepareManipulationContext(context, options) {
    try {
      // Prepara habilidades e princípios com estado de desbloqueio
      const abilitiesResult = prepareManipulationAbilities(this.actor);
      const principlesResult = preparePrinciples(this.actor);

      // Kanji de cada princípio Nen (centro da roda).
      const NEN_KANJI = {
        ten: "纏", zetsu: "絶", ren: "練", hatsu: "発",
        gyo: "凝", in: "隠", en: "円", shu: "周", ken: "堅", ko: "硬", ryu: "流"
      };
      // Monta sections usando TREE_DATA (estrutura estática com ordem correta)
      const sections = TREE_DATA.map(treeSection => ({
        label: treeSection.section,
        principles: treeSection.principles.map(pr => {
          const prStatus = principlesResult[pr.id] ?? {};
          const abilities = (pr.abilities ?? []).map(ab => {
            const abStatus = abilitiesResult[pr.id]?.[ab.id] ?? {};
            return {
              id: ab.id,
              label: ab.label,
              description: ab.desc ?? "",
              reference: ab.reference ?? "",
              cost: ab.cost,
              unlocked: abStatus.unlocked ?? false,
              canUnlock: abStatus.canUnlock ?? false
            };
          });
          const isMasterGrant = prStatus.isMasterGrant ?? false;
          const unlocked = prStatus.unlocked ?? false;
          // Fundamentais (isMasterGrant) podem ser desbloqueados livremente pelo jogador
          const canUnlock = !unlocked && (isMasterGrant ? true : prStatus.canUnlock ?? false);
          const canUnlockFree = !unlocked && isMasterGrant;
          return {
            id: pr.id,
            label: pr.label,
            kanji: NEN_KANJI[pr.id] ?? "",
            description: pr.desc ?? "",
            reference: pr.reference ?? "",
            cost: pr.cost ?? 0,
            unlocked,
            canUnlock,
            canUnlockFree,
            isMasterGrant,
            abilities
          };
        })
      }));

      context.manipulation = { sections };
    } catch(err) {
      console.error("Hunter | Erro Manipulacao:", err);
      context.manipulation = { sections: [] };
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Tenta avançar um nível em uma categoria Nen.
   * Rola Teste de Espírito vs CD do nível — sucesso avança, falha reduz CD em 1.
   */
  /**
   * Seleciona o atributo a ser treinado (estado em memória, não persistido).
   */
  _onSelectAttributeToTrain(abilityId) {
    if ( !abilityId ) return;
    this._selectedAttrToTrain = abilityId;
    // Atualiza UI: marca o pip selecionado
    this.element.querySelectorAll("[data-action='selectAttributeToTrain']").forEach(b => {
      b.classList.toggle("selected", b.dataset.ability === abilityId);
    });
  }

  /**
   * Treina o atributo selecionado: gasta PT e aumenta o valor em +1.
   * Custo: 3 PT até 17→18; 6 PT em 18→19 e 19→20. Cap em 20.
   */
  async _onTrainAttribute() {
    const id = this._selectedAttrToTrain;
    if ( !id ) {
      ui.notifications.warn("Selecione um atributo antes de treinar.");
      return;
    }
    const LABELS = { str: "Força", dex: "Agilidade", con: "Constituição",
                     int: "Inteligência", wis: "Sabedoria", cha: "Presença" };
    const value = this.actor.system.abilities?.[id]?.value ?? 10;
    if ( value >= 20 ) {
      ui.notifications.warn(`${LABELS[id]} já está no máximo (20).`);
      return;
    }
    const cost = value >= 18 ? 6 : 3;
    const pt = getAvailableTrainingPoints(this.actor);
    if ( pt < cost ) {
      ui.notifications.warn(`PT insuficientes: precisa ${cost}, disponível ${pt}.`);
      return;
    }

    // Confirmação antes de gastar PT
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "🏋️ Confirmar Treinamento" },
      content: `
        <div style="padding:8px 0; font-size:13px; color:#ccc; line-height:1.6;">
          <p style="margin:0 0 10px;">Treinar <strong style="color:#c8a84b;">${LABELS[id]}</strong>?</p>
          <table style="width:100%; border-spacing:0; font-size:12px;">
            <tr>
              <td style="padding:4px 8px; color:#8080a0;">Valor:</td>
              <td style="padding:4px 8px; text-align:right;">
                <strong>${value}</strong> → <strong style="color:#60c080;">${value + 1}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 8px; color:#8080a0;">Custo:</td>
              <td style="padding:4px 8px; text-align:right;"><strong style="color:#e07050;">${cost} PT</strong></td>
            </tr>
            <tr>
              <td style="padding:4px 8px; color:#8080a0;">PT restante:</td>
              <td style="padding:4px 8px; text-align:right;"><strong>${pt - cost}</strong></td>
            </tr>
          </table>
        </div>`,
      yes: { label: "Confirmar Treinamento", default: true },
      no:  { label: "Cancelar" }
    });
    if ( !ok ) return;

    const spentPt = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
    await this.actor.update({
      [`system.abilities.${id}.value`]: value + 1,
      "system.curseResources.spentTrainingPoints": spentPt + cost
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🏋️ <strong>${this.actor.name}</strong> treinou <strong>${LABELS[id]}</strong>: ${value} → <strong>${value + 1}</strong> (custo: ${cost} PT).`
    });
    ui.notifications.info(`${LABELS[id]} agora é ${value + 1}.`);
  }

  /* -------------------------------------------- */

  async _onTrainNenCategory(categoryId) {
    const cat = NEN_CATEGORIES_DATA[categoryId];
    if ( !cat ) return;

    // Level salvo diretamente no nenCategories
    const currentLevel = this.actor.system.nenCategories?.[categoryId]?.level ?? 0;
    const nextLevel = currentLevel + 1;

    // Verificar limite de afinidade
    const maxAllowed = getMaxLevelForCategory(this.actor, categoryId);
    if ( maxAllowed === 0 ) {
      ui.notifications.warn(`Sua categoria principal não tem afinidade com ${cat.label}.`);
      return;
    }
    if ( nextLevel > maxAllowed ) {
      ui.notifications.warn(`Você só pode treinar ${cat.label} até o nível ${maxAllowed} com sua categoria atual.`);
      return;
    }
    if ( nextLevel > 10 ) {
      ui.notifications.info(`${cat.label} já está no nível máximo!`);
      return;
    }

    const costs = NEN_LEVEL_COSTS[nextLevel];
    if ( !costs ) return;

    const trainingPoints = getAvailableTrainingPoints(this.actor);
    const energyTotal = this.actor.system.energy?.total ?? 0;
    const dcReductions = this.actor.system.nenCategories?.[categoryId]?.dcReductions?.[nextLevel] ?? 0;
    const currentDC = Math.max(1, costs.cd - dcReductions);

    // Entendimento (habilidade principal de Especialista, Nv6): treinar qualquer outra
    // categoria em um nível abaixo do nível de Especialista custa metade do PT (arredondado
    // para cima) — só PT, PA e CD não são afetados. Aplicado independentemente ao custo de
    // rolar e ao custo automático (cada um arredondado para cima a partir do seu próprio
    // valor base), não encadeado — por isso o automático não é simplesmente o dobro do rolar.
    const especialistaLevel = this.actor.system.nenCategories?.especialista?.level ?? 0;
    const hasEntendimento = !!this.actor.system.nenCategories?.especialista?.unlockedMajor?.entendimento;
    const entendimentoApplies = hasEntendimento && (categoryId !== "especialista") && (nextLevel < especialistaLevel);

    // Automático só está disponível abaixo do nível máximo (10) — nível 10 exige rolagem.
    const rollPt = entendimentoApplies ? Math.ceil(costs.pt / 2) : costs.pt;
    const autoPt = entendimentoApplies ? Math.ceil((costs.pt * 2) / 2) : costs.pt * 2;
    const canRoll = (trainingPoints >= rollPt) && (energyTotal >= costs.pa);
    const canAuto = (nextLevel < 10) && (trainingPoints >= autoPt) && (energyTotal >= costs.pa);

    const mode = await this._onChooseTrainingMode({
      cat, nextLevel, costs, rollPt, currentDC, autoPt, canRoll, canAuto, entendimentoApplies
    });
    if ( !mode ) return; // cancelado

    if ( mode === "auto" ) {
      if ( !canAuto ) {
        ui.notifications.warn(`PT insuficientes! Precisa de ${autoPt} PT para treinar ${cat.label} automaticamente.`);
        return;
      }
      const spentPtAuto = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
      await this.actor.update({
        "system.curseResources.spentTrainingPoints": spentPtAuto + autoPt,
        "system.energy.total": Math.max(0, energyTotal - costs.pa),
        [`system.nenCategories.${categoryId}.level`]: nextLevel
      });
      await this._applyNenMinorEffect(categoryId, nextLevel);
      console.log(`Hunter | Avançou ${cat.label} para nível ${nextLevel} (automático)`);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `✨ <strong>${this.actor.name}</strong> avançou automaticamente para o <strong>Nível ${nextLevel}</strong> em <strong>${cat.label}</strong> (custo${entendimentoApplies ? " reduzido por Entendimento" : " dobrado"}: ${autoPt} PT).`
      });
      return;
    }

    // mode === "roll"
    if ( !canRoll ) {
      ui.notifications.warn(`Recursos insuficientes! Precisa de ${rollPt} PT e ${costs.pa} PA para treinar ${cat.label}.`);
      return;
    }

    // Rolar Teste de Espírito (Nen) — chave de perícia "nen" (INT), com todos
    // os modificadores aplicados pelo sistema. Sem diálogo (rolagem direta).
    const rollResult = await this.actor.rollSkill(
      { skill: "nen", target: currentDC },
      { configure: false },
      { data: { flavor: `Teste de Espírito (Nen) — ${cat.label} Nível ${nextLevel} (CD ${currentDC})` } }
    );
    const roll = Array.isArray(rollResult) ? rollResult[0] : rollResult;
    if ( !roll ) return; // rolagem cancelada — não deduz PT/PA

    // PA é gasto de qualquer forma; PT só vira "Gastos" (sucesso) ou "Perdidos" (falha) — nunca os dois.
    await this.actor.update({ "system.energy.total": Math.max(0, energyTotal - costs.pa) });

    if ( roll.total >= currentDC ) {
      // Salva o nível diretamente no nenCategories
      const spentPtRoll = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
      await this.actor.update({
        [`system.nenCategories.${categoryId}.level`]: nextLevel,
        "system.curseResources.spentTrainingPoints": spentPtRoll + rollPt
      });
      // Aplicar efeito menor automático se atingiu nível 2, 5 ou 8
      await this._applyNenMinorEffect(categoryId, nextLevel);
      console.log(`Hunter | Avançou ${cat.label} para nível ${nextLevel}`);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `✅ <strong>${this.actor.name}</strong> avançou para o <strong>Nível ${nextLevel}</strong> em <strong>${cat.label}</strong>!`
      });
    } else {
      // Falha — reduz CD em 1 para próxima tentativa
      const currentReduction = this.actor.system.nenCategories?.[categoryId]?.dcReductions?.[nextLevel] ?? 0;
      await this.actor.update({
        [`system.nenCategories.${categoryId}.dcReductions.${nextLevel}`]: currentReduction + 1,
        "system.curseResources.lostTrainingPoints": (this.actor.system.curseResources?.lostTrainingPoints ?? 0) + rollPt
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `❌ <strong>${this.actor.name}</strong> falhou no treino de <strong>${cat.label}</strong> Nível ${nextLevel}. CD reduzida para ${currentDC - 1} (próxima tentativa).`
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Modal de escolha entre rolar o treinamento de categoria ou concluí-lo automaticamente
   * pagando o dobro de PT. A opção automática não está disponível no nível 10 (máximo).
   */
  async _onChooseTrainingMode({ cat, nextLevel, costs, rollPt, currentDC, autoPt, canRoll, canAuto, entendimentoApplies }) {
    const color = cat.color ?? "#c8a84b";
    // entendimentoApplies vem pronto do chamador — não re-inferir comparando rollPt com
    // costs.pt, pois em costs.pt === 1 (nível 1) o arredondamento pra cima não muda o valor
    // do custo de rolar (ceil(1/2) = 1), o que faria essa inferência falhar silenciosamente
    // mesmo com o desconto genuinamente ativo (e visível no custo automático, ceil(2/2)=1).
    const entendimentoHint = entendimentoApplies
      ? `<div class="jj-train-option-boon">✨ Entendimento reduz o custo de PT pela metade</div>` : "";

    const autoSection = ( nextLevel < 10 ) ? `
      <label class="jj-train-option" style="--opt-color: ${color}; ${canAuto ? "" : "opacity:0.45;"}">
        <div class="jj-train-option-icon"><i class="fa-solid fa-forward" inert></i></div>
        <div class="jj-train-option-info">
          <strong>Automático</strong>
          <div class="jj-train-option-desc">Sucesso garantido, sem rolagem. Custo${entendimentoApplies ? "" : " dobrado"}: <strong>${autoPt} PT</strong> + ${costs.pa} PA.</div>
          ${entendimentoHint}
          ${canAuto ? "" : `<div class="jj-train-option-warn">⛔ PT insuficientes (precisa de ${autoPt})</div>`}
        </div>
      </label>` : `
      <div class="jj-train-option" style="--opt-color: ${color}; opacity:0.45;">
        <div class="jj-train-option-icon"><i class="fa-solid fa-ban" inert></i></div>
        <div class="jj-train-option-info">
          <strong>Automático indisponível</strong>
          <div class="jj-train-option-desc">O nível máximo (10) só pode ser alcançado rolando o teste.</div>
        </div>
      </div>`;

    const content = `
      <style>
        .jj-train-option { display:flex; align-items:flex-start; gap:10px; padding:10px 12px;
          background:#12121c; border:1px solid rgba(255,255,255,0.08); border-radius:8px; margin-bottom:8px; }
        .jj-train-option-icon { width:30px; height:30px; border-radius:7px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center; font-size:13px;
          background:color-mix(in srgb, var(--opt-color) 18%, transparent);
          border:1px solid color-mix(in srgb, var(--opt-color) 45%, transparent);
          color: var(--opt-color); }
        .jj-train-option-info strong { color:#e8e8f0; font-size:13px; }
        .jj-train-option-desc { font-size:11px; color:#9098a8; margin-top:2px; line-height:1.4; }
        .jj-train-option-warn { font-size:11px; color:#e08a6a; margin-top:3px; }
        .jj-train-option-boon { font-size:11px; color:#8ad0a0; margin-top:3px; }
      </style>
      <p style="margin:0 0 10px; font-size:12px; color:#aaa;">
        Como deseja treinar <strong style="color:${color}">${cat.label}</strong> para o <strong>Nível ${nextLevel}</strong>?
      </p>
      <label class="jj-train-option" style="--opt-color: ${color}; ${canRoll ? "" : "opacity:0.45;"}">
        <div class="jj-train-option-icon"><i class="fa-solid fa-dice-d20" inert></i></div>
        <div class="jj-train-option-info">
          <strong>Rolar Treinamento</strong>
          <div class="jj-train-option-desc">Teste de Espírito (Nen) CD ${currentDC}. Custo: <strong>${rollPt} PT</strong> + ${costs.pa} PA (falha reduz a CD na próxima tentativa).</div>
          ${entendimentoHint}
          ${canRoll ? "" : `<div class="jj-train-option-warn">⛔ Recursos insuficientes (precisa de ${rollPt} PT / ${costs.pa} PA)</div>`}
        </div>
      </label>
      ${autoSection}
    `;

    const buttons = [
      { label: "Rolar Treinamento", action: "roll", icon: "fa-solid fa-dice-d20", default: true }
    ];
    if ( nextLevel < 10 ) {
      buttons.push({ label: `Automático (${autoPt} PT)`, action: "auto", icon: "fa-solid fa-forward" });
    }
    buttons.push({ label: "Cancelar", action: "cancel", icon: "fa-solid fa-xmark" });

    const mode = await foundry.applications.api.DialogV2.wait({
      window: { title: `Treinar ${cat.label} — Nível ${nextLevel}` },
      content,
      buttons,
      rejectClose: false,
      close: () => null
    });
    return (mode === "cancel") ? null : mode;
  }

  /* -------------------------------------------- */

  /**
   * Alterna o estado dos focos Agressivo/Defensivo.
   * - Mutuamente exclusivos exceto se Fluxo Veloz desbloqueado.
   * - Foco Defensivo concede 20 (ou 40 com Fluxo Constante) PV temporários.
   * - Foco Agressivo apenas seta a flag — o bônus de dano é aplicado no roll.
   */
  async _onToggleFoco(focoType) {
    const ab = this.actor.system.manipulation?.abilities ?? {};
    const flagAgressivo  = !!this.actor.getFlag("hunter-system", "focoAgressivoAtivo");
    // defensivoAtivo é derivado: armorPoints.value > 0
    const flagDefensivo  = (this.actor.system.armorPoints?.value ?? 0) > 0;
    const fluxoVeloz     = !!ab.fluxoVeloz?.unlocked;
    const fluxoConstante = !!ab.fluxoConstante?.unlocked;
    const baseAmount     = fluxoConstante ? 40 : 20;

    // Bônus de Resistência Aprimorada: +3 PV temporários por nível de Aprimorador
    const resistenciaUnlocked = !!this.actor.system.nenCategories?.aprimorador?.unlockedMajor?.resistenciaAprimorada;
    const aprimoradorLevel    = this.actor.system.nenCategories?.aprimorador?.level ?? 0;
    const resistenciaBonus    = resistenciaUnlocked ? aprimoradorLevel * 3 : 0;
    const tempAmount          = baseAmount + resistenciaBonus;
    const dieFace             = fluxoConstante ? 6 : 4;

    if ( focoType === "agressivo" ) {
      if ( !ab.focoAgressivo?.unlocked ) return;
      const novo = !flagAgressivo;
      if ( novo && flagDefensivo && !fluxoVeloz ) {
        await this._desativarFocoDefensivo({ silent: true });
      }
      await this.actor.setFlag("hunter-system", "focoAgressivoAtivo", novo);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: novo
          ? `🥊 <strong>${this.actor.name}</strong> ativou o <strong>Foco Agressivo</strong> (+1d${dieFace} de dano em ataques comuns).`
          : `🥊 <strong>${this.actor.name}</strong> desativou o <strong>Foco Agressivo</strong>.`
      });
    }

    else if ( focoType === "defensivo" ) {
      if ( !ab.focoDefensivo?.unlocked ) return;
      const novo = !flagDefensivo;
      if ( novo ) {
        if ( flagAgressivo && !fluxoVeloz ) {
          await this.actor.setFlag("hunter-system", "focoAgressivoAtivo", false);
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `🥊 <strong>${this.actor.name}</strong> desativou o <strong>Foco Agressivo</strong>.`
          });
        }
        await this._ativarFocoDefensivo(tempAmount);
      } else {
        await this._desativarFocoDefensivo();
      }
    }
  }

  /**
   * Ativa o Foco Defensivo enchendo os Pontos de Armadura até o máximo derivado.
   * O estado "ativo" é representado por `armorPoints.value > 0` (fonte única).
   */
  async _ativarFocoDefensivo(amount) {
    const max = this.actor.system.armorPoints?.max ?? 0;
    if ( max <= 0 ) {
      ui.notifications.warn("Foco Defensivo não está disponível (habilidade não desbloqueada).");
      return;
    }
    await this.actor.update({ "system.armorPoints.value": max });
    // Limpa flag legada caso ainda exista (compat).
    if ( this.actor.getFlag("hunter-system", "focoDefensivoAtivo") !== undefined ) {
      await this.actor.unsetFlag("hunter-system", "focoDefensivoAtivo");
    }
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🛡️ <strong>${this.actor.name}</strong> ativou o <strong>Foco Defensivo</strong> — recebe <strong>${max} Pontos de Armadura</strong>!`
    });
  }

  /**
   * Toggle do Estágio de Foco (Ultimato).
   * Ao ativar: deduz 2 PA, registra hook de turno (perde 2 PA + ganha 10 PA gerada).
   * Ao desativar: limpa flag e remove hook.
   */
  async _onToggleEstagioFoco() {
    const tier = this.actor.getFlag("hunter-system", "hatsuActiveTier") ?? "none";
    if ( tier !== "ultimato" ) {
      ui.notifications.warn("Estágio de Foco requer proficiência Ultimato.");
      return;
    }

    const ativo = !!this.actor.getFlag("hunter-system", "hatsuEstagioFocoAtivo");
    if ( !ativo ) {
      // Ativar: custar 2 PA inicial
      const energy = this.actor.system.energy?.total ?? 0;
      if ( energy < 2 ) {
        ui.notifications.warn("PA insuficientes para ativar Estágio de Foco (custa 2 PA).");
        return;
      }
      await this.actor.update({ "system.energy.total": energy - 2 });
      await this.actor.setFlag("hunter-system", "hatsuEstagioFocoAtivo", true);
      _registerEstagioFocoHook(this.actor);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `🔥 <strong>${this.actor.name}</strong> entrou no <strong>Estágio de Foco</strong> (-2 PA).`
      });
    } else {
      await this.actor.setFlag("hunter-system", "hatsuEstagioFocoAtivo", false);
      _unregisterEstagioFocoHook(this.actor);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<strong>${this.actor.name}</strong> saiu do Estágio de Foco.`
      });
    }
  }

  /**
   * Desativa o Foco Defensivo zerando os Pontos de Armadura.
   * Limpa flags legadas: `focoDefensivoTempHpGranted` (PV temp v1) e
   * `focoDefensivoAtivo` (estado v2, agora derivado).
   */
  async _desativarFocoDefensivo({ silent = false } = {}) {
    const updates = { "system.armorPoints.value": 0 };

    // Migração: se a versão antiga deixou PV temp pendurado, restaura.
    const grantedLegacy = this.actor.getFlag("hunter-system", "focoDefensivoTempHpGranted") ?? 0;
    if ( grantedLegacy > 0 ) {
      const currentTemp = this.actor.system.attributes?.hp?.temp ?? 0;
      updates["system.attributes.hp.temp"] = Math.max(0, currentTemp - grantedLegacy);
    }

    await this.actor.update(updates);
    if ( grantedLegacy > 0 ) await this.actor.unsetFlag("hunter-system", "focoDefensivoTempHpGranted");
    if ( this.actor.getFlag("hunter-system", "focoDefensivoAtivo") !== undefined ) {
      await this.actor.unsetFlag("hunter-system", "focoDefensivoAtivo");
    }

    if ( !silent ) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `🛡️ <strong>${this.actor.name}</strong> desativou o <strong>Foco Defensivo</strong>.`
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Desfaz o último treinamento de uma categoria Nen.
   * Desce 1 nível, devolve os PT gastos no nível atual, mantém as reduções de CD acumuladas
   * e desbloqueia em cascata habilidades principais que dependiam do nível desfeito.
   */
  async _onUndoTrainNenCategory(categoryId) {
    const cat = NEN_CATEGORIES_DATA[categoryId];
    if ( !cat ) return;

    const currentLevel = this.actor.system.nenCategories?.[categoryId]?.level ?? 0;
    if ( currentLevel <= 0 ) {
      ui.notifications.warn(`${cat.label} não tem treinamento para desfazer.`);
      return;
    }

    const newLevel = currentLevel - 1;
    const costs = NEN_LEVEL_COSTS[currentLevel];
    const refundPt = costs?.pt ?? 0;

    const spentPtBefore = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
    const updates = {
      [`system.nenCategories.${categoryId}.level`]: newLevel,
      "system.curseResources.spentTrainingPoints": Math.max(0, spentPtBefore - refundPt)
    };

    // Cascata: remove majors cujo nível requerido fica acima do novo nível
    const unlockedMajorMap = this.actor.system.nenCategories?.[categoryId]?.unlockedMajor ?? {};
    const undoneMajors = [];
    let nenMajorCount = this.actor.system.nenMajorCount ?? 0;
    for ( const [reqLvlStr, ability] of Object.entries(cat.major ?? {}) ) {
      const reqLvl = parseInt(reqLvlStr);
      if ( reqLvl > newLevel && unlockedMajorMap[ability.id] ) {
        updates[`system.nenCategories.${categoryId}.unlockedMajor.${ability.id}`] = false;
        if ( !ability.exclusive ) nenMajorCount = Math.max(0, nenMajorCount - 1);
        undoneMajors.push(ability.label);
      }
    }
    updates["system.nenMajorCount"] = nenMajorCount;

    await this.actor.update(updates);

    // Atualiza efeito menor automático para o novo nível (rebaixa ou remove)
    await this._applyNenMinorEffect(categoryId, newLevel);

    ui.notifications.info(`${cat.label}: nível ${currentLevel} → ${newLevel}. ${refundPt} PT devolvidos.`);

    let chatContent = `↩️ <strong>${this.actor.name}</strong> desfez o treinamento de <strong>${cat.label}</strong>: Nível ${currentLevel} → Nível ${newLevel}. ${refundPt} PT devolvidos.`;
    if ( undoneMajors.length ) {
      chatContent += `<br/>⚠️ Habilidades principais removidas em cascata: <strong>${undoneMajors.join(", ")}</strong>.`;
    }
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: chatContent
    });
  }

  /* -------------------------------------------- */

  /**
   * Busca a entrada (princípio ou habilidade) na TREE_DATA, que é quem guarda
   * a referência de compêndio usada para o tooltip/card enriquecido.
   */
  _findTreeEntry(kind, id) {
    const principles = TREE_DATA.flatMap(s => s.principles);
    if ( kind === "principle" ) return principles.find(p => p.id === id);
    return principles.flatMap(p => p.abilities ?? []).find(a => a.id === id);
  }

  /* -------------------------------------------- */

  /**
   * Manda a descrição de um princípio/habilidade de Nen já desbloqueada para o chat,
   * enriquecendo a partir da página de compêndio referenciada quando disponível.
   */
  async _onDisplayNenTooltip({ label, description, reference }) {
    let bodyHtml = "";
    if ( reference ) {
      try {
        const page = await fromUuid(reference);
        const raw = page?.text?.content;
        if ( raw ) bodyHtml = await foundry.applications.ux.TextEditor.implementation.enrichHTML(raw, { relativeTo: page });
      } catch(err) {
        console.warn("Hunter | Falha ao carregar referência de Nen:", err);
      }
    }
    if ( !bodyHtml ) bodyHtml = `<p>${description ?? ""}</p>`;

    const content = `
      <div class="chat-card">
        <section class="card-header description">
          <header class="summary">
            <img class="gold-icon" src="icons/svg/aura.svg" alt="${label}">
            <div class="name-stacked border"><span class="title">${label}</span></div>
          </header>
          <section class="details card-content"><div class="wrapper">${bodyHtml}</div></section>
        </section>
      </div>`;

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content
    });
  }

  /* -------------------------------------------- */

  /**
   * Desbloqueia um princípio Nen (Ten, Zetsu, Ren, etc.)
   */
  async _onUnlockNenPrinciple(principleId) {
    // Usa o preparePrinciples já importado estaticamente
    const principles = preparePrinciples(this.actor);
    const pr = principles[principleId];
    if ( !pr ) return;

    if ( pr.unlocked ) {
      const treePr = this._findTreeEntry("principle", principleId);
      return this._onDisplayNenTooltip({
        label: pr.label,
        description: treePr?.desc ?? pr.description,
        reference: treePr?.reference ?? ""
      });
    }

    const cost = pr.cost ?? 0;
    if ( cost > 0 ) {
      const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;
      if ( cursePoints < cost ) {
        ui.notifications.warn(`PM insuficientes! Precisa de ${cost} PM.`);
        return;
      }
      await this.actor.update({
        [`system.manipulation.principles.${principleId}.unlocked`]: true,
        "system.manipulation.pointsInvested": (this.actor.system.manipulation?.pointsInvested ?? 0) + cost,
        "system.curseResources.cursePoints": cursePoints - cost
      });
    } else {
      // Fundamentais — custo 0
      await this.actor.update({
        [`system.manipulation.principles.${principleId}.unlocked`]: true
      });
    }

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🔓 <strong>${this.actor.name}</strong> desbloqueou o princípio: <strong>${pr.label}</strong>!`
    });

    // Concede técnicas vinculadas ao princípio
    const principleData = PRINCIPLES_DATA[principleId];
    if ( principleData?.techniques?.length ) {
      await this._grantLinkedTechniques(principleData.techniques);
    }
  }

  /* -------------------------------------------- */

  /**
   * Desbloqueia uma habilidade de princípio Nen
   */
  async _onUnlockNenAbility(abilityId) {
    // Usa as funções já importadas estaticamente
    const def = MANIPULATION_ABILITIES[abilityId];
    if ( !def ) return;

    if ( this.actor.system.manipulation?.abilities?.[abilityId]?.unlocked ) {
      const treeAb = this._findTreeEntry("ability", abilityId);
      return this._onDisplayNenTooltip({
        label: def.label,
        description: treeAb?.desc ?? def.description,
        reference: treeAb?.reference ?? ""
      });
    }

    const { can, reason } = canUnlockAbility(abilityId, this.actor);
    if ( !can ) {
      ui.notifications.warn(`Não é possível desbloquear: ${reason}`);
      return;
    }

    const cost = def.cost ?? 0;
    const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;

    await this.actor.update({
      [`system.manipulation.abilities.${abilityId}.unlocked`]: true,
      "system.manipulation.pointsInvested": (this.actor.system.manipulation?.pointsInvested ?? 0) + cost,
      "system.curseResources.cursePoints": Math.max(0, cursePoints - cost)
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🔓 <strong>${this.actor.name}</strong> desbloqueou: <strong>${def.label}</strong>!`
    });

    // Concessão de técnicas vinculadas
    if ( def.techniques?.length ) {
      await this._grantLinkedTechniques(def.techniques);
    }
  }


  /* -------------------------------------------- */

  /**
   * Desfaz um princípio de Nen desbloqueado.
   * Verifica se outros princípios ou habilidades dependem dele antes de permitir.
   */
  async _onUndoNenPrinciple(principleId) {
    const principles = this.actor.system.manipulation?.principles ?? {};
    if ( !principles[principleId]?.unlocked ) return;

    const allPrinciples = TREE_DATA.flatMap(s => s.principles);
    const thisPr = allPrinciples.find(p => p.id === principleId);
    if ( !thisPr ) return;

    const unlockedPrinciples = new Set(
      allPrinciples.filter(p => principles[p.id]?.unlocked).map(p => p.id)
    );
    const unlockedAbilities = new Set(
      Object.entries(this.actor.system.manipulation?.abilities ?? {})
        .filter(([, v]) => v?.unlocked).map(([k]) => k)
    );

    // Princípios que dependem deste (req.pr inclui principleId)
    const blockerPrinciples = allPrinciples.filter(p => {
      if ( !unlockedPrinciples.has(p.id) ) return false;
      return (p.req?.pr ?? []).includes(principleId);
    });

    // Habilidades filhas desbloqueadas
    const blockerAbilities = (thisPr.abilities ?? []).filter(ab => unlockedAbilities.has(ab.id));

    const blockers = [
      ...blockerPrinciples.map(p => p.label),
      ...blockerAbilities.map(ab => ab.label)
    ];

    if ( blockers.length > 0 ) {
      ui.notifications.warn(
        `Não é possível desfazer "${thisPr.label}" — desfaz primeiro: ${blockers.map(b => `"${b}"`).join(", ")}.`
      );
      return;
    }

    const confirmed = await Dialog.confirm({
      title: "Desfazer Princípio",
      content: `<p>Desfazer <strong>${thisPr.label}</strong>?</p>`
        + `<p style="font-size:11px;color:#aaa;margin-top:6px">Os PM gastos serão devolvidos.</p>`,
      yes: () => true, no: () => false
    });
    if ( !confirmed ) return;

    const cost = thisPr.cost ?? 0;
    const updates = {
      [`system.manipulation.principles.${principleId}.unlocked`]: false,
      "system.manipulation.pointsInvested": Math.max(0, (this.actor.system.manipulation?.pointsInvested ?? 0) - cost)
    };
    if ( cost > 0 ) {
      updates["system.curseResources.cursePoints"] =
        (this.actor.system.curseResources?.cursePoints ?? 0) + cost;
    }
    await this.actor.update(updates);

    // Remove técnicas vinculadas ao princípio
    const principleData = PRINCIPLES_DATA[principleId];
    if ( principleData?.techniques?.length ) {
      await this._removeLinkedTechniques(principleData.techniques);
    }

    ui.notifications.info(`Princípio "${thisPr.label}" desfeito.`);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `↩ <strong>${this.actor.name}</strong> desfez o princípio: <strong>${thisPr.label}</strong>.`
    });
  }

  /* -------------------------------------------- */

  /**
   * Desfaz uma habilidade de princípio Nen desbloqueada.
   * Verifica se outras habilidades ou princípios dependem dela antes de permitir.
   */
  async _onUndoNenAbility(abilityId) {
    const abilities = this.actor.system.manipulation?.abilities ?? {};
    if ( !abilities[abilityId]?.unlocked ) return;

    const def = MANIPULATION_ABILITIES[abilityId];
    if ( !def ) return;

    const unlockedAbilities = new Set(
      Object.entries(abilities).filter(([, v]) => v?.unlocked).map(([k]) => k)
    );

    const allPrinciples = TREE_DATA.flatMap(s => s.principles);
    const unlockedPrinciples = new Set(
      allPrinciples
        .filter(p => this.actor.system.manipulation?.principles?.[p.id]?.unlocked)
        .map(p => p.id)
    );

    // Princípios que têm esta habilidade como req.ab
    const blockerPrinciples = allPrinciples.filter(p => {
      if ( !unlockedPrinciples.has(p.id) ) return false;
      return (p.req?.ab ?? []).includes(abilityId);
    });

    // Habilidades que listam esta no seu req[]
    const blockerAbilities = Object.values(MANIPULATION_ABILITIES).filter(ab => {
      if ( !unlockedAbilities.has(ab.id) ) return false;
      return (ab.req ?? []).includes(abilityId);
    });

    const blockers = [
      ...blockerPrinciples.map(p => p.label),
      ...blockerAbilities.map(ab => ab.label)
    ];

    if ( blockers.length > 0 ) {
      ui.notifications.warn(
        `Não é possível desfazer "${def.label}" — desfaz primeiro: ${blockers.map(b => `"${b}"`).join(", ")}.`
      );
      return;
    }

    const confirmed = await Dialog.confirm({
      title: "Desfazer Habilidade",
      content: `<p>Desfazer <strong>${def.label}</strong>?</p>`
        + `<p style="font-size:11px;color:#aaa;margin-top:6px">Os PM gastos serão devolvidos.</p>`,
      yes: () => true, no: () => false
    });
    if ( !confirmed ) return;

    const cost = def.cost ?? 0;
    await this.actor.update({
      [`system.manipulation.abilities.${abilityId}.unlocked`]: false,
      "system.manipulation.pointsInvested": Math.max(0, (this.actor.system.manipulation?.pointsInvested ?? 0) - cost),
      "system.curseResources.cursePoints": (this.actor.system.curseResources?.cursePoints ?? 0) + cost
    });

    ui.notifications.info(`Habilidade "${def.label}" desfeita.`);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `↩ <strong>${this.actor.name}</strong> desfez: <strong>${def.label}</strong>.`
    });
  }


  /* -------------------------------------------- */

  /**
   * Aplica/atualiza o ActiveEffect de habilidade menor ao treinar uma categoria.
   * Chamado após avançar de nível com sucesso.
   */
  async _applyNenMinorEffect(categoryId, newLevel) {
    // Mapa: qual efeito menor cada categoria ganha nos níveis 2, 5, 8
    const MINOR_EFFECTS = {
      aprimorador: {
        label: "Robusto",
        icon: "icons/svg/heart.svg",
        flagId: "nen-robusto",
        getRank: lvl => lvl >= 8 ? 3 : lvl >= 5 ? 2 : lvl >= 2 ? 1 : 0,
        getChanges: rank => [
          { key: "system.attributes.hp.bonuses.overall", mode: 2, value: `${rank} * @details.level`, priority: 20 }
        ]
      },
      emissor: {
        label: "Agilidade Avançada",
        icon: "icons/svg/wing.svg",
        flagId: "nen-agilidade",
        getRank: lvl => lvl >= 8 ? 3 : lvl >= 5 ? 2 : lvl >= 2 ? 1 : 0,
        getChanges: rank => {
          const bonus = rank === 1 ? 5 : rank === 2 ? 10 : 20;
          return [{ key: "system.attributes.movement.walk", mode: 2, value: String(bonus), priority: 20 }];
        }
      },
      transmutador: {
        label: "Aumentar Densidade",
        icon: "icons/svg/shield.svg",
        flagId: "nen-densidade",
        getRank: lvl => lvl >= 8 ? 3 : lvl >= 5 ? 2 : lvl >= 2 ? 1 : 0,
        getChanges: rank => [
          { key: "system.attributes.ac.bonus", mode: 2, value: String(rank), priority: 20 }
        ]
      },
      conjurador: {
        label: "Aura Adaptável",
        icon: "icons/svg/aura.svg",
        flagId: "nen-adaptavel",
        getRank: lvl => lvl >= 8 ? 3 : lvl >= 5 ? 2 : lvl >= 2 ? 1 : 0,
        getChanges: rank => {
          const mult = rank + 2; // 1→3, 2→4, 3→5
          return [{ key: "system.attributes.hp.bonuses.overall", mode: 2, value: `${mult} * @abilities.wis.mod`, priority: 20 }];
        }
      }
    };

    const def = MINOR_EFFECTS[categoryId];
    if ( !def ) return; // Categoria sem efeito menor automático

    const rank = def.getRank(newLevel);
    const existing = this.actor.effects.find(e => e.getFlag("hunter-system", "nenMinor") === def.flagId);

    if ( rank === 0 ) {
      if ( existing ) await existing.delete();
      return;
    }

    const effectData = {
      name: `${def.label} (${"★".repeat(rank)})`,
      icon: def.icon,
      origin: this.actor.uuid,
      disabled: false,
      flags: { "hunter-system": { nenMinor: def.flagId } },
      changes: def.getChanges(rank)
    };

    if ( existing ) {
      await existing.update(effectData);
    } else {
      await ActiveEffect.create(effectData, { parent: this.actor });
    }
  }

  /* -------------------------------------------- */

  /**
   * Clique no card de uma habilidade principal disponível — confirma antes de aprender.
   * A validação de nível/limite/híbrida continua em _onUnlockNenMajor, que roda depois
   * da confirmação (serve de rede de segurança mesmo se o estado do card estiver desatualizado).
   */
  async _onConfirmUnlockNenMajor(categoryId, abilityId, label) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Aprender Habilidade" },
      content: `<p style="margin:0; padding:4px 0; font-size:13px; color:#ccc;">Aprender <strong style="color:#c8a84b;">${foundry.utils.escapeHTML(label ?? "")}</strong>?</p>`,
      yes: { label: "Aprender", default: true },
      no: { label: "Cancelar" }
    });
    if ( !ok ) return;
    return this._onUnlockNenMajor(categoryId, abilityId);
  }

  /* -------------------------------------------- */

  /**
   * Clique com o botão direito no card de uma habilidade principal desbloqueada —
   * confirma antes de desfazer.
   */
  async _onConfirmUndoNenMajor(categoryId, abilityId, label) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Desfazer Habilidade" },
      content: `<p style="margin:0; padding:4px 0; font-size:13px; color:#ccc;">Desfazer <strong style="color:#c8a84b;">${foundry.utils.escapeHTML(label ?? "")}</strong>? O slot será liberado.</p>`,
      yes: { label: "Desfazer", default: true },
      no: { label: "Cancelar" }
    });
    if ( !ok ) return;
    return this._onUndoNenMajor(categoryId, abilityId);
  }

  /* -------------------------------------------- */

  /**
   * Desfaz o desbloqueio de uma habilidade principal, liberando o slot.
   */
  async _onUndoNenMajor(categoryId, abilityId) {
    const alreadyUnlocked = this.actor.system.nenCategories?.[categoryId]?.unlockedMajor?.[abilityId] ?? false;
    if ( !alreadyUnlocked ) return;

    const { NEN_CATEGORIES_DATA: catData } = await Promise.resolve({ NEN_CATEGORIES_DATA });
    const cat = catData[categoryId];
    const ability = Object.values(cat?.major ?? {}).find(ab => ab.id === abilityId);

    await this.actor.update({
      [`system.nenCategories.${categoryId}.unlockedMajor.${abilityId}`]: false,
      "system.nenMajorCount": Math.max(0, (this.actor.system.nenMajorCount ?? 0) - (ability?.exclusive ? 0 : 1))
    });

    ui.notifications.info(`Habilidade "${ability?.label ?? abilityId}" removida. Slot liberado.`);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `↩️ <strong>${this.actor.name}</strong> desfez a habilidade principal: <strong>${ability?.label ?? abilityId}</strong>.`
    });
  }

  /* -------------------------------------------- */

  /**
   * Retorna o máximo de habilidades principais que o personagem pode ter.
   * Base: 4. Sobe para 6 quando todas as categorias atingem o nível máximo permitido
   * pela afinidade da categoria principal (ex: Aprimorador → 10/8/8/6/6/0).
   */
  _getNenMajorMax() {
    const CATEGORIES = ["aprimorador", "emissor", "transmutador", "conjurador", "manipulador", "especialista"];
    const allMax = CATEGORIES.every(id => {
      const max = getMaxLevelForCategory(this.actor, id);
      if ( max <= 0 ) return true; // categoria sem afinidade não bloqueia o avanço
      const lvl = this.actor.system.nenCategories?.[id]?.level ?? 0;
      return lvl >= max;
    });
    return allMax ? 6 : 4;
  }

  /* -------------------------------------------- */

  /**
   * Desbloqueia uma habilidade principal de categoria Nen.
   */
  async _onUnlockNenMajor(categoryId, abilityId) {
    const cat = NEN_CATEGORIES_DATA[categoryId];
    if ( !cat ) return;

    const level = this.actor.system.nenCategories?.[categoryId]?.level ?? 0;
    const abilityEntry = Object.entries(cat.major).find(([, ab]) => ab.id === abilityId);
    if ( !abilityEntry ) return;

    const [requiredLvl, ability] = abilityEntry;
    if ( level < parseInt(requiredLvl) ) {
      ui.notifications.warn(`Nível insuficiente! Precisa de nível ${requiredLvl} em ${cat.label}.`);
      return;
    }

    const nenMajorCount = this.actor.system.nenMajorCount ?? 0;
    const nenMajorMax = this._getNenMajorMax();
    const alreadyUnlocked = this.actor.system.nenCategories?.[categoryId]?.unlockedMajor?.[abilityId] ?? false;

    if ( alreadyUnlocked ) {
      ui.notifications.warn("Essa habilidade já está desbloqueada.");
      return;
    }

    if ( !ability.exclusive && nenMajorCount >= nenMajorMax ) {
      ui.notifications.warn(`Limite de habilidades principais atingido (${nenMajorMax}/${nenMajorMax}).`);
      return;
    }

    // Restrições de Categoria Híbrida
    const hybridKey = this.actor.system.nenHybrid ?? "";
    const hyb = hybridKey ? NEN_HYBRIDS[hybridKey] : null;
    if ( hyb && hyb.categories.includes(categoryId) ) {
      const lvlNum = parseInt(requiredLvl);
      if ( categoryId === "especialista" && lvlNum > hyb.majorLevel ) {
        ui.notifications.warn(`Híbrida ${hyb.label}: de Especialista, só pode pegar a habilidade principal de nível ${hyb.majorLevel}.`);
        return;
      }
      if ( hyb.majorLevel >= 10 && lvlNum === 10 ) {
        let lvl10 = 0;
        for ( const cid of hyb.categories ) {
          const ab10 = NEN_CATEGORIES_DATA[cid]?.major?.[10];
          const um = this.actor.system.nenCategories?.[cid]?.unlockedMajor ?? {};
          if ( ab10 && um[ab10.id] ) lvl10++;
        }
        if ( lvl10 >= 1 ) {
          ui.notifications.warn(`Híbrida ${hyb.label}: só pode escolher UMA habilidade principal de nível 10 entre as duas categorias.`);
          return;
        }
      }
    }

    await this.actor.update({
      [`system.nenCategories.${categoryId}.unlockedMajor.${abilityId}`]: true,
      "system.nenMajorCount": ability.exclusive ? nenMajorCount : nenMajorCount + 1
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🔓 <strong>${this.actor.name}</strong> desbloqueou a habilidade principal: <strong>${ability.label}</strong>!`
    });
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */
  /*  Hatsu Tab                                   */
  /* -------------------------------------------- */

  /**
   * Prepara o contexto da aba Hatsu — 4 slots (inata, m1, m2, m3),
   * cada um com sua manifestação atribuída e técnicas filhas.
   */
  async _prepareHatsuContext(context, options) {
    const SLOTS = [
      { id: "inata", label: "Habilidade Inata",   tecnicasLabel: "Técnicas de Inata" },
      { id: "m1",    label: "1ª Manifestação",    tecnicasLabel: "Técnicas da Manifestação" },
      { id: "m2",    label: "2ª Manifestação",    tecnicasLabel: "Técnicas da Manifestação" },
      { id: "m3",    label: "3ª Manifestação",    tecnicasLabel: "Técnicas da Manifestação" }
    ];

    const CATEGORIES = [
      { id: "aprimorador",  label: "Aprimorador",  color: "#e86800" },
      { id: "emissor",      label: "Emissor",      color: "#B8860B" },
      { id: "transmutador", label: "Transmutador", color: "#9B59D0" },
      { id: "conjurador",   label: "Conjurador",   color: "#3A8FD4" },
      { id: "manipulador",  label: "Manipulador",  color: "#2ECC71" },
      { id: "especialista", label: "Especialista", color: "#AAAAAA" }
    ];

    const allSpells = this.actor.items.filter(i => i.type === "spell");
    const slots = SLOTS.map(def => {
      const manifestacao = allSpells.find(s => s.getFlag("hunter-system", "hatsu.slot") === def.id) ?? null;
      const tecnicas = allSpells
        .filter(s => s.getFlag("hunter-system", "hatsu.parent") === def.id && s !== manifestacao)
        .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

      // Requisitos de categoria (até 6) — armazenados na manifestação
      const rawReqs = manifestacao?.getFlag("hunter-system", "hatsu.requirements") ?? [];
      const manifestacaoId = manifestacao?.id ?? null;
      const mode = manifestacao?.getFlag("hunter-system", "hatsu.mode") ?? "focado";
      const isVersatil = mode === "versatil";
      const requirements = rawReqs.map((req, idx) => {
        const cat = CATEGORIES.find(c => c.id === req.category) ?? CATEGORIES[0];
        const currentLevel = this.actor.system.nenCategories?.[cat.id]?.level ?? 0;
        const met = currentLevel >= (req.level ?? 1);
        return {
          index: idx,
          manifestacaoId,
          category: cat.id,
          categoryLabel: cat.label,
          color: cat.color,
          level: req.level ?? 1,
          currentLevel,
          met
        };
      });
      const unmet = requirements.filter(r => !r.met);
      const blocked = !!manifestacao && unmet.length > 0;
      const blockedReason = blocked
        ? "Faltam: " + unmet.map(r => `${r.categoryLabel} Nv${r.level} (atual: ${r.currentLevel})`).join("; ")
        : "";

      const _spellLite = (s, isBlocked = false) => s ? {
        id: s.id,
        name: s.name,
        img: s.img,
        subtitle: s.system?.school ? CONFIG.DND5E.spellSchools?.[s.system.school]?.label : "",
        blocked: isBlocked,
        grau: s.system?.level ?? 0
      } : null;

      const reqsCols = requirements.length <= 1 ? 1
                     : requirements.length <= 4 ? 2
                     : 3;

      return {
        ...def,
        manifestacao: _spellLite(manifestacao, blocked),
        tecnicas: tecnicas.map(t => _spellLite(t, blocked)),
        requirements,
        reqsCols,
        canAddReq: !!manifestacao && requirements.length < 6,
        blocked,
        blockedReason,
        mode,
        isVersatil
      };
    });

    // Detectar categoria principal (mesma lógica usada na aba Treinamentos)
    const primaryNen = this._getPrimaryNenCategory();
    const primaryCategory = primaryNen?.id ?? null;
    const primaryLevel = primaryNen?.level ?? 0;
    const primaryLabel = primaryNen?.label ?? "—";
    const primaryColor = primaryNen?.color ?? "#828892";

    // Proficiência: calcular tier
    const occupied = slots.filter(s => s.manifestacao);
    const _allCatsAtLeast = (manifSlots, lvl) => {
      if ( !manifSlots.length ) return false;
      for ( const m of manifSlots ) {
        for ( const r of (m.requirements ?? []) ) {
          const cur = this.actor.system.nenCategories?.[r.category]?.level ?? 0;
          if ( cur < lvl ) return false;
        }
      }
      return true;
    };

    const ultimatoUnlocked = !!this.actor.getFlag("hunter-system", "hatsuUltimatoUnlocked");
    const reqUltimato  = primaryLevel >= 10 && occupied.length >= 1 && _allCatsAtLeast(occupied, 6);
    const reqGenial    = primaryLevel >= 7  && occupied.length >= 2 && _allCatsAtLeast(occupied.slice(0, 2), 4);
    const reqExcelente = primaryLevel >= 5  && occupied.length >= 1 && _allCatsAtLeast(occupied.slice(0, 1), 3);
    const reqOtimo     = primaryLevel >= 1  && occupied.length >= 1 && _allCatsAtLeast(occupied.slice(0, 1), 1);

    let tier = "none";
    if ( ultimatoUnlocked && reqUltimato ) tier = "ultimato";
    else if ( reqGenial )                  tier = "genial";
    else if ( reqExcelente )               tier = "excelente";
    else if ( reqOtimo )                   tier = "otimo";

    const TIERS = [
      { id: "otimo",     label: "Ótimo",     mainReq: 1,  catsReq: 1,  manifs: 1,
        benefits: ["Manifestação de Habilidade", "Recuperação Elevada (d4 → d6)"] },
      { id: "excelente", label: "Excelente", mainReq: 5,  catsReq: 3,  manifs: 1,
        benefits: ["+1 Manifestação", "Recuperação Rápida (d6 → d8)", "Aura Fortalecida (+mod em dano/cura)"] },
      { id: "genial",    label: "Genial",    mainReq: 7,  catsReq: 4,  manifs: 2,
        benefits: ["Recuperação Veloz (d8 → d10, +2 dados em descanso)", "Aprimorar Aspecto (+4 PA, máx 30)"] },
      { id: "ultimato",  label: "Ultimato",  mainReq: 10, catsReq: 6,  manifs: "todas",
        benefits: ["+15 PN", "+2 atributo principal", "+3 talentos", "Dano +1 passo (d10 → d12)",
                   "+1 Manifestação", "Recuperação Extrema (d10 → d12, +4 dados em descanso)"] }
    ];

    // Estado de cada tier (alcançado, atual, disponível, bloqueado)
    const tiersState = TIERS.map(t => {
      const reqMet = t.id === "ultimato" ? reqUltimato
                  : t.id === "genial"   ? reqGenial
                  : t.id === "excelente"? reqExcelente
                  : reqOtimo;
      return {
        ...t,
        reqMet,
        isCurrent: tier === t.id,
        // Para Ultimato, separar "reqs cumpridos" de "ativado"
        canActivateUltimato: t.id === "ultimato" && reqMet && !ultimatoUnlocked,
        canDeactivateUltimato: t.id === "ultimato" && ultimatoUnlocked
      };
    });

    const tierLabels = { none: "—", otimo: "Ótimo", excelente: "Excelente", genial: "Genial", ultimato: "Ultimato" };

    // Graus de técnica (0 = Auxiliar, 1-9) — mesma escala já usada no item de spell (system.level).
    const grauOptions = Array.fromRange(10).map(lvl => ({
      value: lvl,
      label: game.i18n.localize(CONFIG.DND5E.spellLevels?.[lvl] ?? String(lvl))
    }));

    context.hatsu = {
      slots,
      categoryOptions: CATEGORIES,
      grauOptions,
      name: this.actor.getFlag("hunter-system", "hatsuName") ?? "",
      proficiencia: {
        id: tier,
        label: tierLabels[tier]
      },
      tiers: tiersState,
      primary: { id: primaryCategory, label: primaryLabel, level: primaryLevel, color: primaryColor },
      isGM: game.user.isGM,
      isEditMode: this.isEditMode
    };

    return context;
  }

  /* -------------------------------------------- */

  async _onHatsuRoll(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    // Bloqueio: requisitos da própria manifestação ou do pai (se for técnica)
    const blocked = this._isHatsuItemBlocked(item);
    if ( blocked ) {
      ui.notifications.warn(`"${item.name}" está bloqueada — ${blocked}`);
      return;
    }
    return item.use({}, { event: window.event });
  }

  /**
   * Verifica se um item de Hatsu (manifestação ou técnica) está bloqueado por
   * requisitos de categoria não atendidos. Retorna a razão do bloqueio (string)
   * ou null se livre.
   */
  _isHatsuItemBlocked(item) {
    if ( !item ) return null;
    const flag = item.getFlag("hunter-system", "hatsu") ?? {};
    let manifestacao = null;
    if ( flag.slot ) {
      manifestacao = item;
    } else if ( flag.parent ) {
      manifestacao = this.actor.items.find(i =>
        i.type === "spell" && i.getFlag("hunter-system", "hatsu.slot") === flag.parent
      ) ?? null;
    }
    if ( !manifestacao ) return null;
    const reqs = manifestacao.getFlag("hunter-system", "hatsu.requirements") ?? [];
    if ( !reqs.length ) return null;
    const unmet = reqs.filter(r => {
      const lvl = this.actor.system.nenCategories?.[r.category]?.level ?? 0;
      return lvl < (r.level ?? 1);
    });
    if ( !unmet.length ) return null;
    const CATS = {
      aprimorador: "Aprimorador", emissor: "Emissor", transmutador: "Transmutador",
      conjurador: "Conjurador",  manipulador: "Manipulador", especialista: "Especialista"
    };
    return "faltam " + unmet.map(r => `${CATS[r.category] ?? r.category} Nv${r.level}`).join(", ");
  }

  async _onHatsuEdit(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    return item.sheet?.render(true);
  }

  /** Manda o card da manifestação/técnica para o chat (descrição). */
  async _onHatsuDisplayCard(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    return item.displayCard();
  }

  /** Troca a imagem da manifestação/técnica via FilePicker (só em modo edição). */
  async _onHatsuChangeImage(itemId) {
    if ( !this.isEditMode ) return;
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    new FP({
      type: "image",
      current: item.img,
      callback: path => item.update({ img: path })
    }).render(true);
  }

  async _onHatsuUnassign(slotId, kind) {
    const target = this.actor.items.find(i =>
      i.type === "spell" && i.getFlag("hunter-system", "hatsu.slot") === slotId
    );
    if ( !target ) return;
    await target.unsetFlag("hunter-system", "hatsu");
    ui.notifications.info(`"${target.name}" removida do slot.`);
  }

  async _onHatsuUnassignTecnica(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    await item.unsetFlag("hunter-system", "hatsu");
    ui.notifications.info(`"${item.name}" removida da lista de técnicas.`);
  }

  async _onHatsuCreateManif(slotId) {
    // Se o slot já tem manifestação, abre ela em vez de criar duplicata
    const existing = this.actor.items.find(i =>
      i.type === "spell" && i.getFlag("hunter-system", "hatsu.slot") === slotId
    );
    if ( existing ) return existing.sheet?.render(true);

    const SLOT_NAMES = {
      inata: "Habilidade Inata",
      m1:    "1ª Manifestação",
      m2:    "2ª Manifestação",
      m3:    "3ª Manifestação"
    };
    const created = await Item.implementation.create([{
      name: SLOT_NAMES[slotId] ?? "Nova Manifestação",
      type: "spell",
      system: { level: 0, method: "atwill" },
      flags: { "hunter-system": { hatsu: { slot: slotId } } }
    }], { parent: this.actor });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
  }

  async _onHatsuCreateTecnica(slotId) {
    const created = await Item.implementation.create([{
      name: "Nova Técnica",
      type: "spell",
      system: { level: 0 },
      flags: { "hunter-system": { hatsu: { parent: slotId } } }
    }], { parent: this.actor });
    const item = Array.isArray(created) ? created[0] : created;
    if ( item ) item.sheet?.render(true);
  }

  async _onHatsuSaveTemplate() {
    const hatsuItems = this.actor.items.filter(i => {
      if ( i.type !== "spell" ) return false;
      const hatsuFlag = i.getFlag("hunter-system", "hatsu");
      return hatsuFlag?.slot || hatsuFlag?.parent;
    });

    if ( !hatsuItems.length ) {
      ui.notifications.warn("Nenhuma manifestação ou técnica encontrada para salvar.");
      return;
    }

    try {
      const hatsuName = this.actor.getFlag("hunter-system", "hatsuName")?.trim();
      const template = await Item.implementation.create({
        name: hatsuName || `${this.actor.name} — Molde Hatsu`,
        type: "hatsuTemplate",
        img: "icons/skills/melee/strike-hammer-destructive-blue.webp"
      });
      if ( !template ) return;

      // Cada manifestação/técnica vira um item real (não um blob de dados), ligado ao molde pela
      // flag hatsuTemplate — assim mantém sheet completa (activities, dano etc.) ao configurar o
      // molde depois, igual a container.mjs faz com `system.container`. Todas ficam no compendium
      // compartilhado de Hatsu (não na lista de Itens do mundo) para não poluir a sidebar.
      const pack = await ensureHatsuPack();
      const folder = await template.system.ensureFolder();
      const itemsData = hatsuItems.map(i => {
        const data = i.toObject();
        delete data._id;
        data.folder = folder?.id;
        foundry.utils.setProperty(data, "flags.hunter-system.hatsuTemplate", template.id);
        return data;
      });
      await Item.implementation.create(itemsData, { pack: pack.metadata.id });

      ui.notifications.info(`Molde "${template.name}" criado com ${itemsData.length} item(ns). Arraste para uma ficha para instalar.`);
    } catch ( err ) {
      console.error(err);
      ui.notifications.error("Não foi possível criar o Molde Hatsu (verifique permissões para criar itens).");
    }
  }

  async _onHatsuInstallTemplate(templateItem) {
    const contents = Array.from(await templateItem.system?.contents ?? []);
    if ( !contents.length ) {
      ui.notifications.warn("Este Molde Hatsu está vazio.");
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Instalar Molde Hatsu" },
      content: `<p>Isso vai adicionar <strong>${contents.length}</strong> item(ns) de Hatsu nesta ficha, substituindo manifestações que já ocupem os mesmos slots. Continuar?</p>`
    });
    if ( !confirmed ) return;

    const itemsData = contents.map(i => {
      const data = i.toObject();
      delete data._id;
      if ( data.flags?.["hunter-system"] ) delete data.flags["hunter-system"].hatsuTemplate;
      return data;
    });

    // Slots de manifestação já ocupados no ator: precisam ser liberados antes de instalar o molde,
    // senão dois itens ficam com a mesma flag hatsu.slot e um deles some da ficha sem ser removido.
    const incomingSlots = new Set(itemsData.map(d => d.flags?.["hunter-system"]?.hatsu?.slot).filter(Boolean));
    for ( const slotId of incomingSlots ) {
      const previous = this.actor.items.find(i =>
        (i.type === "spell") && (i.getFlag("hunter-system", "hatsu.slot") === slotId)
      );
      if ( previous ) await previous.unsetFlag("hunter-system", "hatsu");
    }

    try {
      await Item.implementation.create(itemsData, { parent: this.actor });
      ui.notifications.info(`Hatsu instalado: ${itemsData.length} item(ns) adicionado(s).`);
    } catch ( err ) {
      console.error(err);
      ui.notifications.error("Não foi possível instalar o Molde Hatsu.");
    }
  }

  async _onHatsuReqAdd(itemId) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("hunter-system", "hatsu.requirements") ?? []);
    if ( reqs.length >= 6 ) {
      ui.notifications.warn("Máximo de 6 requisitos por manifestação.");
      return;
    }
    reqs.push({ category: "aprimorador", level: 1 });
    await item.setFlag("hunter-system", "hatsu", {
      ...(item.getFlag("hunter-system", "hatsu") ?? {}),
      requirements: reqs
    });
  }

  async _onHatsuReqRemove(itemId, index) {
    const item = this.actor.items.get(itemId);
    if ( !item || Number.isNaN(index) ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("hunter-system", "hatsu.requirements") ?? []);
    if ( !reqs[index] ) return;
    reqs.splice(index, 1);
    await item.setFlag("hunter-system", "hatsu", {
      ...(item.getFlag("hunter-system", "hatsu") ?? {}),
      requirements: reqs
    });
  }

  /**
   * Alterna uma manifestação entre Focado (modelo atual, requisitos únicos para todas as
   * técnicas) e Versátil (cada técnica ganha seu próprio Grau, além dos requisitos).
   */
  async _onHatsuToggleMode(itemId, mode) {
    const item = this.actor.items.get(itemId);
    if ( !item || !["focado", "versatil"].includes(mode) ) return;
    await item.setFlag("hunter-system", "hatsu", {
      ...(item.getFlag("hunter-system", "hatsu") ?? {}),
      mode
    });
  }

  /** Define o Grau (system.level) de uma técnica em manifestação Versátil. */
  async _onHatsuGrauChange(itemId, rawValue) {
    const item = this.actor.items.get(itemId);
    if ( !item ) return;
    const level = Math.max(0, Math.min(9, parseInt(rawValue) || 0));
    await item.update({ "system.level": level });
  }

  /**
   * Categoria Nen principal do personagem (pela classe, ou maior nível treinado).
   * @returns {{id: string, level: number, color: string, label: string}|null}
   */
  _getPrimaryNenCategory() {
    const catIds = Object.keys(NEN_CATEGORIES_DATA);
    let primaryCategory = null;
    for ( const catId of catIds ) {
      const cls = Object.values(this.actor.classes ?? {}).find(c =>
        c.identifier === catId || c.system?.identifier === catId || c.name?.toLowerCase() === catId
      );
      if ( cls ) { primaryCategory = catId; break; }
    }
    if ( !primaryCategory ) {
      let maxLvl = 0;
      for ( const catId of catIds ) {
        const lvl = this.actor.system?.nenCategories?.[catId]?.level ?? 0;
        if ( lvl > maxLvl ) { maxLvl = lvl; primaryCategory = catId; }
      }
    }
    if ( !primaryCategory ) return null;
    const data = NEN_CATEGORIES_DATA[primaryCategory];
    return {
      id: primaryCategory,
      level: this.actor.system?.nenCategories?.[primaryCategory]?.level ?? 0,
      color: data?.color ?? "#828892",
      label: data?.label ?? primaryCategory
    };
  }

  /* -------------------------------------------- */

  /**
   * Calcula o tier atual de proficiência Hatsu sem depender do contexto da sheet.
   * Retorna "none" | "otimo" | "excelente" | "genial" | "ultimato".
   */
  _calcHatsuTier() {
    const PRIM_CATS = ["aprimorador", "emissor", "transmutador", "conjurador", "manipulador", "especialista"];
    let primaryCategory = null;
    for ( const catId of PRIM_CATS ) {
      const cls = Object.values(this.actor.classes ?? {}).find(c =>
        c.identifier === catId || c.system?.identifier === catId || c.name?.toLowerCase() === catId
      );
      if ( cls ) { primaryCategory = catId; break; }
    }
    if ( !primaryCategory ) {
      let maxLvl = 0;
      for ( const catId of PRIM_CATS ) {
        const lvl = this.actor.system?.nenCategories?.[catId]?.level ?? 0;
        if ( lvl > maxLvl ) { maxLvl = lvl; primaryCategory = catId; }
      }
    }
    const primaryLevel = primaryCategory
      ? this.actor.system.nenCategories?.[primaryCategory]?.level ?? 0
      : 0;

    const SLOTS = ["inata", "m1", "m2", "m3"];
    const occupied = SLOTS.map(id => this.actor.items.find(i =>
      i.type === "spell" && i.getFlag("hunter-system", "hatsu.slot") === id
    )).filter(Boolean);

    const allCatsAtLeast = (manifs, lvl) => {
      if ( !manifs.length ) return false;
      for ( const m of manifs ) {
        const reqs = m.getFlag("hunter-system", "hatsu.requirements") ?? [];
        for ( const r of reqs ) {
          const cur = this.actor.system.nenCategories?.[r.category]?.level ?? 0;
          if ( cur < lvl ) return false;
        }
      }
      return true;
    };

    const ultimatoUnlocked = !!this.actor.getFlag("hunter-system", "hatsuUltimatoUnlocked");
    if ( ultimatoUnlocked && primaryLevel >= 10 && occupied.length >= 1 && allCatsAtLeast(occupied, 6) ) return "ultimato";
    if ( primaryLevel >= 7  && occupied.length >= 2 && allCatsAtLeast(occupied.slice(0, 2), 4) ) return "genial";
    if ( primaryLevel >= 5  && occupied.length >= 1 && allCatsAtLeast(occupied.slice(0, 1), 3) ) return "excelente";
    if ( primaryLevel >= 1  && occupied.length >= 1 && allCatsAtLeast(occupied.slice(0, 1), 1) ) return "otimo";
    return "none";
  }

  /**
   * Sincroniza o Active Effect "Proficiência Hatsu: <tier>" com o tier calculado.
   * Cria/atualiza/remove conforme necessário, evitando loops via flag-cache.
   */
  async _syncHatsuProficiencyEffect() {
    const tier = this._calcHatsuTier();
    const stored = this.actor.getFlag("hunter-system", "hatsuActiveTier") ?? "none";
    if ( tier === stored ) return; // sem mudança, nada a fazer

    const TIER_DATA = {
      otimo:     { label: "Ótimo",     icon: "icons/svg/aura.svg",      auraDie: "d6"  },
      excelente: { label: "Excelente", icon: "icons/svg/upgrade.svg",   auraDie: "d8"  },
      genial:    { label: "Genial",    icon: "icons/svg/sun.svg",       auraDie: "d10" },
      ultimato:  { label: "Ultimato",  icon: "icons/svg/explosion.svg", auraDie: "d12" }
    };

    // Remove qualquer marker existente
    const old = this.actor.effects.filter(e => e.getFlag("hunter-system", "hatsuTierMarker"));
    if ( old.length ) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", old.map(e => e.id));
    }

    // Cria novo se tier !== "none"
    if ( tier !== "none" ) {
      const def = TIER_DATA[tier];
      const changes = [
        // Passo de dado de aura por proficiência
        { key: "system.energyDice.denomination", mode: 5, value: def.auraDie, priority: 20 }
      ];
      await ActiveEffect.implementation.create({
        name: `Proficiência Hatsu: ${def.label}`,
        icon: def.icon,
        flags: {
          "hunter-system": { hatsuTierMarker: true, hatsuProficiencia: tier }
        },
        changes,
        disabled: false,
        transfer: false
      }, { parent: this.actor });
    }

    await this.actor.setFlag("hunter-system", "hatsuActiveTier", tier);
  }

  /**
   * Toggle do pin de um botão de poder no sidebar.
   * Quando "pinned": o bloco aparece também na sidebar.
   * Quando não-pinned: o bloco aparece apenas na aba Effects.
   */
  async _onTogglePinSidebar(pinKey) {
    if ( !pinKey ) return;
    const current = this.actor.getFlag("hunter-system", "pinSidebar") ?? {};
    // default = true (pinned), então inverte sobre o estado atual
    const wasPinned = current[pinKey] !== false;
    const next = { ...current, [pinKey]: !wasPinned };
    await this.actor.setFlag("hunter-system", "pinSidebar", next);
  }

  /**
   * Fixa (ou solta) o HUD flutuante de Sacrifícios/Recursos neste ator, fazendo-o aparecer
   * fora de combate e sem precisar controlar o token — clicar de novo no mesmo ator solta;
   * clicar em outro ator troca a fixação (o HUD é um widget único por cliente).
   */
  async _onToggleSacrificeHud() {
    const FLAG = "sacrificeHudPinnedActorId";
    const current = game.user.getFlag("hunter-system", FLAG);
    await game.user.setFlag("hunter-system", FLAG, current === this.actor.id ? null : this.actor.id);
    renderSacrificeHud();
    this.render();
  }


  async _onHatsuToggleUltimato() {
    if ( !game.user.isGM ) {
      ui.notifications.warn("Apenas o Mestre pode ativar/desativar o Ultimato.");
      return;
    }
    const current = !!this.actor.getFlag("hunter-system", "hatsuUltimatoUnlocked");
    await this.actor.setFlag("hunter-system", "hatsuUltimatoUnlocked", !current);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: !current
        ? `⭐ <strong>${this.actor.name}</strong> alcançou o <strong>Ultimato</strong>!`
        : `<strong>${this.actor.name}</strong> não está mais no Ultimato.`
    });
  }

  async _onHatsuReqChange(itemId, index, field, rawValue) {
    const item = this.actor.items.get(itemId);
    if ( !item || Number.isNaN(index) ) return;
    const reqs = foundry.utils.deepClone(item.getFlag("hunter-system", "hatsu.requirements") ?? []);
    if ( !reqs[index] ) return;
    if ( field === "level" ) {
      const v = Math.max(1, Math.min(10, parseInt(rawValue) || 1));
      reqs[index].level = v;
    } else if ( field === "category" ) {
      reqs[index].category = String(rawValue);
    }
    await item.setFlag("hunter-system", "hatsu", {
      ...(item.getFlag("hunter-system", "hatsu") ?? {}),
      requirements: reqs
    });
  }

  /* -------------------------------------------- */

  async _prepareTrainingsContext(context, options) {
    const CATEGORIES = ["aprimorador", "emissor", "transmutador", "conjurador", "manipulador", "especialista"];
    const LABELS = {
      aprimorador: "Aprimorador",
      emissor: "Emissor",
      transmutador: "Transmutador",
      conjurador: "Conjurador",
      manipulador: "Manipulador",
      especialista: "Especialista"
    };
    const ABBREVS = {
      aprimorador: "APR",
      emissor: "EMI",
      transmutador: "TRA",
      conjurador: "CON",
      manipulador: "MAN",
      especialista: "ESP"
    };
    const KANJIS = {
      aprimorador:  "強", // Kyōka — Aprimoramento
      emissor:      "放", // Hōshutsu — Emissão
      transmutador: "変", // Henka — Transmutação
      conjurador:   "具", // Gugenka — Conjuração
      manipulador:  "操", // Sōsa — Manipulação
      especialista: "特"  // Tokushitsu — Especialização
    };
    const COLORS = {
      aprimorador: "#e86800",
      emissor: "#B8860B",
      transmutador: "#9B59D0",
      conjurador: "#3A8FD4",
      manipulador: "#2ECC71",
      especialista: "#AAAAAA"
    };
    const ICONS = {
      aprimorador:  "systems/hunter-system/assets/Categorias/apri-mini.png",
      emissor:      "systems/hunter-system/assets/Categorias/emi-mini.png",
      transmutador: "systems/hunter-system/assets/Categorias/transmini.png",
      conjurador:   "systems/hunter-system/assets/Categorias/conj-mini.png",
      manipulador:  "systems/hunter-system/assets/Categorias/mani-mini.png",
      especialista: "systems/hunter-system/assets/Categorias/esp-mini.png"
    };

    // Referências compendium para hover das habilidades de categoria
    const NEN_ABILITY_REFS = {
      "robusto_1": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.s0Rq2BmzMI1Pbw2L",
      "robusto_2": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.s0Rq2BmzMI1Pbw2L",
      "robusto_3": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.s0Rq2BmzMI1Pbw2L",
      "ofensivaAprimorada": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.a6Ou5E3jxIMYsZPt",
      "resistenciaAprimorada": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.3vPFbFcuDdpSvwKT",
      "corpoAprimorado": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.C4COzedbI6qyJmXo",
      "agilidadeAvancada_1": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.AqvfUbRRQzpVlHz1",
      "agilidadeAvancada_2": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.AqvfUbRRQzpVlHz1",
      "agilidadeAvancada_3": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.AqvfUbRRQzpVlHz1",
      "emissaoTreinada": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.miXywfeqLSk6hzI6",
      "reabsorcaoDeAura": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.11yZVOrfieCSv8YC",
      "atravessarMateria": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.TYMYMOCH2iZhs9NL",
      "aumentarDensidade_1": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.D784UnTjqTaJZOEh",
      "aumentarDensidade_2": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.D784UnTjqTaJZOEh",
      "aumentarDensidade_3": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.D784UnTjqTaJZOEh",
      "auraTraicoeira": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.VLP7DaQoUH5Gfpu3",
      "transmutacaoSutil": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.gA882swrqxLwqj1N",
      "auraAdaptavel_1": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.GMsFUhiFKbSnPsGJ",
      "auraAdaptavel_2": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.GMsFUhiFKbSnPsGJ",
      "auraAdaptavel_3": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.GMsFUhiFKbSnPsGJ",
      "focoConjurador": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.H7CY8R4LSHeE9D3a",
      "liberacaoConjuradora": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.LzT1Zya0el1kuKRp",
      "mudandoOJogo": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.9GZp3e1EQqsKA3ah",
      "auraControlada_1": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.Z5mDHhz0sVRHsA3B",
      "auraControlada_2": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.Z5mDHhz0sVRHsA3B",
      "auraControlada_3": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.Z5mDHhz0sVRHsA3B",
      "objetoConfigurado": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.UIwMEh5O3pBITCIL",
      "criacaoDeEgo": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.lcaWf7WK3I9lCm8q",
      "comandosAvancados": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.oXF8McpPaneyvSxT",
      "ativacaoEficiente": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.2IhjDc0fKUOtdubM",
      "entendimento": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.EhzWEVQsCbJWY9wB",
      "movimentoEspecializado": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.9KQ2h5wAyBFZ1KrE",
      "períciaTranmutadora": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.IT0QweKyExQmAJGc",
    };

    const nenCategories = [];
    for ( const id of CATEGORIES ) {
      // Lê o nível da classe correspondente no actor
      // Level salvo diretamente no nenCategories (não depende de classe na ficha)
      const level = this.actor.system.nenCategories?.[id]?.level ?? 0;
      const pct = Math.round((level / 10) * 100);
      const dcReductions = this.actor.system.nenCategories?.[id]?.dcReductions ?? {};
      // Um booleano por nível (1-10) — vira a barra de progresso segmentada no template
      const levelSegments = Array.from({ length: 10 }, (_, i) => i < level);

      nenCategories.push({
        id,
        label: LABELS[id],
        abbrev: ABBREVS[id],
        kanji: KANJIS[id],
        color: COLORS[id],
        icon: ICONS[id],
        level,
        pct,
        levelSegments,
        dcReductions
      });
    }

    // Calcular pontos do polígono SVG para o hexágono
    // As 6 categorias na ordem dos vértices (topo, direita-topo, direita-baixo, baixo, esquerda-baixo, esquerda-topo)
    const ORDER = ["aprimorador", "transmutador", "conjurador", "especialista", "manipulador", "emissor"];
    const CX = 160, CY = 160, MAX_R = 125;
    const hexPts = ORDER.map((id, i) => {
      const cat = nenCategories.find(c => c.id === id);
      const r = MAX_R * ((cat?.level ?? 0) / 10);
      const angle = (Math.PI / 180) * (60 * i - 90);
      return `${(CX + r * Math.cos(angle)).toFixed(1)},${(CY + r * Math.sin(angle)).toFixed(1)}`;
    }).join(" ");

    // Pontos do grid (anéis de referência) para cada nível
    const gridRings = [2, 4, 6, 8, 10].map(lvl => {
      const r = MAX_R * (lvl / 10);
      return Array.from({length: 6}, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i - 90);
        return `${(CX + r * Math.cos(angle)).toFixed(1)},${(CY + r * Math.sin(angle)).toFixed(1)}`;
      }).join(" ");
    });

    // Eixos (linha do centro a cada vértice máximo)
    const axes = ORDER.map((_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 90);
      return {
        x2: (CX + MAX_R * Math.cos(angle)).toFixed(1),
        y2: (CY + MAX_R * Math.sin(angle)).toFixed(1)
      };
    });

    // Labels posicionados fora dos vértices
    const LABEL_R = 128;
    const labels = ORDER.map((id, i) => {
      const cat = nenCategories.find(c => c.id === id);
      const angle = (Math.PI / 180) * (60 * i - 90);
      const ly = (CY + LABEL_R * Math.sin(angle));
      return {
        ...cat,
        lx: (CX + LABEL_R * Math.cos(angle)).toFixed(1),
        ly: ly.toFixed(1),
        ly2: (ly + 13).toFixed(1)
      };
    });

    // Pips pré-calculados para cada categoria (array de 10 booleans)
    for ( const cat of nenCategories ) {
      cat.pips = Array.from({length: 10}, (_, i) => ({ filled: i < cat.level, n: i + 1 }));
    }

    // Adicionar habilidades menores e principais ao contexto
    const nenMajorCount = this.actor.system.nenMajorCount ?? 0;
    const nenMajorMax = this._getNenMajorMax();

    // Categoria Híbrida (restrições de habilidade principal)
    const hybridKey = this.actor.system.nenHybrid ?? "";
    const hyb = hybridKey ? NEN_HYBRIDS[hybridKey] : null;
    // Quantas habilidades principais de nível 10 já estão desbloqueadas entre as
    // duas categorias da híbrida (regra "só uma de nível 10").
    let hybLvl10Unlocked = 0;
    if ( hyb ) {
      for ( const cid of hyb.categories ) {
        const ab10 = NEN_CATEGORIES_DATA[cid]?.major?.[10];
        const um = this.actor.system.nenCategories?.[cid]?.unlockedMajor ?? {};
        if ( ab10 && um[ab10.id] ) hybLvl10Unlocked++;
      }
    }

    // Entendimento (Especialista Nv6): treinar qualquer outra categoria em um nível abaixo
    // do nível de Especialista custa metade do PT (arredondado para cima) — refletido aqui
    // para o pill de custo já mostrar o valor real cobrado, igual ao usado em _onTrainNenCategory.
    const especialistaLevel = this.actor.system.nenCategories?.especialista?.level ?? 0;
    const hasEntendimento = !!this.actor.system.nenCategories?.especialista?.unlockedMajor?.entendimento;

    for ( const cat of nenCategories ) {
      const unlockedMajorMap = this.actor.system.nenCategories?.[cat.id]?.unlockedMajor ?? {};

      // Próximo nível, custos e limite de afinidade
      const maxAllowed = getMaxLevelForCategory(this.actor, cat.id);
      const nextLevel = cat.level + 1;
      cat.maxAllowed = maxAllowed;
      cat.affinityPct = maxAllowed >= 10 ? 100 : maxAllowed >= 8 ? 80 : maxAllowed >= 6 ? 60 : maxAllowed >= 4 ? 40 : maxAllowed >= 1 ? 1 : 0;

      if ( nextLevel <= 10 && nextLevel <= maxAllowed ) {
        const costs = NEN_LEVEL_COSTS[nextLevel];
        const dcReduction = this.actor.system.nenCategories?.[cat.id]?.dcReductions?.[nextLevel] ?? 0;
        const entendimentoApplies = hasEntendimento && (cat.id !== "especialista") && (nextLevel < especialistaLevel);
        cat.nextLevel = nextLevel;
        cat.nextPt = entendimentoApplies ? Math.ceil(costs.pt / 2) : costs.pt;
        cat.nextPa = costs.pa;
        cat.currentDC = Math.max(1, costs.cd - dcReduction);
        cat.canTrain = true;
        cat.entendimentoDiscount = entendimentoApplies;
      } else if ( maxAllowed === 0 ) {
        cat.canTrain = false;
        cat.blockedReason = "Sem afinidade";
      } else if ( cat.level >= maxAllowed ) {
        cat.canTrain = false;
        cat.blockedReason = `Máx. ${maxAllowed} (${cat.affinityPct}%)`;
      } else {
        cat.canTrain = false;
      }

      // Menores: slots fixos nos níveis 2, 5, 8 — acesos se nível atingido
      const catData = NEN_CATEGORIES_DATA[cat.id];
      cat.minorSlots = [2, 5, 8].map(lvl => {
        const ab = catData?.minor?.[lvl];
        const reached = cat.level >= lvl;
        if ( !ab ) return { reached: false, level: lvl, empty: true, color: cat.color };
        return { ...ab, reached, level: lvl, color: cat.color, reference: NEN_ABILITY_REFS[ab.id] ?? "" };
      });

      // Principais: slots fixos nos níveis 3, 6, 10
      cat.majorSlots = [3, 6, 10].map(lvl => {
        const ab = catData?.major?.[lvl];
        const reached = cat.level >= lvl;
        if ( !ab ) return { reached: false, level: lvl, empty: true, categoryId: cat.id, color: cat.color };
        const unlocked = unlockedMajorMap[ab.id] ?? false;
        let canUnlock = reached && !unlocked && (nenMajorCount < nenMajorMax || ab.exclusive);
        // Restrições de Categoria Híbrida (só nas categorias da híbrida)
        if ( hyb && hyb.categories.includes(cat.id) ) {
          // Especialista híbrido: só a principal até majorLevel (ex: 3) na 2ª categoria
          if ( cat.id === "especialista" && lvl > hyb.majorLevel ) canUnlock = false;
          // Normais: só UMA principal de nível 10 entre as duas categorias
          if ( hyb.majorLevel >= 10 && lvl === 10 && !unlocked && hybLvl10Unlocked >= 1 ) canUnlock = false;
        }
        // categoryId e color pré-calculados para evitar {{../cat.id}}/{{../cat.color}} no HBS
        // (parâmetros de bloco de {{#each}} aninhados não resolvem via ../ de forma confiável)
        return { ...ab, reached, unlocked, canUnlock, level: lvl, categoryId: cat.id, color: cat.color, reference: NEN_ABILITY_REFS[ab.id] ?? "" };
      });
    }

    // Detectar categoria principal para colorir o fill do hexagono
    const PRIM_CATS = ["aprimorador", "emissor", "transmutador", "conjurador", "manipulador", "especialista"];
    let nenPrimaryCategory = null;
    for ( const catId of PRIM_CATS ) {
      const cls = Object.values(this.actor.classes ?? {}).find(c =>
        c.identifier === catId || c.system?.identifier === catId || c.name?.toLowerCase() === catId
      );
      if ( cls ) { nenPrimaryCategory = catId; break; }
    }
    if ( !nenPrimaryCategory ) {
      let maxLvl = 0;
      for ( const catId of PRIM_CATS ) {
        const lvl = this.actor.system?.nenCategories?.[catId]?.level ?? 0;
        if ( lvl > maxLvl ) { maxLvl = lvl; nenPrimaryCategory = catId; }
      }
    }
    const nenPrimaryColor = COLORS[nenPrimaryCategory] ?? "#c8a84b";

    context.nenCategories = nenCategories;
    context.nenMajorCount = nenMajorCount;
    context.nenMajorMax = nenMajorMax;
    context.nenHexPoints = hexPts;
    context.nenTrainingPoints = this.actor.system.curseResources?.trainingPoints ?? 0;
    context.nenLostTrainingPoints = this.actor.system.curseResources?.lostTrainingPoints ?? 0;
    context.nenNarratorTrainingPoints = this.actor.system.curseResources?.narratorTrainingPoints ?? 0;
    context.nenSpentTrainingPoints = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
    context.nenAvailableTrainingPoints = getAvailableTrainingPoints(this.actor);
    context.nenGridRings = gridRings;
    context.nenAxes = axes;
    context.nenLabels = labels;
    // Perímetro do hexágono ligando os 6 nós das categorias (moldura forte)
    context.nenOuterPoints = labels.map(l => `${l.lx},${l.ly}`).join(" ");
    context.nenPrimaryCategory = nenPrimaryCategory;
    context.nenPrimaryColor = nenPrimaryColor;

    // ── Categoria Híbrida (Narrador) ──
    const isGM = game.user.isGM;
    context.isGM = isGM;
    const hybridOptionKeys = NEN_HYBRID_OPTIONS_BY_PRIMARY[nenPrimaryCategory] ?? [];
    const primaryLabel = NEN_CATEGORIES_DATA[nenPrimaryCategory]?.label ?? "—";
    context.nenHybridKey = hybridKey;
    context.nenHybridRevealed = !!this.actor.system.nenHybridRevealed;
    context.nenHybridLabel = hyb?.label ?? "";
    // Só faz sentido oferecer híbrida se a principal tiver opções (Especialista não tem).
    context.nenHybridCanHave = !!nenPrimaryCategory && hybridOptionKeys.length > 0;
    context.nenHybridOptions = [
      { value: "", label: primaryLabel, selected: !hybridKey },
      ...hybridOptionKeys.map(k => ({ value: k, label: NEN_HYBRIDS[k].label, selected: hybridKey === k }))
    ];
    // Jogador só vê o rótulo se o Narrador revelou.
    context.nenHybridShowPlayer = !!hybridKey && context.nenHybridRevealed;

    // ── Treinar Atributo ──
    // Custo: 3 PT por +1 até 18; 6 PT por +1 entre 18 e 20. Cap em 20.
    const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"];
    const ABILITY_ABBR = { str: "FOR", dex: "AGI", con: "CON", int: "ESP", wis: "SAB", cha: "PRE" };
    const trainingPts = context.nenAvailableTrainingPoints;
    const _nextCost = v => v >= 20 ? Infinity : (v >= 18 ? 6 : 3);
    const selectedAttr = this._selectedAttrToTrain ?? null;
    context.attributeTraining = {
      pt: trainingPts,
      abilities: ABILITY_ORDER.map(id => {
        const value = this.actor.system.abilities?.[id]?.value ?? 10;
        const cost  = _nextCost(value);
        return {
          id,
          abbr:     ABILITY_ABBR[id],
          value,
          cost:     Number.isFinite(cost) ? cost : null,
          maxed:    value >= 20,
          canTrain: value < 20 && trainingPts >= cost,
          selected: id === selectedAttr
        };
      })
    };

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClickAction(event, target) {
  // Bloqueia disparo em botões não-primários (right/middle click).
  // Teclado (Enter/Space) chega como event.button === 0 ou undefined em PointerEvent.
  if ( event?.button > 0 ) return;

  const action = target.dataset.action;

  if ( action === "unlockManipulation" ) {
    return this._onUnlockManipulationAbility(target.dataset.ability, parseInt(target.dataset.cost ?? 0));
  }

  if ( action === "intensiveTraining" ) {
    return this._onIntensiveTraining();
  }
  if ( action === "undoIntensiveTraining" ) {
    return this._onUndoIntensiveTraining(target.dataset.field);
  }
  if ( action === "removeBioItem" ) {
    return this._onRemoveBioItem(target.dataset.itemId);
  }
  if ( action === "toggleSection" ) {
    return this._onToggleSection(target.dataset.section);
  }
  // unlockNenMajor/undoNenMajor NÃO têm mais um case aqui de propósito — o card inteiro
  // carrega esses data-action agora (sem botão dedicado), e o clique/clique-direito é
  // tratado só pelo listener manual em _onRender (com confirmação via DialogV2). Um case
  // aqui faria o clique esquerdo do Foundry (dispatch nativo por data-action) desfazer/
  // aprender direto, sem confirmação, antes mesmo do listener manual entrar em ação.
  if ( action === "unlockNenPrinciple" ) {
    return this._onUnlockNenPrinciple(target.dataset.id);
  }
  if ( action === "unlockNenAbility" ) {
    return this._onUnlockNenAbility(target.dataset.id);
  }
  if ( action === "undoNenPrinciple" ) {
    return this._onUndoNenPrinciple(target.dataset.id);
  }
  if ( action === "undoNenAbility" ) {
    return this._onUndoNenAbility(target.dataset.id);
  }
  if ( action === "trainNenCategory" ) {
    return this._onTrainNenCategory(target.dataset.category);
  }
  if ( action === "selectAttributeToTrain" ) {
    return this._onSelectAttributeToTrain(target.dataset.ability);
  }
  if ( action === "trainAttribute" ) {
    return this._onTrainAttribute();
  }
  if ( action === "hatsu-roll" )            return this._onHatsuRoll(target.dataset.itemId);
  if ( action === "hatsu-edit" )            return this._onHatsuEdit(target.dataset.itemId);
  if ( action === "hatsu-display-card" )    return this._onHatsuDisplayCard(target.dataset.itemId);
  if ( action === "hatsu-change-image" )    return this._onHatsuChangeImage(target.dataset.itemId);
  if ( action === "hatsu-unassign-manif" )  return this._onHatsuUnassign(target.dataset.slot, "manif");
  if ( action === "hatsu-unassign-tecnica" )return this._onHatsuUnassignTecnica(target.dataset.itemId);
  if ( action === "hatsu-create-manif" )    return this._onHatsuCreateManif(target.dataset.slot);
  if ( action === "hatsu-create-tecnica" )  return this._onHatsuCreateTecnica(target.dataset.slot);
  if ( action === "hatsu-req-add" )         return this._onHatsuReqAdd(target.dataset.itemId);
  if ( action === "hatsu-req-remove" )      return this._onHatsuReqRemove(target.dataset.itemId, parseInt(target.dataset.index));
  if ( action === "hatsu-toggle-mode" )     return this._onHatsuToggleMode(target.dataset.itemId, target.dataset.mode);
  if ( action === "hatsu-toggle-ultimato" ) return this._onHatsuToggleUltimato();
  if ( action === "hatsu-save-template" )   return this._onHatsuSaveTemplate();
  if ( action === "jj-toggle-pin" )         return this._onTogglePinSidebar(target.dataset.pin);
  if ( action === "jj-toggle-sacrifice-hud" ) return this._onToggleSacrificeHud();

  return super._onClickAction(event, target);
}

  /* -------------------------------------------- */

  /**
   * Colapsa ou expande uma seção da aba Features, persistindo o estado no localStorage.
   */
  _onToggleSection(sectionId) {
    const storageKey = `hunter-system.features.collapsed.${this.actor.id}`;
    let collapsed;
    try { collapsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); }
    catch { collapsed = []; }

    // O wrapper .section-accordion é pai de header e content
    const wrapper = this.element.querySelector(`.section-accordion[data-section-id="${sectionId}"]`);
    if ( !wrapper ) return;

    const isCollapsed = wrapper.classList.toggle("collapsed");
    const accordionContent = wrapper.querySelector(".accordion-content");

    if ( accordionContent ) {
      if ( isCollapsed ) {
        accordionContent.style.height = accordionContent.scrollHeight + "px";
        requestAnimationFrame(() => { accordionContent.style.height = "0px"; });
      } else {
        accordionContent.style.height = accordionContent.scrollHeight + "px";
        accordionContent.addEventListener("transitionend", () => { accordionContent.style.height = ""; }, { once: true });
      }
    }

    const idx = collapsed.indexOf(sectionId);
    if ( isCollapsed && idx === -1 ) collapsed.push(sectionId);
    else if ( !isCollapsed && idx !== -1 ) collapsed.splice(idx, 1);
    localStorage.setItem(storageKey, JSON.stringify(collapsed));
  }

  /* -------------------------------------------- */

  /**
   * Restaura o estado colapsado das seções da aba Features ao renderizar a ficha.
   */
  _restoreCollapsedSections() {
    const storageKey = `hunter-system.features.collapsed.${this.actor.id}`;
    let collapsed;
    try { collapsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); }
    catch { collapsed = []; }

    for ( const sectionId of collapsed ) {
      const wrapper = this.element.querySelector(`.section-accordion[data-section-id="${sectionId}"]`);
      if ( !wrapper ) continue;
      wrapper.classList.add("collapsed");
      const accordionContent = wrapper.querySelector(".accordion-content");
      if ( accordionContent ) accordionContent.style.height = "0px";
    }
  }

  /* -------------------------------------------- */

  /**
   * Desbloqueia uma habilidade de manipulação, deduzindo os PM e registrando.
   */
  async _onUnlockManipulationAbility(abilityId, cost) {
    const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;
    if ( cursePoints < cost ) {
      ui.notifications.warn(`PM insuficientes! Você tem ${cursePoints} PM, precisa de ${cost}.`);
      return;
    }

    const currentInvested = this.actor.system.manipulation?.pointsInvested ?? 0;

    // Buscar técnicas vinculadas do compêndio e adicioná-las ao ator
    const { MANIPULATION_ABILITIES } = await import("../../systems/manipulation-data.mjs");
    const abilityDef = MANIPULATION_ABILITIES[abilityId];
    if ( abilityDef?.techniques?.length ) {
      await this._grantLinkedTechniques(abilityDef.techniques);
    }

    await this.actor.update({
      [`system.manipulation.abilities.${abilityId}.unlocked`]: true,
      "system.manipulation.pointsInvested": currentInvested + cost,
      "system.curseResources.cursePoints": cursePoints - cost
    });

    ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  content: `<strong>${this.actor.name}</strong> desbloqueou a habilidade de manipulação: <strong>${abilityDef?.label ?? abilityId}</strong>!`
});
  }

  /* -------------------------------------------- */

  /** Adiciona um talento/defeito do compêndio à ficha (seletor da aba Biografia).
      Se o item tem advancement, roda o fluxo do dnd5e (aplica grants e pergunta escolhas). */
  async _onAddBioItem(uuid, kind) {
    if ( !uuid ) return;
    try {
      const doc = await fromUuid(uuid);
      if ( !doc ) return ui.notifications.warn("Item não encontrado no compêndio.");
      const obj = doc.toObject();
      delete obj._id;
      foundry.utils.setProperty(obj, "flags.hunter-system.bioKind", kind);

      // Com advancement (proficiências, grants, escolhas) → abre o AdvancementManager, igual a
      // arrastar o item pra ficha: aplica os grants e pergunta as escolhas. Sem advancement, o
      // create direto já basta (os Active Effects vêm no toObject e são transferidos ao ator).
      const hasAdv = (obj.system?.advancement?.length ?? 0) > 0;
      if ( hasAdv && !game.settings.get("hunter-system", "disableAdvancements") ) {
        const manager = AdvancementManager.forNewItem(this.actor, obj);
        if ( manager.steps.length ) return manager.render({ force: true });
      }
      await this.actor.createEmbeddedDocuments("Item", [obj]);
    } catch(err) {
      console.error("HunterSheet | falha ao adicionar talento/defeito na Biografia:", err);
      ui.notifications.error("Falha ao adicionar o item — veja o console (F12).");
    }
  }

  /** Remove um talento/defeito da ficha (× no card do seletor da Biografia). */
  async _onRemoveBioItem(itemId) {
    await this.actor.items.get(itemId)?.delete();
  }

  /* -------------------------------------------- */

  /**
   * Abre o dialog de Treinamento Intenso para escolher a opção de melhoria.
   */
  async _onIntensiveTraining() {
    const actor = this.actor;
    const it = actor.system.energy?.intensiveTraining ?? {};
    const cursePoints = actor.system.curseResources?.cursePoints ?? 0;
    const generatedAtLimit = (it.generatedEnergy ?? 0) >= 20;

    const currentMaxPA = actor.system.energy?.max ?? 0;
    const currentGeneratedBonus = it.generatedEnergy ?? 0;

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: "⚔️ Treinamento Intenso — Evolução na Prática" },
      content: `
        <div style="padding:4px 0; font-size:13px; color:#ccc; line-height:1.5;">
          <p style="margin:0 0 10px; font-size:12px; color:#aaa;">
            Escolha o benefício do seu <strong>Treinamento Intenso (10 dias)</strong>:
          </p>
          <div style="display:flex; flex-direction:column; gap:6px;">

            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                          background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                          cursor:pointer;">
              <input type="radio" name="jj-training-choice" value="maxEnergy" style="flex:0 0 auto;">
              <div>
                <strong style="color:#c0a0ff;">↑ PA Máximo +5</strong>
                <div style="font-size:11px; color:#8080a0;">Atual: ${currentMaxPA} → ${currentMaxPA + 5} (treino ${(it.maxEnergy ?? 0) + 1})</div>
              </div>
            </label>

            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                          background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                          cursor:pointer; ${generatedAtLimit ? "opacity:0.4;" : ""}">
              <input type="radio" name="jj-training-choice" value="generatedEnergy"
                     ${generatedAtLimit ? "disabled" : ""} style="flex:0 0 auto;">
              <div>
                <strong style="color:#60c0ff;">⚡ PA Gerada +1/turno</strong>
                <div style="font-size:11px; color:#8080a0;">
                  ${generatedAtLimit
                    ? "⛔ Limite atingido (20 treinos)"
                    : `Treinos: ${currentGeneratedBonus}/20 — bônus de +${currentGeneratedBonus} → +${currentGeneratedBonus + 1} por turno`}
                </div>
              </div>
            </label>

            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                          background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                          cursor:pointer;">
              <input type="radio" name="jj-training-choice" value="cursePoints" style="flex:0 0 auto;">
              <div>
                <strong style="color:#ffa060;">💀 Pontos de Nen +4</strong>
                <div style="font-size:11px; color:#8080a0;">Atual: ${cursePoints} PM → ${cursePoints + 4} PM</div>
              </div>
            </label>

          </div>
          <label style="display:flex; align-items:center; gap:8px; margin-top:12px; font-size:12px; color:#ccc;">
            <span>Repetir este treino</span>
            <input type="number" name="jj-training-times" value="1" min="1" max="99"
                   style="width:64px; text-align:center; background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px; color:#fff; padding:4px;">
            <span style="color:#8080a0;">vez(es) — pra montar personagem de nível alto de uma vez</span>
          </label>
          <p style="margin:10px 0 0; font-size:11px; color:#6060a0;">
            ⚠️ Treino de <em>PA Gerada</em> requer 10 dias de espera antes de repetir.
          </p>
        </div>`,
      buttons: [
        {
          label: "Confirmar Treinamento",
          action: "ok",
          default: true,
          callback: (event, button, dialog) => {
            const root = dialog.element ?? document;
            const selected = root.querySelector("input[name='jj-training-choice']:checked");
            if ( !selected ) return null;
            const times = Math.max(1, Math.min(99, Math.floor(Number(root.querySelector("input[name='jj-training-times']")?.value) || 1)));
            return { mode: selected.value, times };
          }
        },
        {
          label: "Cancelar",
          action: "cancel",
          callback: () => null
        }
      ],
      rejectClose: false,
      close: () => null
    });

    if ( !choice ) return;
    const { mode, times } = choice;

    const it2 = actor.system.energy?.intensiveTraining ?? {};

    const updates = {};
    let chatMsg = "";

    if ( mode === "maxEnergy" ) {
      // intensiveTraining.maxEnergy é um CONTADOR de treinos — character.mjs faz (contador * 5)
      const novoContador = (it2.maxEnergy ?? 0) + times;
      updates["system.energy.intensiveTraining.maxEnergy"] = novoContador;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou <strong>${times}</strong> Treinamento(s) Intenso(s)! <strong>PA Máximo +${5 * times}</strong> (${novoContador} treino(s) = +${novoContador * 5} PA Máx total de treino).`;
    } else if ( mode === "generatedEnergy" ) {
      // Contador com teto de 20 — aplica só o que couber.
      const atual = it2.generatedEnergy ?? 0;
      if ( atual >= 20 ) {
        ui.notifications.warn("Limite de treinos de PA Gerada atingido (20 vezes).");
        return;
      }
      const novoContador = Math.min(20, atual + times);
      const aplicados = novoContador - atual;
      updates["system.energy.intensiveTraining.generatedEnergy"] = novoContador;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou <strong>${aplicados}</strong> Treinamento(s) Intenso(s)! <strong>PA Gerada +${aplicados}</strong> por turno (treino ${novoContador}/20).`;
      if ( aplicados < times ) ui.notifications.warn(`Só ${aplicados} treino(s) de PA Gerada couberam (limite de 20).`);
    } else if ( mode === "cursePoints" ) {
      const current = actor.system.curseResources?.cursePoints ?? 0;
      updates["system.curseResources.cursePoints"] = current + 4 * times;
      updates["system.energy.intensiveTraining.cursePoints"] = (it2.cursePoints ?? 0) + 4 * times;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou <strong>${times}</strong> Treinamento(s) Intenso(s)! <strong>+${4 * times} Pontos de Nen</strong> (total: ${current + 4 * times} PM).`;
    }

    await actor.update(updates);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: chatMsg
    });

    ui.notifications.info("Treinamento(s) Intenso(s) concluído(s)!");
  }

  /* -------------------------------------------- */

  /**
   * Desfaz o último registro de treinamento intensivo no campo indicado.
   * @param {"maxEnergy"|"generatedEnergy"|"cursePoints"} field
   */
  async _onUndoIntensiveTraining(field) {
    const actor = this.actor;
    const it = actor.system.energy?.intensiveTraining ?? {};

    const FIELD_CONFIG = {
      maxEnergy: {
        label: "PA Máximo",
        amount: 1,
        undo: (it) => ({
          "system.energy.intensiveTraining.maxEnergy": Math.max(0, (it.maxEnergy ?? 0) - 1)
        })
      },
      generatedEnergy: {
        label: "PA Gerada",
        amount: 1,
        undo: (it) => ({
          "system.energy.intensiveTraining.generatedEnergy": Math.max(0, (it.generatedEnergy ?? 0) - 1)
        })
      },
      cursePoints: {
        label: "Pontos de Nen",
        amount: 4,
        undo: (it) => ({
          "system.curseResources.cursePoints": Math.max(0, (actor.system.curseResources?.cursePoints ?? 0) - 4),
          "system.energy.intensiveTraining.cursePoints": Math.max(0, (it.cursePoints ?? 0) - 4)
        })
      }
    };

    const config = FIELD_CONFIG[field];
    if ( !config ) return;

    const currentCount = it[field] ?? 0;
    if ( currentCount <= 0 ) {
      ui.notifications.warn(`Não há treinos de ${config.label} para desfazer.`);
      return;
    }

    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: "↩️ Desfazer Treinamento" },
      content: `<p>Desfazer o último treino de <strong>${config.label}</strong>?<br>
                <span style="font-size:12px;color:#aaa;">Isso reverterá o bônus de <strong>-${config.amount}</strong>.</span></p>`,
      yes: { label: "Desfazer" },
      no: { label: "Cancelar" }
    });
    if ( !confirm ) return;

    const updates = config.undo(it);
    await actor.update(updates);

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `↩️ <strong>${actor.name}</strong> desfez um Treinamento de <strong>${config.label}</strong> (-${config.amount}).`
    });

    ui.notifications.info(`Treinamento de ${config.label} desfeito.`);
  }

  /* -------------------------------------------- */

  /**
   * Tenta conceder automaticamente técnicas vinculadas a partir do compêndio.
   */
  async _grantLinkedTechniques(techniqueNames) {
    const itemPacks = game.packs.filter(p => p.metadata.type === "Item" && p.metadata.system === "hunter-system");
    for ( const name of techniqueNames ) {
      if ( this.actor.items.find(i => i.name === name) ) continue;
      let item = null;
      for ( const pack of itemPacks ) {
        await pack.getIndex();
        const entry = pack.index.find(i => i.name === name);
        if ( !entry ) continue;
        item = await pack.getDocument(entry._id);
        if ( item ) break;
      }
      if ( !item ) continue;
      await this.actor.createEmbeddedDocuments("Item", [item.toObject()]);
      ui.notifications.info(`Técnica "${name}" adicionada automaticamente.`);
    }
  }

  /* -------------------------------------------- */

  async _removeLinkedTechniques(techniqueNames) {
    for ( const name of techniqueNames ) {
      const item = this.actor.items.find(i => i.name === name);
      if ( !item ) continue;
      await item.delete();
      ui.notifications.info(`Técnica "${name}" removida.`);
    }
  }

  /* -------------------------------------------- */

/**
 * Context menu para habilidades de manipulação (botão direito)
 */
_getManipulationContextOptions() {
  return [
    {
      name: "Desfazer",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const abilityId = element.dataset.abilityId;
        return this.actor.system.manipulation?.abilities?.[abilityId]?.unlocked === true;
      },
      callback: element => {
        const abilityId = element.dataset.abilityId;
        this._onUndoManipulationAbility(abilityId);
      }
    }
  ];
}

/* -------------------------------------------- */

/* -------------------------------------------- */

/**
 * Context menu para habilidades de manipulação (botão direito)
 */
_getManipulationContextOptions() {
  return [
    {
      name: "Desfazer",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const abilityId = element.dataset.abilityId;
        return this.actor.system.manipulation?.abilities?.[abilityId]?.unlocked === true;
      },
      callback: element => {
        const abilityId = element.dataset.abilityId;
        this._onUndoManipulationAbility(abilityId);
      }
    }
  ];
}

/* -------------------------------------------- */

/**
 * Context menu para treinamentos (botão direito)
 */
_getTrainingContextOptions() {
  return [
    {
      name: "Desfazer",
      icon: '<i class="fas fa-rotate-left"></i>',
      condition: element => {
        const trainingId = element.dataset.trainingId;
        return (this.actor.system.trainings?.[trainingId]?.rank ?? 0) > 0;
      },
      callback: element => {
        const trainingId = element.dataset.trainingId;
        this._onUndoTraining(trainingId);
      }
    }
  ];
}

/* -------------------------------------------- */

async _onUndoManipulationAbility(abilityId) {
  const { MANIPULATION_ABILITIES } = await import("../../systems/manipulation-data.mjs");
  const def = MANIPULATION_ABILITIES[abilityId];
  if ( !def ) return;

  const invested = this.actor.system.manipulation?.pointsInvested ?? 0;
  const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;

  await this.actor.update({
    [`system.manipulation.abilities.${abilityId}.unlocked`]: false,
    "system.manipulation.pointsInvested": Math.max(0, invested - def.cost),
    "system.curseResources.cursePoints": cursePoints + def.cost
  });

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `↩️ <strong>${this.actor.name}</strong> desfez a habilidade: <strong>${def.label}</strong>. +${def.cost} PM devolvidos.`
  });
}

/* -------------------------------------------- */

async _onUndoTraining(trainingId) {
  const { TRAININGS_DATA } = await import("../../systems/manipulation-data.mjs");
  const def = TRAININGS_DATA[trainingId];
  if ( !def ) return;

  const currentRank = this.actor.system.trainings?.[trainingId]?.rank ?? 0;
  if ( currentRank === 0 ) return;

  const prevRankIdx = currentRank - 1;
  const ptRefund = def.ptCost[prevRankIdx] ?? def.ptCost[0];
  const currentDC = this.actor.system.trainings?.[trainingId]?.currentDC ?? def.baseDC;
  const prevDC = Math.max(def.baseDC, currentDC - (def.dcIncrement ?? 5));

const spentPtBeforeUndo = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
await this.actor.update({
  [`system.trainings.${trainingId}.rank`]: currentRank - 1,
  [`system.trainings.${trainingId}.currentDC`]: prevDC,
  "system.masteryPoints": Math.max(0, (this.actor.system.masteryPoints ?? 0) - ptRefund),
  "system.curseResources.spentTrainingPoints": Math.max(0, spentPtBeforeUndo - ptRefund)
});
await this._syncTrainingEffect(trainingId, currentRank - 1);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    content: `↩️ <strong>${this.actor.name}</strong> desfez um nível de <strong>${def.label}</strong>. Rank voltou para ★${"★".repeat(currentRank - 1) || "0"}.`
  });
}


/* -------------------------------------------- */

/**
 * Sincroniza o Active Effect de um treinamento com o rank atual.
 * Cria, atualiza ou remove o effect conforme necessário.
 */
async _syncTrainingEffect(trainingId, rank) {
  const effectId = `training-${trainingId}`;

  // Configurações de cada treinamento
  const TRAINING_EFFECTS = {
    protecaoEnergia: {
      label: "Proteção de Energia",
      icon: "icons/svg/shield.svg",
      changes: rank => [
        { key: "system.attributes.ac.bonus", mode: 2, value: String(rank), priority: 20 }
      ]
    },
    robusto: {
      label: "Robusto",
      icon: "icons/svg/heart.svg",
      changes: rank => [
        { key: "system.attributes.hp.bonuses.overall", mode: 2, value: `${rank} * @details.level`, priority: 20 }
      ]
    },
    agilidadeAvancada: {
      label: "Agilidade Avançada",
      icon: "icons/svg/wing.svg",
      changes: rank => {
        const bonus = rank === 1 ? 5 : rank === 2 ? 10 : 20;
        return [
          { key: "system.attributes.movement.walk", mode: 2, value: String(bonus), priority: 20 }
        ];
      }
    },
    energiaAdaptavel: {
      label: "Energia Adaptável",
      icon: "icons/svg/aura.svg",
      changes: rank => {
        const mult = rank + 2; // rank1=3, rank2=4, rank3=5
        return [
          { key: "system.attributes.hp.bonuses.overall", mode: 2, value: `${mult} * @abilities.con.mod`, priority: 20 }
        ];
      }
    },
    golpePenetrante: {
      label: "Golpe Penetrante",
      icon: "icons/svg/sword.svg",
      changes: rank => [
        { key: "system.bonuses.mwak.attack", mode: 2, value: String(rank), priority: 20 },
        { key: "system.bonuses.rwak.attack", mode: 2, value: String(rank), priority: 20 },
        { key: "system.bonuses.msak.attack", mode: 2, value: String(rank), priority: 20 },
        { key: "system.bonuses.rsak.attack", mode: 2, value: String(rank), priority: 20 }
      ]
    }
  };

  const def = TRAINING_EFFECTS[trainingId];
  if ( !def ) return; // Treinamento sem automação, ignora

  // Procura effect existente pela flag
  const existing = this.actor.effects.find(e => e.getFlag("hunter-system", "trainingId") === trainingId);

  // Se rank 0, remove o effect se existir
  if ( rank === 0 ) {
    if ( existing ) await existing.delete();
    return;
  }

  const effectData = {
    name: `${def.label} (${"★".repeat(rank)})`,
    icon: def.icon,
    origin: this.actor.uuid,
    disabled: false,
    flags: { "hunter-system": { trainingId } },
    changes: def.changes(rank)
  };

  if ( existing ) {
    // Atualiza effect existente
    await existing.update(effectData);
  } else {
    // Cria novo effect
    await this.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
}

  /**
   * Realiza ou avança um treinamento.
   * @param {string} trainingId  ID do treinamento
   * @param {boolean} instant    true = Avanço Instantâneo (gasta PM)
   */
  async _onTrainAbility(trainingId, instant) {
    const { TRAININGS_DATA } = await import("../../systems/manipulation-data.mjs");
    const def = TRAININGS_DATA[trainingId];
    if ( !def ) return;

    const savedTrainings = this.actor.system.trainings ?? {};
    const saved = savedTrainings[trainingId] ?? { rank: 0, currentDC: def.baseDC };
    const rank = saved.rank ?? 0;
    const currentDC = saved.currentDC ?? def.baseDC;

    const nextPtCost = def.ptCost[rank] ?? def.ptCost[def.ptCost.length - 1];
    const nextPaCost = def.paCost[rank] ?? def.paCost[def.paCost.length - 1];
    const trainingPoints = getAvailableTrainingPoints(this.actor);
    const energyTotal = this.actor.system.energy?.total ?? 0;
    const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;

    // Avanço Instantâneo: gasta PM igual ao custo de PT
    if ( instant ) {
      if ( cursePoints < nextPtCost ) {
        ui.notifications.warn(`PM insuficientes! Precisa de ${nextPtCost} PM.`);
        return;
      }
      const newDC = currentDC + (def.dcIncrement ?? 5);
      await this.actor.update({
        [`system.trainings.${trainingId}.rank`]: rank + 1,
        [`system.trainings.${trainingId}.currentDC`]: newDC,
        "system.curseResources.cursePoints": cursePoints - nextPtCost,
        "system.masteryPoints": (this.actor.system.masteryPoints ?? 0) + nextPtCost
      });
      ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  content: `⚡ <strong>${this.actor.name}</strong> usou Avanço Instantâneo em <strong>${def.label}</strong>! (★${"★".repeat(rank + 1)})`
});
      return;
    }

    // Treinamento normal: verificar custos
    if ( trainingPoints < nextPtCost ) {
      ui.notifications.warn(`PT insuficientes! Precisa de ${nextPtCost} PT.`);
      return;
    }
    if ( energyTotal < nextPaCost ) {
      ui.notifications.warn(`PA Total insuficiente! Precisa de ${nextPaCost} PA.`);
      return;
    }

    // Deduzir PA de qualquer forma; PT só vira "Gastos" (sucesso) ou "Perdidos" (falha) — nunca os dois.
    await this.actor.update({ "system.energy.total": energyTotal - nextPaCost });

    // Rolar Teste de Constituição (Controle de Energia) — skill "Cont"
    // Usa o total da skill que já considera proficiência, maestria e bônus
    const contSkill = this.actor.system.skills?.Cont;
    const skillTotal = contSkill?.total ?? (
      (this.actor.system.abilities?.con?.mod ?? 0) +
      Math.floor((this.actor.system.attributes?.prof ?? 2) * (contSkill?.value ?? 0))
    );
    const roll = await new Roll("1d20 + @bonus", { bonus: skillTotal }).evaluate();
    if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true);
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Controle de Energia (CON)<br><strong>${def.label}</strong> — CD ${currentDC}`
    });

    if ( roll.total >= currentDC ) {
      // Sucesso
      // Sucesso
const newDC = currentDC + (def.dcIncrement ?? 5);
const spentPtAbility = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
await this.actor.update({
  [`system.trainings.${trainingId}.rank`]: rank + 1,
  [`system.trainings.${trainingId}.currentDC`]: newDC,
  "system.masteryPoints": (this.actor.system.masteryPoints ?? 0) + nextPtCost,
  "system.curseResources.cursePoints": (this.actor.system.curseResources?.cursePoints ?? 0) + 1,
  "system.curseResources.spentTrainingPoints": spentPtAbility + nextPtCost
});
await this._syncTrainingEffect(trainingId, rank + 1);
      ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  content: `✅ <strong>${this.actor.name}</strong> treinou <strong>${def.label}</strong> com sucesso! (★${"★".repeat(rank + 1)}) +1 Ponto de Maldição.`
});
    } else {
      // Falha: CD reduz em -1, registra PT perdidos
      const lostPt = this.actor.system.curseResources?.lostTrainingPoints ?? 0;
      await this.actor.update({
        [`system.trainings.${trainingId}.currentDC`]: Math.max(0, currentDC - 1),
        "system.curseResources.lostTrainingPoints": lostPt + nextPtCost
      });
      ChatMessage.create({
  speaker: ChatMessage.getSpeaker({ actor: this.actor }),
  content: `❌ <strong>${this.actor.name}</strong> falhou no treino de <strong>${def.label}</strong>. CD reduzida em 1 (nova CD: ${Math.max(0, currentDC - 1)}). <strong>${nextPtCost} PT perdidos</strong>.`
});
    }
  }
}
/**
 * jujutsu-chat-card.mjs
 * JujutsuLegacy — Chat Card Customizado
 *
 * Substitui completamente o card nativo do dnd5e para ataques.
 * Fluxo:
 *   1. Jogador clica na técnica/arma na ficha
 *   2. Card aparece no chat com: nome, descrição, botões de Rolar Ataque e Rolar Dano
 *   3. Ao clicar em Rolar Ataque: dialog pergunta quantos dados de PA quer gastar
 *      (0 até dobro do bônus de proficiência, limitado pela PA gerada disponível)
 *   4. Rolagem de acerto aparece no card com breakdown clicável
 *   5. Ao clicar em Rolar Dano: mesma pergunta de PA
 *   6. Dano aparece no card — se múltiplos tipos, divide em colunas
 *
 * INTEGRAÇÃO: adicionar ao final do character-sheet.mjs (como o consumo de PA)
 */

/**
 * Aplica dano a UM actor passando por todas as camadas de absorção do Hunter:
 *  0. Explosão Defensiva pendente
 *  0.5. Redução de Dano (activity "reduction")
 *  0.75. Pontos de Armadura (Foco Defensivo) — resistência 2:1, exceto Verdadeiro
 *  1. PV temporário
 *  2. PV
 * Tudo num único `actor.update` por token, com 1 mensagem de chat. Compartilhado
 * entre os IIFEs de chat-card e extra-cards (escopo de módulo).
 */
async function _applyLayeredDamageToActor(actor, amount, { soVerdadeiro = false, cardMeta = null } = {}) {
  if ( !actor ) return;
  const hp = actor.system?.attributes?.hp;
  if ( hp === undefined ) return;

  // ── Pontos de Vitalidade prevalecem (aura inativa/esgotada): regra própria ──
  if ( _pvePrevails(actor) ) { await _applyPVEDamage(actor, amount, cardMeta); return; }

  let restante = amount;
  const partes = [];
  const updates = {};

  // 0. Explosão Defensiva pendente
  const expDefFlag = actor.getFlag("hunter-system", "explosaoDefensivaPendente") ?? null;
  const expDefPendente = expDefFlag?.reducao ?? 0;
  if ( expDefPendente > 0 && restante > 0 ) {
    const reducao = Math.min(expDefPendente, restante);
    restante = Math.max(0, restante - reducao);
    updates["flags.hunter-system.-=explosaoDefensivaPendente"] = null;
    partes.push(`Explosão Defensiva reduziu <strong>${reducao}</strong>`);
  }

  // 0.5. Redução de Dano (activity tipo "reduction")
  const redFlag = actor.getFlag("hunter-system", "reducaoDano") ?? null;
  const redPendente = redFlag?.valor ?? 0;
  if ( redPendente > 0 && restante > 0 ) {
    const reducao = Math.min(redPendente, restante);
    restante = Math.max(0, restante - reducao);
    if ( !redFlag.persistente ) updates["flags.hunter-system.-=reducaoDano"] = null;
    partes.push(`Redução de Dano reduziu <strong>${reducao}</strong>`);
  }

  // 0.75. Pontos de Armadura — resistência 2:1, exceto Verdadeiro (force) que passa direto.
  const armorAtual = actor.system?.armorPoints?.value ?? 0;
  if ( armorAtual > 0 && restante > 0 && !soVerdadeiro ) {
    const maxAbsorvivel = armorAtual * 2;
    const absorvido    = Math.min(restante, maxAbsorvivel);
    const paGasto      = Math.ceil(absorvido / 2);
    restante = Math.max(0, restante - absorvido);
    updates["system.armorPoints.value"] = Math.max(0, armorAtual - paGasto);
    const sobrouResist = absorvido - paGasto;
    const extra = sobrouResist > 0 ? `, resistência evitou ${sobrouResist} a mais` : "";
    partes.push(`Pontos de Armadura absorveram <strong>${absorvido}</strong> (${paGasto} PA${extra})`);
  } else if ( soVerdadeiro && armorAtual > 0 ) {
    partes.push(`Dano <strong>Verdadeiro</strong> ignorou a armadura`);
  }

  // 1. Consumir PV temporário
  const tempAtual = hp.temp ?? 0;
  if ( tempAtual > 0 && restante > 0 ) {
    const consumido = Math.min(tempAtual, restante);
    restante -= consumido;
    updates["system.attributes.hp.temp"] = tempAtual - consumido;
    partes.push(`PV temporário absorveu <strong>${consumido}</strong>`);
  }

  // 2. Aplicar restante nos PV normais
  if ( restante > 0 ) {
    updates["system.attributes.hp.value"] = Math.max(0, (hp.value ?? 0) - restante);
    partes.push(`PV recebeu <strong>${restante}</strong>`);
  }

  if ( !foundry.utils.isEmpty(updates) ) await actor.update(updates);
  if ( partes.length ) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🛡️ <strong>${actor.name}</strong> (${amount} de dano): ${partes.join("; ")}.`
    });
  }
}

/* ============================================================
 * PONTOS DE VITALIDADE (PVE) — dano sob aura inativa
 * ============================================================ */

/** A Vitalidade prevalece quando o personagem está com a aura desligada (zetsu/esgotada). */
function _pvePrevails(actor) {
  return actor?.type === "character" && actor.system?.attributes?.auraOn === false;
}

/** Quanto de PV (atuais e máx) se perde por PVE perdido em zetsu. */
const PVE_HP_RATIO = 15;

/** Diálogo dos modificadores da regra de Vitalidade (pré-marca o crítico vindo do card). */
function _promptPVE(actor, cardMeta = null) {
  const crit = !!cardMeta?.crit;
  const grade = Number(cardMeta?.techniqueGrade ?? 0);
  const isTech = grade > 0;
  const row = "display:flex; align-items:center; gap:8px;";
  const chk = "display:flex; align-items:center; gap:8px; padding:7px 10px; border:1px solid var(--color-border-light-tertiary,#4441); border-radius:6px;";
  const x2  = "margin-left:auto; font-weight:700; color:#c8a84b;";
  const content = `
    <div style="display:flex; flex-direction:column; gap:10px; padding:6px 0;">
      <p style="margin:0;">${actor.name} está com a <strong>aura inativa</strong> — o dano atinge a <strong>Vitalidade</strong>.</p>
      <div style="${row}">
        <label style="flex:0 0 100px;">Tipo de dano</label>
        <select id="pve-src" style="flex:1;">
          <option value="normal" ${!isTech ? "selected" : ""}>Normal — 1 PVE</option>
          <option value="firearm">Arma de Fogo — 2 PVE</option>
          <option value="technique" ${isTech ? "selected" : ""}>Técnica — grau em PVE</option>
        </select>
      </div>
      <div id="pve-grade-row" style="${row} ${isTech ? "" : "display:none;"}">
        <label style="flex:0 0 100px;">Grau da técnica</label>
        <input type="number" id="pve-grade" value="${grade || 1}" min="1" step="1" style="width:70px; text-align:center;">
      </div>
      <label style="${chk}"><input type="checkbox" id="pve-crit" ${crit ? "checked" : ""}> Crítico <span style="${x2}">×2</span></label>
      <label style="${chk}"><input type="checkbox" id="pve-aura"> Ataque com Aura <span style="${x2}">×2</span></label>
      <label style="${chk} border-color:rgba(214,75,75,.5);"><input type="checkbox" id="pve-nat20"> Nat 20 — morte instantânea (com aura)</label>
    </div>`;
  return foundry.applications.api.DialogV2.wait({
    window: { title: `🌀 Vitalidade — ${actor.name}` },
    content,
    render: (event, dialog) => {
      const el = dialog.element;
      const src = el.querySelector("#pve-src");
      const gr  = el.querySelector("#pve-grade-row");
      src?.addEventListener("change", () => { gr.style.display = src.value === "technique" ? "" : "none"; });
    },
    buttons: [
      {
        action: "ok", label: "Aplicar", default: true, icon: "fas fa-check",
        callback: (event, button, dialog) => {
          const el = dialog.element;
          const src = el.querySelector("#pve-src").value;
          return {
            firearm: src === "firearm",
            techniqueGrade: src === "technique" ? Math.max(1, Number(el.querySelector("#pve-grade").value) || 1) : 0,
            crit: el.querySelector("#pve-crit").checked,
            aura: el.querySelector("#pve-aura").checked,
            nat20: el.querySelector("#pve-nat20").checked
          };
        }
      },
      { action: "cancel", label: "Cancelar", icon: "fas fa-xmark", callback: () => null }
    ],
    rejectClose: false,
    close: () => null
  });
}

/** Aplica a perda de Vitalidade (e o acoplamento 15:1 de PV) conforme as regras. */
async function _applyPVEDamage(actor, amount, cardMeta = null) {
  const meta = await _promptPVE(actor, cardMeta);
  if ( meta === null ) return; // cancelado

  // Morte instantânea: acerto natural 20 com aura.
  if ( meta.nat20 && meta.aura ) {
    await actor.update({ "system.attributes.hp.value": 0, "system.attributes.pve.value": 0 });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `💀 <strong>${actor.name}</strong> — acerto <strong>natural 20 com aura</strong>: morte instantânea.`
    });
    return;
  }

  // Perda de PVE: base 1 · arma de fogo 2 · técnica = grau; ×2 por crítico e por aura.
  let loss = meta.techniqueGrade > 0 ? meta.techniqueGrade : (meta.firearm ? 2 : 1);
  if ( meta.crit ) loss *= 2;
  if ( meta.aura ) loss *= 2;

  const pve = actor.system.attributes.pve;
  if ( (pve.value ?? 0) <= 0 && (pve.temp ?? 0) <= 0 ) {
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `🌀 <strong>${actor.name}</strong>: Vitalidade já está em 0.` });
    return;
  }

  const updates = {};
  const partes = [];
  let restante = loss;

  // 1. Consumir Vitalidade temporária primeiro (mesma regra do PV temporário).
  const tempAtual = pve.temp ?? 0;
  if ( tempAtual > 0 && restante > 0 ) {
    const consumido = Math.min(tempAtual, restante);
    restante -= consumido;
    updates["system.attributes.pve.temp"] = tempAtual - consumido;
    partes.push(`Vitalidade temporária absorveu <strong>${consumido}</strong>`);
  }

  // 2. Aplicar o restante na Vitalidade normal.
  let realLost = 0;
  if ( restante > 0 ) {
    const cur = pve.value ?? pve.max ?? 0;
    const newPve = Math.max(0, cur - restante);
    realLost = cur - newPve;
    updates["system.attributes.pve.value"] = newPve;
    partes.push(`perdeu <strong>${realLost}</strong> Ponto(s) de Vitalidade`);
  }

  // (REMOVIDO a pedido) Acoplamento 15:1 — perder Vitalidade não reduz mais a Vida.
  // Regra a ser refeita depois; `realLost` e PVE_HP_RATIO ficam disponíveis pra isso.

  await actor.update(updates);
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `🌀 <strong>${actor.name}</strong> (Vitalidade): ${partes.join("; ")}.`
  });
}

/* ============================================================
 * "Aplicar Dano" padrão (card do dnd5e / token selecionado) →
 * passa pela MESMA lógica Hunter em camadas (_applyLayeredDamageToActor),
 * incluindo a regra de Vitalidade quando a aura está desligada.
 * ============================================================ */
(function _routeVanillaDamageThroughHunterLayers() {
  // Guarda os tipos de dano da aplicação corrente (pra detectar "Verdadeiro"/force).
  const _pendingTypes = new WeakMap();

  Hooks.on("dnd5e.preCalculateDamage", (actor, damages) => {
    try { _pendingTypes.set(actor, new Set((damages ?? []).map(d => d.type).filter(Boolean))); }
    catch(e) { /* ignore */ }
    return true;
  });

  Hooks.on("dnd5e.preApplyDamage", (actor, amount, updates, options) => {
    if ( actor?.type !== "character" ) return true;                 // NPCs: fluxo padrão (Vida)
    if ( !(amount > 0) ) return true;                                // cura / temp / zero: padrão
    // Só intercepta dano vindo de um CARD (não edições manuais da barra do token).
    if ( !options?.originatingMessage && !options?.origin ) return true;

    const types = _pendingTypes.get(actor);
    _pendingTypes.delete(actor);
    const soVerdadeiro = !!types && types.size > 0 && [...types].every(t => t === "force");

    // Aplica pelo sistema Hunter (Explosão Defensiva, Redução, Armadura, PV temp/PV,
    // e Vitalidade quando a aura está desligada) e cancela o update padrão de HP.
    _applyLayeredDamageToActor(actor, amount, { soVerdadeiro, cardMeta: null });
    return false;
  });
})();

(function _registerJujutsuChatCard() {

  // ── HOOK PRINCIPAL: intercepta o uso de qualquer atividade ──────────────────
  Hooks.on("dnd5e.preUseActivity", (activity, config, dialog) => {
    const item = activity.item;
    if ( !item ) return;

    // Só interceptamos atividades de ataque
    if ( activity.type !== "attack" ) return;

    // Cancelar o comportamento nativo
    _postJujutsuCard(activity, item);
    return false;
  });

  // ── RECURSO CUSTOMIZADO: consumo em atividades NÃO-ataque ────────────────────
  // (ataques consomem o recurso dentro de _postJujutsuCard, junto com a PA)
  //
  // IMPORTANTE — ordem de registro: este hook precisa continuar registrado ANTES
  // do hook de _registerJujutsuExtraCards (mais abaixo neste arquivo). Hooks.call
  // para no primeiro listener que retorna false — é o veto AQUI que impede o card
  // customizado de dano/cura/salvaguarda/perícia/utilidade de ser postado quando o
  // recurso configurado está insuficiente. Se este hook for movido para depois
  // daquele, o card passaria a ser postado mesmo sem saldo suficiente.
  Hooks.on("dnd5e.preUseActivity", (activity) => {
    if ( activity.type === "attack" ) return; // já tratado no card customizado
    const actor = activity.item?.actor;
    if ( !actor ) return;
    if ( !activity.flags?.["hunter-system"]?.resourceCost?.id ) return; // nada configurado
    const payer = _paPayer(actor); // invocação → invocador; senão, o próprio
    const reserva = _reserveCustomResource(payer, activity);
    if ( reserva.ok === false ) {
      ui.notifications.warn(`${payer.name} não tem ${reserva.name} suficiente! (${reserva.have} disponível, ${reserva.need} necessário)`);
      return false; // bloqueia o uso
    }
    _commitCustomResource(payer, reserva).then(() => {
      if ( payer !== actor && reserva.key ) ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `🔗 <strong>${actor.name}</strong> (invocação) gastou <strong>${reserva.need} ${reserva.name}</strong> de <strong>${payer.name}</strong>.`
      });
    });
  });

  // ── INVOCAÇÕES: quem paga a PA ───────────────────────────────────────────────
  // Se o ator é uma invocação com "Gasta a PA do invocador" marcado, devolve o
  // invocador (dono do item que a invocou). Senão, devolve o próprio ator.
  function _paPayer(actor) {
    const flags = actor?.flags ?? {};
    const summon = flags.HunterLegacy?.summon ?? flags["hunter-system"]?.summon;
    if ( !summon?.origin || summon.consumeSummoner !== true ) return actor;
    let doc = null;
    try { doc = fromUuidSync(summon.origin); } catch { doc = null; }
    return doc?.actor ?? doc?.parent ?? actor;
  }

  // ── RECURSO CUSTOMIZADO: checagem+reserva (síncrona) e confirmação (async) ──
  // A checagem usa um "reservado localmente" por ator+recurso pra evitar corrida:
  // actor.getFlag() só reflete o saldo depois que o setFlag anterior é confirmado
  // pelo servidor (assíncrono), então duas ativações quase simultâneas podem ler o
  // MESMO saldo antes de qualquer uma escrever, permitindo gastar o recurso 2x mas
  // descontar só 1x. Descontando o valor já reservado (mas ainda não confirmado)
  // da conta, a segunda ativação vê o saldo correto mesmo antes da primeira
  // terminar de persistir.
  const _pendingResourceDeductions = new Map(); // `${payerId}:${resId}` -> nº reservado

  /**
   * Verifica saldo (síncrono) e RESERVA o valor se suficiente — ainda não escreve.
   * Recurso órfão (removido do ator depois de configurado na activity) é
   * auto-limpo da flag e tratado como "sem custo" (não bloqueia o uso).
   * @returns {{ok:true, key?:string, resId?:string, name?:string, need?:number}
   *          |{ok:false, name:string, have:number, need:number}}
   */
  function _reserveCustomResource(payer, activity) {
    const rc = activity.flags?.["hunter-system"]?.resourceCost;
    if ( !rc?.id || !(Number(rc.amount) > 0) ) return { ok: true };
    const need = Number(rc.amount);
    const list = payer.getFlag("hunter-system", "customResources") ?? [];
    const idx  = list.findIndex(r => r.id === rc.id);
    if ( idx < 0 ) {
      activity.update({ "flags.hunter-system.-=resourceCost": null });
      ui.notifications.warn(`O recurso configurado em "${activity.name}" não existe mais em ${payer.name} — custo removido.`);
      return { ok: true };
    }
    const key = `${payer.id}:${rc.id}`;
    const pendente = _pendingResourceDeductions.get(key) ?? 0;
    const have = Number(list[idx].current ?? 0) - pendente;
    if ( have < need ) return { ok: false, name: list[idx].name, have, need };
    _pendingResourceDeductions.set(key, pendente + need);
    return { ok: true, key, resId: rc.id, name: list[idx].name, need };
  }

  /** Confirma (persiste) uma reserva feita por _reserveCustomResource. */
  async function _commitCustomResource(payer, reserva) {
    if ( !reserva?.key ) return; // nada foi reservado (sem custo configurado, ou órfão já tratado)
    try {
      const list = payer.getFlag("hunter-system", "customResources") ?? [];
      const idx  = list.findIndex(r => r.id === reserva.resId);
      if ( idx < 0 ) return;
      const have = Number(list[idx].current ?? 0);
      const updated = list.map((r, i) => i === idx ? { ...r, current: Math.max(0, have - reserva.need) } : r);
      await payer.setFlag("hunter-system", "customResources", updated);
    } finally {
      const restante = (_pendingResourceDeductions.get(reserva.key) ?? 0) - reserva.need;
      if ( restante > 0 ) _pendingResourceDeductions.set(reserva.key, restante);
      else _pendingResourceDeductions.delete(reserva.key);
    }
  }

  // ── CRIAR O CARD CUSTOMIZADO ─────────────────────────────────────────────────
  async function _postJujutsuCard(activity, item) {
    const actor = item.actor;
    const isSpell = item.type === "spell";

    // Processar consumo de PA configurado na activity (Attribute type)
    // antes de criar o card, já que bloqueamos o processamento nativo
    if ( actor ) {
      const payer = _paPayer(actor); // invocação → invocador; senão, o próprio
      const targets = activity.consumption?.targets ?? [];
      for ( const target of targets ) {
        const isGerada = target.target === "energy.generated";
        const isTotal  = target.target === "energy.total";
        if ( !isGerada && !isTotal ) continue;
        const custo = Number(target.value ?? 0);
        if ( custo <= 0 ) continue;
        const campo = isGerada ? "system.energy.generated" : "system.energy.total";
        const atual = isGerada
          ? (payer.system?.energy?.generated ?? 0)
          : (payer.system?.energy?.total ?? 0);
        const label = isGerada ? "PA Gerada" : "PA Total";
        if ( atual < custo ) {
          ui.notifications.warn(`${payer.name} não tem ${label} suficiente! (${atual} disponível, ${custo} necessário)`);
          return; // aborta criação do card
        }
        await payer.update({ [campo]: atual - custo }, { isEnergySystem: true });
        if ( payer !== actor ) ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `🔗 <strong>${actor.name}</strong> (invocação) gastou <strong>${custo} ${label}</strong> de <strong>${payer.name}</strong>.`
        });
      }

      // Consumo de Recurso customizado configurado na activity (mesma reserva
      // síncrona usada pelo hook de atividades não-ataque, acima — evita a
      // corrida de duplo-gasto e já redireciona pro invocador, como a PA)
      const reservaRecurso = _reserveCustomResource(payer, activity);
      if ( reservaRecurso.ok === false ) {
        ui.notifications.warn(`${payer.name} não tem ${reservaRecurso.name} suficiente! (${reservaRecurso.have} disponível, ${reservaRecurso.need} necessário)`);
        return; // aborta criação do card
      }
      await _commitCustomResource(payer, reservaRecurso);
      if ( payer !== actor && reservaRecurso.key ) ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `🔗 <strong>${actor.name}</strong> (invocação) gastou <strong>${reservaRecurso.need} ${reservaRecurso.name}</strong> de <strong>${payer.name}</strong>.`
      });
    }

    // Dados de dano da activity
    const damageParts = activity.damage?.parts ?? [];

    // Montar o HTML do card
    const description = item.system.description?.value ?? "";
    const hasDescription = description && description !== "<p></p>";

    // Tipo de dado bônus de PA
    const baseDenomination = isSpell
      ? (damageParts[0]?.denomination ?? 6)
      : 4;

    const cardData = {
      itemId:       item.id,
      actorId:      actor?.id ?? null,
      tokenId:      actor?.token?.id ?? null,
      activityId:   activity.id,
      itemName:     item.name,
      itemImg:      item.img,
      isSpell,
      hasDescription,
      description:  hasDescription ? description : "",
      damageParts:  damageParts.map(p => ({
        formula: _buildDamageFormula(p, actor),
        types:   p.types ?? [],
        label:   _damageTypeLabel(p.types)
      })),
      hasAttack:    true,
      hasDamage:    damageParts.length > 0,
      paBonus:      baseDenomination,
      profBonus:    actor?.system?.attributes?.prof ?? 2,
      userId:       game.user.id
    };

    const content = _renderCardHTML(cardData);

    const rollMode = game.settings.get("core", "rollMode");
    const chatData = {
      speaker:  ChatMessage.getSpeaker({ actor }),
      content,
      rollMode,
      flags: {
        "hunter-system": {
          jujutsuCard: true,
          cardData
        }
      }
    };
    ChatMessage.applyRollMode(chatData, rollMode);
    await ChatMessage.create(chatData);
  }

  // ── RENDERIZAR HTML DO CARD ──────────────────────────────────────────────────
  function _renderCardHTML(data) {
    return `
<div class="jujutsu-card"
     data-item-id="${data.itemId}"
     data-actor-id="${data.actorId ?? ""}"
     data-token-id="${data.tokenId ?? ""}"
     data-activity-id="${data.activityId}"
     data-user-id="${data.userId ?? ""}"
     data-pa-bonus="${data.paBonus}"
     data-prof-bonus="${data.profBonus}"
     data-is-spell="${data.isSpell}">

  <div class="jj-top-bar">
    <img class="jj-top-icon" src="${data.itemImg}" alt="${data.itemName}">
    <span class="jj-top-name">${data.itemName}</span>
    <span class="jj-top-sub">${data.isSpell ? "Técnica" : "Ataque"}</span>
  </div>

  ${data.hasDescription ? `<div class="jj-description">${data.description}</div>` : ""}

  ${data.hasAttack ? `
  <div class="jj-adv-row">
    <button class="jj-adv-btn" data-adv="advantage" title="Vantagem">
      <i class="fas fa-angles-up"></i> Vantagem
    </button>
    <button class="jj-adv-btn" data-adv="disadvantage" title="Desvantagem">
      <i class="fas fa-angles-down"></i> Desvantagem
    </button>
  </div>` : ""}

  <div class="jj-roll-btns">
    ${data.hasAttack ? `
    <button class="jj-btn jj-attack-btn" data-action="jj-attack">
      <i class="fas fa-dice-d20"></i> Acerto
    </button>` : `<div></div>`}
    ${data.hasDamage ? `
    <button class="jj-btn jj-damage-btn" data-action="jj-damage">
      <i class="fas fa-burst"></i> Dano
    </button>` : `<div></div>`}
  </div>

  <div class="jj-panels">
    <div class="jj-panel" id="jj-atk-panel">
      <div class="jj-panel-label">Acerto</div>
      <div class="jj-panel-val" id="jj-atk-val">—</div>
      <div class="jj-panel-breakdown" id="jj-atk-break"></div>
    </div>
    <div class="jj-panel" id="jj-dmg-panel">
      <div class="jj-panel-label">Dano</div>
      <div class="jj-panel-val dmg" id="jj-dmg-val">—</div>
      <div class="jj-panel-breakdown" id="jj-dmg-break"></div>
    </div>
  </div>

  <div class="jj-footer" id="jj-footer">
    <div class="jj-mods">
      <label class="jj-mod-check" title="Metade"><input type="checkbox" data-mod="half"> ½</label>
      <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-mod="quarter"> ¼</label>
      <label class="jj-mod-check jj-crit-check" title="Crítico — rola dados novamente"><input type="checkbox" data-mod="crit"> Crit</label>
    </div>
    <span class="jj-footer-total">Total <strong id="jj-total-display">0</strong></span>
    <button class="jj-apply-btn" data-action="jj-apply-damage">Aplicar</button>
  </div>

</div>`;
  }

  // ── LISTENERS DO CHAT ────────────────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if ( !root ) return;
    const card = root.querySelector(".jujutsu-card:not(.jj-extra-card)");
    if ( !card ) return;

    const cardUserId = card.dataset.userId ?? "";
    const isAuthor = cardUserId === game.user.id;

    const atkBtn = card.querySelector("[data-action='jj-attack']");
    const dmgBtn = card.querySelector("[data-action='jj-damage']");

    if ( !isAuthor ) {
      if ( atkBtn ) { atkBtn.style.display = "none"; atkBtn.disabled = true; }
      if ( dmgBtn ) { dmgBtn.style.display = "none"; dmgBtn.disabled = true; }
    }

    atkBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ( card.dataset.userId !== game.user.id ) return;
      await _handleAttackRoll(card, message);
    });

    dmgBtn?.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ( card.dataset.userId !== game.user.id ) return;
      await _handleDamageRoll(card, message);
    });

    card.querySelector("[data-action='jj-apply-damage']")?.addEventListener("click", () => {
      const base = Number(card.dataset.totalDmg ?? 0);
      const activeMod = card.querySelector(".jj-mod-check input:checked")?.dataset.mod ?? null;
      const final = _applyModifier(base, activeMod);
      _applyDamageToSelected(final, card);
    });

    card.querySelectorAll(".jj-mod-check input").forEach(cb => {
      cb.addEventListener("change", async () => {
        card.querySelectorAll(".jj-mod-check input").forEach(o => { if (o !== cb) o.checked = false; });
        const base = Number(card.dataset.totalDmg ?? 0);
        const mod  = cb.checked ? cb.dataset.mod : null;
        const el   = card.querySelector("#jj-total-display");
        if ( !el ) return;

        if ( mod === "crit" ) {
          // Crítico: rola dados extras se ainda não foram rolados
          if ( !card.dataset.critBonus ) {
            const critBonus = await _rollCritDice(card);
            card.dataset.critBonus = critBonus;
            const dmgBreak = card.querySelector("#jj-dmg-break");
            if ( dmgBreak && critBonus > 0 ) {
              dmgBreak.innerHTML += `<span class="jj-pa-badge" style="color:#e07040;border-color:#804020">+${critBonus} crit</span>`;
            }
          }
          const critBonus = Number(card.dataset.critBonus ?? 0);
          el.textContent = _applyModifier(base, "crit", critBonus);
        } else if ( mod === "kokusen" ) {
          // Black Flash: NÃO rola dados, apenas multiplica o base por 2,5
          card.dataset.critBonus = "";
          el.textContent = _applyModifier(base, "kokusen", 0);
        } else {
          card.dataset.critBonus = "";
          el.textContent = _applyModifier(base, mod);
        }
      });
    });

    // Toggles de vantagem/desvantagem — mutuamente exclusivos
    card.querySelectorAll(".jj-adv-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const adv = btn.dataset.adv;
        const active = btn.classList.contains("active");
        card.querySelectorAll(".jj-adv-btn").forEach(b => b.classList.remove("active"));
        if ( !active ) {
          btn.classList.add("active");
          card.dataset.rollMode = adv;
        } else {
          card.dataset.rollMode = "normal";
        }
      });
    });
  });

  // ── ROLAR ATAQUE ─────────────────────────────────────────────────────────────
  async function _handleAttackRoll(card, message) {
    const { actor, activity, item, profBonus, paBonus } = _resolveCardData(card);
    if ( !actor || !activity ) return;

    // 1º — Escala de Energia: dropdown ANTES da Explosão Ofensiva. Apenas
    //      escolhe (não deduz) para permitir cancelar tudo sem gastar PA.
    const escolhaEscala = await chooseJJScale({ actor, activity });
    if ( escolhaEscala === null ) return; // cancelado

    // Dialog de PA — escolha feita ANTES do ataque, dados adicionados ao DANO depois
    const paGastos = await _paDialog(actor, profBonus, paBonus);
    if ( paGastos === null ) return; // cancelado

    // Consumir PA imediatamente
    if ( paGastos > 0 ) {
      const ok = await _consumePA(actor, paGastos);
      if ( !ok ) return;
    }

    // Agora sim deduz o PA da Escala e guarda o bônus reservado p/ a rolagem de dano
    const escala = await applyScaleChoice({ actor, activity, incrementos: escolhaEscala.incrementos });
    card.dataset.jjScaleBonus = escala.bonusFormula ?? "";

    // Guardar PA gastos no card para usar automaticamente no dano
    card.dataset.paGastos = paGastos;

    // Montar fórmula de acerto usando labels.toHit (já inclui FOR + Prof + bônus)
    const toHitStr  = item.labels?.toHit ?? "+0";
    const rollMode  = card.dataset.rollMode ?? "normal";
    let formula;
    if ( rollMode === "advantage" )    formula = `2d20kh1 ${toHitStr}`;
    else if ( rollMode === "disadvantage" ) formula = `2d20kl1 ${toHitStr}`;
    else                               formula = `1d20 ${toHitStr}`;

    const roll = await new Roll(formula, actor.getRollData()).evaluate();
    // Mostrar resultado IMEDIATAMENTE, animar dados em paralelo
    if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true); // sem await
    const isCrit = roll.total >= (activity.attack?.critical?.threshold ?? 20);

    const isNat20 = roll.dice[0]?.results[0]?.result === 20;
    const isNat1  = roll.dice[0]?.results[0]?.result === 1;

    // Renderizar no painel de acerto (Layout B)
    const atkPanel = card.querySelector("#jj-atk-panel");
    const atkVal   = card.querySelector("#jj-atk-val");
    const atkBreak = card.querySelector("#jj-atk-break");

    if ( atkPanel ) {
      atkPanel.classList.add("visible");
      atkVal.textContent = roll.total;
      atkVal.className = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : "");
      const modeLabel = rollMode === "advantage" ? '<span class="jj-pa-badge" style="color:#50a050;border-color:#306030">Vantagem</span>' 
                      : rollMode === "disadvantage" ? '<span class="jj-pa-badge" style="color:#a05050;border-color:#603030">Desvantagem</span>'
                      : "";
      atkBreak.innerHTML = _buildBreakdown(roll) + modeLabel;
      if ( paGastos > 0 ) {
        atkBreak.innerHTML += `<span class="jj-pa-badge">⚡ +${paGastos}d${paBonus} no dano</span>`;
      }
      if ( card.dataset.jjScaleBonus ) {
        atkBreak.innerHTML += `<span class="jj-pa-badge" style="color:#c0a0ff;border-color:#6040a0;">⚡ +${card.dataset.jjScaleBonus} (escala)</span>`;
      }
    }

    // Ativar o painel de dano (para mostrar o botão)
    const dmgPanel = card.querySelector("#jj-dmg-panel");
    if ( dmgPanel ) dmgPanel.classList.add("visible");

    // Desabilitar botão de acerto após rolar
    const atkBtn = card.querySelector(".jj-attack-btn");
    if ( atkBtn ) { atkBtn.disabled = true; atkBtn.style.opacity = "0.4"; atkBtn.style.cursor = "default"; }

    await _updateCardMessage(message, card.outerHTML);
  }

  // ── ROLAR DANO ───────────────────────────────────────────────────────────────
  async function _handleDamageRoll(card, message) {
    const { actor, activity, item, profBonus, paBonus } = _resolveCardData(card);
    if ( !actor || !activity ) return;

    // PA já gastos no ataque (se houver)
    // PA já foi escolhido e consumido no Rolar Ataque — usa direto
    const paGastos = Number(card.dataset.paGastos ?? 0);

    // Usar labels.damages que já tem fórmula e tipo de dano calculados
    const damageParts  = activity.damage?.parts ?? [];
    const damageLabels = item.labels?.damages ?? [];
    const rollData     = actor.getRollData();
    const isSpell      = card.dataset.isSpell === "true";
    const resultsEl    = card.querySelector(".jj-damage-results");

    // Hatsu: passo de dado de dano +1 para técnicas em Ultimato
    const hatsuTier = actor.getFlag("hunter-system", "hatsuActiveTier") ?? "none";
    const ultimatoActive = isSpell && (hatsuTier === "ultimato");
    const _stepUpFormulaDice = f => {
      const STEP = { "4": "6", "6": "8", "8": "10", "10": "12", "12": "12" };
      return String(f).replace(/(\d*)d(\d+)/g, (m, n, d) => `${n}d${STEP[d] ?? d}`);
    };

    const rolls = [];
    // Avaliar todos os rolls de dano em paralelo
    const rollPromises = damageParts.map(async (part, i) => {
      const lbl     = damageLabels[i];
      let   formula = lbl?.formula ?? _buildDamageFormula(part, actor);
      if ( ultimatoActive ) formula = _stepUpFormulaDice(formula);
      const label   = lbl?.label ?? _damageTypeLabel(part.types);
      const roll    = await new Roll(formula, rollData).evaluate();
      return { roll, part, label };
    });

    // PA bônus em paralelo com os demais
    let paRollPromise = null;
    if ( paGastos > 0 ) {
      const paDenomination = isSpell ? (damageParts[0]?.denomination ?? 6) : 4;
      paRollPromise = new Roll(`${paGastos}d${paDenomination}`, rollData).evaluate();
    }

    // Foco Agressivo: +1d4 (ou +1d6 com Fluxo Constante) em ataques comuns (não-magia)
    const focoAgressivoAtivo = !!actor.getFlag("hunter-system", "focoAgressivoAtivo");
    const fluxoConstante     = !!actor.system.manipulation?.abilities?.fluxoConstante?.unlocked;
    let focoRollPromise = null;
    if ( focoAgressivoAtivo && !isSpell ) {
      const focoDie = fluxoConstante ? "1d6" : "1d4";
      focoRollPromise = new Roll(focoDie, rollData).evaluate();
    }

    // Estágio de Foco — Aumento de Potência: +N dados de dano em técnicas
    // N = Grau da técnica (só em manifestação Versátil), OU dados do slot do
    // Hatsu (inata=5, m1=3, m2=5, m3=8) — modo Focado sempre usa os do slot.
    const estagioFocoAtivo = !!actor.getFlag("hunter-system", "hatsuEstagioFocoAtivo");
    let estagioRollPromise = null;
    let estagioDieFace = null;
    let estagioGrade = null;
    if ( estagioFocoAtivo && isSpell ) {
      const HATSU_SLOT_DICE = { inata: 5, m1: 3, m2: 5, m3: 8 };
      const hatsuSlot = item.getFlag("hunter-system", "hatsu.slot")
                     ?? item.getFlag("hunter-system", "hatsu.parent");
      const declaredLevel = _hatsuVersatilGrau(actor, item);
      if ( declaredLevel > 0 ) estagioGrade = declaredLevel;
      else if ( hatsuSlot && HATSU_SLOT_DICE[hatsuSlot] ) estagioGrade = HATSU_SLOT_DICE[hatsuSlot];
      else estagioGrade = 1;

      // Usa o passo de dado já potencializado (Ultimato faz step automático na primeira parte)
      const baseDie = damageParts[0]?.denomination;
      if ( baseDie ) {
        const STEP = { 4: 6, 6: 8, 8: 10, 10: 12, 12: 12 };
        estagioDieFace = ultimatoActive ? (STEP[baseDie] ?? baseDie) : baseDie;
        estagioRollPromise = new Roll(`${estagioGrade}d${estagioDieFace}`, rollData).evaluate();
      }
    }

    // Escala de Energia — bônus reservado no "Acerto", rolado aqui
    const jjScaleBonus = card.dataset.jjScaleBonus || "";
    const escalaRollPromise = jjScaleBonus ? new Roll(jjScaleBonus, rollData).evaluate() : null;

    const resolvedRolls = await Promise.all(rollPromises);
    rolls.push(...resolvedRolls);
    let paRoll = paRollPromise ? await paRollPromise : null;
    let focoRoll = focoRollPromise ? await focoRollPromise : null;
    let estagioRoll = estagioRollPromise ? await estagioRollPromise : null;
    let escalaRoll = escalaRollPromise ? await escalaRollPromise : null;

    // Animar todos os dados simultaneamente (sem await — resultado já está calculado)
    if ( game.dice3d ) {
      const allRolls = [...resolvedRolls.map(r => r.roll),
                        ...(paRoll ? [paRoll] : []),
                        ...(focoRoll ? [focoRoll] : []),
                        ...(estagioRoll ? [estagioRoll] : []),
                        ...(escalaRoll ? [escalaRoll] : [])];
      Promise.all(allRolls.map(r => game.dice3d.showForRoll(r, game.user, true)));
    }

    // Total geral de dano
    const totalBase    = rolls.reduce((sum, { roll }) => sum + roll.total, 0);
    const totalPA      = paRoll?.total ?? 0;
    const totalFoco    = focoRoll?.total ?? 0;
    const totalEstagio = estagioRoll?.total ?? 0;
    const totalEscala  = escalaRoll?.total ?? 0;
    const totalDmg     = totalBase + totalPA + totalFoco + totalEstagio + totalEscala;
    card.dataset.totalDmg = totalDmg;

    // Guardar fórmula de dados puros para o crítico (apenas dados, sem modificadores fixos)
    // Ex: "1d10" para rolar novamente sem o +4 do modificador
    const critParts = damageParts.map(p => {
      const n = p.number ?? 1;
      const d = p.denomination ?? 6;
      return `${n}d${d}`;
    });
    if ( paGastos > 0 ) {
      const paDen = isSpell ? (damageParts[0]?.denomination ?? 6) : 4;
      critParts.push(`${paGastos}d${paDen}`);
    }
    if ( focoRoll ) {
      critParts.push(fluxoConstante ? "1d6" : "1d4");
    }
    if ( estagioRoll && estagioDieFace && estagioGrade ) {
      critParts.push(`${estagioGrade}d${estagioDieFace}`);
    }
    if ( jjScaleBonus ) {
      // Só os DADOS da escala entram no crítico (sem a parte fixa), como base/PA
      const diceOnly = jjScaleBonus.split("+").map(t => t.trim()).filter(t => /^\d*d\d+$/i.test(t)).join(" + ");
      if ( diceOnly ) critParts.push(diceOnly);
    }
    card.dataset.critFormula = critParts.join(" + ");

    // Tipos de dano (para detectar "Verdadeiro" — dano força — na aplicação)
    const allTypes = damageParts.flatMap(p => p.types ?? []);
    card.dataset.damageTypes = allTypes.join(",");

    // Label do tipo de dano (todos juntos ou primeiro)
    const dmgLabel = rolls.map(r => r.label).join(" + ");

    // Renderizar no painel de dano (Layout B)
    const dmgPanel = card.querySelector("#jj-dmg-panel");
    const dmgVal   = card.querySelector("#jj-dmg-val");
    const dmgBreak = card.querySelector("#jj-dmg-break");

    if ( dmgPanel ) {
      dmgPanel.classList.add("visible");
      dmgPanel.querySelector(".jj-panel-label").textContent = dmgLabel || "Dano";
      dmgVal.textContent = totalDmg;
      dmgBreak.innerHTML = rolls.map(({ roll }) => _buildBreakdown(roll)).join('<span class="jj-mod-pip"> + </span>');
      if ( paRoll ) {
        dmgBreak.innerHTML += `<span class="jj-mod-pip"> + </span>${_buildBreakdown(paRoll)}<span class="jj-pa-badge">PA</span>`;
      }
      if ( focoRoll ) {
        dmgBreak.innerHTML += `<span class="jj-mod-pip"> + </span>${_buildBreakdown(focoRoll)}<span class="jj-pa-badge">FOCO</span>`;
      }
      if ( estagioRoll ) {
        dmgBreak.innerHTML += `<span class="jj-mod-pip"> + </span>${_buildBreakdown(estagioRoll)}<span class="jj-pa-badge">ESTÁGIO</span>`;
      }
      if ( escalaRoll ) {
        dmgBreak.innerHTML += `<span class="jj-mod-pip"> + </span>${_buildBreakdown(escalaRoll)}<span class="jj-pa-badge" style="color:#c0a0ff;border-color:#6040a0;">ESCALA</span>`;
      }
    }

    // Mostrar footer com modificadores
    const footer = card.querySelector("#jj-footer");
    if ( footer ) {
      footer.classList.add("visible");
      const totalEl = footer.querySelector("#jj-total-display");
      if ( totalEl ) totalEl.textContent = totalDmg;
    }

    // Desabilitar botão de dano após rolar
    const dmgBtn = card.querySelector(".jj-damage-btn");
    if ( dmgBtn ) { dmgBtn.disabled = true; dmgBtn.style.opacity = "0.4"; dmgBtn.style.cursor = "default"; }

    await _updateCardMessage(message, card.outerHTML);
  }

  // ── DIALOG DE PA ─────────────────────────────────────────────────────────────
  async function _paDialog(actor, profBonus, denomination) {
    const paDisp = actor.system?.energy?.generated ?? 0;
    const maxPA  = Math.min(profBonus * 2, paDisp);

    if ( maxPA === 0 ) return 0; // sem PA disponível, não pergunta

    return foundry.applications.api.DialogV2.wait({
      window: { title: "⚡ Explosão Ofensiva" },
      content: `
        <div style="padding: 8px 0;">
          <p style="margin:0 0 8px">Gastar PA para adicionar dados de dano?</p>
          <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
            PA Gerada disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
            Máximo: <strong>${maxPA}</strong> d${denomination}
          </p>
          <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
            <label style="flex:0 0 auto">Dados de PA:</label>
            <input type="number" id="jj-pa-input"
                   value="0" min="0" max="${maxPA}"
                   style="width:60px; text-align:center;">
            <span style="font-size:12px; color:#aaa;">d${denomination} por dado</span>
          </div>
        </div>`,
      buttons: [
        {
          label:    "Confirmar",
          action:   "ok",
          default:  true,
          callback: (event, button, dialog) => {
            const input = dialog.element?.querySelector("#jj-pa-input") ?? document.querySelector("#jj-pa-input");
            return Math.max(0, Math.min(Number(input?.value ?? 0), maxPA));
          }
        },
        {
          label:  "Sem PA",
          action: "skip",
          callback: () => 0
        },
        {
          label:  "Cancelar",
          action: "cancel",
          callback: () => null
        }
      ],
      rejectClose: false,
      close: () => null
    });
  }

  // ── CONSUMIR PA GERADA ───────────────────────────────────────────────────────
  async function _consumePA(actor, quantidade) {
    const payer = _paPayer(actor); // invocação → invocador; senão, o próprio
    const atual = payer.system?.energy?.generated ?? 0;
    if ( atual < quantidade ) {
      ui.notifications.warn(`${payer.name} não tem PA Gerada suficiente! (${atual} disponível, ${quantidade} necessário)`);
      return false;
    }
    await payer.update({ "system.energy.generated": atual - quantidade }, { isEnergySystem: true });
    if ( payer !== actor ) ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🔗 <strong>${actor.name}</strong> (invocação) gastou <strong>${quantidade} PA Gerada</strong> de <strong>${payer.name}</strong>.`
    });
    return true;
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────

  function _resolveCardData(card) {
    const actorId    = card.dataset.actorId;
    const tokenId    = card.dataset.tokenId;
    const itemId     = card.dataset.itemId;
    const activityId = card.dataset.activityId;
    const profBonus  = Number(card.dataset.profBonus ?? 2);
    const paBonus    = Number(card.dataset.paBonus ?? 4);

    let actor = tokenId
      ? canvas.tokens.get(tokenId)?.actor
      : game.actors.get(actorId);

    const item     = actor?.items.get(itemId);
    const activity = item?.system.activities?.get(activityId);

    return { actor, item, activity, profBonus, paBonus };
  }

  function _buildDamageFormula(part, actor) {
    const num  = part.number ?? 1;
    const den  = part.denomination ?? 6;
    const bon  = part.bonus ?? "";
    const mod  = actor ? _resolveAbilityMod(part, actor) : 0;
    let formula = `${num}d${den}`;
    if ( bon ) formula += ` + ${bon}`;
    if ( mod ) formula += ` + ${mod}`;
    return formula;
  }

  function _resolveAbilityMod(part, actor) {
    // Por padrão usa o mod da habilidade de ataque do ator
    const ability = actor.system?.attributes?.spellcasting
      ?? Object.keys(actor.system?.abilities ?? {})[0]
      ?? "str";
    return actor.system?.abilities?.[ability]?.mod ?? 0;
  }

  function _damageTypeLabel(types) {
    if ( !types?.length ) return "Dano";
    const labels = {
      bludgeoning: "Contundente", piercing: "Perfurante", slashing: "Cortante",
      fire: "Fogo", cold: "Frio", lightning: "Raio", acid: "Ácido",
      poison: "Veneno", necrotic: "Necrótico", radiant: "Radiante",
      thunder: "Trovão", force: "Força", psychic: "Psíquico"
    };
    return types.map(t => labels[t] ?? t).join(" + ");
  }

/**
 * Grau declarado de uma técnica de Hatsu, válido apenas quando a manifestação
 * que a governa está em modo Versátil. Em modo Focado o Estágio de Foco volta
 * aos dados fixos do slot (modelo original), mesmo que um Grau tenha ficado
 * salvo de um período Versátil anterior.
 * @param {Actor5e} actor
 * @param {Item5e} item  Manifestação ou técnica de Hatsu.
 * @returns {number}     O Grau (1-9), ou 0 se não aplicável.
 */
function _hatsuVersatilGrau(actor, item) {
  const flag = item.getFlag("hunter-system", "hatsu") ?? {};
  let manifestacao = null;
  if ( flag.slot ) manifestacao = item;
  else if ( flag.parent ) manifestacao = actor.items.find(i =>
    (i.type === "spell") && (i.getFlag("hunter-system", "hatsu.slot") === flag.parent)
  ) ?? null;
  if ( (manifestacao?.getFlag("hunter-system", "hatsu.mode") ?? "focado") !== "versatil" ) return 0;
  return item.system?.level ?? 0;
}

function _buildBreakdown(roll) {
    const diceParts = [];
    const modParts  = [];

    for ( const term of roll.terms ) {
      if ( term.results ) {
        const spans = term.results.map(r => {
          const active = !r.discarded;
          let cls;
          if ( !active )                       cls = "jj-die discarded";
          else if ( r.result === term.faces )  cls = "jj-die max";
          else if ( r.result === 1 )           cls = "jj-die min";
          else                                 cls = "jj-die active";
          return `<span class="${cls}">${r.result}</span>`;
        });
        diceParts.push(spans.join('<span class="jj-mod-pip">, </span>'));
      } else if ( typeof term.number === "number" && term.number !== 0 ) {
        modParts.push(`<span class="jj-mod-pip">${term.number > 0 ? "+" : ""}${term.number}</span>`);
      }
    }

    const diceHtml = diceParts.length
      ? `<span class="jj-break-bracket">[</span>${diceParts.join('<span class="jj-mod-pip">, </span>')}<span class="jj-break-bracket">]</span>`
      : "";
    return diceHtml + modParts.join("");
  }

  async function _updateCardMessage(message, cardHTML) {
    await message.update({ content: cardHTML });
  }

  // ── MODIFICADOR DE DANO ──────────────────────────────────────────────────────
  // Nota: "crit" é tratado separadamente em _handleCritRoll (rola dados extras)
  // Os demais modificam o total base diretamente
  function _applyModifier(base, mod, critBonus = 0) {
    switch ( mod ) {
      case "half":    return Math.floor(base / 2);
      case "quarter": return Math.floor(base / 4);
      case "crit":    return base + critBonus; // base + dados extras rolados
      case "kokusen": return Math.ceil((base + critBonus) * 2.5); // ×2,5 no total
      default:        return base;
    }
  }

  // ── ROLAR DADOS EXTRAS DE CRÍTICO ────────────────────────────────────────────
  async function _rollCritDice(card) {
    // Pegar a fórmula dos dados usados no dano (sem modificadores fixos)
    // Guardamos a fórmula de dados pura quando rolamos o dano
    const critFormula = card.dataset.critFormula;
    if ( !critFormula ) return 0;
    try {
      const roll = await new Roll(critFormula).evaluate();
      if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true); // sem await
      return roll.total;
    } catch(e) {
      console.error("JujutsuLegacy | Erro ao rolar crítico:", e);
      return 0;
    }
  }

  // ── APLICAR DANO NOS TOKENS SELECIONADOS ────────────────────────────────────
  async function _applyDamageToSelected(amount, card) {
    const tokens = canvas.tokens?.controlled ?? [];
    if ( !tokens.length ) {
      ui.notifications.warn("Selecione um ou mais tokens no canvas antes de aplicar o dano.");
      return;
    }

    // Tipos de dano (para detectar "Verdadeiro" — todos force — uma só vez por aplicação)
    const damageTypesStr = card?.dataset?.damageTypes ?? "";
    const damageTypes = damageTypesStr ? damageTypesStr.split(",").filter(Boolean) : [];
    const soVerdadeiro = damageTypes.length > 0 && damageTypes.every(t => t === "force");
    const cardMeta = { crit: !!card?.querySelector('.jj-mod-check input[data-mod="crit"]:checked') };

    for ( const token of tokens ) {
      await _applyLayeredDamageToActor(token.actor, amount, { soVerdadeiro, cardMeta });
    }

    const nomes = tokens.map(t => t.name).join(", ");
    ui.notifications.info(`${amount} de dano aplicado em: ${nomes}`);

    // Feedback visual no botão
    const btn = card.querySelector("[data-action='jj-apply-damage']");
    if ( btn ) {
      btn.textContent = `✓ ${amount} aplicado`;
      btn.disabled = true;
      btn.style.opacity = "0.6";
    }
  }

  console.log("JujutsuLegacy | Chat card customizado registrado ✓");
})();

/* ============================================================
 * CARDS CUSTOMIZADOS — Dano, Cura, Salvaguarda, Teste, Usar
 * ============================================================ */
(function _registerJujutsuExtraCards() {

  const CARD_TYPES = new Set(["damage", "heal", "save", "check", "utility"]);

  // ── HOOK PRINCIPAL ───────────────────────────────────────────────────────────
  // IMPORTANTE — ordem de registro: o hook de consumo de Recurso customizado
  // (em _registerJujutsuChatCard, bem mais acima neste arquivo) precisa continuar
  // registrado ANTES deste. É o veto dele que impede este card de ser postado
  // quando o recurso configurado na activity está insuficiente — não mexer na
  // ordem relativa dos dois sem entender essa dependência.
  Hooks.on("dnd5e.preUseActivity", (activity, config, dialog) => {
    const item = activity.item;
    if ( !item ) return;
    if ( !CARD_TYPES.has(activity.type) ) return;
    // Limite de Cura: bloqueia heal esgotado antes de postar o card (não desperdiça ação).
    if ( activity.type === "heal" ) {
      const lim = activity.getHealLimit?.();
      if ( lim?.enabled && lim.remaining <= 0 ) {
        ui.notifications.warn(`${item.name}: limite de cura esgotado — resete para curar novamente.`);
        return false;
      }
    }
    resetHealLimitsByTechnique(activity); // reset-por-técnica (o return false abaixo barraria o listener global)
    _postExtraCard(activity, item);
    return false;
  });

  // ── CRIAR CARD ───────────────────────────────────────────────────────────────
  async function _postExtraCard(activity, item) {
    const actor = item.actor;
    const type  = activity.type;

    // Consumir PA configurado
    if ( actor ) {
      const targets = activity.consumption?.targets ?? [];

      // Redução de PA do Seis Olhos
      const seisOlhosItem = actor.items?.find(i => i.name === "Seis Olhos" && i.type === "feat");
      const seisOlhosMode = actor.getFlag("hunter-system", "seisOlhosMode");
      let paReduction = 0;
      if ( seisOlhosItem && seisOlhosMode ) {
        const prof    = actor.system.attributes?.prof ?? 2;
        const halfProf = Math.max(1, Math.floor(prof / 2));
        paReduction = seisOlhosMode === "full" ? prof : halfProf;
      }

      for ( const target of targets ) {
        const isGerada = target.target === "energy.generated";
        const isTotal  = target.target === "energy.total";
        if ( !isGerada && !isTotal ) continue;
        const custoBase = Number(target.value ?? 0);
        if ( custoBase <= 0 ) continue;
        const custo = Math.max(1, custoBase - paReduction);
        const campo = isGerada ? "system.energy.generated" : "system.energy.total";
        const atual = isGerada ? (actor.system?.energy?.generated ?? 0) : (actor.system?.energy?.total ?? 0);
        const label = isGerada ? "PA Gerada" : "PA Total";
        if ( atual < custo ) {
          ui.notifications.warn(`${actor.name} não tem ${label} suficiente! (${atual} disponível, ${custo} necessário)`);
          return;
        }
        await actor.update({ [campo]: atual - custo }, { isEnergySystem: true });
      }
    }

    const description = item.system.description?.value ?? "";
    const hasDescription = description && description !== "<p></p>";
    const typeConfig = _getTypeConfig(activity, item, actor);

    const cardData = {
      itemId:      item.id,
      actorId:     actor?.id ?? null,
      tokenId:     actor?.token?.id ?? null,
      activityId:  activity.id,
      itemName:    item.name,
      itemImg:     item.img,
      type,
      typeLabel:   typeConfig.typeLabel,
      hasDescription,
      description: hasDescription ? description : "",
      btnLabel:    typeConfig.btnLabel,
      btnIcon:     typeConfig.btnIcon,
      btnColor:    typeConfig.btnColor,
      hasApply:    type === "damage",
    };

    const content = _renderExtraCardHTML(cardData);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      flags: { "hunter-system": { jujutsuExtraCard: true, cardData } }
    });
  }

  // ── CONFIG POR TIPO ──────────────────────────────────────────────────────────
  function _getTypeConfig(activity, item, actor) {
    const type = activity.type;
    if ( type === "damage" ) {
      return { typeLabel: "Dano", btnLabel: "Rolar Dano", btnIcon: "fa-burst", btnColor: "#c06040" };
    } else if ( type === "heal" ) {
      return { typeLabel: "Cura", btnLabel: "Rolar Cura", btnIcon: "fa-heart", btnColor: "#40a060" };
    } else if ( type === "save" ) {
      const dc = activity.save?.dc?.value ?? activity.save?.dc ?? "?";
      return { typeLabel: "Salvaguarda", btnLabel: `Salv. CD ${dc}`, btnIcon: "fa-shield-halved", btnColor: "#6040c0" };
    } else if ( type === "check" ) {
      return { typeLabel: "Teste", btnLabel: "Rolar Teste", btnIcon: "fa-dice-d20", btnColor: "#4080c0" };
    } else if ( type === "utility" ) {
      return { typeLabel: "Usar", btnLabel: "Usar", btnIcon: "fa-wand-sparkles", btnColor: "#8060a0" };
    }
    return { typeLabel: "Ação", btnLabel: "Rolar", btnIcon: "fa-dice-d20", btnColor: "#8080a0" };
  }

  // ── HTML DO CARD ─────────────────────────────────────────────────────────────
  function _renderExtraCardHTML(data) {
    const footerHTML = data.hasApply ? `
  <div class="jj-footer" id="jj-extra-footer">
    <div class="jj-mods">
      <label class="jj-mod-check" title="Metade"><input type="checkbox" data-mod="half"> ½</label>
      <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-mod="quarter"> ¼</label>
      <label class="jj-mod-check jj-crit-check" title="Crítico"><input type="checkbox" data-mod="crit"> Crit</label>
    </div>
    <span class="jj-footer-total">Total <strong id="jj-extra-total">0</strong></span>
    <button type="button" class="jj-apply-btn" data-action="jj-extra-apply">Aplicar</button>
  </div>` : "";

    return `<div class="jujutsu-card jj-extra-card"
     data-item-id="${data.itemId}"
     data-actor-id="${data.actorId ?? ""}"
     data-token-id="${data.tokenId ?? ""}"
     data-activity-id="${data.activityId}"
     data-card-type="${data.type}">
  <div class="jj-top-bar">
    <img class="jj-top-icon" src="${data.itemImg}" alt="${data.itemName}">
    <span class="jj-top-name">${data.itemName}</span>
    <span class="jj-top-sub">${data.typeLabel}</span>
  </div>
  ${data.hasDescription ? `<div class="jj-description">${data.description}</div>` : ""}
  <div class="jj-roll-btns" style="grid-template-columns: 1fr;">
    <button type="button" class="jj-btn jj-extra-btn" data-action="jj-extra-roll"
            style="background: color-mix(in srgb, ${data.btnColor} 20%, #0e0e18); color: ${data.btnColor};">
      <i class="fas ${data.btnIcon}"></i> ${data.btnLabel}
    </button>
  </div>
  <div class="jj-panels" style="grid-template-columns: 1fr;">
    <div class="jj-panel" id="jj-extra-panel">
      <div class="jj-panel-label" id="jj-extra-label">${data.typeLabel}</div>
      <div class="jj-panel-val ${data.type === "heal" ? "jj-heal-val" : data.type === "damage" ? "dmg" : ""}" id="jj-extra-val">—</div>
      <div class="jj-panel-breakdown" id="jj-extra-break"></div>
    </div>
  </div>
  ${footerHTML}
</div>`;
  }

  // ── LISTENERS ────────────────────────────────────────────────────────────────
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if ( !root ) return;
    const card = root.querySelector(".jj-extra-card");
    if ( !card ) return;

    card.querySelector("[data-action='jj-extra-roll']")?.addEventListener("click", async (e) => {
      e.preventDefault();
      await _handleExtraRoll(card, message);
    });

    card.querySelector("[data-action='jj-extra-apply']")?.addEventListener("click", () => {
      const base = Number(card.dataset.totalDmg ?? 0);
      const mod  = card.querySelector(".jj-mod-check input:checked")?.dataset.mod ?? null;
      const final = _applyMod(base, mod);
      _applyDmg(final, card);
    });

    card.querySelectorAll(".jj-mod-check input").forEach(cb => {
      cb.addEventListener("change", () => {
        card.querySelectorAll(".jj-mod-check input").forEach(o => { if (o !== cb) o.checked = false; });
        const base = Number(card.dataset.totalDmg ?? 0);
        const mod  = cb.checked ? cb.dataset.mod : null;
        const el   = card.querySelector("#jj-extra-total");
        if ( el ) el.textContent = _applyMod(base, mod);
      });
    });
  });

  // Limite de Cura: capa a cura ao saldo restante e consome (o card customizado
  // não passa pelo rollDamage padrão, então aplicamos o limite aqui).
  async function _applyHealLimit(activity, type, total) {
    if ( type !== "heal" ) return total;
    const lim = activity?.getHealLimit?.();
    if ( !lim?.enabled ) return total;
    const aplicado = Math.max(0, Math.min(total, lim.remaining));
    if ( aplicado < total ) ui.notifications.info(`Cura limitada a ${aplicado} (saldo do Limite de Cura).`);
    if ( aplicado > 0 ) await activity.update({ "healLimit.spent": Math.min(lim.max, lim.spent + aplicado) });
    return aplicado;
  }

  // ── HANDLER PRINCIPAL ────────────────────────────────────────────────────────
  async function _handleExtraRoll(card, message) {
    const actorId    = card.dataset.actorId;
    const tokenId    = card.dataset.tokenId;
    const itemId     = card.dataset.itemId;
    const activityId = card.dataset.activityId;
    const type       = card.dataset.cardType;

    const actor    = tokenId ? canvas.tokens.get(tokenId)?.actor : game.actors.get(actorId);
    const item     = actor?.items.get(itemId);
    const activity = item?.system.activities?.get(activityId);
    if ( !actor || !item ) return;

    const rollData = actor.getRollData();
    const panel    = card.querySelector("#jj-extra-panel");
    const valEl    = card.querySelector("#jj-extra-val");
    const breakEl  = card.querySelector("#jj-extra-break");
    const labelEl  = card.querySelector("#jj-extra-label");

    if ( type === "damage" || type === "heal" ) {
      // Escala de Energia — deduz PA e devolve o bônus a somar (rolagem/flat)
      const escala = await promptJJScale({ actor, activity });
      if ( escala === null ) return; // cancelado
      const escalaFormula = escala?.bonusFormula || "";
      const escalaRoll = escalaFormula ? await new Roll(escalaFormula, rollData).evaluate() : null;
      if ( escalaRoll ) game.dice3d?.showForRoll(escalaRoll, game.user, true);
      const escalaTotal = escalaRoll?.total ?? 0;
      const escalaBreak = escalaRoll
        ? `<span class="jj-mod-pip"> + </span>${_buildBreakdown(escalaRoll)}<span class="jj-pa-badge" style="color:#c0a0ff;border-color:#6040a0;">ESCALA</span>`
        : "";

      const damageParts  = activity?.damage?.parts ?? [];
      const damageLabels = item.labels?.damages ?? [];

      // Para heal sem damage.parts, tenta activity.healing
      if ( damageParts.length === 0 ) {
        const healFormula = activity?.healing?.formula ?? "1d6";
        const roll = await new Roll(healFormula, rollData).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        const total = await _applyHealLimit(activity, type, roll.total + escalaTotal);
        card.dataset.totalDmg = total;
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = "Cura";
        if ( valEl ) { valEl.textContent = total; valEl.className = "jj-panel-val jj-heal-val"; }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll) + escalaBreak;
        _showHealFooter(card, total);
        return;
      }

      const rollPromises = damageParts.map(async (part, i) => {
        const lbl     = damageLabels[i];
        const formula = lbl?.formula ?? _buildDmgFormula(part, actor);
        const label   = lbl?.label ?? (type === "heal" ? "Cura" : "Dano");
        const roll    = await new Roll(formula, rollData).evaluate();
        return { roll, label };
      });

      const resolved = await Promise.all(rollPromises);
      if ( game.dice3d ) Promise.all(resolved.map(r => game.dice3d.showForRoll(r.roll, game.user, true)));

      const total = await _applyHealLimit(activity, type, resolved.reduce((s, r) => s + r.roll.total, 0) + escalaTotal);
      card.dataset.totalDmg = total;
      // Tipos de dano agregados (para detectar "Verdadeiro" na aplicação)
      const allTypes = damageParts.flatMap(p => p.types ?? []);
      card.dataset.damageTypes = allTypes.join(",");
      if ( panel ) panel.classList.add("visible");
      if ( labelEl ) labelEl.textContent = resolved.map(r => r.label).join(" + ") || (type === "heal" ? "Cura" : "Dano");
      if ( valEl ) { valEl.textContent = total; valEl.className = `jj-panel-val ${type === "heal" ? "jj-heal-val" : "dmg"}`; }
      if ( breakEl ) breakEl.innerHTML = resolved.map(r => _buildBreakdown(r.roll)).join('<span class="jj-mod-pip"> + </span>') + escalaBreak;

      if ( type === "damage" ) {
        const footer = card.querySelector("#jj-extra-footer");
        if ( footer ) {
          footer.classList.add("visible");
          const totalEl = footer.querySelector("#jj-extra-total");
          if ( totalEl ) totalEl.textContent = total;
        }
      } else {
        _showHealFooter(card, total);
      }

    } else if ( type === "save" ) {
      // No V14, activity.save.ability é um Set — usar .first()
      const abilitySet   = activity?.save?.ability;
      const ability      = (abilitySet instanceof Set ? abilitySet.first() : null)
                        ?? (typeof abilitySet === "string" ? abilitySet : null)
                        ?? "con";
      const dc           = activity?.save?.dc?.value ?? activity?.save?.dc ?? "?";
      const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability.toUpperCase();
      const targetToken  = [...(game.user.targets ?? [])][0] ?? canvas.tokens?.controlled?.[0];
      const targetActor  = targetToken?.actor;

      if ( targetActor ) {
        const saveMod = targetActor.system?.abilities?.[ability]?.save?.value
                     ?? targetActor.system?.abilities?.[ability]?.mod
                     ?? 0;
        const roll = await new Roll(`1d20 + ${Number(saveMod)}`, targetActor.getRollData()).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        const isNat20 = roll.dice[0]?.results[0]?.result === 20;
        const isNat1  = roll.dice[0]?.results[0]?.result === 1;
        const success  = roll.total >= Number(dc);
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = `Salv. ${abilityLabel} (${targetActor.name})`;
        if ( valEl ) {
          valEl.textContent = roll.total;
          valEl.className   = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : "");
          valEl.style.color = success ? "#60c080" : "#e05050";
        }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll)
          + `<span class="jj-mod-pip"> vs CD ${dc} — ${success ? "✓ Sucesso" : "✗ Falha"}</span>`;
      } else {
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = `Salv. ${abilityLabel}`;
        if ( valEl ) { valEl.textContent = `CD ${dc}`; valEl.className = "jj-panel-val"; valEl.style.fontSize = "28px"; }
        if ( breakEl ) breakEl.innerHTML = `<span class="jj-mod-pip">CD ${dc} — selecione um alvo para rolar</span>`;
      }

      // Botão de dano — sempre visível se houver damageParts, independente de alvo
      {
        // Se tiver dano, injetar botão de rolar dano
        const damageParts = activity?.damage?.parts ?? [];
        if ( damageParts.length && !card.querySelector("[data-action='jj-save-damage']") ) {
          const dmgFooter = document.createElement("div");
          dmgFooter.className = "jj-footer visible";
          dmgFooter.innerHTML = `
            <span class="jj-footer-total" style="color:#c06040">Dano da Salvaguarda</span>
            <button type="button" class="jj-apply-btn" data-action="jj-save-damage"
                    style="background:#2a1010;border-color:#804020;color:#c06040">
              <i class="fas fa-burst"></i> Rolar Dano
            </button>`;
          dmgFooter.querySelector("[data-action='jj-save-damage']").addEventListener("click", async () => {
            const dmgLabels = item.labels?.damages ?? [];

            // Escala de Energia — deduz PA e devolve o bônus a somar
            const escala = await promptJJScale({ actor, activity });
            if ( escala === null ) return; // cancelado
            const escalaFormula = escala?.bonusFormula || "";
            const escalaRoll = escalaFormula ? await new Roll(escalaFormula, rollData).evaluate() : null;

            // Hatsu: passo de dado +1 em técnicas (spells) quando em Ultimato
            const hatsuTier = actor.getFlag("hunter-system", "hatsuActiveTier") ?? "none";
            const ultimatoActive = (hatsuTier === "ultimato");
            const _stepUpFormulaDice = f => {
              const STEP = { "4": "6", "6": "8", "8": "10", "10": "12", "12": "12" };
              return String(f).replace(/(\d*)d(\d+)/g, (m, n, d) => `${n}d${STEP[d] ?? d}`);
            };

            const dmgRolls  = await Promise.all(damageParts.map(async (part, i) => {
              const lbl     = dmgLabels[i];
              let   formula = lbl?.formula ?? _buildDmgFormula(part, actor);
              if ( ultimatoActive ) formula = _stepUpFormulaDice(formula);
              const label   = lbl?.label ?? "Dano";
              const r       = await new Roll(formula, rollData).evaluate();
              return { r, label };
            }));

            // Estágio de Foco — Aumento de Potência
            const estagioFocoAtivo = !!actor.getFlag("hunter-system", "hatsuEstagioFocoAtivo");
            let estagioRoll = null;
            if ( estagioFocoAtivo ) {
              const HATSU_SLOT_DICE = { inata: 5, m1: 3, m2: 5, m3: 8 };
              const hatsuSlot = item.getFlag("hunter-system", "hatsu.slot")
                             ?? item.getFlag("hunter-system", "hatsu.parent");
              const declaredLevel = _hatsuVersatilGrau(actor, item);
              let grade;
              if ( declaredLevel > 0 ) grade = declaredLevel;
              else if ( hatsuSlot && HATSU_SLOT_DICE[hatsuSlot] ) grade = HATSU_SLOT_DICE[hatsuSlot];
              else grade = 1;

              const baseDie = damageParts[0]?.denomination;
              if ( baseDie ) {
                const STEP_NUM = { 4: 6, 6: 8, 8: 10, 10: 12, 12: 12 };
                const dieFace = ultimatoActive ? (STEP_NUM[baseDie] ?? baseDie) : baseDie;
                estagioRoll = await new Roll(`${grade}d${dieFace}`, rollData).evaluate();
              }
            }

            if ( game.dice3d ) {
              Promise.all([
                ...dmgRolls.map(({ r }) => game.dice3d.showForRoll(r, game.user, true)),
                ...(estagioRoll ? [game.dice3d.showForRoll(estagioRoll, game.user, true)] : []),
                ...(escalaRoll ? [game.dice3d.showForRoll(escalaRoll, game.user, true)] : [])
              ]);
            }
            const totalDmg = dmgRolls.reduce((s, { r }) => s + r.total, 0)
                          + (estagioRoll?.total ?? 0)
                          + (escalaRoll?.total ?? 0);

            const dmgPanel = document.createElement("div");
            dmgPanel.className = "jj-panels";
            dmgPanel.style.cssText = "margin-top:6px;grid-template-columns:1fr;";
            const breakdownHtml = dmgRolls.map(({ r }) => _buildBreakdown(r)).join('<span class="jj-mod-pip"> + </span>')
              + (estagioRoll
                  ? `<span class="jj-mod-pip"> + </span>${_buildBreakdown(estagioRoll)}<span class="jj-pa-badge">ESTÁGIO</span>`
                  : "")
              + (escalaRoll
                  ? `<span class="jj-mod-pip"> + </span>${_buildBreakdown(escalaRoll)}<span class="jj-pa-badge" style="color:#c0a0ff;border-color:#6040a0;">ESCALA</span>`
                  : "");
            dmgPanel.innerHTML = `
              <div class="jj-panel visible">
                <div class="jj-panel-label">Dano</div>
                <div class="jj-panel-val dmg">${totalDmg}</div>
                <div class="jj-panel-breakdown">${breakdownHtml}</div>
              </div>`;
            card.appendChild(dmgPanel);

            const applyFooter = document.createElement("div");
            applyFooter.className = "jj-footer visible";
            applyFooter.innerHTML = `
              <div class="jj-mods">
                <label class="jj-mod-check" title="Metade"><input type="checkbox" data-save-mod="half"> ½</label>
                <label class="jj-mod-check" title="Um quarto"><input type="checkbox" data-save-mod="quarter"> ¼</label>
              </div>
              <span class="jj-footer-total">Total <strong id="jj-save-total">${totalDmg}</strong></span>
              <button type="button" class="jj-apply-btn" data-action="jj-apply-save-dmg">Aplicar</button>`;
            applyFooter.querySelectorAll("[data-save-mod]").forEach(cb => {
              cb.addEventListener("change", () => {
                applyFooter.querySelectorAll("[data-save-mod]").forEach(o => { if (o !== cb) o.checked = false; });
                const el = applyFooter.querySelector("#jj-save-total");
                if ( el ) el.textContent = _applyMod(totalDmg, cb.checked ? cb.dataset.saveMod : null);
              });
            });
            applyFooter.querySelector("[data-action='jj-apply-save-dmg']").addEventListener("click", () => {
              const mod   = applyFooter.querySelector("[data-save-mod]:checked")?.dataset.saveMod ?? null;
              _applyDmg(_applyMod(totalDmg, mod), card);
            });
            card.appendChild(applyFooter);
            dmgFooter.remove();
          });
          card.appendChild(dmgFooter);
        }
      }

    } else if ( type === "check" ) {
      const ability      = activity?.check?.associated?.[0] ?? "int";
      const abilityLabel = CONFIG.DND5E.abilities[ability]?.label ?? ability.toUpperCase();
      const mod          = actor.system?.abilities?.[ability]?.mod ?? 0;
      const roll         = await new Roll(`1d20 + ${mod}`, rollData).evaluate();
      game.dice3d?.showForRoll(roll, game.user, true);
      const isNat20 = roll.dice[0]?.results[0]?.result === 20;
      const isNat1  = roll.dice[0]?.results[0]?.result === 1;
      if ( panel ) panel.classList.add("visible");
      if ( labelEl ) labelEl.textContent = `Teste de ${abilityLabel}`;
      if ( valEl ) { valEl.textContent = roll.total; valEl.className = "jj-panel-val" + (isNat20 ? " nat20" : isNat1 ? " nat1" : ""); }
      if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll);

    } else if ( type === "utility" ) {
      const formula = activity?.roll?.formula ?? activity?.rolls?.[0]?.formula ?? null;
      if ( formula ) {
        const roll = await new Roll(formula, rollData).evaluate();
        game.dice3d?.showForRoll(roll, game.user, true);
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = item.name;
        if ( valEl ) { valEl.textContent = roll.total; valEl.className = "jj-panel-val"; }
        if ( breakEl ) breakEl.innerHTML = _buildBreakdown(roll);
      } else {
        if ( panel ) panel.classList.add("visible");
        if ( labelEl ) labelEl.textContent = "Usado!";
        if ( valEl ) { valEl.textContent = "✓"; valEl.className = "jj-panel-val"; valEl.style.color = "#60c080"; }
        if ( breakEl ) breakEl.innerHTML = `<span class="jj-mod-pip">${item.name} ativado</span>`;
      }
    }
  }

  // ── HELPER: botão de aplicar cura ────────────────────────────────────────────
  function _showHealFooter(card, total) {
    if ( card.querySelector("[data-action='jj-apply-heal']") ) return;
    const healFooter = document.createElement("div");
    healFooter.className = "jj-footer visible";
    healFooter.style.cssText = "border-top-color: #30a030;";
    healFooter.innerHTML = `
      <span class="jj-footer-total" style="color:#60c080">Cura <strong>${total}</strong></span>
      <button type="button" class="jj-apply-btn" data-action="jj-apply-heal"
              style="background:#1a3a1a;border-color:#30a030;color:#60c080">Aplicar Cura</button>`;
    healFooter.querySelector("[data-action='jj-apply-heal']").addEventListener("click", async () => {
      const targets = [...(game.user.targets ?? [])];
      const tokens  = targets.length ? targets : (canvas.tokens?.controlled ?? []);
      if ( !tokens.length ) { ui.notifications.warn("Selecione um token para aplicar a cura."); return; }
      for ( const token of tokens ) {
        const a  = token.actor ?? token;
        const hp = a?.system?.attributes?.hp;
        if ( !hp ) continue;
        const novoHP = Math.min(hp.effectiveMax ?? hp.max, (hp.value ?? 0) + total);
        await a.update({ "system.attributes.hp.value": novoHP });
      }
      ui.notifications.info(`${total} de cura aplicada!`);
      const btn = healFooter.querySelector("[data-action='jj-apply-heal']");
      if ( btn ) { btn.textContent = `✓ ${total} curado`; btn.disabled = true; btn.style.opacity = "0.6"; }
    });
    card.appendChild(healFooter);
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  function _buildDmgFormula(part, actor) {
    const num     = part.number ?? 1;
    const den     = part.denomination ?? 6;
    const bon     = part.bonus ?? "";
    const ability = actor.system?.attributes?.spellcasting ?? "str";
    const mod     = actor.system?.abilities?.[ability]?.mod ?? 0;
    let f = `${num}d${den}`;
    if ( bon ) f += ` + ${bon}`;
    if ( mod ) f += ` + ${mod}`;
    return f;
  }

  function _buildBreakdown(roll) {
    const diceParts = [];
    const modParts  = [];

    for ( const term of roll.terms ) {
      if ( term.results ) {
        const spans = term.results.map(r => {
          let cls;
          if ( r.discarded )                   cls = "jj-die discarded";
          else if ( r.result === term.faces )  cls = "jj-die max";
          else if ( r.result === 1 )           cls = "jj-die min";
          else                                 cls = "jj-die active";
          return `<span class="${cls}">${r.result}</span>`;
        });
        diceParts.push(spans.join('<span class="jj-mod-pip">, </span>'));
      } else if ( typeof term.number === "number" && term.number !== 0 ) {
        modParts.push(`<span class="jj-mod-pip">${term.number > 0 ? "+" : ""}${term.number}</span>`);
      }
    }

    const diceHtml = diceParts.length
      ? `<span class="jj-break-bracket">[</span>${diceParts.join('<span class="jj-mod-pip">, </span>')}<span class="jj-break-bracket">]</span>`
      : "";
    return diceHtml + modParts.join("");
  }

  function _applyMod(base, mod) {
    if ( mod === "half" )    return Math.floor(base / 2);
    if ( mod === "quarter" ) return Math.floor(base / 4);
    if ( mod === "crit" )    return base * 2;
    return base;
  }

  async function _applyDmg(amount, card) {
    const tokens = canvas.tokens?.controlled ?? [];
    if ( !tokens.length ) { ui.notifications.warn("Selecione um ou mais tokens no canvas."); return; }

    // Tipos de dano (para detectar "Verdadeiro" — todos force — uma só vez por aplicação)
    const damageTypesStr = card?.dataset?.damageTypes ?? "";
    const damageTypes = damageTypesStr ? damageTypesStr.split(",").filter(Boolean) : [];
    const soVerdadeiro = damageTypes.length > 0 && damageTypes.every(t => t === "force");
    const cardMeta = { crit: !!card?.querySelector('.jj-mod-check input[data-mod="crit"]:checked') };

    for ( const token of tokens ) {
      await _applyLayeredDamageToActor(token.actor, amount, { soVerdadeiro, cardMeta });
    }
    ui.notifications.info(`${amount} de dano aplicado em: ${tokens.map(t => t.name).join(", ")}`);
    const btn = card.querySelector("[data-action='jj-extra-apply']");
    if ( btn ) { btn.textContent = `✓ ${amount} aplicado`; btn.disabled = true; btn.style.opacity = "0.6"; }
  }

  console.log("JujutsuLegacy | Cards extras registrados ✓");
})();

(function _registerCursedEnergyConsumption() {
  const PATH_GERADA = "energy.generated";
  const PATH_TOTAL  = "energy.total";
  function _addPaths() {
    const res = CONFIG.DND5E?.consumableResources;
    if ( !Array.isArray(res) ) return;
    for ( const path of [PATH_GERADA, PATH_TOTAL] ) {
      if ( !res.includes(path) ) res.push(path);
    }
    const attrType = CONFIG.DND5E?.activityConsumptionTypes?.attribute;
    if ( attrType ) {
      attrType.scalingModes ??= [];
      if ( !attrType.scalingModes.some(m => m.value === "pa") ) {
        attrType.scalingModes.push({ value: "pa", label: "PA Extra (+1 por step)" });
      }
    }
  }
  Hooks.on("setup", _addPaths);
  Hooks.once("ready", _addPaths);
  function _injectLabels(app, html) {
    const name = app.constructor?.name ?? "";
    if ( !name.toLowerCase().includes("activity") ) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if ( !root ) return;
    root.querySelectorAll("option").forEach(opt => {
      if ( opt.value === PATH_GERADA ) opt.textContent = "⚡ Energia Gerada (PA)";
      if ( opt.value === PATH_TOTAL  ) opt.textContent = "🔮 Energia Total (PA)";
    });
  }
  Hooks.on("renderApplication",   _injectLabels);
  Hooks.on("renderDocumentSheet", _injectLabels);
  Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
    const actor = activity.item?.actor ?? activity.actor;
    if ( !actor ) return;
    // Não bloqueamos mais aqui — o chat card customizado já trata isso
  });
})();

/* ============================================================
 * CONDIÇÕES DO SISTEMA JUJUTSU LEGACY
 * ============================================================ */

export const JJ_CONDITIONS = [
  { id: "jj-agarrado",        label: "Agarrado",         icon: "fas fa-hand-grab",         desc: "Deslocamento 0. Encerra se quem agarrou ficar incapacitado ou soltar.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.mlfBihj1WTMnp8tt" },
  { id: "jj-alucinado",       label: "Alucinado",        icon: "fas fa-brain",             desc: "Ataca qualquer criatura próxima indiscriminadamente. ND −2.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.g0jKKMfi2ShUJ3lm" },
  { id: "jj-amedrontado",     label: "Amedrontado",      icon: "fas fa-person-running",    desc: "Desvantagem em testes e ataques enquanto fonte do medo estiver visível.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.8AbcrNaNNfIbQs4G" },
  { id: "jj-apaixonado",      label: "Apaixonado",       icon: "fas fa-heart",             desc: "Não pode atacar quem a apaixonou. Quem apaixonou tem vantagem em testes sociais.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.vImaFZEzGlr0WdJm" },
  { id: "jj-atordoado",       label: "Atordoado",        icon: "fas fa-stars",             desc: "Incapacitado, imóvel, fala hesitante. Falha em For/Agi. Ataques contra têm vantagem.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.bR1Lz7cbCZST2Auk" },
  { id: "jj-bebado",          label: "Bêbado",           icon: "fas fa-beer-mug-empty",    desc: "Desvantagem em Salv. e testes de Agilidade. Encerra com Salv. CON ou situação adequada.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.wceHJV6dZP4KzaAW" },
  { id: "jj-caido",           label: "Caído",            icon: "fas fa-person-falling",    desc: "Só pode rastejar. Desvantagem em ataques. Ataques a 1,5m têm vantagem.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.SjtAEH0zyJb5VRfv" },
  { id: "jj-cego",            label: "Cego",             icon: "fas fa-eye-slash",         desc: "Falha em testes que requeiram visão. Ataques contra têm vantagem; seus ataques têm desvantagem.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.P1ziScgbUVuhsVPz" },
  { id: "jj-congelado",       label: "Congelado",        icon: "fas fa-snowflake",         desc: "Incapacitado, imóvel. Resistência a todos os danos. Imune a veneno e doenças.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.a6IWy4W4n2D8Z8Ze" },
  { id: "jj-desidratado",     label: "Desidratado",      icon: "fas fa-droplet-slash",     desc: "Deslocamento ÷2. 1 nível de exaustão por hora. Só ação OU ação bônus por turno.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.TJU7w36NnMHjnxfD" },
  { id: "jj-empoderado",      label: "Empoderado",       icon: "fas fa-fist-raised",       desc: "Dano corpo-a-corpo → 1d12. PA de técnicas mal-sucedidas não descontados.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.AFNLlT5TrbqmkfbV" },
  { id: "jj-enfeiticado",     label: "Enfeitiçado",      icon: "fas fa-wand-sparkles",     desc: "Não pode atacar quem a enfeitiçou. Quem enfeitiçou tem vantagem em testes sociais.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.24HWsBJxkRfUj0It" },
  { id: "jj-enfurecido",      label: "Enfurecido",       icon: "fas fa-fire-flame-curved", desc: "Ataca fonte da fúria com desvantagem. Dano corpo-a-corpo +1d4. Dura 1 minuto.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.IUGCnR8QkoGA6ctr" },
  { id: "jj-energia-esgotada",label: "Energia Esgotada", icon: "fas fa-battery-empty",     desc: "Não pode usar nenhuma habilidade ou técnica. Também está Letárgica.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.S9EiUtSjRVrJqAK8" },
  { id: "jj-estremecido",     label: "Estremecido",      icon: "fas fa-person-trembling",  desc: "Desvantagem em ataques. Não pode usar técnicas com concentração. Deslocamento custa 2×.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.sSPiyuksW97O34QI" },
  { id: "jj-exausto",         label: "Exausto",          icon: "fas fa-tired",             desc: "−2 em rolagens d20. −1,5m de deslocamento. Acumulável até 3× por técnicas.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.jUQ0Ojn7NsJcygkg" },
  { id: "jj-envenenado",      label: "Envenenado",       icon: "fas fa-skull-crossbones",  desc: "Desvantagem em ataques e testes. Após 1 dia, Salv. CON CD 15 para encerrar.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.64NP2kxSF8mfti6U" },
  { id: "jj-hipotermico",     label: "Hipotérmico",      icon: "fas fa-temperature-low",   desc: "Desvantagem em Salv. Agi, testes e ataques. Encerra com Medicina CD 10 ou Sobrev. CD 17.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.m27RYswlWudR9DFt" },
  { id: "jj-impedido",        label: "Impedido",         icon: "fas fa-ban",               desc: "Deslocamento 0. Ataques contra têm vantagem; seus ataques têm desvantagem.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.TY0bMiK70ov78CLz" },
  { id: "jj-incapacitado",    label: "Incapacitado",     icon: "fas fa-circle-xmark",      desc: "Não pode realizar ações ou reações.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.fiVKmMfElwun0dCb" },
  { id: "jj-inconsciente",    label: "Inconsciente",     icon: "fas fa-moon",              desc: "Incapacitado, imóvel, sem ciência. Falha For/Agi. Ataques têm vantagem. Crit a 1,5m.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.k2u92af7x9UErMYA" },
  { id: "jj-invisivel",       label: "Invisível",        icon: "fas fa-ghost",             desc: "Impossível de ver sem técnicas especiais. Seus ataques têm vantagem; ataques contra têm desvantagem.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.X9PdPvCaP6CZH6ez" },
  { id: "jj-letargico",       label: "Letárgico",        icon: "fas fa-person-walking",    desc: "Deslocamento ÷2. Dano de ataques ÷2 (exceto armas de fogo).", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.j0tOdlX3KHl6WS8S" },
  { id: "jj-mudo",            label: "Mudo",             icon: "fas fa-volume-xmark",      desc: "Falha em testes que requeiram fala. Não emite sons pela boca.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.vVo8o6aHW1JzkFz3" },
  { id: "jj-paralisado",      label: "Paralisado",       icon: "fas fa-person-rays",       desc: "Incapacitado, imóvel. Sem ações bônus. Falha For/Agi. Ataques têm vantagem. Crit a 1,5m.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.4fMgcIkU1a0dZ2lt" },
  { id: "jj-pesado",          label: "Pesado",           icon: "fas fa-weight-hanging",    desc: "Deslocamento ÷2. Desvantagem em ataques corpo-a-corpo.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.CJYCKRZPwzMmZbK1" },
  { id: "jj-petrificado",     label: "Petrificado",      icon: "fas fa-monument",          desc: "Incapacitado, imóvel, peso ×10. Resistência a todos os danos. Imune a veneno/doenças.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.IvoYeweAcCAK4FOp" },
  { id: "jj-queimado",        label: "Queimado",         icon: "fas fa-fire",              desc: "1d6 Fogo irredutível na primeira ação/movimento por turno. Sem técnicas com concentração.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.zsCYJFxtE28qaQim" },
  { id: "jj-queimadura",      label: "Queimadura",       icon: "fas fa-fire-flame-simple", desc: "Desvantagem em Testes de Concentração. Encerra com Medicina CD 13 ou Sobrev. CD 17.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.yPXw8c6JzyUX6Fik" },
  { id: "jj-sangramento",     label: "Sangramento",      icon: "fas fa-droplet",           desc: "1d6 Cortante irredutível na primeira ação/movimento. Acumulável 3×. Encerra com Medicina CD 12.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.imw5GzpBqNMPuBIN" },
  { id: "jj-sonolento",       label: "Sonolento",        icon: "fas fa-bed",               desc: "Sem ações bônus ou reações. Desv. Salv. Agi e Sab. Máx. 1 ataque corpo-a-corpo por turno.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.rpsUvEOS6Veec4GO" },
  { id: "jj-sufocado",        label: "Sufocado",         icon: "fas fa-lungs-virus",       desc: "Desv. Salv. Agi. Após turnos (1+mod.CON), Teste CON CD 10 ou desmaia. CD +2 por turno.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.7xTHnHgiQvrBUde7" },
  { id: "jj-surdo",           label: "Surdo",            icon: "fas fa-ear-deaf",          desc: "Falha em testes que requeiram audição.", reference: "Compendium.hunter-system.conteudo.JournalEntry.ZI4IYTRv7YQVnMpf.JournalEntryPage.V1qYSFa9hf5Max5Z" }
];

/**
 * Injeta a seção de condições Jujutsu na aba Effects.
 * Chamada dentro do _onRender da CharacterActorSheet.
 */
export function _injectJJConditions(element, actor) {
  // Só age na aba effects
  const effectsTab = element.querySelector('[data-tab="effects"]');
  if ( !effectsTab ) return;

  // Esconder seção nativa de condições
  const nativeSections = effectsTab.querySelectorAll(".conditions, .conditions-list");
  nativeSections.forEach(el => {
    // Subir até o header + lista
    const section = el.closest("fieldset, section, .flexcol") ?? el;
    section.style.display = "none";
  });

  // Evitar injeção duplicada
  if ( effectsTab.querySelector(".jj-conditions-section") ) {
    // Atualizar estado ativo das condições existentes
    const activeStatuses = new Set(actor.statuses ?? []);
    effectsTab.querySelectorAll(".jj-cond-item").forEach(item => {
      item.classList.toggle("active", activeStatuses.has(item.dataset.condId));
    });
    return;
  }

  const activeStatuses = new Set(actor.statuses ?? []);

  const section = document.createElement("div");
  section.className = "jj-conditions-section";
  section.innerHTML = `
    <div class="jj-cond-header">
      <span>Condições</span>
      <button type="button" class="jj-cond-custom-btn" title="Condição customizada">
        <i class="fas fa-plus"></i>
      </button>
    </div>
    <div class="jj-cond-grid">
      ${JJ_CONDITIONS.map(cond => `
        <div class="jj-cond-item ${activeStatuses.has(cond.id) ? "active" : ""}"
             data-cond-id="${cond.id}"
             ${cond.reference ? `data-reference-tooltip="${cond.reference}"` : `data-tooltip="${cond.label}" data-tooltip-direction="UP"`}>
          <i class="${cond.icon}"></i>
          <span>${cond.label}</span>
        </div>`).join("")}
    </div>`;

  // Listeners de toggle
  section.querySelectorAll(".jj-cond-item").forEach(el => {
    el.addEventListener("click", async () => {
      const condId = el.dataset.condId;
      const isActive = el.classList.contains("active");
      const cond = JJ_CONDITIONS.find(c => c.id === condId);
      if ( !isActive ) {
        await actor.createEmbeddedDocuments("ActiveEffect", [{
          name:     cond.label,
          icon:     "icons/svg/aura.svg",
          statuses: [condId],
          flags:    { "hunter-system": { isJujutsuCondition: true } }
        }]);
      } else {
        const existing = actor.effects.find(e => e.statuses?.has(condId));
        if ( existing ) await existing.delete();
      }
      // Estado visual atualizado automaticamente pelo re-render
    });
  });

  // Botão condição customizada
  section.querySelector(".jj-cond-custom-btn").addEventListener("click", async () => {
    const name = await foundry.applications.api.DialogV2.wait({
      window: { title: "Condição Customizada" },
      content: `<div style="padding:8px 0">
        <label style="display:block;margin-bottom:6px;font-size:12px;color:#aaa">Nome:</label>
        <input type="text" id="jj-custom-cond" placeholder="Ex: Marcado, Maldito..." style="width:100%">
      </div>`,
      buttons: [
        {
          label:   "Adicionar",
          action:  "ok",
          default: true,
          callback: (event, button, dialog) => (dialog.element?.querySelector("#jj-custom-cond") ?? document.querySelector("#jj-custom-cond"))?.value?.trim() ?? null
        },
        {
          label:    "Cancelar",
          action:   "cancel",
          callback: () => null
        }
      ],
      rejectClose: false,
      close: () => null
    });
    if ( !name ) return;
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name,
      icon:     "icons/svg/aura.svg",
      statuses: [`jj-custom-${name.toLowerCase().replace(/\s+/g, "-")}`],
      flags:    { "hunter-system": { isCustomCondition: true } }
    }]);
    ui.notifications.info(`Condição "${name}" adicionada a ${actor.name}.`);
  });

  effectsTab.appendChild(section);

  // Aplicar tooltips de referência nos itens injetados dinamicamente
  section.querySelectorAll("[data-reference-tooltip]").forEach(el => {
    el.dataset.tooltip = `\n      <section class="loading" data-uuid="${el.dataset.referenceTooltip}"><i class="fas fa-spinner fa-spin-pulse"></i></section>\n    `;
  });
}

/* ============================================================
 * CAMPO DE CUSTO DE PA NA ABA DE ATIVIDADES
 * Injeta campo de custo (PA Gerada/Total) na listagem de
 * atividades do item sheet. Ao salvar, configura o Consumption
 * da atividade automaticamente — apenas se vazio.
 * ============================================================ */

(function _registerActivityCostField() {

  // Lê o consumption atual de PA de uma atividade
  function _getExistingPaCost(activity) {
    const targets = activity.consumption?.targets ?? [];
    const paTarget = targets.find(t =>
      t.type === "attribute" &&
      (t.target === "energy.generated" || t.target === "energy.total")
    );
    if ( !paTarget ) return { amount: "", pool: "generated" };
    return {
      amount: paTarget.value ?? "",
      pool: paTarget.target === "energy.total" ? "total" : "generated"
    };
  }

  // Injeta os campos de custo em todas as atividades visíveis
  function _injectCostFields(html, item) {
    // Seletor correto: li.item.activity[data-activity-id]
    const rows = html.querySelectorAll("li.activity[data-activity-id], li.item.activity[data-activity-id]");
    if ( !rows.length ) return;

    // Mesmo ator para todas as linhas deste item — calcular uma vez só, não por linha.
    const hasActor = !!item.actor;
    const actorRes = item.actor?.getFlag?.("hunter-system", "customResources") ?? [];
    const noResOptionLabel = hasActor ? "— sem recursos —" : "— item sem personagem —";

    rows.forEach(row => {
      // Evitar duplicação
      if ( row.querySelector(".jj-pa-cost-field") ) return;

      const activityId = row.dataset.activityId;
      if ( !activityId ) return;

      const activity = item.system.activities?.get(activityId);
      if ( !activity ) return;

      const { amount, pool } = _getExistingPaCost(activity);

      // Recurso customizado já configurado (flag na activity)
      const rc    = activity.flags?.["hunter-system"]?.resourceCost ?? {};
      const rcId  = rc.id ?? "";
      const rcAmt = Number(rc.amount) > 0 ? rc.amount : "";
      const poolAbbr = pool === "total" ? "T" : "G";
      const resOptions = actorRes.length
        ? `<option value="">—</option>` + actorRes.map(r =>
            `<option value="${foundry.utils.escapeHTML(String(r.id))}" ${r.id === rcId ? "selected" : ""}>${foundry.utils.escapeHTML(String(r.name ?? ""))}</option>`
          ).join("")
        : `<option value="">${noResOptionLabel}</option>`;

      // Campo de Custo (PA) — reserva mostra só G/T fechada; nome inteiro no dropdown
      const wrapper = document.createElement("div");
      wrapper.className = "jj-pa-cost-field";
      wrapper.innerHTML = `
        <input type="number" class="jj-pa-amount" value="${amount}" placeholder="PA" min="0"
               title="Custo em PA" ${amount ? 'disabled' : ''}>
        <span class="jj-pool-wrap">
          <select class="jj-pa-pool" title="Reserva de PA" ${amount ? 'disabled' : ''}>
            <option value="generated" ${pool === "generated" ? "selected" : ""}>⚡ Gerada</option>
            <option value="total"     ${pool === "total"     ? "selected" : ""}>🔮 Total</option>
          </select>
          <span class="jj-pool-abbr">${poolAbbr}</span>
        </span>
        ${amount ? `<button class="jj-pa-clear" title="Remover custo">✕</button>` : ""}
      `;

      // Campo de Recurso customizado (consumido ao usar a atividade)
      const resWrapper = document.createElement("div");
      resWrapper.className = "jj-resource-cost-field";
      resWrapper.innerHTML = `
        <select class="jj-res-select" title="Recurso consumido ao usar" ${actorRes.length ? "" : "disabled"}>
          ${resOptions}
        </select>
        <input type="number" class="jj-res-amount" value="${rcAmt}" placeholder="Qtd" min="0"
               title="Quantidade consumida" ${actorRes.length ? "" : "disabled"}>
      `;

      const input      = wrapper.querySelector(".jj-pa-amount");
      const select     = wrapper.querySelector(".jj-pa-pool");
      const poolAbbrEl = wrapper.querySelector(".jj-pool-abbr");
      const clearBtn   = wrapper.querySelector(".jj-pa-clear");
      const resSelect  = resWrapper.querySelector(".jj-res-select");
      const resAmount  = resWrapper.querySelector(".jj-res-amount");

      // Atualiza a abreviação G/T conforme a reserva escolhida
      select.addEventListener("change", () => {
        if ( poolAbbrEl ) poolAbbrEl.textContent = select.value === "total" ? "T" : "G";
      });

      async function _saveCost() {
        const val = parseInt(input.value);
        if ( !val || val <= 0 ) return;
        const target = select.value === "total" ? "energy.total" : "energy.generated";
        const existing = activity.consumption?.targets ?? [];
        const hasPa = existing.some(t =>
          t.type === "attribute" &&
          (t.target === "energy.generated" || t.target === "energy.total")
        );
        if ( hasPa ) return;
        await activity.update({
          "consumption.targets": [
            ...existing,
            { type: "attribute", target, value: val, scaling: { mode: "", formula: "" } }
          ]
        });
        ui.notifications.info(`Custo de ${val} PA (${select.value === "total" ? "Total" : "Gerada"}) salvo em "${activity.name}".`);
      }

      // Upsert/remoção do Recurso customizado consumido pela atividade (flag na activity)
      async function _saveResource() {
        const id  = resSelect.value;
        const amt = parseInt(resAmount.value) || 0;
        if ( !id || amt <= 0 ) {
          if ( activity.flags?.["hunter-system"]?.resourceCost ) {
            await activity.update({ "flags.hunter-system.-=resourceCost": null });
          }
          return;
        }
        const res = (item.actor?.getFlag?.("hunter-system", "customResources") ?? []).find(r => r.id === id);
        await activity.update({ "flags.hunter-system.resourceCost": { id, name: res?.name ?? "", amount: amt } });
        ui.notifications.info(`Recurso "${res?.name ?? id}" (${amt}) configurado em "${activity.name}".`);
      }

      input.addEventListener("keydown", e => { if ( e.key === "Enter" ) { e.preventDefault(); _saveCost(); } });
      input.addEventListener("blur", _saveCost);
      resSelect.addEventListener("change", _saveResource);
      resAmount.addEventListener("keydown", e => { if ( e.key === "Enter" ) { e.preventDefault(); _saveResource(); } });
      resAmount.addEventListener("blur", _saveResource);

      if ( clearBtn ) {
        clearBtn.addEventListener("click", async e => {
          e.stopPropagation();
          const existing = activity.consumption?.targets ?? [];
          const filtered = existing.filter(t =>
            !(t.type === "attribute" &&
              (t.target === "energy.generated" || t.target === "energy.total"))
          );
          await activity.update({ "consumption.targets": filtered });
          ui.notifications.info(`Custo de PA removido de "${activity.name}".`);
        });
      }

      // Inserir dentro de .item-row, antes dos controles (Custo + Recursos)
      const itemRow = row.querySelector(".item-row") ?? row;
      const controls = itemRow.querySelector(".item-controls, .activity-controls, .controls");
      if ( controls ) { itemRow.insertBefore(wrapper, controls); itemRow.insertBefore(resWrapper, controls); }
      else { itemRow.appendChild(wrapper); itemRow.appendChild(resWrapper); }
    });
  }

  // Mapa de observers por form ID para evitar duplicação
  const _formObservers = new Map();

  // Configura observer dentro de um form de item sheet
  function _watchForm(form, item) {
    if ( _formObservers.has(form.id) ) return;

    // _injectCostFields insere nós no próprio form observado — sem desconectar
    // durante a injeção, essas inserções disparam o observer de novo, causando
    // um passe redundante extra a cada mudança real.
    let obs;
    function runInject() {
      obs.disconnect();
      _injectCostFields(form, item);
      obs.observe(form, { childList: true, subtree: true });
    }

    obs = new MutationObserver(() => runInject());

    // Injetar imediatamente
    runInject();
    _formObservers.set(form.id, obs);

    // Limpar quando o form for removido do DOM
    const cleanup = new MutationObserver((muts) => {
      for ( const m of muts ) {
        for ( const n of m.removedNodes ) {
          if ( n === form || n.contains?.(form) ) {
            obs.disconnect();
            cleanup.disconnect();
            _formObservers.delete(form.id);
          }
        }
      }
    });
    cleanup.observe(document.body, { childList: true, subtree: true });
  }

  // Observer no body para detectar novos item sheets
  Hooks.once("ready", () => {
    const _bodyObserver = new MutationObserver((mutations) => {
      for ( const mutation of mutations ) {
        for ( const node of mutation.addedNodes ) {
          if ( !(node instanceof HTMLElement) ) continue;
          let form = node.id?.startsWith("ItemSheet5e") ? node
            : node.querySelector?.('form[id^="ItemSheet5e"]');
          if ( !form ) continue;
          const app = foundry.applications.instances.get(form.id);
          if ( !app ) return;
          const item = app.document;
          if ( !item?.system?.activities ) continue;
          setTimeout(() => _watchForm(form, item), 100);
        }
      }
    });
    _bodyObserver.observe(document.body, { childList: true, subtree: true });
  });

  // Fallback: clique na aba de atividades
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest("[data-tab='activities']");
    if ( !btn ) return;
    const form = btn.closest('form[id^="ItemSheet5e"]');
    if ( !form ) return;
    const app = foundry.applications.instances.get(form.id);
    if ( !app ) return;
    const item = app.document;
    if ( !item?.system?.activities ) return;
    setTimeout(() => _watchForm(form, item), 150);
  }, true);

  // CSS inline (via <style> injetado no head)
  if ( !document.querySelector("#jj-pa-cost-style") ) {
    const style = document.createElement("style");
    style.id = "jj-pa-cost-style";
    style.textContent = `
      /* Cabeçalhos "Cargas" (usos limitados nativos) / "Custo" / "Recursos" —
         3 colunas de cabeçalho pras 3 colunas de conteúdo que a linha pode ter
         (usos limitados nativos do dnd5e, quando configurados, continuam
         renderizando ao lado do Custo/Recursos — sem cabeçalho próprio ficariam
         desalinhados). */
      .activities-element .items-header .jj-native-uses-header { width: 70px !important; flex: 0 0 70px !important; justify-content: center; }
      .activities-element .items-header .jj-cost-header { width: 96px !important; flex: 0 0 96px !important; justify-content: center; }
      .activities-element .items-header .jj-res-header  { width: 132px !important; flex: 0 0 132px !important; justify-content: center; text-align: center; }
      /* Esconde a coluna de cargas vazia nas linhas (some quando não há usos limitados) */
      .activities-element .item-detail.item-uses.empty { display: none !important; }

      .jj-pa-cost-field {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 96px;
        flex: none;
        box-sizing: border-box;
      }
      .jj-resource-cost-field {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 132px;
        flex: none;
        box-sizing: border-box;
      }
      .jj-pa-amount {
        width: 38px;
        height: 22px;
        padding: 0 4px;
        font-size: 11px;
        text-align: center;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #c0a8ff;
      }
      .jj-pa-amount:disabled {
        color: #6060a0;
        opacity: 0.8;
      }
      /* Reserva de PA — fechada mostra só G/T (overlay); nome inteiro só no dropdown */
      .jj-pool-wrap { position: relative; display: inline-flex; align-items: center; }
      .jj-pa-pool {
        appearance: none;
        -webkit-appearance: none;
        height: 22px;
        width: 30px;
        font-size: 10px;
        padding: 0 2px;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: transparent;
        cursor: pointer;
      }
      .jj-pa-pool option { color: #cfc6ff; background: #0e0e18; }
      .jj-pa-pool:disabled { opacity: 0.7; cursor: default; }
      .jj-pool-abbr {
        position: absolute;
        left: 5px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        font-size: 11px;
        font-weight: 700;
        color: #b9a6ff;
      }
      .jj-pool-abbr::after { content: "⌄"; margin-left: 1px; font-size: 9px; color: #6a6a90; }

      /* Recurso customizado consumido ao usar a atividade */
      .jj-res-select {
        height: 22px;
        max-width: 86px;
        font-size: 10px;
        padding: 0 2px;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #c8b0ff;
        cursor: pointer;
      }
      .jj-res-select:disabled { opacity: 0.6; cursor: default; }
      .jj-res-amount {
        width: 34px;
        height: 22px;
        padding: 0 3px;
        font-size: 11px;
        text-align: center;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #c8b0ff;
      }
      .jj-res-amount:disabled { opacity: 0.6; }
      .jj-pa-clear {
        width: 18px;
        height: 18px;
        font-size: 9px;
        background: #1a0808;
        border: 1px solid #5a1a1a;
        border-radius: 3px;
        color: #c05050;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .jj-pa-clear:hover { background: #2a0808; color: #ff6060; }
    `;
    document.head.appendChild(style);
  }

  console.log("JujutsuLegacy | Campo de custo de PA nas atividades carregado ✓");
})();

/* ============================================================
 * EXPLOSÃO DEFENSIVA — Botão na Sidebar
 * Aparece abaixo dos Favoritos quando o personagem tiver a
 * habilidade desbloqueada. Permite gastar PA para reduzir o
 * próximo dano recebido no card Jujutsu.
 * ============================================================ */

// Chave do flag onde guardamos a redução pendente
const JJ_DEF_FLAG = "hunter-system.explosaoDefensivaPendente";

/**
 * Handler do botão de Explosão Defensiva — chamado pelo listener no _onRender.
 */
async function _onExplosaoDefensiva(actor) {
  const flagData      = actor.getFlag("hunter-system", "explosaoDefensivaPendente") ?? null;
  const pendente      = flagData?.reducao ?? 0;
  const pendenteCusto = flagData?.paCusto ?? 0;

  if ( pendente > 0 ) {
    // Perguntar se quer cancelar
    const cancel = await foundry.applications.api.DialogV2.confirm({
      window: { title: "🛡️ Explosão Defensiva Ativa" },
      content: `<p>Há uma redução de <strong>${pendente}</strong> pontos pendente (custo: <strong>${pendenteCusto} PA</strong>).</p><p>Deseja cancelar e recuperar a PA?</p>`,
      yes: { label: "Cancelar e Devolver PA" },
      no:  { label: "Manter" }
    });
    if ( !cancel ) return;
    await actor.unsetFlag("hunter-system", "explosaoDefensivaPendente");
    const paAtual = actor.system?.energy?.generated ?? 0;
    await actor.update({ "system.energy.generated": paAtual + pendenteCusto });
    ui.notifications.info("Explosão Defensiva cancelada. PA devolvida.");
    return;
  }

  const result = await _explosaoDefensivaDialog(actor);
  if ( !result ) return;

  await actor.setFlag("hunter-system", "explosaoDefensivaPendente", { reducao: result.reducao, paCusto: result.paCusto });
  const paAtual = actor.system?.energy?.generated ?? 0;
  await actor.update({ "system.energy.generated": Math.max(0, paAtual - result.paCusto) });
  ui.notifications.info(`🛡️ Explosão Defensiva ativa! Próximo dano reduzido em ${result.reducao} (${result.paCusto} PA gasto).`);
}

/**
 * Dialog de escolha de PA para Explosão Defensiva.
 * Retorna o total de redução rolado (soma dos Nd4), ou null se cancelado.
 */
async function _explosaoDefensivaDialog(actor) {
  const paDisp   = actor.system?.energy?.generated ?? 0;
  const profBonus = actor.system?.attributes?.prof ?? 2;
  const maxPA = paDisp;

  if ( maxPA === 0 ) {
    ui.notifications.warn("PA Gerada insuficiente para Explosão Defensiva!");
    return null;
  }

  const paGasto = await foundry.applications.api.DialogV2.wait({
    window: { title: "🛡️ Explosão Defensiva" },
    content: `
      <div style="padding:8px 0">
        <p style="margin:0 0 8px">Gastar PA para reduzir o próximo dano?</p>
        <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
          PA Gerada disponível: <strong>${paDisp}</strong> &nbsp;|&nbsp;
          Máximo: <strong>${maxPA}</strong> d4
        </p>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <label style="flex:0 0 auto">Dados d4:</label>
          <input type="number" id="jj-expdef-input"
                 value="0" min="0" max="${maxPA}"
                 style="width:60px; text-align:center;">
          <span style="font-size:12px; color:#aaa;">1 PA por dado</span>
        </div>
      </div>`,
    buttons: [
      {
        label:   "Rolar",
        action:  "ok",
        default: true,
        callback: (event, button, dialog) => {
          const input = dialog.element?.querySelector("#jj-expdef-input") ?? document.querySelector("#jj-expdef-input");
          return Math.max(0, Math.min(Number(input?.value ?? 0), maxPA));
        }
      },
      {
        label:    "Cancelar",
        action:   "cancel",
        callback: () => null
      }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( paGasto === null || paGasto === undefined || paGasto === 0 ) return paGasto ?? 0;

  // Rolar os dados e calcular a redução
  const roll = await new Roll(`${paGasto}d4`).evaluate();
  if ( game.dice3d ) await game.dice3d.showForRoll(roll, game.user, true);
  const total = roll.total;

  // Mostrar no chat
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor:  `🛡️ <strong>${actor.name}</strong> usa Explosão Defensiva — reduz <strong>${total}</strong> do próximo dano!`,
    rollMode: game.settings.get("core", "rollMode")
  });

  return { reducao: total, paCusto: paGasto };
}

/**
 * Intercepta o botão "Aplicar" do card Jujutsu e subtrai a redução pendente.
 * Chamado em _applyDamageToSelected (já existente no character-sheet.mjs).
 *
 * Para integrar: antes de aplicar o dano final aos tokens selecionados,
 * verificar se algum token tem flag de Explosão Defensiva pendente.
 */
async function _aplicarExplosaoDefensiva(tokens, danoFinal) {
  let danoRestante = danoFinal;

  for ( const token of tokens ) {
    const actor = token.actor;
    if ( !actor ) continue;

      const expDefFlag     = actor.getFlag("hunter-system", "explosaoDefensivaPendente") ?? null;
      const expDefPendente = expDefFlag?.reducao ?? 0;
      if ( expDefPendente > 0 ) {
        const reducao = Math.min(expDefPendente, danoRestante);
        danoRestante  = Math.max(0, danoRestante - reducao);
        await actor.unsetFlag("hunter-system", "explosaoDefensivaPendente");
        ui.notifications.info(`🛡️ Explosão Defensiva: ${reducao} de dano reduzido para ${actor.name}!`);
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `🛡️ <strong>${actor.name}</strong> reduziu <strong>${reducao}</strong> de dano com Explosão Defensiva!`
        });
      }
  }

  return danoRestante;
}

// CSS do botão
if ( !document.querySelector("#jj-expdef-style") ) {
  const style = document.createElement("style");
  style.id = "jj-expdef-style";
  style.textContent = `
    .jj-expdef-sidebar {
      padding: 4px 8px 6px;
    }

    .jj-expdef-sidebar-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      background: #0e0e18;
      border: 1px solid #2a2a40;
      border-radius: 4px;
      color: #6060a0;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 150ms ease;
    }

    .jj-expdef-sidebar-btn:hover {
      background: #141428;
      border-color: #4a4a70;
      color: #a0a0d0;
    }

    .jj-expdef-sidebar-btn.active {
      background: #0a0a20;
      border-color: #3a5a9a;
      color: #6090e0;
      box-shadow: 0 0 8px rgba(60, 100, 200, 0.3);
    }
  `;
  document.head.appendChild(style);
}

/* ============================================================
 * RODAS DOS PRINCÍPIOS DE NEN (compartilhado personagem + NPC)
 * ============================================================ */

/**
 * Posiciona as habilidades no anel de cada princípio (+ raios SVG) e liga o abrir/fechar
 * da roda no clique do hub. Usado pela ficha de personagem E pela de NPC (mesmo template).
 * @param {HTMLElement} root  Elemento raiz da ficha.
 */
export function setupNenWheels(root) {
  if ( !root ) return;
  root.querySelectorAll(".nen-wheel").forEach(wheel => {
    const orbits = [...wheel.querySelectorAll(".nen-orbit")];
    const svg = wheel.querySelector(".nen-wheel-svg");
    const n = orbits.length;
    let lines = "";
    const R = 38; // raio em %
    orbits.forEach((o, i) => {
      const ang = (-90 + i * (360 / n)) * Math.PI / 180;
      const x = 50 + R * Math.cos(ang);
      const y = 50 + R * Math.sin(ang);
      o.style.left = `${x.toFixed(2)}%`;
      o.style.top = `${y.toFixed(2)}%`;
      lines += `<line x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" class="${o.classList.contains("is-unlocked") ? "on" : ""}"></line>`;
    });
    if ( svg ) svg.innerHTML = lines;

    const hub = wheel.querySelector(".nen-hub[data-wheel-toggle]");
    if ( hub && !hub.dataset.bound ) {
      hub.dataset.bound = "1";
      hub.addEventListener("click", e => {
        if ( e.target.closest("[data-action]") ) return; // mini desbloquear/desfazer do princípio
        e.preventDefault();
        wheel.classList.toggle("is-open");
      });
    }
    // Já desbloqueado (ou com habilidade desbloqueada) → começa aberto.
    if ( wheel.classList.contains("pr-on") || orbits.some(o => o.classList.contains("is-unlocked")) ) {
      wheel.classList.add("is-open");
    }
  });

  // Grade de princípios (2 colunas travadas): clique e arraste para revelar rodas fora da largura visível.
  root.querySelectorAll(".nen-wheel-grid").forEach(grid => {
    if ( grid.dataset.dragBound ) return;
    grid.dataset.dragBound = "1";
    let startX = 0, startScroll = 0, moved = false;

    const onMove = e => {
      const dx = e.pageX - startX;
      if ( Math.abs(dx) > 4 ) moved = true;
      grid.scrollLeft = startScroll - dx;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      grid.classList.remove("is-dragging");
      if ( moved ) {
        // Suprime o clique gerado ao soltar, para não acionar a roda/habilidade por baixo do arraste.
        grid.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
      }
    };
    grid.addEventListener("mousedown", e => {
      if ( e.button !== 0 ) return;
      startX = e.pageX;
      startScroll = grid.scrollLeft;
      moved = false;
      grid.classList.add("is-dragging");
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });
}

/* ============================================================
 * SEÇÕES CUSTOMIZADAS DE FEATURES (JJ)
 * ============================================================ */

function _unhideFeatureSections(element) {
  const featuresTab = element.querySelector('[data-tab="features"]');
  if ( !featuresTab ) return;
  ["jj-origin", "jj-combat", "jj-path", "jj-basic", "jj-talents", "jj-flaws"].forEach(id => {
    const section = featuresTab.querySelector(`[data-group-origin="${id}"]`);
    if ( section ) section.removeAttribute("hidden");
  });
}

const JJ_FEATURE_SECTIONS = new Set(["jj-origin", "jj-combat", "jj-path", "jj-basic", "jj-talents", "jj-flaws"]);

/**
 * Configura listeners de drop nas seções customizadas de habilidades.
 * Quando um item é solto numa seção jj-*, salva o flag featureSection.
 */
function _setupFeatureSectionDrops(element, actor) {
  const featuresTab = element.querySelector('[data-tab="features"]');
  if ( !featuresTab ) return;

  JJ_FEATURE_SECTIONS.forEach(sectionId => {
    const section = featuresTab.querySelector(`[data-group-origin="${sectionId}"]`);
    if ( !section ) return;

    section.addEventListener("dragover", e => {
      e.preventDefault();
      section.classList.add("jj-drag-over");
    });

    section.addEventListener("dragleave", () => {
      section.classList.remove("jj-drag-over");
    });

    section.addEventListener("drop", async e => {
      section.classList.remove("jj-drag-over");
      let dragData;
      try { dragData = JSON.parse(e.dataTransfer.getData("text/plain")); }
      catch(err) { return; }
      if ( dragData?.type !== "Item" ) return;
      const item = dragData.uuid ? await fromUuid(dragData.uuid) : actor.items.get(dragData.id);
      if ( !item || item.parent !== actor || item.type !== "feat" ) return;
      // Pequeno delay para o nativo processar primeiro
      setTimeout(async () => {
        await item.setFlag("hunter-system", "featureSection", sectionId);
      }, 50);
    });
  });

  // Seções nativas — limpar flag quando item volta
  const nativeSections = featuresTab.querySelectorAll("[data-group-origin]:not([data-group-origin^='jj-'])");
  nativeSections.forEach(section => {
    section.addEventListener("drop", async e => {
      let dragData;
      try { dragData = JSON.parse(e.dataTransfer.getData("text/plain")); }
      catch(err) { return; }
      if ( dragData?.type !== "Item" ) return;
      const item = dragData.uuid ? await fromUuid(dragData.uuid) : actor.items.get(dragData.id);
      if ( !item || item.parent !== actor ) return;
      const hasFlag = item.getFlag("hunter-system", "featureSection");
      if ( hasFlag ) await item.unsetFlag("hunter-system", "featureSection");
    });
  });
}

/* ============================================================
   SEIS OLHOS — Lógica de Active Effects
   ============================================================ */

async function _applySeiOlhosEffects(actor, mode) {
  const prof = actor.system.attributes.prof ?? 2;

  const EFFECT_IDS = {
    sealed:  "jj-seis-olhos-sealed",
    full:    "jj-seis-olhos-full",
    psychic: "jj-seis-olhos-psychic"
  };

  for ( const id of Object.values(EFFECT_IDS) ) {
    const existing = actor.effects.find(e => e.getFlag("hunter-system", "seisOlhosId") === id);
    if ( existing ) await existing.delete();
  }

  const sealedSkillBonus = String(prof);
  const fullSkillBonus   = String(prof * 2);

  const sealedChanges = [
    { key: "system.attributes.ac.bonus",       mode: 2, value: "1",              priority: 20 },
    { key: "system.bonuses.mwak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.rwak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.msak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.bonuses.rsak.attack",       mode: 2, value: "2",              priority: 20 },
    { key: "system.skills.prc.bonuses.check",  mode: 2, value: sealedSkillBonus, priority: 20 },
    { key: "system.skills.arc.bonuses.check",  mode: 2, value: sealedSkillBonus, priority: 20 },
    { key: "system.skills.Cont.bonuses.check", mode: 2, value: sealedSkillBonus, priority: 20 }
  ];

  const fullChanges = [
    { key: "system.attributes.ac.bonus",       mode: 2, value: "3",              priority: 20 },
    { key: "system.bonuses.mwak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.rwak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.msak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.bonuses.rsak.attack",       mode: 2, value: "4",              priority: 20 },
    { key: "system.skills.prc.bonuses.check",  mode: 2, value: fullSkillBonus,   priority: 20 },
    { key: "system.skills.arc.bonuses.check",  mode: 2, value: fullSkillBonus,   priority: 20 },
    { key: "system.skills.Cont.bonuses.check", mode: 2, value: fullSkillBonus,   priority: 20 }
  ];

  if ( mode === "sealed" ) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos (Selado)",
      icon: "icons/magic/perception/eye-ringed-glow-angry-small-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: sealedChanges,
      flags: { "hunter-system": { seisOlhosId: EFFECT_IDS.sealed } }
    }]);
  } else if ( mode === "full" ) {
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos (Poder Completo)",
      icon: "icons/magic/perception/eye-ringed-glow-angry-small-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: fullChanges,
      flags: { "hunter-system": { seisOlhosId: EFFECT_IDS.full } }
    }]);

    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: "Seis Olhos — Dano Psíquico",
      icon: "icons/magic/death/skull-glowing-teal.webp",
      origin: actor.uuid,
      disabled: false,
      changes: [],
      duration: { rounds: 9999 },
      flags: { "hunter-system": { seisOlhosId: EFFECT_IDS.psychic, psychicDamage: true } }
    }]);

    _registerSeiOlhosTurnHook(actor);
  }
}

function _registerSeiOlhosTurnHook(actor) {
  if ( actor._seisOlhosHookId ) Hooks.off("combatTurnChange", actor._seisOlhosHookId);

  actor._seisOlhosHookId = Hooks.on("combatTurnChange", async (combat, prior, current) => {
    const combatant = combat.combatants.get(current.combatantId);
    if ( combatant?.actor?.id !== actor.id ) return;

    const hasEffect = actor.effects.some(e =>
      e.getFlag("hunter-system", "seisOlhosId") === "jj-seis-olhos-psychic"
    );
    if ( !hasEffect ) {
      Hooks.off("combatTurnChange", actor._seisOlhosHookId);
      actor._seisOlhosHookId = null;
      return;
    }

    const roll = await new Roll("2d8").evaluate();
    const dmg = roll.total;
    const newHp = Math.max(0, (actor.system.attributes.hp.value ?? 0) - dmg);
    await actor.update({ "system.attributes.hp.value": newHp });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="font-family:var(--dnd5e-font-roboto,sans-serif);padding:6px 10px;background:#0a0a18;border:1px solid #2a1a4a;border-radius:4px;">
        <strong style="color:#9060d0">⬡ Seis Olhos — Poder Completo</strong><br>
        <span style="color:#c0a0ff">${actor.name} sofre <strong>${dmg}</strong> de dano psíquico no início do turno.</span>
      </div>`
    });
  });
}

/* ============================================================
   ESTÁGIO DE FOCO — Hook de turno (Ultimato)
   ============================================================ */
function _registerEstagioFocoHook(actor) {
  if ( actor._estagioFocoHookId ) Hooks.off("combatTurnChange", actor._estagioFocoHookId);

  actor._estagioFocoHookId = Hooks.on("combatTurnChange", async (combat, prior, current) => {
    const combatant = combat.combatants.get(current?.combatantId);
    if ( combatant?.actor?.id !== actor.id ) return;

    if ( !actor.getFlag("hunter-system", "hatsuEstagioFocoAtivo") ) {
      _unregisterEstagioFocoHook(actor);
      return;
    }

    const energyTotal = actor.system.energy?.total ?? 0;
    const energyGen   = actor.system.energy?.generated ?? 0;
    const energyMax   = actor.system.energy?.max ?? 0;

    if ( energyTotal < 2 ) {
      await actor.setFlag("hunter-system", "hatsuEstagioFocoAtivo", false);
      _unregisterEstagioFocoHook(actor);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `🔥 <strong>${actor.name}</strong> saiu do <strong>Estágio de Foco</strong> (PA insuficiente).`
      });
      return;
    }

    await actor.update({
      "system.energy.total":     Math.max(0, energyTotal - 2),
      "system.energy.generated": Math.min(energyMax, energyGen + 10)
    });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `🔥 <strong>${actor.name}</strong> Estágio de Foco: <strong>-2 PA Total</strong>, <strong>+10 PA Gerada</strong>.`
    });
  });
}

function _unregisterEstagioFocoHook(actor) {
  if ( actor._estagioFocoHookId ) {
    Hooks.off("combatTurnChange", actor._estagioFocoHookId);
    actor._estagioFocoHookId = null;
  }
}

/* ============================================================
   SOCKET — Geração de Energia (Personagem e NPC)
   ============================================================ */
Hooks.on("ready", () => {
  game.socket.on("system.hunter-system", async (data) => {

    // Personagem: jogador recebe pedido do GM para abrir dialog
    if ( data.action === "energyGenerationDialog" && data.userId === game.user.id ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      setTimeout(async () => {
        const choices = await EnergyGenerationDialog.configure(actor);
        if ( choices ) {
          game.socket.emit("system.hunter-system", {
            action: "energyChoicesResult",
            actorId: data.actorId,
            choices
          });
        }
      }, 100);
    }

    // Personagem: GM recebe escolhas e processa
    if ( data.action === "energyChoicesResult" && game.user.isGM ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      await EnergySystem.processTurnStartWithChoices(actor, data.choices);
    }

    // NPC: jogador recebe pedido do GM para abrir dialog
    if ( data.action === "npcEnergyDialog" && data.userId === game.user.id ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      const nd = actor.system.details?.cr ?? 1;
      const trainingBonus = (actor.system.energy?.bonuses?.generatedEnergy ?? 0)
                          + (actor.system.energy?.intensiveTraining?.generatedEnergy ?? 0);
      const fmt = n => trainingBonus > 0 ? `${n} (${nd}×N + ${trainingBonus})` : `${n}`;
      setTimeout(async () => {
        const multiplicador = await foundry.applications.api.DialogV2.wait({
          window: { title: `⚡ Geração de Energia — ${actor.name}` },
          content: `
            <p style="margin:0 0 4px;">Quantas vezes o ND (<strong>${nd}</strong>) deseja gerar?</p>
            ${trainingBonus > 0 ? `<p style="margin:0 0 10px;font-size:11px;color:#7090b0;">+${trainingBonus} PA de bônus de treinamento</p>` : ""}`,
          buttons: [
            { label: `2× (${fmt(nd * 2 + trainingBonus)} PA)`, action: "2", default: true },
            { label: `3× (${fmt(nd * 3 + trainingBonus)} PA)`, action: "3" },
            { label: `4× (${fmt(nd * 4 + trainingBonus)} PA)`, action: "4" },
            { label: "Pular",                                  action: "skip" }
          ],
          rejectClose: false,
          close: () => "skip"
        });
        if ( !multiplicador || multiplicador === "skip" ) return;
        game.socket.emit("system.hunter-system", {
          action: "npcEnergyChoices",
          actorId: data.actorId,
          nd,
          multiplicador,
          trainingBonus
        });
      }, 100);
    }

    // NPC: GM recebe escolhas e processa
    if ( data.action === "npcEnergyChoices" && game.user.isGM ) {
      const actor = game.actors.get(data.actorId);
      if ( !actor ) return;
      const tBonus = data.trainingBonus
                  ?? (actor.system.energy?.bonuses?.generatedEnergy ?? 0)
                   + (actor.system.energy?.intensiveTraining?.generatedEnergy ?? 0);
      const alvo        = (data.nd * Number(data.multiplicador)) + tBonus;
      const geradaAtual = actor.system.energy.generated ?? 0;
      const totalAtual  = actor.system.energy.total ?? 0;
      if ( alvo <= geradaAtual ) {
        ui.notifications.info(`${actor.name} já tem ${geradaAtual} PA Gerada.`);
        return;
      }
      const necessario    = alvo - geradaAtual;
      const transferencia = Math.min(necessario, totalAtual);
      if ( transferencia === 0 ) {
        ui.notifications.warn(`${actor.name} não tem PA Total suficiente!`);
        return;
      }
      await actor.update({
        "system.energy.total":     totalAtual - transferencia,
        "system.energy.generated": geradaAtual + transferencia
      }, { isEnergySystem: true });
      const sheet = actor.sheet;
      if ( sheet?.rendered ) sheet.render();
    }
  });
});

/* ============================================================
   MOCHILA (Container equipável) — regras de negócio
   ============================================================ */

// Apenas uma mochila (container) pode estar equipada por vez.
Hooks.on("preUpdateItem", (item, changes) => {
  if ( item.type !== "container" ) return;
  const willEquip = foundry.utils.getProperty(changes, "system.equipped");
  if ( willEquip !== true ) return;
  const actor = item.parent;
  if ( !actor ) return;
  const jaEquipada = actor.items.find(i =>
    (i.type === "container") && (i.id !== item.id) && i.system?.equipped
  );
  if ( jaEquipada ) {
    ui.notifications.warn(`Você já tem uma mochila equipada: "${jaEquipada.name}". Desequipe-a antes.`);
    return false; // cancela o equip
  }
});

// Ao deletar uma mochila: se vazia, deleta direto; se tiver itens, pede confirmação.
Hooks.on("preDeleteItem", (item, options) => {
  if ( item.type !== "container" ) return;
  if ( options?._mochilaConfirmada ) return; // já confirmado, segue a deleção

  const conteudo = item.system?.contents;
  const qtd = conteudo?.size ?? (Array.isArray(conteudo) ? conteudo.length : 0);
  if ( qtd <= 0 ) return; // vazia → deleta normalmente

  // Tem itens — bloqueia e pergunta
  foundry.applications.api.DialogV2.confirm({
    window: { title: "Apagar Mochila" },
    content: `<p>A mochila <strong>${item.name}</strong> contém <strong>${qtd}</strong> item(ns).</p>
              <p>Deseja apagá-la mesmo assim? <em>Os itens dentro também serão removidos.</em></p>`,
    yes: { label: "Apagar Mesmo Assim" },
    no:  { label: "Cancelar" }
  }).then(confirmado => {
    if ( confirmado ) item.delete({ _mochilaConfirmada: true });
  });

  return false; // cancela esta deleção; será refeita se confirmado
});
