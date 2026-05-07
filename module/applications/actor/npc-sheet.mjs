import { formatNumber, getPluralRules, simplifyBonus, splitSemicolons } from "../../utils.mjs";
import { createCheckboxInput } from "../fields.mjs";
import BaseActorSheet from "./api/base-actor-sheet.mjs";
import HabitatConfig from "./config/habitat-config.mjs";
import TreasureConfig from "./config/treasure-config.mjs";
import { prepareManipulationAbilities, preparePrinciples, TREE_DATA, MANIPULATION_ABILITIES, canUnlockAbility } from "../../systems/manipulation-data.mjs";
import { NEN_CATEGORIES_DATA, NEN_LEVEL_COSTS, getMaxLevelForCategory } from "../../systems/nen-categories-data.mjs";

const TextEditor = foundry.applications.ux.TextEditor.implementation;

/**
 * Extension of base actor sheet for NPCs.
 */
export default class NPCActorSheet extends BaseActorSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      editDescription: NPCActorSheet.#editDescription
    },
    classes: ["npc", "vertical-tabs"],
    position: {
      width: 700,
      height: 700
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static PARTS = {
    header: {
      template: "systems/jujutsu-system/templates/actors/npc-header.hbs"
    },
    sidebarCollapser: {
      container: { classes: ["main-content"], id: "main" },
      template: "systems/jujutsu-system/templates/actors/parts/sidebar-collapser.hbs"
    },
    sidebar: {
      container: { classes: ["main-content"], id: "main" },
      template: "systems/jujutsu-system/templates/actors/npc-sidebar.hbs"
    },
    features: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/actor-features.hbs",
      templates: ["systems/jujutsu-system/templates/inventory/inventory.hbs", "systems/jujutsu-system/templates/inventory/activity.hbs"],
      scrollable: [""]
    },
    inventory: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/actor-inventory.hbs",
      templates: [
        "systems/jujutsu-system/templates/inventory/inventory.hbs", "systems/jujutsu-system/templates/inventory/activity.hbs",
        "systems/jujutsu-system/templates/inventory/encumbrance.hbs"
      ],
      scrollable: [""]
    },
    spells: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/creature-spells.hbs",
      scrollable: [""]
    },
    effects: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/actor-effects.hbs",
      scrollable: [""]
    },
    biography: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/npc-biography.hbs",
      scrollable: [""]
    },
    specialTraits: {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/jujutsu-system/templates/actors/tabs/creature-special-traits.hbs",
      scrollable: [""]
    },
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
    warnings: {
      template: "systems/jujutsu-system/templates/actors/parts/actor-warnings-dialog.hbs"
    },
    tabs: {
      id: "tabs",
      classes: ["tabs-right"],
      template: "systems/jujutsu-system/templates/shared/sidebar-tabs.hbs"
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static TABS = [
    { tab: "features", label: "DND5E.Features", icon: "fas fa-list" },
    { tab: "inventory", label: "DND5E.Inventory", svg: "systems/jujutsu-system/icons/svg/backpack.svg" },
    { tab: "spells", label: "TYPES.Item.spellPl", icon: "fas fa-book" },
    { tab: "effects", label: "DND5E.Effects", icon: "fas fa-bolt" },
    { tab: "biography", label: "DND5E.Biography", icon: "fas fa-feather" },
    { tab: "specialTraits", label: "DND5E.SpecialTraits", icon: "fas fa-star" },
    { tab: "manipulation", label: "JUJUTSU.Manipulation.Tab", icon: "fas fa-hand-sparkles" },
    { tab: "trainings", label: "JUJUTSU.Trainings.Tab", icon: "fas fa-dumbbell" }
  ];

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Description currently being edited.
   * @type {string|null}
   */
  editingDescriptionTarget = null;

  /* -------------------------------------------- */

  /** @override */
  tabGroups = {
    primary: "features"
  };

  /* -------------------------------------------- */

  /** @override */
  _filters = {
    features: { name: "", properties: new Set() },
    effects: { name: "", properties: new Set() },
    inventory: { name: "", properties: new Set() },
    spells: { name: "", properties: new Set() }
  };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _configureInventorySections(sections) {
    sections.forEach(s => s.minWidth = 200);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = {
      ...await super._prepareContext(options),
      important: !foundry.utils.isEmpty(this.actor.classes) || this.actor.system.traits.important,
      isNPC: true
    };
    context.hasClasses = context.itemCategories.classes?.length;
    context.spellbook = this._prepareSpellbook(context);
    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    switch ( partId ) {
      case "biography": return this._prepareBiographyContext(context, options);
      case "effects": return this._prepareEffectsContext(context, options);
      case "features": return this._prepareFeaturesContext(context, options);
      case "header": return this._prepareHeaderContext(context, options);
      case "inventory": return this._prepareInventoryContext(context, options);
      case "sidebar": return this._prepareSidebarContext(context, options);
      case "specialTraits": return this._prepareSpecialTraitsContext(context, options);
      case "spells": return this._prepareSpellsContext(context, options);
      case "manipulation": return this._prepareManipulationContext(context, options);
      case "trainings": return this._prepareTrainingsContext(context, options);
      default: return context;
    }
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
    if ( this.actor.limited ) return context;

    const enrichmentOptions = {
      secrets: this.actor.isOwner, relativeTo: this.actor, rollData: context.rollData
    };
    context.enriched = {
      public: await TextEditor.enrichHTML(this.actor.system.details.biography.public, enrichmentOptions),
      value: await TextEditor.enrichHTML(this.actor.system.details.biography.value, enrichmentOptions)
    };
    if ( this.editingDescriptionTarget ) context.editingDescription = {
      target: this.editingDescriptionTarget,
      value: foundry.utils.getProperty(this.actor._source, this.editingDescriptionTarget)
    };

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareEffectsContext(context, options) {
    context = await super._prepareEffectsContext(context, options);
    context.hasConditions = true;
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
    const sections = Object.entries(CONFIG.DND5E.activityActivationTypes).reduce((obj, [id, config], i) => {
      const { header: label, passive } = config;
      if ( passive ) return obj;
      obj[id] ??= {
        id, label, order: (i + 1) * 100, items: [], minWidth: 210,
        columns: ["recovery", "uses", "roll", "formula", "controls"]
      };
      return obj;
    }, {});
    sections.passive = {
      id: "passive", label: "DND5E.Features", order: 0, items: [], minWidth: 210,
      columns: ["recovery", "uses", "roll", "formula", "controls"]
    };
    context.itemCategories.features?.forEach(i => {
      const ctx = context.itemContext[i.id];
      sections[ctx.group]?.items.push(i);
    });
    context.sections = customElements.get(this.options.elements.inventory).prepareSections(Object.values(sections));
    context.listControls = {
      label: "DND5E.FeatureSearch",
      list: "features",
      filters: [
        { key: "action", label: "DND5E.ACTIVATION.Type.Action.Label" },
        { key: "bonus", label: "DND5E.ACTIVATION.Type.BonusAction.Label" },
        { key: "reaction", label: "DND5E.ACTIVATION.Type.Reaction.Label" },
        { key: "legendary", label: "DND5E.ACTIVATION.Type.Legendary.Label" },
        { key: "lair", label: "DND5E.ACTIVATION.Type.Lair.Label" }
      ],
      sorting: [
        { key: "m", label: "SIDEBAR.SortModeManual", dataset: { icon: "fa-solid fa-arrow-down-short-wide" } },
        { key: "a", label: "SIDEBAR.SortModeAlpha", dataset: { icon: "fa-solid fa-arrow-down-a-z" } }
      ]
    };
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
    context.portrait = await this._preparePortrait(context);

    if ( this.actor.limited ) {
      const enrichmentOptions = { relativeTo: this.actor, rollData: context.rollData };
      context.enriched = {
        public: await TextEditor.enrichHTML(this.actor.system.details.biography.public, enrichmentOptions)
      };
      return context;
    }

    context.abilities = this._prepareAbilities(context);
    context.classes = context.itemCategories.classes;

    // Legendary Actions & Resistances
    const plurals = getPluralRules({ type: "ordinal" });
    const resources = context.source.resources;
    for ( const res of ["legact", "legres"] ) {
      const { max, value } = resources[res];
      context[res] = Array.fromRange(max, 1).map(n => {
        const i18n = res === "legact" ? "LegendaryAction" : "LegendaryResistance";
        const filled = value >= n;
        const classes = ["pip"];
        if ( filled ) classes.push("filled");
        return {
          n: max - n, filled,
          tooltip: `DND5E.${i18n}.Label`,
          label: game.i18n.format(`DND5E.${i18n}.Ordinal.${plurals.select(n)}`, { n }),
          classes: classes.join(" ")
        };
      });
    }
    context.hasLegendaries = resources.legact.max || resources.legres.max
      || (context.modernRules && resources.lair.value) || (!context.modernRules && resources.lair.initiative);

    // Visibility
    if ( this._mode === this.constructor.MODES.PLAY ) {
      context.showDeathSaves = context.important && !context.system.attributes.hp.value;
      context.showInitiativeScore = dnd5e.settings.rulesVersion === "modern";
    }
    context.showLoyalty = context.important && game.settings.get("hunter-system", "loyaltyScore") && game.user.isGM;
    context.showRests = game.user.isGM || (this.actor.isOwner && game.settings.get("hunter-system", "allowRests"));

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareInventoryContext(context, options) {
    context = await super._prepareInventoryContext(context, options);
    context.encumbrance = context.system.attributes.encumbrance;
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
    const { attributes, details } = context.system;

    // Gear
    const gear = await this.actor.items.filter(i => i.system.quantity && i.system.properties?.has("gear"));
    if ( gear.length ) context.gear = gear.map(item => {
      const { name, uuid } = item.system.gearPresentationData();
      return {
        draggable: true,
        label: name,
        link: {
          action: "showDocument",
          itemId: item.id,
          quantity: item.system.quantity,
          uuid
        },
        value: item.system.quantity > 1 ? item.system.quantity : undefined
      };
    }).sort((lhs, rhs) => lhs.label.localeCompare(rhs.label, game.i18n.lang));

    // Habitat
    if ( details.habitat.value.length || details.habitat.custom ) {
      const { habitat } = details;
      const any = details.habitat.value.find(({ type }) => type === "any");
      context.habitat = [
        ...habitat.value.map(({ type, subtype }) => {
          let { label } = CONFIG.DND5E.habitats[type] ?? {};
          if ( label && (!any || (type === "any")) ) {
            if ( subtype ) label = game.i18n.format("DND5E.Habitat.Subtype", { type: label, subtype });
            return { label };
          }
          return null;
        }, []).filter(_ => _),
        ...splitSemicolons(habitat.custom).map(label => ({ label }))
      ].sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    }

    // Senses
    context.senses = this._prepareSenses(context);
    if ( this.actor.system.skills.prc ) context.senses.push({
      key: "passivePerception",
      label: game.i18n.localize("DND5E.PassivePerception"),
      value: this.actor.system.skills.prc.passive
    });

    // Skills & Tools
    const skillSetting = game.settings.get("hunter-system", "defaultSkills");
    context.skills = this._prepareSkillsTools(context, "skills")
      .filter(v => v.prof.multiplier || skillSetting.has(v.key) || v.bonuses.check || v.bonuses.passive);
    context.tools = this._prepareSkillsTools(context, "tools");

    // Speed
    context.speed = [
      ...Object.entries(CONFIG.DND5E.movementTypes).filter(([, m]) => !m.hidden).map(([k, { label }]) => {
        const value = attributes.movement[k];
        if ( !value ) return null;
        const data = { label, value };
        if ( (k === "fly") && attributes.movement.hover ) data.icons = [{
          icon: "fas fa-cloud", label: game.i18n.localize("DND5E.MOVEMENT.Hover")
        }];
        return data;
      }),
      ...splitSemicolons(attributes.movement.special).map(label => ({ label }))
    ].filter(_ => _);

    // Traits
    context.traits = this._prepareTraits(context);

    // Treasure
    if ( details?.treasure?.value.size ) {
      const any = details.treasure.value.has("any");
      context.treasure = Array.from(details.treasure.value)
        .map(id => {
          const { label } = CONFIG.DND5E.treasure[id] ?? {};
          if ( label && (!any || (id === "any")) ) return { label };
          return null;
        }, [])
        .filter(_ => _)
        .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    }

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareSpecialTraitsContext(context, options) {
    context = await super._prepareSpecialTraitsContext(context, options);

    const { fields } = this.document.system.schema;
    context.flags.sections.unshift({
      label: game.i18n.localize("DND5E.NPC.Label"),
      fields: [{
        field: fields.traits.fields.important,
        input: createCheckboxInput,
        name: "system.traits.important",
        value: context.source.traits.important
      }, {
        label: "DND5E.NPC.FIELDS.attributes.price.label",
        hint: "DND5E.NPC.FIELDS.attributes.price.hint",
        fields: [{
          field: fields.attributes.fields.price.fields.value,
          name: "system.attributes.price.value",
          value: context.source.attributes.price.value
        }, {
          choices: CONFIG.DND5E.currencies,
          field: fields.attributes.fields.price.fields.denomination,
          name: "system.attributes.price.denomination",
          value: context.source.attributes.price.denomination
        }]
      }]
    });

    return context;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareSpellsContext(context, options) {
    context = await super._prepareSpellsContext(context, options);
    context.classSpellcasting = Object.values(this.actor.classes).some(c => c.spellcasting?.levels);

    const { abilities, attributes, bonuses } = this.actor.system;
    context.spellcasting = [];
    const msak = simplifyBonus(bonuses.msak.attack, context.rollData);
    const rsak = simplifyBonus(bonuses.rsak.attack, context.rollData);
    const spellcaster = Object.values(this.actor.spellcastingClasses)[0];
    const ability = spellcaster?.spellcasting.ability ?? attributes.spellcasting;
    const spellAbility = abilities[ability];
    const mod = spellAbility?.mod ?? 0;
    const attackBonus = msak === rsak ? msak : 0;
    context.spellcasting.push({
      label: game.i18n.format("DND5E.SpellcastingClass", {
        class: spellcaster?.name ?? game.i18n.format("DND5E.NPC.Label")
      }),
      level: spellcaster?.system.levels ?? attributes.spell.level,
      ability: {
        ability, mod,
        label: CONFIG.DND5E.abilities[ability]?.label
      },
      attack: mod + attributes.prof + attackBonus,
      save: spellAbility?.dc ?? 0,
      noSpellcaster: !spellcaster,
      concentration: {
        mod: attributes.concentration.save,
        tooltip: game.i18n.format("DND5E.AbilityConfigure", { ability: game.i18n.localize("DND5E.Concentration") })
      }
    });

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepara o contexto para a aba de Princípios de Nen (Manipulação) no NPC.
   */
  async _prepareManipulationContext(context, options) {
    try {
      const abilitiesResult = prepareManipulationAbilities(this.actor);
      const principlesResult = preparePrinciples(this.actor);

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
          const canUnlock = !unlocked && (isMasterGrant ? true : prStatus.canUnlock ?? false);
          const canUnlockFree = !unlocked && isMasterGrant;
          return {
            id: pr.id,
            label: pr.label,
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

      // O template usa manipulation.sections
      context.manipulation = { sections };
      console.log("NPCSheet | _prepareManipulationContext | sections:", sections.length);
    } catch(err) {
      console.error("NPCSheet | Erro em _prepareManipulationContext:", err);
      context.manipulation = { sections: [] };
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepara o contexto para a aba de Treinamentos (Categorias Nen) no NPC.
   * Replicado do CharacterActorSheet para funcionar com o mesmo template.
   */
  async _prepareTrainingsContext(context, options) {
    const CATEGORIES = ["aprimorador", "emissor", "transmutador", "conjurador", "manipulador", "especialista"];
    const LABELS = {
      aprimorador: "Aprimorador", emissor: "Emissor", transmutador: "Transmutador",
      conjurador: "Conjurador", manipulador: "Manipulador", especialista: "Especialista"
    };
    const ABBREVS = {
      aprimorador: "APR", emissor: "EMI", transmutador: "TRA",
      conjurador: "CON", manipulador: "MAN", especialista: "ESP"
    };
    const COLORS = {
      aprimorador: "#e86800", emissor: "#B8860B", transmutador: "#9B59D0",
      conjurador: "#3A8FD4", manipulador: "#2ECC71", especialista: "#AAAAAA"
    };
    const ICONS = {
      aprimorador:  "systems/hunter-system/assets/Categorias/apri-mini.png",
      emissor:      "systems/hunter-system/assets/Categorias/emi-mini.png",
      transmutador: "systems/hunter-system/assets/Categorias/transmini.png",
      conjurador:   "systems/hunter-system/assets/Categorias/conj-mini.png",
      manipulador:  "systems/hunter-system/assets/Categorias/mani-mini.png",
      especialista: "systems/hunter-system/assets/Categorias/esp-mini.png"
    };
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
      "períciaTranmutadora": "Compendium.hunter-system.conteudo.JournalEntry.tr3t07bsAOPkVrb6.JournalEntryPage.IT0QweKyExQmAJGc"
    };

    const nenCategories = [];
    for ( const id of CATEGORIES ) {
      const level = this.actor.system.nenCategories?.[id]?.level ?? 0;
      const pct = Math.round((level / 10) * 100);
      const dcReductions = this.actor.system.nenCategories?.[id]?.dcReductions ?? {};
      nenCategories.push({ id, label: LABELS[id], abbrev: ABBREVS[id], color: COLORS[id], icon: ICONS[id], level, pct, dcReductions });
    }

    // Polígono SVG do hexágono
    const ORDER = ["aprimorador", "transmutador", "conjurador", "especialista", "manipulador", "emissor"];
    const CX = 160, CY = 160, MAX_R = 125;
    const hexPts = ORDER.map((id, i) => {
      const cat = nenCategories.find(c => c.id === id);
      const r = MAX_R * ((cat?.level ?? 0) / 10);
      const angle = (Math.PI / 180) * (60 * i - 90);
      return `${(CX + r * Math.cos(angle)).toFixed(1)},${(CY + r * Math.sin(angle)).toFixed(1)}`;
    }).join(" ");

    const gridRings = [2, 4, 6, 8, 10].map(lvl => {
      const r = MAX_R * (lvl / 10);
      return Array.from({length: 6}, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i - 90);
        return `${(CX + r * Math.cos(angle)).toFixed(1)},${(CY + r * Math.sin(angle)).toFixed(1)}`;
      }).join(" ");
    });

    const axes = ORDER.map((_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 90);
      return { x2: (CX + MAX_R * Math.cos(angle)).toFixed(1), y2: (CY + MAX_R * Math.sin(angle)).toFixed(1) };
    });

    const LABEL_R = 128;
    const labels = ORDER.map((id, i) => {
      const cat = nenCategories.find(c => c.id === id);
      const angle = (Math.PI / 180) * (60 * i - 90);
      const ly = (CY + LABEL_R * Math.sin(angle));
      return { ...cat, lx: (CX + LABEL_R * Math.cos(angle)).toFixed(1), ly: ly.toFixed(1), ly2: (ly + 13).toFixed(1) };
    });

    for ( const cat of nenCategories ) {
      cat.pips = Array.from({length: 10}, (_, i) => ({ filled: i < cat.level, n: i + 1 }));
    }

    const nenMajorCount = this.actor.system.nenMajorCount ?? 0;
    const nenMajorMax = this._getNenMajorMax();

    // ── Categoria do NPC (salva em system.nenCategories.primary) ──────────
    const npcPrimaryCategory = this.actor.system.nenCategories?.primary ?? null;
    context.npcPrimaryCategory = npcPrimaryCategory;
    context.npcCategoryOptions = CATEGORIES.map(id => ({
      id, label: LABELS[id], color: COLORS[id], icon: ICONS[id],
      selected: id === npcPrimaryCategory
    }));

    for ( const cat of nenCategories ) {
      const unlockedMajorMap = this.actor.system.nenCategories?.[cat.id]?.unlockedMajor ?? {};
      // Para NPCs: afinidade baseada na categoria salva (primary)
      const maxAllowed = npcPrimaryCategory
        ? this._getNpcMaxLevelForCategory(npcPrimaryCategory, cat.id)
        : 10; // Sem categoria definida: sem restrição
      const nextLevel = cat.level + 1;
      cat.maxAllowed = maxAllowed;
      cat.affinityPct = maxAllowed >= 10 ? 100 : maxAllowed >= 8 ? 80 : maxAllowed >= 6 ? 60 : maxAllowed >= 4 ? 40 : maxAllowed >= 1 ? 1 : 0;

      if ( nextLevel <= 10 && nextLevel <= maxAllowed ) {
        const costs = NEN_LEVEL_COSTS[nextLevel];
        const dcReduction = this.actor.system.nenCategories?.[cat.id]?.dcReductions?.[nextLevel] ?? 0;
        cat.nextLevel = nextLevel;
        cat.nextPt = costs.pt;
        cat.nextPa = costs.pa;
        cat.currentDC = Math.max(1, costs.cd - dcReduction);
        cat.canTrain = true;
      } else if ( maxAllowed === 0 ) {
        cat.canTrain = false;
        cat.blockedReason = "Sem afinidade";
      } else if ( cat.level >= maxAllowed ) {
        cat.canTrain = false;
        cat.blockedReason = `Máx. ${maxAllowed} (${cat.affinityPct}%)`;
      } else {
        cat.canTrain = false;
      }

      const catData = NEN_CATEGORIES_DATA[cat.id];
      cat.minorSlots = [2, 5, 8].map(lvl => {
        const ab = catData?.minor?.[lvl];
        const reached = cat.level >= lvl;
        if ( !ab ) return { reached: false, level: lvl, empty: true };
        return { ...ab, reached, level: lvl, reference: NEN_ABILITY_REFS[ab.id] ?? "" };
      });

      cat.majorSlots = [3, 6, 10].map(lvl => {
        const ab = catData?.major?.[lvl];
        const reached = cat.level >= lvl;
        if ( !ab ) return { reached: false, level: lvl, empty: true, categoryId: cat.id };
        const unlocked = unlockedMajorMap[ab.id] ?? false;
        const canUnlock = reached && !unlocked && (nenMajorCount < nenMajorMax || ab.exclusive);
        return { ...ab, reached, unlocked, canUnlock, level: lvl, categoryId: cat.id, reference: NEN_ABILITY_REFS[ab.id] ?? "" };
      });
    }

    // Cor primária do hexágono: baseada na categoria do NPC
    const nenPrimaryColor = npcPrimaryCategory ? COLORS[npcPrimaryCategory] : (COLORS[nenCategories.reduce((a, b) => a.level >= b.level ? a : b).id] ?? "#c8a84b");

    context.nenCategories = nenCategories;
    context.nenMajorCount = nenMajorCount;
    context.nenMajorMax = nenMajorMax;
    context.nenHexPoints = hexPts;
    context.nenTrainingPoints = this.actor.system.curseResources?.trainingPoints ?? 0;
    context.nenLostTrainingPoints = this.actor.system.curseResources?.lostTrainingPoints ?? 0;
    context.nenGridRings = gridRings;
    context.nenAxes = axes;
    context.nenLabels = labels;
    context.nenPrimaryCategory = npcPrimaryCategory;
    context.nenPrimaryColor = nenPrimaryColor;
    console.log("NPCSheet | _prepareTrainingsContext | categories:", nenCategories.length);
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Calcula o nível máximo permitido em uma categoria para um NPC,
   * baseado na categoria principal definida na ficha.
   * Usa a mesma tabela de afinidade do sistema Hunter.
   */
  _getNpcMaxLevelForCategory(primaryCategoryId, targetCategoryId) {
    // Tabela de afinidade: categoria principal -> máximo em outras categorias
    const AFFINITY_TABLE = {
      aprimorador:  { aprimorador: 10, transmutador: 8, conjurador: 6, emissor: 4, manipulador: 4, especialista: 1 },
      emissor:      { emissor: 10, aprimorador: 8, transmutador: 6, conjurador: 4, manipulador: 4, especialista: 1 },
      transmutador: { transmutador: 10, aprimorador: 8, emissor: 6, conjurador: 4, manipulador: 4, especialista: 1 },
      conjurador:   { conjurador: 10, transmutador: 8, emissor: 6, aprimorador: 4, manipulador: 4, especialista: 1 },
      manipulador:  { manipulador: 10, conjurador: 8, transmutador: 6, emissor: 4, aprimorador: 4, especialista: 1 },
      especialista: { especialista: 10, aprimorador: 8, emissor: 8, transmutador: 8, conjurador: 8, manipulador: 8 }
    };
    return AFFINITY_TABLE[primaryCategoryId]?.[targetCategoryId] ?? 10;
  }

  /* -------------------------------------------- */

  _getNenMajorMax() {
    return 4; // NPCs têm sempre máximo fixo de 4 habilidades principais
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClickAction(event, target) {
    const action = target.dataset.action;

    if ( action === "unlockManipulation" )     return this._onUnlockManipulationAbility(target.dataset.ability, parseInt(target.dataset.cost ?? 0));
    if ( action === "unlockNenPrinciple" )      return this._onUnlockNenPrinciple(target.dataset.id);
    if ( action === "unlockNenAbility" )        return this._onUnlockNenAbility(target.dataset.id);
    if ( action === "undoNenPrinciple" )        return this._onUndoNenPrinciple(target.dataset.id);
    if ( action === "undoNenAbility" )          return this._onUndoNenAbility(target.dataset.id);
    if ( action === "unlockNenMajor" )          return this._onUnlockNenMajor(target.dataset.category, target.dataset.ability);
    if ( action === "undoNenMajor" )            return this._onUndoNenMajor(target.dataset.category, target.dataset.ability);
    if ( action === "trainNenCategory" )        return this._onTrainNenCategory(target.dataset.category);
    if ( action === "setNpcCategory" )          return this._onSetNpcCategory(target.dataset.category);

    return super._onClickAction(event, target);
  }

  /* -------------------------------------------- */

  /**
   * Define a categoria principal do NPC (usada para calcular afinidade).
   */
  async _onSetNpcCategory(categoryId) {
    if ( !categoryId ) return;
    await this.actor.update({ "system.nenCategories.primary": categoryId });
    console.log(`NPCSheet | _onSetNpcCategory | ${categoryId}`);
  }

  /* -------------------------------------------- */

  /**
   * Desbloqueia uma habilidade de Nen/Manipulação para o NPC.
   */
  async _onUnlockManipulationAbility(abilityId, cost) {
    if ( !abilityId ) return;
    const def = MANIPULATION_ABILITIES[abilityId];
    if ( !def ) return;

    const { can, reason } = canUnlockAbility(abilityId, this.actor);
    if ( !can ) {
      ui.notifications.warn(`Não é possível desbloquear: ${reason}`);
      return;
    }

    const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;
    if ( cursePoints < (def.cost ?? 0) ) {
      ui.notifications.warn(`PM insuficientes para desbloquear (custo: ${def.cost}, disponível: ${cursePoints}).`);
      return;
    }

    await this.actor.update({
      [`system.manipulation.abilities.${abilityId}.unlocked`]: true,
      "system.manipulation.pointsInvested": (this.actor.system.manipulation?.pointsInvested ?? 0) + (def.cost ?? 0),
      "system.curseResources.cursePoints": Math.max(0, cursePoints - (def.cost ?? 0))
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🔓 <strong>${this.actor.name}</strong> desbloqueou: <strong>${def.label}</strong>!`
    });
    console.log(`NPCSheet | _onUnlockManipulationAbility | ${abilityId}`);
  }

  /* -------------------------------------------- */

  async _onUnlockNenPrinciple(principleId) {
    const principles = preparePrinciples(this.actor);
    const pr = principles[principleId];
    if ( !pr || pr.unlocked ) { ui.notifications.warn(pr ? "Princípio já desbloqueado." : "Princípio não encontrado."); return; }

    const cost = pr.cost ?? 0;
    if ( cost > 0 ) {
      const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;
      if ( cursePoints < cost ) { ui.notifications.warn(`PM insuficientes! Precisa de ${cost} PM.`); return; }
      await this.actor.update({
        [`system.manipulation.principles.${principleId}.unlocked`]: true,
        "system.manipulation.pointsInvested": (this.actor.system.manipulation?.pointsInvested ?? 0) + cost,
        "system.curseResources.cursePoints": cursePoints - cost
      });
    } else {
      await this.actor.update({ [`system.manipulation.principles.${principleId}.unlocked`]: true });
    }
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `🔓 <strong>${this.actor.name}</strong> desbloqueou o princípio: <strong>${pr.label}</strong>!` });
  }

  /* -------------------------------------------- */

  async _onUnlockNenAbility(abilityId) {
    const def = MANIPULATION_ABILITIES[abilityId];
    if ( !def ) return;
    const { can, reason } = canUnlockAbility(abilityId, this.actor);
    if ( !can ) { ui.notifications.warn(`Não é possível desbloquear: ${reason}`); return; }

    const cost = def.cost ?? 0;
    const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;
    await this.actor.update({
      [`system.manipulation.abilities.${abilityId}.unlocked`]: true,
      "system.manipulation.pointsInvested": (this.actor.system.manipulation?.pointsInvested ?? 0) + cost,
      "system.curseResources.cursePoints": Math.max(0, cursePoints - cost)
    });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `🔓 <strong>${this.actor.name}</strong> desbloqueou: <strong>${def.label}</strong>!` });
  }

  /* -------------------------------------------- */

  async _onUndoNenPrinciple(principleId) {
    const principles = this.actor.system.manipulation?.principles ?? {};
    if ( !principles[principleId]?.unlocked ) return;
    const allPrinciples = TREE_DATA.flatMap(s => s.principles);
    const thisPr = allPrinciples.find(p => p.id === principleId);
    if ( !thisPr ) return;

    const unlockedPrinciples = new Set(allPrinciples.filter(p => principles[p.id]?.unlocked).map(p => p.id));
    const unlockedAbilities = new Set(Object.entries(this.actor.system.manipulation?.abilities ?? {}).filter(([, v]) => v?.unlocked).map(([k]) => k));
    const blockers = [
      ...allPrinciples.filter(p => unlockedPrinciples.has(p.id) && (p.req?.pr ?? []).includes(principleId)).map(p => p.label),
      ...(thisPr.abilities ?? []).filter(ab => unlockedAbilities.has(ab.id)).map(ab => ab.label)
    ];
    if ( blockers.length ) { ui.notifications.warn(`Desfaz primeiro: ${blockers.join(", ")}.`); return; }

    const cost = thisPr.cost ?? 0;
    const updates = { [`system.manipulation.principles.${principleId}.unlocked`]: false, "system.manipulation.pointsInvested": Math.max(0, (this.actor.system.manipulation?.pointsInvested ?? 0) - cost) };
    if ( cost > 0 ) updates["system.curseResources.cursePoints"] = (this.actor.system.curseResources?.cursePoints ?? 0) + cost;
    await this.actor.update(updates);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `↩ <strong>${this.actor.name}</strong> desfez o princípio: <strong>${thisPr.label}</strong>.` });
  }

  /* -------------------------------------------- */

  async _onUndoNenAbility(abilityId) {
    const abilities = this.actor.system.manipulation?.abilities ?? {};
    if ( !abilities[abilityId]?.unlocked ) return;
    const def = MANIPULATION_ABILITIES[abilityId];
    if ( !def ) return;
    const cost = def.cost ?? 0;
    await this.actor.update({
      [`system.manipulation.abilities.${abilityId}.unlocked`]: false,
      "system.manipulation.pointsInvested": Math.max(0, (this.actor.system.manipulation?.pointsInvested ?? 0) - cost),
      "system.curseResources.cursePoints": (this.actor.system.curseResources?.cursePoints ?? 0) + cost
    });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `↩ <strong>${this.actor.name}</strong> desfez: <strong>${def.label}</strong>.` });
  }

  /* -------------------------------------------- */

  async _onUnlockNenMajor(categoryId, abilityId) {
    const cat = NEN_CATEGORIES_DATA[categoryId];
    if ( !cat ) return;
    const level = this.actor.system.nenCategories?.[categoryId]?.level ?? 0;
    const abilityEntry = Object.entries(cat.major).find(([, ab]) => ab.id === abilityId);
    if ( !abilityEntry ) return;
    const [requiredLvl, ability] = abilityEntry;
    if ( level < parseInt(requiredLvl) ) { ui.notifications.warn(`Nível insuficiente! Precisa de nível ${requiredLvl}.`); return; }

    const nenMajorCount = this.actor.system.nenMajorCount ?? 0;
    const nenMajorMax = this._getNenMajorMax();
    if ( this.actor.system.nenCategories?.[categoryId]?.unlockedMajor?.[abilityId] ) { ui.notifications.warn("Já desbloqueada."); return; }
    if ( !ability.exclusive && nenMajorCount >= nenMajorMax ) { ui.notifications.warn(`Limite atingido (${nenMajorMax}).`); return; }

    await this.actor.update({
      [`system.nenCategories.${categoryId}.unlockedMajor.${abilityId}`]: true,
      "system.nenMajorCount": ability.exclusive ? nenMajorCount : nenMajorCount + 1
    });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `🔓 <strong>${this.actor.name}</strong> desbloqueou: <strong>${ability.label}</strong>!` });
  }

  /* -------------------------------------------- */

  async _onUndoNenMajor(categoryId, abilityId) {
    if ( !this.actor.system.nenCategories?.[categoryId]?.unlockedMajor?.[abilityId] ) return;
    const cat = NEN_CATEGORIES_DATA[categoryId];
    const ability = Object.values(cat?.major ?? {}).find(ab => ab.id === abilityId);
    await this.actor.update({
      [`system.nenCategories.${categoryId}.unlockedMajor.${abilityId}`]: false,
      "system.nenMajorCount": Math.max(0, (this.actor.system.nenMajorCount ?? 0) - (ability?.exclusive ? 0 : 1))
    });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `↩️ <strong>${this.actor.name}</strong> desfez: <strong>${ability?.label ?? abilityId}</strong>.` });
  }

  /* -------------------------------------------- */

  /**
   * Treina uma categoria Nen para o NPC.
   * NPCs avançam diretamente (sem rolar dado) — GM controla manualmente.
   */
  async _onTrainNenCategory(categoryId) {
    const cat = NEN_CATEGORIES_DATA[categoryId];
    if ( !cat ) return;

    const currentLevel = this.actor.system.nenCategories?.[categoryId]?.level ?? 0;
    const nextLevel = currentLevel + 1;
    const npcPrimary = this.actor.system.nenCategories?.primary ?? null;
    const maxAllowed = npcPrimary ? this._getNpcMaxLevelForCategory(npcPrimary, categoryId) : 10;

    if ( nextLevel > 10 ) { ui.notifications.info(`${cat.label} já está no nível máximo!`); return; }
    if ( maxAllowed === 0 ) { ui.notifications.warn(`Sem afinidade com ${cat.label}.`); return; }
    if ( nextLevel > maxAllowed ) { ui.notifications.warn(`Máximo ${maxAllowed} para ${cat.label} com a categoria do NPC.`); return; }

    const costs = NEN_LEVEL_COSTS[nextLevel];
    const trainingPoints = this.actor.system.curseResources?.trainingPoints ?? 0;
    const energyTotal = this.actor.system.energy?.total ?? 0;

    if ( trainingPoints < costs.pt ) { ui.notifications.warn(`PT insuficientes! Precisa de ${costs.pt} PT.`); return; }
    if ( energyTotal < costs.pa ) { ui.notifications.warn(`PA insuficientes! Precisa de ${costs.pa} PA.`); return; }

    await this.actor.update({
      "system.curseResources.trainingPoints": trainingPoints - costs.pt,
      "system.energy.total": Math.max(0, energyTotal - costs.pa),
      [`system.nenCategories.${categoryId}.level`]: nextLevel
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `✅ <strong>${this.actor.name}</strong> avançou para o <strong>Nível ${nextLevel}</strong> em <strong>${cat.label}</strong>!`
    });
    console.log(`NPCSheet | _onTrainNenCategory | ${categoryId} -> ${nextLevel}`);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _renderFrame(options) {
    const html = await super._renderFrame(options);
    this._renderSourceFrame(html);
    html.querySelector(".header-elements")?.insertAdjacentHTML("beforeend", '<div class="cr-xp"></div>');
    return html;
  }

  /* -------------------------------------------- */
  /*  Item Preparation Helpers                    */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _assignItemCategories(item) {
    if ( ["class", "subclass"].includes(item.type) ) return new Set(["classes"]);
    const categories = super._assignItemCategories(item);
    if ( item.type === "weapon" ) categories.add("features");
    return categories;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareItem(item, ctx) {
    await super._prepareItem(item, ctx);
    const isPassive = item.system.properties?.has("trait")
      || CONFIG.DND5E.activityActivationTypes[item.system.activities?.contents[0]?.activation.type]?.passive;
    ctx.group = isPassive ? "passive" : item.system.activities?.contents[0]?.activation.type || "passive";
  }

  /* -------------------------------------------- */
  /*  Life-Cycle Handlers                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onRender(context, options) {
    await super._onRender(context, options);

    if ( !this.actor.limited ) {
      this._renderCreateInventory();
      this._renderAttunement(context, options);
      this._renderSpellbook(context, options);
    }

    const elements = this.element.querySelector(".header-elements .cr-xp");
    if ( !elements || this.actor.limited ) return;
    const xp = this.actor.system.details.xp.value;
    elements.innerText = xp === null ? "" : game.i18n.format("DND5E.ExperiencePoints.Format", {
      value: formatNumber(xp)
    });

    if ( this.editingDescriptionTarget ) {
      this.element.querySelectorAll("prose-mirror").forEach(editor => editor.addEventListener("save", () => {
        this.editingDescriptionTarget = null;
        this.render();
      }));
    }

    // ── Explosão Defensiva NPC ─────────────────────────────
    this.element.querySelector("[data-action='jj-npc-expdef']")
      ?.addEventListener("click", () => _npcExplosaoDefensiva(this.actor));

    // ── Atualizar porcentagens das barras de energia ───────
    const energy = this.actor.system.energy;
    const barTotal = this.element.querySelector(".npc-energy-bar-total");
    if ( barTotal && energy.max ) {
      barTotal.style.setProperty("--bar-percentage", `${Math.round((energy.total / energy.max) * 100)}%`);
    }
    const barGen = this.element.querySelector(".npc-energy-bar-gen");
    if ( barGen && energy.genMax ) {
      barGen.style.setProperty("--bar-percentage", `${Math.round((energy.generated / energy.genMax) * 100)}%`);
    }

    // ── Atualizar energia máxima baseado no treinamento intenso ────────────
    _npcSyncIntensiveTraining(this.actor);
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _addDocumentItemTypes(tab) {
    const types = super._addDocumentItemTypes(tab);
    if ( tab === "features" ) types.push("weapon");
    return types;
  }

  /* -------------------------------------------- */

  /**
   * Handle expanding the description editor.
   * @this {NPCActorSheet}
   * @param {Event} event         Triggering click event.
   * @param {HTMLElement} target  Button that was clicked.
   */
  static #editDescription(event, target) {
    if ( target.ariaDisabled ) return;
    this.editingDescriptionTarget = target.dataset.target;
    this.render();
  }

  /* -------------------------------------------- */

  /** @override */
  _showConfiguration(event, target) {
    let app;
    const config = { document: this.actor };
    switch ( target.dataset.config ) {
      case "habitat":
        app = new HabitatConfig(config);
        break;
      case "treasure":
        app = new TreasureConfig(config);
        break;
    }
    if ( app ) {
      this._renderChild(app);
      return false;
    }
  }

  /* -------------------------------------------- */
  /*  Form Handling                               */
  /* -------------------------------------------- */

  /** @inheritDoc */
  _processFormData(event, form, formData) {
    const submitData = super._processFormData(event, form, formData);

    // Convert CR
    let cr = submitData.system?.details?.cr;
    if ( (cr === "") || (cr === "—") ) foundry.utils.setProperty(submitData, "system.details.cr", null);
    else {
      cr = { "1/8": 0.125, "⅛": 0.125, "1/4": 0.25, "¼": 0.25, "1/2": 0.5, "½": 0.5 }[cr] || parseFloat(cr);
      if ( Number.isNaN(cr) ) cr = null;
      else foundry.utils.setProperty(submitData, "system.details.cr", cr < 1 ? cr : parseInt(cr));
    }

    return submitData;
  }

  /* -------------------------------------------- */
  /*  Drag & Drop                                 */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onDragStart(event) {
    const target = event.currentTarget;
    if ( target.classList.contains("pill") ) {
      const dataset = target.querySelector("[data-item-id]")?.dataset ?? {};
      const item = await this.actor.items.get(dataset.itemId)?.system.asGear?.();
      if ( item ) {
        event.dataTransfer.setData("text/plain", JSON.stringify({
          data: item.isEmbedded ? item.toObject() : game.items.fromCompendium(item),
          type: "Item"
        }));
        return;
      }
    }
    return super._onDragStart(event);
  }
}

/* ============================================================
 * SISTEMA DE ENERGIA — NPC
 * ============================================================ */

// Geração de PA no início do turno — dialog 2x / 3x / 4x do ND
async function _npcEnergyGenerationDialog(actor) {
  const nd = actor.system.details?.cr ?? 1;

  const multiplicador = await foundry.applications.api.DialogV2.wait({
    window: { title: `⚡ Geração de Energia — ${actor.name}` },
    content: `
      <p style="margin:0 0 10px;">Quantas vezes o ND (<strong>${nd}</strong>) deseja gerar?</p>`,
    buttons: [
      { label: `2× (${nd * 2} PA)`,  action: "2", default: true },
      { label: `3× (${nd * 3} PA)`,  action: "3" },
      { label: `4× (${nd * 4} PA)`,  action: "4" },
      { label: "Pular",              action: "skip" }
    ],
    rejectClose: false,
    close: () => "skip"
  });

  if ( !multiplicador || multiplicador === "skip" ) return null;
  return { nd, multiplicador };
}

async function _npcApplyEnergyGeneration(actor, nd, multiplicador) {
  const alvo        = nd * Number(multiplicador);
  const geradaAtual = actor.system.energy.generated ?? 0;
  const totalAtual  = actor.system.energy.total ?? 0;

  if ( alvo <= geradaAtual ) {
    ui.notifications.info(`${actor.name} já tem ${geradaAtual} PA Gerada — alvo ${alvo} não é maior.`);
    return;
  }

  const necessario    = alvo - geradaAtual;
  const transferencia = Math.min(necessario, totalAtual);

  if ( transferencia === 0 ) {
    ui.notifications.warn(`${actor.name} não tem PA Total suficiente para gerar!`);
    return;
  }

  await actor.update({
    "system.energy.total":     totalAtual - transferencia,
    "system.energy.generated": geradaAtual + transferencia
  }, { isEnergySystem: true });

  const sheet = actor.sheet;
  if ( sheet?.rendered ) sheet.render();
}

Hooks.on("updateCombat", async (combat, changed) => {
  if ( !("turn" in changed) && !("round" in changed) ) return;

  const combatant = combat.combatant;
  if ( !combatant ) return;

  const token = canvas.tokens?.get(combatant.tokenId);
  if ( !token ) return;
  const actor = token.actor;
  if ( !actor || actor.type !== "npc" ) return;
  if ( !actor.system.energy?.max ) return;

  // Encontrar o dono da ficha (jogador ativo não-GM) ou fallback para GM ativo
  const owner = game.users.find(u => !u.isGM && u.active && actor.testUserPermission(u, "OWNER"))
    ?? game.users.find(u => u.isGM && u.active);

  if ( !owner ) return;

  // Se o usuário atual é o dono, mostra o dialog direto
  if ( owner.id === game.user.id ) {
    const result = await _npcEnergyGenerationDialog(actor);
    if ( !result ) return;
    if ( game.user.isGM ) {
      await _npcApplyEnergyGeneration(actor, result.nd, result.multiplicador);
    } else {
      // Jogador envia as escolhas para o GM processar
      game.socket.emit("system.jujutsu-system", {
        action: "npcEnergyChoices",
        actorId: actor.id,
        nd: result.nd,
        multiplicador: result.multiplicador
      });
    }
  }
  // GM emite socket para o dono se não for ele
  else if ( game.user.isGM ) {
    game.socket.emit("system.jujutsu-system", {
      action: "npcEnergyDialog",
      actorId: actor.id,
      userId: owner.id
    });
  }
});

// Explosão Defensiva do NPC — mesmo comportamento do jogador
async function _npcExplosaoDefensiva(actor) {
  const flagData     = actor.getFlag("jujutsu-system", "explosaoDefensivaPendente") ?? null;
  const pendente     = flagData?.reducao ?? 0;
  const pendenteCusto = flagData?.paCusto ?? 0;

  if ( pendente > 0 ) {
    const cancel = await foundry.applications.api.DialogV2.confirm({
      window: { title: "🛡️ Explosão Defensiva Ativa" },
      content: `<p>Redução de <strong>${pendente}</strong> pendente (custo: <strong>${pendenteCusto} PA</strong>).</p><p>Deseja cancelar e recuperar a PA?</p>`,
      yes: { label: "Cancelar e Devolver PA" },
      no:  { label: "Manter" }
    });
    if ( !cancel ) return;
    await actor.unsetFlag("jujutsu-system", "explosaoDefensivaPendente");
    const paAtual = actor.system?.energy?.generated ?? 0;
    await actor.update({ "system.energy.generated": paAtual + pendenteCusto });
    ui.notifications.info("Explosão Defensiva cancelada. PA devolvida.");
    return;
  }

  const paDisp = actor.system?.energy?.generated ?? 0;
  if ( paDisp === 0 ) {
    ui.notifications.warn(`${actor.name} não tem PA Gerada disponível!`);
    return;
  }

  const paGasto = await foundry.applications.api.DialogV2.wait({
    window: { title: "🛡️ Explosão Defensiva" },
    content: `
      <div style="padding:8px 0">
        <p style="margin:0 0 8px">Gastar PA para reduzir o próximo dano?</p>
        <p style="margin:0 0 4px; font-size:12px; color:#aaa;">
          PA Gerada disponível: <strong>${paDisp}</strong>
        </p>
        <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
          <label style="flex:0 0 auto">Dados d4:</label>
          <input type="number" id="jj-npc-expdef-input"
                 value="0" min="0" max="${paDisp}"
                 style="width:60px; text-align:center;">
          <span style="font-size:12px; color:#aaa;">1 PA por dado</span>
        </div>
      </div>`,
    buttons: [
      {
        label: "Rolar", action: "ok", default: true,
        callback: (event, button, dialog) => {
          const input = dialog.element?.querySelector("#jj-npc-expdef-input");
          return Math.max(0, Math.min(Number(input?.value ?? 0), paDisp));
        }
      },
      { label: "Cancelar", action: "cancel", callback: () => null }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( !paGasto ) return;

  const roll = await new Roll(`${paGasto}d4`).evaluate();
  if ( game.dice3d ) game.dice3d.showForRoll(roll, game.user, true);

  await actor.setFlag("jujutsu-system", "explosaoDefensivaPendente", { reducao: roll.total, paCusto: paGasto });
  await actor.update({ "system.energy.generated": Math.max(0, paDisp - paGasto) });

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `🛡️ <strong>${actor.name}</strong> usa Explosão Defensiva — reduz <strong>${roll.total}</strong> do próximo dano!`
  });
}

async function _npcSyncIntensiveTraining(actor) {
  // Reservado para uso futuro
}
