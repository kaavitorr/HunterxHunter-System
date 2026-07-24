import { formatNumber, getPluralRules, simplifyBonus, splitSemicolons } from "../../utils.mjs";
import { createCheckboxInput } from "../fields.mjs";
import BaseActorSheet from "./api/base-actor-sheet.mjs";
import HabitatConfig from "./config/habitat-config.mjs";
import TreasureConfig from "./config/treasure-config.mjs";
import { prepareManipulationAbilities, preparePrinciples, TREE_DATA, MANIPULATION_ABILITIES, PRINCIPLES_DATA, canUnlockAbility, getAvailableTrainingPoints, grantLinkedTechniques } from "../../systems/manipulation-data.mjs";
import { NEN_CATEGORIES_DATA, NEN_LEVEL_COSTS, NEN_AFFINITY, getMaxLevelForCategory } from "../../systems/nen-categories-data.mjs";
import CharacterActorSheet, { JJ_CONDITIONS, _injectJJConditions, setupNenWheels } from "./character-sheet.mjs";
import ContextMenu5e from "../context-menu.mjs";

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
      template: "systems/hunter-system/templates/actors/npc-header.hbs"
    },
    sidebarCollapser: {
      container: { classes: ["main-content"], id: "main" },
      template: "systems/hunter-system/templates/actors/parts/sidebar-collapser.hbs"
    },
    sidebar: {
      container: { classes: ["main-content"], id: "main" },
      template: "systems/hunter-system/templates/actors/npc-sidebar.hbs",
      templates: ["systems/hunter-system/templates/actors/parts/jj-power-buttons.hbs"]
    },
    features: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/actor-features.hbs",
      templates: ["systems/hunter-system/templates/inventory/inventory.hbs", "systems/hunter-system/templates/inventory/activity.hbs"],
      scrollable: [""]
    },
    inventory: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/actor-inventory.hbs",
      templates: [
        "systems/hunter-system/templates/inventory/inventory.hbs", "systems/hunter-system/templates/inventory/activity.hbs",
        "systems/hunter-system/templates/inventory/encumbrance.hbs"
      ],
      scrollable: [""]
    },
    spells: {
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/creature-spells.hbs",
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
      template: "systems/hunter-system/templates/actors/tabs/npc-biography.hbs",
      scrollable: [""]
    },
    specialTraits: {
      classes: ["flexcol"],
      container: { classes: ["tab-body"], id: "tabs" },
      template: "systems/hunter-system/templates/actors/tabs/creature-special-traits.hbs",
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
      template: "systems/hunter-system/templates/actors/parts/actor-warnings-dialog.hbs"
    },
    tabs: {
      id: "tabs",
      classes: ["tabs-right"],
      template: "systems/hunter-system/templates/shared/sidebar-tabs.hbs"
    }
  };

  /* -------------------------------------------- */

  /** @override */
  static TABS = [
    { tab: "features", label: "DND5E.Features", icon: "fas fa-list" },
    { tab: "inventory", label: "DND5E.Inventory", svg: "systems/hunter-system/icons/svg/backpack.svg" },
    { tab: "spells", label: "TYPES.Item.spellPl", icon: "fas fa-book" },
    { tab: "hatsu", label: "JUJUTSU.Hatsu.Tab", icon: "fas fa-hand-fist" },
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

  /** @override — intercepta drops na aba Hatsu */
  async _onDropItem(event, item) {
    const hatsuTarget = event.target.closest("[data-hatsu-drop]");
    if ( hatsuTarget && item.type === "spell" ) {
      return this._onHatsuDropSpell(event, item, hatsuTarget);
    }
    return super._onDropItem(event, item);
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
      case "hatsu": return this._prepareHatsuContext(context, options);
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

    // Condições do sistema Hunter para injetar via _onRender
    const activeStatuses = new Set(this.actor.statuses ?? []);
    context.jjConditions = JJ_CONDITIONS.map(cond => ({
      ...cond,
      active: activeStatuses.has(cond.id)
    }));

    // Botões de poder no topo da aba (mesmos da sidebar)
    this._prepareJJPowersContext(context);

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Mesma lógica do CharacterActorSheet — botões de poder + flags de pin.
   */
  _prepareJJPowersContext(context) {
    const ab = this.actor.system.manipulation?.abilities ?? {};
    context.foco = {
      show: !!(ab.focoAgressivo?.unlocked || ab.focoDefensivo?.unlocked),
      agressivoUnlocked: !!ab.focoAgressivo?.unlocked,
      defensivoUnlocked: !!ab.focoDefensivo?.unlocked,
      agressivoAtivo:    !!this.actor.getFlag("hunter-system", "focoAgressivoAtivo"),
      // defensivoAtivo é derivado de armorPoints.value > 0 — fonte única.
      defensivoAtivo:    (this.actor.system.armorPoints?.value ?? 0) > 0,
      fluxoVeloz:        !!ab.fluxoVeloz?.unlocked,
      fluxoConstante:    !!ab.fluxoConstante?.unlocked
    };
    context.foco.agressivoDie = context.foco.fluxoConstante ? "1d6" : "1d4";
    // Pontos de Armadura do Foco Defensivo (derivado em character.mjs/npc.mjs).
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

    const pin = this.actor.getFlag("hunter-system", "pinSidebar") ?? {};
    context.pinSidebar = {
      expDef:     pin.expDef     !== false,
      estagio:    pin.estagio    !== false,
      agressivo:  pin.agressivo  !== false,
      defensivo:  pin.defensivo  !== false
    };
    context.foco.bothPinned = context.pinSidebar.agressivo && context.pinSidebar.defensivo;
    context.foco.anyPinned  = context.pinSidebar.agressivo || context.pinSidebar.defensivo;
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

    // Percentuais para barras (Pontos de Aura + PA Gerado)
    const energy = this.actor.system.energy;
    context.energyPct      = energy?.max    > 0 ? Math.round((energy.total / energy.max) * 100) : 0;
    context.energyGenPct   = energy?.genMax > 0 ? Math.round((energy.generated / energy.genMax) * 100) : 0;

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

    // Botões de poder no sidebar
    this._prepareJJPowersContext(context);

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

      // O template usa manipulation.sections; categoryColor pinta os acentos da aba
      const categoryColor = this._getPrimaryNenCategory()?.color ?? "#c8a84b";
      context.manipulation = { sections, categoryColor };
      console.log("NPCSheet | _prepareManipulationContext | sections:", sections.length);
    } catch(err) {
      console.error("NPCSheet | Erro em _prepareManipulationContext:", err);
      context.manipulation = { sections: [], categoryColor: "#c8a84b" };
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
    const KANJIS = {
      aprimorador: "強", emissor: "放", transmutador: "変",
      conjurador: "具", manipulador: "操", especialista: "特"
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
      const levelSegments = Array.from({ length: 10 }, (_, i) => i < level);
      nenCategories.push({ id, label: LABELS[id], abbrev: ABBREVS[id], color: COLORS[id], kanji: KANJIS[id], icon: ICONS[id], level, pct, levelSegments, dcReductions });
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
        if ( !ab ) return { reached: false, level: lvl, empty: true, color: cat.color };
        return { ...ab, reached, level: lvl, color: cat.color, reference: NEN_ABILITY_REFS[ab.id] ?? "" };
      });

      // categoryId e color pré-calculados para evitar {{../cat.id}}/{{../cat.color}} no HBS
      // (parâmetros de bloco de {{#each}} aninhados não resolvem via ../ de forma confiável)
      cat.majorSlots = [3, 6, 10].map(lvl => {
        const ab = catData?.major?.[lvl];
        const reached = cat.level >= lvl;
        if ( !ab ) return { reached: false, level: lvl, empty: true, categoryId: cat.id, color: cat.color };
        const unlocked = unlockedMajorMap[ab.id] ?? false;
        const canUnlock = reached && !unlocked && (nenMajorCount < nenMajorMax || ab.exclusive);
        return { ...ab, reached, unlocked, canUnlock, level: lvl, categoryId: cat.id, color: cat.color, reference: NEN_ABILITY_REFS[ab.id] ?? "" };
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
    context.nenNarratorTrainingPoints = this.actor.system.curseResources?.narratorTrainingPoints ?? 0;
    context.nenSpentTrainingPoints = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
    context.nenGridRings = gridRings;
    context.nenAxes = axes;
    context.nenLabels = labels;
    // Perímetro do hexágono ligando os 6 nós das categorias (moldura forte)
    context.nenOuterPoints = labels.map(l => `${l.lx},${l.ly}`).join(" ");
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
    // Usa a tabela única de afinidade definida em nen-categories-data.mjs
    return NEN_AFFINITY[primaryCategoryId]?.[targetCategoryId] ?? 0;
  }

  /* -------------------------------------------- */

  _getNenMajorMax() {
    return 4; // NPCs têm sempre máximo fixo de 4 habilidades principais
  }

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onClickAction(event, target) {
    // Bloqueia disparo em botões não-primários (right/middle click).
    // Right-click deve apenas abrir o context menu, nunca executar a ação.
    if ( event?.button > 0 ) return;

    const action = target.dataset.action;

    if ( action === "unlockManipulation" )     return this._onUnlockManipulationAbility(target.dataset.ability, parseInt(target.dataset.cost ?? 0));
    if ( action === "unlockNenPrinciple" )      return this._onUnlockNenPrinciple(target.dataset.id);
    if ( action === "unlockNenAbility" )        return this._onUnlockNenAbility(target.dataset.id);
    if ( action === "undoNenPrinciple" )        return this._onUndoNenPrinciple(target.dataset.id);
    if ( action === "undoNenAbility" )          return this._onUndoNenAbility(target.dataset.id);
    // unlockNenMajor/undoNenMajor sem case aqui de propósito — ver _onRender, onde o card
    // inteiro (sem botão dedicado) trata clique/clique-direito com confirmação via DialogV2.
    if ( action === "trainNenCategory" )        return this._onTrainNenCategory(target.dataset.category);
    if ( action === "setNpcCategory" )          return this._onSetNpcCategory(target.dataset.category);
    if ( action === "intensiveTraining" )       return this._onIntensiveTraining();
    if ( action === "undoIntensiveTraining" )   return this._onUndoIntensiveTraining(target.dataset.field);
    if ( action === "jj-toggle-pin" )           return this._onTogglePinSidebar(target.dataset.pin);

    // Aba Hatsu — delega para CharacterActorSheet
    if ( action === "hatsu-roll" )              return this._onHatsuRoll(target.dataset.itemId);
    if ( action === "hatsu-edit" )              return this._onHatsuEdit(target.dataset.itemId);
    if ( action === "hatsu-unassign-manif" )    return this._onHatsuUnassign(target.dataset.slot, "manif");
    if ( action === "hatsu-unassign-tecnica" )  return this._onHatsuUnassignTecnica(target.dataset.itemId);
    if ( action === "hatsu-create-manif" )      return this._onHatsuCreateManif(target.dataset.slot);
    if ( action === "hatsu-create-tecnica" )    return this._onHatsuCreateTecnica(target.dataset.slot);
    if ( action === "hatsu-req-add" )           return this._onHatsuReqAdd(target.dataset.itemId);
    if ( action === "hatsu-req-remove" )        return this._onHatsuReqRemove(target.dataset.itemId, parseInt(target.dataset.index));
    if ( action === "hatsu-toggle-ultimato" )   return this._onHatsuToggleUltimato();
    if ( action === "hatsu-display-card" )      return this._onHatsuDisplayCard(target.dataset.itemId);
    if ( action === "hatsu-change-image" )      return this._onHatsuChangeImage(target.dataset.itemId);
    if ( action === "hatsu-toggle-mode" )       return this._onHatsuToggleMode(target.dataset.itemId, target.dataset.mode);
    if ( action === "hatsu-save-template" )     return this._onHatsuSaveTemplate();
    if ( action === "hatsu-import-json" )       return this._onHatsuImportJSON();

    return super._onClickAction(event, target);
  }

  /* -------------------------------------------- */
  /*  Hatsu — delegação para CharacterActorSheet  */
  /* -------------------------------------------- */

  _prepareHatsuContext(...args)            { return CharacterActorSheet.prototype._prepareHatsuContext.call(this, ...args); }
  _onHatsuRoll(...args)                    { return CharacterActorSheet.prototype._onHatsuRoll.call(this, ...args); }
  _onHatsuEdit(...args)                    { return CharacterActorSheet.prototype._onHatsuEdit.call(this, ...args); }
  _onHatsuUnassign(...args)                { return CharacterActorSheet.prototype._onHatsuUnassign.call(this, ...args); }
  _onHatsuUnassignTecnica(...args)         { return CharacterActorSheet.prototype._onHatsuUnassignTecnica.call(this, ...args); }
  _onHatsuCreateManif(...args)             { return CharacterActorSheet.prototype._onHatsuCreateManif.call(this, ...args); }
  _onHatsuCreateTecnica(...args)           { return CharacterActorSheet.prototype._onHatsuCreateTecnica.call(this, ...args); }
  _onHatsuReqAdd(...args)                  { return CharacterActorSheet.prototype._onHatsuReqAdd.call(this, ...args); }
  _onHatsuReqRemove(...args)               { return CharacterActorSheet.prototype._onHatsuReqRemove.call(this, ...args); }
  _onHatsuReqChange(...args)               { return CharacterActorSheet.prototype._onHatsuReqChange.call(this, ...args); }
  _onHatsuToggleUltimato(...args)          { return CharacterActorSheet.prototype._onHatsuToggleUltimato.call(this, ...args); }
  _calcHatsuTier(...args)                  { return CharacterActorSheet.prototype._calcHatsuTier.call(this, ...args); }
  _syncHatsuProficiencyEffect(...args)     { return CharacterActorSheet.prototype._syncHatsuProficiencyEffect.call(this, ...args); }
  _onHatsuDropSpell(...args)               { return CharacterActorSheet.prototype._onHatsuDropSpell.call(this, ...args); }
  _onHatsuDisplayCard(...args)             { return CharacterActorSheet.prototype._onHatsuDisplayCard.call(this, ...args); }
  _onHatsuChangeImage(...args)             { return CharacterActorSheet.prototype._onHatsuChangeImage.call(this, ...args); }
  _onHatsuToggleMode(...args)              { return CharacterActorSheet.prototype._onHatsuToggleMode.call(this, ...args); }
  _onHatsuSaveTemplate(...args)            { return CharacterActorSheet.prototype._onHatsuSaveTemplate.call(this, ...args); }
  _onHatsuImportJSON(...args)              { return CharacterActorSheet.prototype._onHatsuImportJSON.call(this, ...args); }
  _installHatsuItems(...args)              { return CharacterActorSheet.prototype._installHatsuItems.call(this, ...args); }
  _isHatsuItemBlocked(...args)             { return CharacterActorSheet.prototype._isHatsuItemBlocked.call(this, ...args); }
  _getPrimaryNenCategory(...args)          { return CharacterActorSheet.prototype._getPrimaryNenCategory.call(this, ...args); }

  /* -------------------------------------------- */

  /**
   * Toggle do pin de um botão de poder no sidebar.
   */
  async _onTogglePinSidebar(pinKey) {
    if ( !pinKey ) return;
    const current = this.actor.getFlag("hunter-system", "pinSidebar") ?? {};
    const wasPinned = current[pinKey] !== false;
    await this.actor.setFlag("hunter-system", "pinSidebar", { ...current, [pinKey]: !wasPinned });
  }

  /* -------------------------------------------- */

  /**
   * Toggle do Foco Agressivo / Defensivo. Mesma lógica do CharacterActorSheet.
   */
  async _onToggleFoco(focoType) {
    const ab = this.actor.system.manipulation?.abilities ?? {};
    const flagAgressivo  = !!this.actor.getFlag("hunter-system", "focoAgressivoAtivo");
    // defensivoAtivo é derivado: armorPoints.value > 0
    const flagDefensivo  = (this.actor.system.armorPoints?.value ?? 0) > 0;
    const fluxoVeloz     = !!ab.fluxoVeloz?.unlocked;
    const fluxoConstante = !!ab.fluxoConstante?.unlocked;
    const tempAmount     = this.actor.system.armorPoints?.max ?? 0; // mantido por compat
    const dieFace        = fluxoConstante ? 6 : 4;

    if ( focoType === "agressivo" ) {
      if ( !ab.focoAgressivo?.unlocked ) return;
      const novo = !flagAgressivo;
      if ( novo && flagDefensivo && !fluxoVeloz ) await this._desativarFocoDefensivo({ silent: true });
      await this.actor.setFlag("hunter-system", "focoAgressivoAtivo", novo);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: novo
          ? `🥊 <strong>${this.actor.name}</strong> ativou o <strong>Foco Agressivo</strong> (+1d${dieFace} de dano em ataques comuns).`
          : `🥊 <strong>${this.actor.name}</strong> desativou o <strong>Foco Agressivo</strong>.`
      });
    } else if ( focoType === "defensivo" ) {
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
    if ( this.actor.getFlag("hunter-system", "focoDefensivoAtivo") !== undefined ) {
      await this.actor.unsetFlag("hunter-system", "focoDefensivoAtivo");
    }
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🛡️ <strong>${this.actor.name}</strong> ativou o <strong>Foco Defensivo</strong> — recebe <strong>${max} Pontos de Armadura</strong>!`
    });
  }

  async _desativarFocoDefensivo({ silent = false } = {}) {
    const updates = { "system.armorPoints.value": 0 };
    const grantedLegacy = this.actor.getFlag("hunter-system", "focoDefensivoTempHpGranted") ?? 0;
    if ( grantedLegacy > 0 ) {
      const cur = this.actor.system.attributes?.hp?.temp ?? 0;
      updates["system.attributes.hp.temp"] = Math.max(0, cur - grantedLegacy);
    }
    await this.actor.update(updates);
    if ( grantedLegacy > 0 ) await this.actor.unsetFlag("hunter-system", "focoDefensivoTempHpGranted");
    if ( this.actor.getFlag("hunter-system", "focoDefensivoAtivo") !== undefined ) {
      await this.actor.unsetFlag("hunter-system", "focoDefensivoAtivo");
    }
    if ( !silent ) ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🛡️ <strong>${this.actor.name}</strong> desativou o <strong>Foco Defensivo</strong>.`
    });
  }

  /* -------------------------------------------- */

  /**
   * Toggle do Estágio de Foco (requer Ultimato). Custa 2 PA na ativação.
   */
  async _onToggleEstagioFoco() {
    const tier = this.actor.getFlag("hunter-system", "hatsuActiveTier") ?? "none";
    if ( tier !== "ultimato" ) {
      ui.notifications.warn("Estágio de Foco requer proficiência Ultimato.");
      return;
    }
    const ativo = !!this.actor.getFlag("hunter-system", "hatsuEstagioFocoAtivo");
    if ( !ativo ) {
      const energy = this.actor.system.energy?.total ?? 0;
      if ( energy < 2 ) { ui.notifications.warn("PA insuficientes (2 PA)."); return; }
      await this.actor.update({ "system.energy.total": energy - 2 });
      await this.actor.setFlag("hunter-system", "hatsuEstagioFocoAtivo", true);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `🔥 <strong>${this.actor.name}</strong> entrou no <strong>Estágio de Foco</strong> (-2 PA).`
      });
    } else {
      await this.actor.setFlag("hunter-system", "hatsuEstagioFocoAtivo", false);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `<strong>${this.actor.name}</strong> saiu do Estágio de Foco.`
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Treinamento Intenso (10 dias) — escolhe entre PA Máximo +5, PA Gerada +1/turno, ou +4 PM.
   * Mesma lógica do character sheet, exposta no NPC.
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
          <p style="margin:0 0 10px; font-size:12px; color:#aaa;">Escolha o benefício do <strong>Treinamento Intenso (10 dias)</strong>:</p>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px; cursor:pointer;">
              <input type="radio" name="jj-training-choice" value="maxEnergy">
              <div><strong style="color:#c0a0ff;">↑ PA Máximo +5</strong>
                <div style="font-size:11px; color:#8080a0;">Atual: ${currentMaxPA} → ${currentMaxPA + 5} (treino ${(it.maxEnergy ?? 0) + 1})</div></div>
            </label>
            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px; cursor:pointer; ${generatedAtLimit ? "opacity:0.4;" : ""}">
              <input type="radio" name="jj-training-choice" value="generatedEnergy" ${generatedAtLimit ? "disabled" : ""}>
              <div><strong style="color:#60c0ff;">⚡ PA Gerada +1/turno</strong>
                <div style="font-size:11px; color:#8080a0;">${generatedAtLimit ? "⛔ Limite atingido (20 treinos)" : `Treinos: ${currentGeneratedBonus}/20 — bônus de +${currentGeneratedBonus} → +${currentGeneratedBonus + 1} por turno`}</div></div>
            </label>
            <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px; cursor:pointer;">
              <input type="radio" name="jj-training-choice" value="cursePoints">
              <div><strong style="color:#ffa060;">💀 Pontos de Nen +1</strong>
                <div style="font-size:11px; color:#8080a0;">Atual: ${cursePoints} PN → ${cursePoints + 1} PN</div></div>
            </label>
          </div>
        </div>`,
      buttons: [
        { label: "Confirmar Treinamento", action: "ok", default: true,
          callback: (event, button, dialog) => {
            const sel = (dialog.element ?? document).querySelector("input[name='jj-training-choice']:checked");
            return sel?.value ?? null;
          }},
        { label: "Cancelar", action: "cancel", callback: () => null }
      ],
      rejectClose: false,
      close: () => null
    });

    if ( !choice ) return;
    const it2 = actor.system.energy?.intensiveTraining ?? {};
    const updates = {};
    let chatMsg = "";

    if ( choice === "maxEnergy" ) {
      const novo = (it2.maxEnergy ?? 0) + 1;
      updates["system.energy.intensiveTraining.maxEnergy"] = novo;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>PA Máximo +5</strong> (${novo} treino(s) = +${novo * 5} PA Máx).`;
    } else if ( choice === "generatedEnergy" ) {
      if ( generatedAtLimit ) { ui.notifications.warn("Limite de treinos de PA Gerada (20)."); return; }
      const novo = (it2.generatedEnergy ?? 0) + 1;
      updates["system.energy.intensiveTraining.generatedEnergy"] = novo;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>PA Gerada +1</strong>/turno (treino ${novo}/20).`;
    } else if ( choice === "cursePoints" ) {
      const cur = actor.system.curseResources?.cursePoints ?? 0;
      updates["system.curseResources.cursePoints"] = cur + 1;
      updates["system.energy.intensiveTraining.cursePoints"] = (it2.cursePoints ?? 0) + 1;
      chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>+1 Ponto de Nen</strong> (total: ${cur + 1}).`;
    }

    await actor.update(updates);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: chatMsg });
    ui.notifications.info("Treinamento Intenso concluído!");
  }

  /* -------------------------------------------- */

  async _onUndoIntensiveTraining(field) {
    const actor = this.actor;
    const it = actor.system.energy?.intensiveTraining ?? {};
    const FIELDS = {
      maxEnergy:       { label: "PA Máximo", amount: 1,
        undo: it => ({ "system.energy.intensiveTraining.maxEnergy": Math.max(0, (it.maxEnergy ?? 0) - 1) }) },
      generatedEnergy: { label: "PA Gerada", amount: 1,
        undo: it => ({ "system.energy.intensiveTraining.generatedEnergy": Math.max(0, (it.generatedEnergy ?? 0) - 1) }) },
      cursePoints:     { label: "Pontos de Nen", amount: 1,
        undo: it => ({
          "system.curseResources.cursePoints": Math.max(0, (actor.system.curseResources?.cursePoints ?? 0) - 1),
          "system.energy.intensiveTraining.cursePoints": Math.max(0, (it.cursePoints ?? 0) - 1)
        }) }
    };
    const cfg = FIELDS[field];
    if ( !cfg ) return;
    if ( (it[field] ?? 0) <= 0 ) {
      ui.notifications.warn(`Não há treinos de ${cfg.label} para desfazer.`);
      return;
    }
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "↩️ Desfazer Treinamento" },
      content: `<p>Desfazer o último treino de <strong>${cfg.label}</strong>?<br><span style="font-size:12px;color:#aaa;">Reverterá <strong>-${cfg.amount}</strong>.</span></p>`,
      yes: { label: "Desfazer" }, no: { label: "Cancelar" }
    });
    if ( !ok ) return;
    await actor.update(cfg.undo(it));
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `↩️ <strong>${actor.name}</strong> desfez um Treinamento de <strong>${cfg.label}</strong> (-${cfg.amount}).`
    });
    ui.notifications.info(`Treinamento de ${cfg.label} desfeito.`);
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
      ui.notifications.warn(`PN insuficientes para desbloquear (custo: ${def.cost}, disponível: ${cursePoints}).`);
      return;
    }

    const entryManip = this.actor.system.manipulation?.abilities?.[abilityId] ?? {};
    await this.actor.update({
      // Entrada completa — updates parciais em entradas antigas são descartados em silêncio.
      [`system.manipulation.abilities.${abilityId}`]: {
        unlocked: true,
        dcReduction: entryManip.dcReduction ?? 0,
        count: entryManip.count ?? 0
      },
      "system.manipulation.pointsInvested": (this.actor.system.manipulation?.pointsInvested ?? 0) + (def.cost ?? 0),
      "system.curseResources.cursePoints": Math.max(0, cursePoints - (def.cost ?? 0))
    });

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `🔓 <strong>${this.actor.name}</strong> desbloqueou: <strong>${def.label}</strong>!`
    });

    // Técnicas vinculadas — paridade com o character-sheet (NPC não recebia nenhuma)
    if ( def.techniques?.length ) await grantLinkedTechniques(this.actor, def.techniques);
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
      if ( cursePoints < cost ) { ui.notifications.warn(`PN insuficientes! Precisa de ${cost} PN.`); return; }
      await this.actor.update({
        [`system.manipulation.principles.${principleId}.unlocked`]: true,
        "system.manipulation.pointsInvested": (this.actor.system.manipulation?.pointsInvested ?? 0) + cost,
        "system.curseResources.cursePoints": cursePoints - cost
      });
    } else {
      await this.actor.update({ [`system.manipulation.principles.${principleId}.unlocked`]: true });
    }
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `🔓 <strong>${this.actor.name}</strong> desbloqueou o princípio: <strong>${pr.label}</strong>!` });

    // Técnicas vinculadas ao princípio — paridade com o character-sheet
    const principleData = PRINCIPLES_DATA[principleId];
    if ( principleData?.techniques?.length ) await grantLinkedTechniques(this.actor, principleData.techniques);
  }

  /* -------------------------------------------- */

  async _onUnlockNenAbility(abilityId) {
    const def = MANIPULATION_ABILITIES[abilityId];
    if ( !def ) return;
    const { can, reason } = canUnlockAbility(abilityId, this.actor);
    if ( !can ) { ui.notifications.warn(`Não é possível desbloquear: ${reason}`); return; }

    const cost = def.cost ?? 0;
    const cursePoints = this.actor.system.curseResources?.cursePoints ?? 0;
    const entryNen = this.actor.system.manipulation?.abilities?.[abilityId] ?? {};
    await this.actor.update({
      // Entrada completa — updates parciais em entradas antigas são descartados em silêncio.
      [`system.manipulation.abilities.${abilityId}`]: {
        unlocked: true,
        dcReduction: entryNen.dcReduction ?? 0,
        count: (entryNen.count ?? 0) + (def.repeatable ? 1 : 0)
      },
      "system.manipulation.pointsInvested": (this.actor.system.manipulation?.pointsInvested ?? 0) + cost,
      "system.curseResources.cursePoints": Math.max(0, cursePoints - cost)
    });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `🔓 <strong>${this.actor.name}</strong> desbloqueou: <strong>${def.label}</strong>!` });

    // Técnicas vinculadas — paridade com o character-sheet
    if ( def.techniques?.length ) await grantLinkedTechniques(this.actor, def.techniques);
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

    // Estorno pela mesma fonte que o desbloqueio cobra (PRINCIPLES_DATA), não pela roda.
    const cost = PRINCIPLES_DATA[principleId]?.unlockRequires?.cost ?? thisPr.cost ?? 0;
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
    // Bloqueia desfazer se outra habilidade desbloqueada depende desta (paridade c/ character-sheet)
    const unlockedIds = new Set(Object.entries(abilities).filter(([, v]) => v?.unlocked).map(([k]) => k));
    const bloqueadores = Object.entries(MANIPULATION_ABILITIES)
      .filter(([abId, ab]) => {
        if ( !unlockedIds.has(abId) ) return false;
        // grupo OU: desfazer só bloqueia se abilityId for o único satisfeito do grupo
        return (ab.requires?.abilities ?? []).some(req => {
          const group = Array.isArray(req) ? req : [req];
          return group.includes(abilityId) && !group.some(r => r !== abilityId && unlockedIds.has(r));
        });
      })
      .map(([, ab]) => ab.label);
    if ( bloqueadores.length ) {
      ui.notifications.warn(`Não é possível desfazer "${def.label}" — desfaz primeiro: ${bloqueadores.map(b => `"${b}"`).join(", ")}.`);
      return;
    }
    const cost = def.cost ?? 0;
    // Entrada completa — updates parciais em entradas antigas são descartados em silêncio.
    const entryUndo = this.actor.system.manipulation?.abilities?.[abilityId] ?? {};
    const undoCount = Math.max(0, (entryUndo.count ?? 0) - 1);
    const aindaFica = !!def.repeatable && undoCount > 0;
    await this.actor.update({
      [`system.manipulation.abilities.${abilityId}`]: {
        unlocked: aindaFica,
        dcReduction: entryUndo.dcReduction ?? 0,
        count: def.repeatable ? undoCount : 0
      },
      "system.manipulation.pointsInvested": Math.max(0, (this.actor.system.manipulation?.pointsInvested ?? 0) - cost),
      "system.curseResources.cursePoints": (this.actor.system.curseResources?.cursePoints ?? 0) + cost
    });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this.actor }), content: `↩ <strong>${this.actor.name}</strong> desfez: <strong>${def.label}</strong>.` });
  }

  /* -------------------------------------------- */

  /**
   * Clique no card de uma habilidade principal disponível — confirma antes de aprender.
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
   * Clique com o botão direito no card de uma habilidade desbloqueada — confirma antes de desfazer.
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
  /**
   * Desfaz o último treinamento de uma categoria. Devolve PT e PA gastos
   * (NPC não rola dado, então o gasto é integralmente reversível).
   * Cascata: remove habilidades principais cujo nível requerido fica acima do novo nível.
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
    const refundPa = costs?.pa ?? 0;

    const spentPtBeforeUndo = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
    const updates = {
      [`system.nenCategories.${categoryId}.level`]: newLevel,
      "system.curseResources.spentTrainingPoints": Math.max(0, spentPtBeforeUndo - refundPt),
      "system.energy.total": (this.actor.system.energy?.total ?? 0) + refundPa
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

    ui.notifications.info(`${cat.label}: nível ${currentLevel} → ${newLevel}. Devolveu ${refundPt} PT e ${refundPa} PA.`);
    let chatContent = `↩️ <strong>${this.actor.name}</strong> desfez o treinamento de <strong>${cat.label}</strong>: Nível ${currentLevel} → Nível ${newLevel}. ${refundPt} PT e ${refundPa} PA devolvidos.`;
    if ( undoneMajors.length ) {
      chatContent += `<br/>⚠️ Habilidades principais removidas em cascata: <strong>${undoneMajors.join(", ")}</strong>.`;
    }
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: chatContent
    });
  }

  /* -------------------------------------------- */

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
    const trainingPoints = getAvailableTrainingPoints(this.actor);
    const energyTotal = this.actor.system.energy?.total ?? 0;

    if ( trainingPoints < costs.pt ) { ui.notifications.warn(`PT insuficientes! Precisa de ${costs.pt} PT.`); return; }
    if ( energyTotal < costs.pa ) { ui.notifications.warn(`PA insuficientes! Precisa de ${costs.pa} PA.`); return; }

    const spentPt = this.actor.system.curseResources?.spentTrainingPoints ?? 0;
    await this.actor.update({
      "system.curseResources.spentTrainingPoints": spentPt + costs.pt,
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
  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    // Context menu de "Desfazer Treinamento" nos cards de categoria
    new ContextMenu5e(
      this.element,
      ".nen-category-card[data-category]",
      [{
        name: "Desfazer Treinamento",
        icon: '<i class="fas fa-rotate-left"></i>',
        condition: el => (this.actor.system.nenCategories?.[el.dataset.category]?.level ?? 0) > 0,
        callback: el => this._onUndoTrainNenCategory(el.dataset.category)
      }],
      { jQuery: false }
    );
  }

  /* -------------------------------------------- */

  async _onRender(context, options) {
    await super._onRender(context, options);

    if ( !this.actor.limited ) {
      this._renderCreateInventory();
      this._renderAttunement(context, options);
      this._renderSpellbook(context, options);
      // Rodas dos Princípios de Nen: abrir/fechar no clique do hub (igual à ficha de
      // personagem). Sem isso, clicar num princípio no NPC não revelava as habilidades.
      setupNenWheels(this.element);
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

    // ── Botões de poder (Explosão Defensiva, Foco, Estágio) ────────
    this.element.querySelector("[data-action='jj-expdef-trigger']")
      ?.addEventListener("click", () => _npcExplosaoDefensiva(this.actor));
    this.element.querySelectorAll("[data-action='jj-toggle-foco']")
      .forEach(btn => btn.addEventListener("click", () => {
        if ( btn.disabled ) return;
        this._onToggleFoco(btn.dataset.foco);
      }));
    this.element.querySelector("[data-action='jj-toggle-estagio-foco']")
      ?.addEventListener("click", () => this._onToggleEstagioFoco());

    // ── Injeta Condições Hunter na aba Effects ────
    _injectJJConditions(this.element, this.actor);

    // ── Hatsu — feedback visual de hover nos drop zones
    this.element.querySelectorAll(".hatsu-drop-zone").forEach(zone => {
      zone.addEventListener("dragenter", e => { e.preventDefault(); zone.classList.add("drag-hover"); });
      zone.addEventListener("dragover",  e => { e.preventDefault(); });
      zone.addEventListener("dragleave", e => { if ( !zone.contains(e.relatedTarget) ) zone.classList.remove("drag-hover"); });
      zone.addEventListener("drop", () => zone.classList.remove("drag-hover"));
    });

    // ── Habilidades principais — card inteiro clicável (sem botão dedicado):
    // clique esquerdo pergunta se quer aprender, clique direito pergunta se quer desfazer.
    // Mesmo template de character-sheet.mjs, mesmo cuidado: undoNenMajor NÃO tem case no
    // if-chain de _onClickAction, senão o dispatch nativo do Foundry (por data-action)
    // desfaria direto no clique esquerdo, sem passar pela confirmação daqui.
    setTimeout(() => {
      const actions = [
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

    // ── Hatsu — change listeners para requisitos
    this.element.querySelectorAll("[data-hatsu-req]").forEach(el => {
      el.addEventListener("change", () => {
        const field  = el.dataset.hatsuReq;
        const itemId = el.dataset.itemId;
        const index  = parseInt(el.dataset.index);
        this._onHatsuReqChange(itemId, index, field, el.value);
      });
    });

    // ── Hatsu — sync AE de proficiência
    if ( this.actor.isOwner ) this._syncHatsuProficiencyEffect();

    // (context menu registrado em _onFirstRender)

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

// Geração de PA no início do turno — dialog 2x / 3x / 4x do ND + bônus de treinamento
async function _npcEnergyGenerationDialog(actor) {
  const nd = actor.system.details?.cr ?? 1;
  const trainingBonus = (actor.system.energy?.bonuses?.generatedEnergy ?? 0)
                      + (actor.system.energy?.intensiveTraining?.generatedEnergy ?? 0);
  const fmt = n => trainingBonus > 0 ? `${n} (${nd}×N + ${trainingBonus})` : `${n}`;

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

  if ( !multiplicador || multiplicador === "skip" ) return null;
  return { nd, multiplicador, trainingBonus };
}

async function _npcApplyEnergyGeneration(actor, nd, multiplicador, trainingBonusOverride) {
  const trainingBonus = trainingBonusOverride
                     ?? (actor.system.energy?.bonuses?.generatedEnergy ?? 0)
                      + (actor.system.energy?.intensiveTraining?.generatedEnergy ?? 0);
  const alvo        = (nd * Number(multiplicador)) + trainingBonus;
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
      game.socket.emit("system.hunter-system", {
        action: "npcEnergyChoices",
        actorId: actor.id,
        nd: result.nd,
        multiplicador: result.multiplicador,
        trainingBonus: result.trainingBonus
      });
    }
  }
  // GM emite socket para o dono se não for ele
  else if ( game.user.isGM ) {
    game.socket.emit("system.hunter-system", {
      action: "npcEnergyDialog",
      actorId: actor.id,
      userId: owner.id
    });
  }
});

// Explosão Defensiva do NPC — mesmo comportamento do jogador
async function _npcExplosaoDefensiva(actor) {
  const flagData     = actor.getFlag("hunter-system", "explosaoDefensivaPendente") ?? null;
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
    await actor.unsetFlag("hunter-system", "explosaoDefensivaPendente");
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

  await actor.setFlag("hunter-system", "explosaoDefensivaPendente", { reducao: roll.total, paCusto: paGasto });
  await actor.update({ "system.energy.generated": Math.max(0, paDisp - paGasto) });

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `🛡️ <strong>${actor.name}</strong> usa Explosão Defensiva — reduz <strong>${roll.total}</strong> do próximo dano!`
  });
}

async function _npcSyncIntensiveTraining(actor) {
  // Reservado para uso futuro
}
