import { NEN_CATEGORIES_DATA } from "../../../systems/nen-categories-data.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Tela de Criação de Personagem (fullscreen, estilo Ember) para o Hunter Legacy.
 *
 * Passos: I. Categoria Nen → II. Atributos → III. Origem/História → IV. Token/Nome.
 * O conteúdo (origens, talentos) vem dos compêndios do módulo `hunter-legacy-module`;
 * a tela só é oferecida quando esse módulo está ativo no mundo (ver isAvailable()).
 *
 * NOTA: Construção em fases. Fase 1 = casca + passo Categoria + navegação + gatilho.
 * Atributos/Origem/Token serão preenchidos nas fases seguintes.
 */
export default class HunterCharacterCreation extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    HunterCharacterCreation.#ensureStylesheet();
    /** @type {Actor} O personagem sendo criado/editado. */
    this.actor = options.actor ?? null;
    /** Modo nível 2: libera as Categorias (no nível 1 só existe "Sem Categoria"). */
    this._levelup = !!options.levelup;
    const startName = (this.actor?.name && !/^new actor|^novo ator/i.test(this.actor.name)) ? this.actor.name : "";
    /** Estado mutável da criação. */
    this._creation = {
      step: "attributes",
      species: null,
      speciesChoice: null,  // variante escolhida (Humano/Kiriko) — registrada; granting depois
      speciesTraits: { common: [], specific: [] }, // traços da Formiga Quimera (ids)
      talents: [],          // talentos escolhidos (ids) — registrado; granting depois
      abilityBonus: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, // pontos de espécie por atributo (total ABILITY_BONUS_POINTS)
      name: startName,
      category: "",          // "" = Sem Categoria (padrão); guarda a categoria PLANEJADA (aplica no nv2)
      randomCategory: false, // true = categoria aleatória definida no nv2
      aguaEscolha: null,     // Água da Adivinhação: categoria apontada ("aleatorio" = a água decide)
      aguaRevelada: null,    // Água da Adivinhação: categoria que o copo revelou (null até observar)
      attrMethod: null,      // "standard" | "roll"
      rolledValues: null,    // 6 valores (array padrão ou rolagens 4d6kh3) ou null
      abilities: { str: null, dex: null, con: null, int: null, wis: null, cha: null }, // ability → índice no pool
      attrPick: null,        // índice do pool "selecionado" para colocar num atributo (hexágono)
      originId: null,        // item de origem escolhido (fase 3)
      originBonus: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, // 2 pontos de atributo da origem
      originSave: null,      // salvaguarda escolhida (ability key)
      originSkills: [],      // perícias escolhidas (skill keys)
      defeitos: [],          // defeitos escolhidos (ids) — passo Personalização
      customTalents: [],     // talentos liberados por defeitos (ids)
      combatBranch: null,    // "divergente" | "especialista"
      combatMethods: [],     // métodos de combate escolhidos (ids, máx 3)
      combatFocus: null,     // método em destaque (preview do texto + técnica)
      primaryAbility: null,  // atributo principal escolhido (para a categoria/técnicas)
      hbFree: [],            // Habilidades Básicas à escolha livre (nível 1: 2; nível 2 REFAZ tudo: 3)
      semSaves: [],          // Sem Categoria: 2 salvaguardas à escolha
      semTalent: null,       // Sem Categoria: 1 talento à escolha
      img: this.actor?.img ?? null,                                  // imagem de perfil
      tokenImg: this.actor?.prototypeToken?.texture?.src ?? null     // imagem do token
    };

    // Nível 2: Água da Adivinhação → Categoria → Token; começa no ritual.
    // As HBs vêm pré-marcadas com as escolhas atuais — o jogador REFAZ o conjunto
    // (talentos são fixos; Habilidades Básicas podem mudar nessa etapa).
    if ( this._levelup ) {
      this._creation.step = "agua";
      this._creation.hbFree = [...(this.actor?.getFlag("hunter-system", "creation")?.basicAbilities ?? [])];
    }
  }

  /** Passos ativos: criação = todos; nível 2 = Adivinhação, Categoria e Token. */
  _activeSteps() {
    if ( !this._levelup ) return HunterCharacterCreation.STEPS;
    const numerals = ["I", "II", "III", "IV", "V", "VI", "VII"];
    return [
      { id: "agua", label: "Adivinhação" },
      ...HunterCharacterCreation.STEPS.filter(s => s.id === "category" || s.id === "token")
    ].map((s, i) => ({ ...s, numeral: numerals[i] }));
  }

  /* -------------------------------------------- */

  /**
   * Garante que o CSS da criação esteja carregado (injeta em runtime se o
   * system.json ainda não o carregou — evita ter que reiniciar o Foundry).
   */
  static #ensureStylesheet() {
    if ( document.querySelector('link[href$="character-creation.css"], style[data-hunter-creation]') ) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "systems/hunter-system/less/character-creation.css";
    link.dataset.hunterCreation = "1";
    document.head.appendChild(link);
  }

  /** @type {string[]} Ordem das categorias Nen. */
  static CATEGORY_IDS = ["aprimorador", "emissor", "transmutador", "conjurador", "manipulador", "especialista"];

  /** Cores, kanji, ícone e imagem-guia por categoria. */
  static CATEGORY_STYLE = {
    aprimorador:  { color: "#e86800", kanji: "強", img: "systems/hunter-system/assets/Categorias/apri-mini.png",  guide: "systems/hunter-system/assets/Categorias/Categorias-Image/apri.png" },
    emissor:      { color: "#B8860B", kanji: "放", img: "systems/hunter-system/assets/Categorias/emi-mini.png",   guide: "systems/hunter-system/assets/Categorias/Categorias-Image/emi.webp" },
    transmutador: { color: "#9B59D0", kanji: "変", img: "systems/hunter-system/assets/Categorias/transmini.png",  guide: "systems/hunter-system/assets/Categorias/Categorias-Image/transm.png" },
    conjurador:   { color: "#3A8FD4", kanji: "具", img: "systems/hunter-system/assets/Categorias/conj-mini.png",  guide: "systems/hunter-system/assets/Categorias/Categorias-Image/conj.webp" },
    manipulador:  { color: "#2ECC71", kanji: "操", img: "systems/hunter-system/assets/Categorias/mani-mini.png",  guide: "systems/hunter-system/assets/Categorias/Categorias-Image/manip.png" },
    especialista: { color: "#AAAAAA", kanji: "特", img: "systems/hunter-system/assets/Categorias/esp-mini.png",   guide: "systems/hunter-system/assets/Categorias/Categorias-Image/esp.png" }
  };

  /** O teste da Água da Adivinhação — como o copo reage por categoria. */
  static AGUA_REACAO = {
    aprimorador:  "O volume da água AUMENTA — o copo transborda.",
    emissor:      "A COR da água muda.",
    transmutador: "O SABOR da água muda.",
    conjurador:   "IMPUREZAS surgem na água — algo se forma dentro dela.",
    manipulador:  "A FOLHA se move sobre a superfície.",
    especialista: "Qualquer OUTRA mudança, inteiramente diferente."
  };

  /** Texto-guia de criação rápida + inclinações (caminhos híbridos) por categoria. */
  static GUIDE_TEXT = {
    aprimorador: {
      quick: "Distribua o atributo mais alto em <b>Força</b>, <b>Agilidade</b> ou <b>Sabedoria</b>, conforme a intenção do seu 2º nível (Natureza Definida). O segundo mais alto deve ser <b>Constituição</b>. Escolha a espécie <b>Humano</b> e a origem <b>Pescador</b> ou <b>Lutador Profissional</b>. Depois, foque em talentos que dão proficiência em <b>Atletismo</b>, <b>Acrobacia</b>, <b>Percepção</b> e <b>Sobrevivência</b>.",
      inclinations: [
        { name: "Aprimorador Mutável", desc: "Desvia para Transmutador — avança transmutação na mesma velocidade que aprimoramento, até o 10º nível." },
        { name: "Aprimorador de Emissão", desc: "Desvia para Emissor — avança emissão na mesma velocidade que aprimoramento, até o 10º nível." }
      ]
    },
    emissor: {
      quick: "Distribua o atributo mais alto em <b>Agilidade</b>. O segundo mais alto deve ser <b>Constituição</b>. Escolha a espécie <b>Humano</b> e a origem <b>Cozinheiro</b>, <b>Ladrão</b> ou <b>Matador de Aluguel</b>. Depois, foque em talentos que dão proficiência em <b>Acrobacia</b>, <b>Intuição</b>, <b>Percepção</b> e <b>Sobrevivência</b>.",
      inclinations: [
        { name: "Aprimorador de Emissão", desc: "Desvia para Aprimorador — avança aprimoramento na mesma velocidade que emissão, até o 10º nível." },
        { name: "Emissor de Controle", desc: "Desvia para Manipulador — avança manipulação na mesma velocidade que emissão, até o 10º nível." }
      ]
    },
    transmutador: {
      quick: "Distribua o atributo mais alto em <b>Agilidade</b>. O segundo mais alto deve ser <b>Constituição</b>. Escolha a espécie <b>Humano</b> e a origem <b>Cozinheiro</b>, <b>Ladrão</b> ou <b>Matador de Aluguel</b>. Depois, foque em talentos que dão proficiência em <b>Atletismo</b>, <b>Acrobacia</b>, <b>Intuição</b> e <b>Sobrevivência</b>.",
      inclinations: [
        { name: "Aprimorador Mutável", desc: "Desvia para Aprimorador — avança aprimoramento na mesma velocidade que transmutação, até o 10º nível." },
        { name: "Conjurador Mutável", desc: "Desvia para Conjurador — avança conjuração na mesma velocidade que transmutação, até o 10º nível." }
      ]
    },
    conjurador: {
      quick: "Distribua o atributo mais alto em <b>Sabedoria</b>. O segundo mais alto deve ser <b>Constituição</b>. Escolha a espécie <b>Humano</b> e a origem <b>Detetive</b>, <b>Engenheiro</b>, <b>Explorador</b> ou <b>Estudioso</b>. Depois, foque em talentos que dão proficiência em <b>Atletismo</b>, <b>História</b>, <b>Investigação</b> e <b>Sobrevivência</b>.",
      inclinations: [
        { name: "Conjurador Mutável", desc: "Desvia para Transmutador — avança transmutação na mesma velocidade que conjuração, até o 10º nível." },
        { name: "Conjurador Especialista", desc: "Desvia para Especialista — avança especialização na mesma velocidade que conjuração, até o 8º nível. Pode receber o 3º nível da habilidade principal de especialista ao atingir o 3º nível." }
      ]
    },
    manipulador: {
      quick: "Distribua o atributo mais alto em <b>Sabedoria</b>. O segundo mais alto deve ser <b>Constituição</b>. Escolha a espécie <b>Humano</b> e a origem <b>Detetive</b>, <b>Engenheiro</b>, <b>Explorador</b> ou <b>Estudioso</b>. Depois, foque em talentos que dão proficiência em <b>Acrobacia</b>, <b>Enganação</b>, <b>História</b>, <b>Investigação</b> e <b>Sobrevivência</b>.",
      inclinations: [
        { name: "Emissor de Controle", desc: "Desvia para Emissor — avança emissão na mesma velocidade que manipulação, até o 10º nível." },
        { name: "Manipulação Especialista", desc: "Desvia para Especialista — avança especialização na mesma velocidade que manipulação, até o 8º nível. Pode receber o 3º nível da habilidade principal de especialista ao atingir o 3º nível." }
      ]
    },
    especialista: {
      quick: "Distribua o atributo mais alto em <b>Presença</b> (ou <b>Força</b>, <b>Agilidade</b> ou <b>Sabedoria</b> caso vá pelo caminho <b>Superdotado - Combate</b>). O segundo mais alto deve ser <b>Constituição</b>. Escolha a espécie <b>Humano</b> e a origem <b>Ladrão</b> ou <b>Órfão</b>, aumentando o atributo de Presença. Depois, foque em talentos que dão proficiência em <b>Acrobacia</b>, <b>Furtividade</b>, <b>Enganação</b> e <b>Persuasão</b>.",
      inclinations: [],
      extra: {
        title: "Escolhendo um Especialista (regra opcional)",
        html: "Especialização é o tipo que não se enquadra em nenhuma das outras categorias — a categoria de Hatsu mais vaga, podendo ser qualquer habilidade paranormal inusitada. Dá pra ter ideia do tipo de habilidade pelo efeito demonstrado no teste de observar a água.<br><br>Caso o jogador queira ser um especialista, ele rola um <b>d6</b>: num resultado <b>6</b> ele se torna especialista; caso contrário, rola entre as outras categorias e recebe uma aleatória, sem chance de escolha."
      }
    }
  };

  /** Definição dos passos da criação. */
  static STEPS = [
    { id: "attributes", label: "Atributos", numeral: "I" },
    { id: "species",    label: "Espécie",   numeral: "II" },
    { id: "category",   label: "Categoria", numeral: "III" },
    { id: "combat",     label: "Métodos", numeral: "IV" },
    { id: "origin",     label: "Origem",    numeral: "V" },
    { id: "customization", label: "Personalização", numeral: "VI" },
    { id: "token",      label: "Token",     numeral: "VII" }
  ];

  /* -------------------------------------------- */

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "hunter-character-creation",
    tag: "div",
    classes: ["hunter-creation", "themed", "theme-dark"],
    window: { frame: false, positioned: false },
    actions: {
      changeStep:      HunterCharacterCreation.#onChangeStep,
      chooseSpecies:   HunterCharacterCreation.#onChooseSpecies,
      toggleTrait:     HunterCharacterCreation.#onToggleTrait,
      toggleTalent:    HunterCharacterCreation.#onToggleTalent,
      addSpecies:      HunterCharacterCreation.#onAddSpecies,
      saveSpecies:     HunterCharacterCreation.#onSaveSpecies,
      speciesImage:    HunterCharacterCreation.#onSpeciesImage,
      deleteSpecies:   HunterCharacterCreation.#onDeleteSpecies,
      chooseCategory:  HunterCharacterCreation.#onChooseCategory,
      randomCategory:  HunterCharacterCreation.#onRandomCategory,
      aguaEscolher:    HunterCharacterCreation.#onAguaEscolher,
      aguaObservar:    HunterCharacterCreation.#onAguaObservar,
      toggleHBFree:    HunterCharacterCreation.#onToggleHBFree,
      toggleSemSave:   HunterCharacterCreation.#onToggleSemSave,
      chooseSemTalent: HunterCharacterCreation.#onChooseSemTalent,
      chooseOrigin:    HunterCharacterCreation.#onChooseOrigin,
      originBonusInc:  HunterCharacterCreation.#onOriginBonusInc,
      originBonusDec:  HunterCharacterCreation.#onOriginBonusDec,
      toggleOriginSkill: HunterCharacterCreation.#onToggleOriginSkill,
      toggleDefeito:   HunterCharacterCreation.#onToggleDefeito,
      toggleCustomTalent: HunterCharacterCreation.#onToggleCustomTalent,
      pickProfileImg:  HunterCharacterCreation.#onPickProfileImg,
      pickTokenImg:    HunterCharacterCreation.#onPickTokenImg,
      useImgAsToken:   HunterCharacterCreation.#onUseImgAsToken,
      chooseCombatBranch: HunterCharacterCreation.#onChooseCombatBranch,
      focusCombatMethod: HunterCharacterCreation.#onFocusCombatMethod,
      toggleCombatMethod: HunterCharacterCreation.#onToggleCombatMethod,
      rollAttributes:  HunterCharacterCreation.#onRollAttributes,
      useStandardArray: HunterCharacterCreation.#onUseStandardArray,
      resetAttrMethod: HunterCharacterCreation.#onResetAttrMethod,
      clearAttributes: HunterCharacterCreation.#onClearAttributes,
      pickPoolValue:   HunterCharacterCreation.#onPickPoolValue,
      assignAttr:      HunterCharacterCreation.#onAssignAttr,
      bonusInc:        HunterCharacterCreation.#onBonusInc,
      bonusDec:        HunterCharacterCreation.#onBonusDec,
      next:           HunterCharacterCreation.#onNext,
      prev:           HunterCharacterCreation.#onPrev,
      complete:       HunterCharacterCreation.#onComplete,
      cancel:         HunterCharacterCreation.#onCancel
    }
  };

  /** @override */
  static PARTS = {
    main: {
      template: "systems/hunter-system/templates/actors/creation/creation.hbs",
      scrollable: [".hc-body", ".hc-center", ".hc-talent-grid", ".hc-detail", ".hc-combat-list"]
    }
  };

  /**
   * Contêineres roláveis cuja posição é preservada entre re-renders. Clicar num talento/
   * habilidade re-renderiza a tela inteira; a preservação nativa (`scrollable` acima) não
   * estava segurando aqui (perde para o restauro de foco/altura do Foundry), então
   * capturamos e restauramos à mão em _preRender/_onRender.
   * @type {string[]}
   */
  static #SCROLLERS = [".hc-body", ".hc-center", ".hc-portrait-col", ".hc-talent-grid", ".hc-combat-list", ".hc-detail", ".hc-debug-list"];

  /**
   * Posições de rolagem capturadas em _preRender para restaurar em _onRender.
   * @type {Object<string, number[]>|null}
   */
  #scrollMemory = null;

  /* -------------------------------------------- */

  /**
   * A tela nova só está disponível quando o módulo de conteúdo está ativo.
   * @returns {boolean}
   */
  static isAvailable() {
    return game.modules.get("hunter-legacy-module")?.active === true;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _preRender(context, options) {
    await super._preRender?.(context, options);
    // O DOM antigo ainda existe aqui: captura a rolagem atual de cada contêiner rolável.
    const mem = {};
    for ( const sel of HunterCharacterCreation.#SCROLLERS ) {
      const els = this.element?.querySelectorAll(sel);
      if ( els?.length ) mem[sel] = [...els].map(el => el.scrollTop);
    }
    this.#scrollMemory = mem;
  }

  /* -------------------------------------------- */

  /**
   * Restaura a rolagem capturada em _preRender — agora e no próximo frame, caso o restauro
   * de foco do Foundry role a tela depois deste _onRender.
   */
  #restoreScroll() {
    const mem = this.#scrollMemory;
    if ( !mem ) return;
    this.#scrollMemory = null;
    const apply = () => {
      for ( const [sel, tops] of Object.entries(mem) ) {
        this.element?.querySelectorAll(sel).forEach((el, i) => {
          if ( tops[i] != null ) el.scrollTop = tops[i];
        });
      }
    };
    apply();
    requestAnimationFrame(apply);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    // Força o fullscreen via estilo inline (não depende do CSS externo ter carregado).
    if ( this.element ) Object.assign(this.element.style, {
      position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
      maxWidth: "100vw", maxHeight: "100vh", margin: "0", padding: "0",
      border: "none", borderRadius: "0", zIndex: "100"
    });
    // Fecha a ficha padrão que o Foundry abre ao criar o ator (catch em cada render).
    if ( this.actor?.sheet?.rendered ) this.actor.sheet.close();
    // Hovercards (talentos/traços): mostra nome + descrição ao passar o mouse.
    this.element?.querySelectorAll("[data-tip-uuid]").forEach(el => {
      el.addEventListener("mouseenter", async () => {
        const html = await this._itemTooltip(el.dataset.tipUuid);
        if ( html && el.matches(":hover") ) game.tooltip.activate(el, { html, cssClass: "hunter-creation-tip" });
      });
      el.addEventListener("mouseleave", () => game.tooltip.deactivate());
    });
    // Hovercards das Características da Categoria (descrição em HTML do feat).
    const catFeats = this._catProg?.[this._creation.category];
    if ( Array.isArray(catFeats) ) this.element?.querySelectorAll(".hc-feature[data-feat-idx]").forEach(el => {
      const f = catFeats[Number(el.dataset.featIdx)];
      if ( !f?.desc ) return;
      el.addEventListener("mouseenter", () => {
        if ( el.matches(":hover") ) game.tooltip.activate(el, { html: f.desc, cssClass: "hunter-creation-tip" });
      });
      el.addEventListener("mouseleave", () => game.tooltip.deactivate());
    });
    // Seletor de Atributo Principal da categoria.
    const primSel = this.element?.querySelector(".hc-primary-select");
    if ( primSel ) primSel.addEventListener("change", ev => {
      this._creation.primaryAbility = ev.currentTarget.value || null;
      this.render();
    });
    // Seletor de salvaguarda da origem.
    const saveSel = this.element?.querySelector(".hc-origin-save");
    if ( saveSel ) saveSel.addEventListener("change", ev => {
      this._creation.originSave = ev.currentTarget.value || null;
      this.render();
    });
    // Seletor de variante/aparência da espécie.
    const variantSel = this.element?.querySelector(".hc-sp-variant");
    if ( variantSel ) variantSel.addEventListener("change", ev => {
      this._creation.speciesChoice = ev.currentTarget.value || null;
      this.render();
    });
    // ProseMirror da descrição da espécie: guarda o valor ao editar/salvar.
    const pm = this.element?.querySelector("prose-mirror[name='hc-sp-desc']");
    if ( pm ) pm.addEventListener("change", ev => { this._creation._descBuffer = ev.target.value; });

    // Mantém o jogador na mesma posição de rolagem (não sobe pro topo ao clicar num talento).
    this.#restoreScroll();
  }

  /** @inheritDoc */
  _onFirstRender(context, options) {
    super._onFirstRender?.(context, options);
    // Fecha a ficha padrão que o Foundry abre ao criar o ator (fica atrás do fullscreen).
    if ( this.actor?.sheet?.rendered ) this.actor.sheet.close();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const activeSteps = this._activeSteps();
    const stepIdx = activeSteps.findIndex(s => s.id === this._creation.step);

    context.charname = this._creation.name;
    context.step = this._creation.step;
    context.isFirst = stepIdx <= 0;
    context.isLast = stepIdx >= activeSteps.length - 1;

    // Nav (stepper)
    context.steps = activeSteps.map((s, i) => ({
      ...s,
      isActive: s.id === this._creation.step,
      isDone: i < stepIdx
    }));

    // Flags por passo (evita helper `eq` no template)
    context.isAgua       = this._creation.step === "agua";
    context.isSpecies    = this._creation.step === "species";
    context.isCategory   = this._creation.step === "category";
    context.isAttributes = this._creation.step === "attributes";
    context.isOrigin     = this._creation.step === "origin";
    context.isCombat     = this._creation.step === "combat";
    context.isCustomization = this._creation.step === "customization";
    context.isToken      = this._creation.step === "token";

    if ( context.isAgua ) {
      const escolha = this._creation.aguaEscolha;
      const revelada = this._creation.aguaRevelada;
      const st = HunterCharacterCreation.CATEGORY_STYLE;
      context.agua = {
        nome: this._creation.name || this.actor?.name || "",
        escolhaFeita: !!escolha,
        aleatorioEscolhido: escolha === "aleatorio",
        reveladaId: revelada,
        revelada: revelada ? {
          id: revelada,
          label: NEN_CATEGORIES_DATA[revelada]?.label ?? revelada,
          color: st[revelada]?.color ?? "#888",
          kanji: st[revelada]?.kanji ?? "",
          texto: HunterCharacterCreation.AGUA_REACAO[revelada] ?? ""
        } : null,
        reacoes: HunterCharacterCreation.CATEGORY_IDS.map(id => ({
          id,
          label: NEN_CATEGORIES_DATA[id]?.label ?? id,
          color: st[id]?.color ?? "#888",
          kanji: st[id]?.kanji ?? "",
          texto: HunterCharacterCreation.AGUA_REACAO[id] ?? "",
          escolhida: escolha === id,
          foiRevelada: revelada === id,
          apagada: !!revelada && revelada !== id
        }))
      };
    }
    if ( context.isSpecies ) await this._prepareSpeciesContext(context);
    if ( context.isCategory ) await this._prepareCategoryContext(context);
    if ( context.isCombat ) await this._prepareCombatContext(context);
    if ( context.isOrigin ) await this._prepareOriginContext(context);
    if ( context.isCustomization ) await this._prepareCustomizationContext(context);
    if ( context.isAttributes ) this._prepareAttributesContext(context);
    if ( context.isToken ) {
      const def = "icons/svg/mystery-man.svg";
      context.profileImg = this._creation.img || def;
      context.tokenImg = this._creation.tokenImg || this._creation.img || def;
      context.charname = this._creation.name;
    }

    return context;
  }

  /* -------------------------------------------- */

  /**
   * Seletor de Atributo Principal de uma categoria.
   * Default = primário da classe; "sem" exclui Espírito (INT) e Constituição (CON).
   */
  _primaryContext(catKey) {
    const keys = this._catPrimary?.[catKey] ?? [];
    const excluded = catKey === "sem" ? ["int", "con"] : [];
    const def = this._creation.primaryAbility ?? keys.find(k => !excluded.includes(k)) ?? null;
    return {
      chosen: def,
      options: HunterCharacterCreation.ABILITY_KEYS.map(k => ({
        key: k, label: game.i18n.localize(CONFIG.DND5E.abilities[k]?.label ?? k),
        selected: k === def, disabled: excluded.includes(k)
      }))
    };
  }

  /** Monta o contexto do passo de Categoria. */
  async _prepareCategoryContext(context) {
    const prog = await this._loadCategoryProgressions();
    context.levelup = this._levelup;
    context.hb = await this._buildHBContext();
    if ( !this._levelup ) context.semChoices = await this._buildSemChoices();

    // ── Nível 1: somente "Sem Categoria" ──
    if ( !this._levelup ) {
      this._creation.category = "sem";
      this._creation.randomCategory = false;
      const meta = this._catMeta?.sem ?? {};
      context.categories = [{
        id: "sem", label: meta.name || "Sem Categoria",
        color: "#8a8f9c", kanji: "無", img: meta.img ?? null, selected: true
      }];
      context.randomSelected = false;
      context.chosenCategory = {
        label: meta.name || "Sem Categoria",
        color: "#8a8f9c", img: meta.img ?? null,
        desc: meta.desc || "Você começa <strong>Sem Categoria</strong>. Ao atingir o <strong>nível 2</strong>, escolherá sua categoria Nen e refará a ficha.",
        longDesc: true,   // descrição longa da classe → alinhada à esquerda, sem título duplicado
        features: prog.sem ?? [],
        saves: this._catSaves?.sem ?? [],
        primary: this._primaryContext("sem"),
        inclinations: [], extra: null
      };
      return;
    }

    // ── Nível 2+: as Categorias Nen ──
    const sel = this._creation.category;
    context.categories = HunterCharacterCreation.CATEGORY_IDS.map(id => {
      const data = NEN_CATEGORIES_DATA[id] ?? {};
      const style = HunterCharacterCreation.CATEGORY_STYLE[id] ?? {};
      return {
        id, label: data.label ?? id,
        color: style.color ?? "#888", kanji: style.kanji ?? "", img: style.img ?? null,
        selected: !this._creation.randomCategory && sel === id
      };
    });
    context.randomSelected = this._creation.randomCategory;
    const chosen = (sel && sel !== "sem") ? NEN_CATEGORIES_DATA[sel] : null;
    context.chosenCategory = this._creation.randomCategory
      ? { label: "Aleatória", random: true, desc: "Sua categoria será sorteada automaticamente." }
      : (chosen ? {
          label: chosen.label,
          color: HunterCharacterCreation.CATEGORY_STYLE[sel]?.color,
          img: HunterCharacterCreation.CATEGORY_STYLE[sel]?.guide ?? HunterCharacterCreation.CATEGORY_STYLE[sel]?.img,
          guide: HunterCharacterCreation.CATEGORY_STYLE[sel]?.guide,
          desc: `Ao confirmar, você se torna um <strong>${chosen.label}</strong>.`,
          quick: HunterCharacterCreation.GUIDE_TEXT[sel]?.quick ?? "",
          inclinations: HunterCharacterCreation.GUIDE_TEXT[sel]?.inclinations ?? [],
          extra: HunterCharacterCreation.GUIDE_TEXT[sel]?.extra ?? null,
          features: prog[sel] ?? [],
          saves: this._catSaves?.[sel] ?? [],
          primary: this._primaryContext(sel)
        } : null);
  }

  /** Sem Categoria: pickers de 2 salvaguardas + 1 talento à escolha. */
  async _buildSemChoices() {
    const saves = this._creation.semSaves ?? [];
    const saveOptions = HunterCharacterCreation.ABILITY_KEYS.map(k => ({
      key: k, label: game.i18n.localize(CONFIG.DND5E.abilities[k]?.label ?? k),
      selected: saves.includes(k), disabled: !saves.includes(k) && saves.length >= 2
    }));
    const tSel = this._creation.semTalent;
    const allTalents = await this._getTalents();
    const talents = allTalents
      .filter(t => !HunterCharacterCreation._isSpeciesFolder(t.folderName))
      .map(t => ({ ...t, selected: tSel === t.id }));
    return { saves: { options: saveOptions, count: 2, chosen: saves.length }, talents };
  }

  static #onToggleSemSave(event, target) {
    this._captureName();
    const key = target.dataset.save;
    const arr = this._creation.semSaves;
    const i = arr.indexOf(key);
    if ( i >= 0 ) { arr.splice(i, 1); this.render(); return; }
    if ( arr.length >= 2 ) { ui.notifications.warn("Escolha apenas 2 salvaguardas."); return; }
    arr.push(key);
    this.render();
  }

  static #onChooseSemTalent(event, target) {
    this._captureName();
    const id = target.dataset.talentId;
    if ( this._creation.semTalent === id ) { this._creation.semTalent = null; }
    else {
      if ( this._talentChosenElsewhere(id, { ignore: "sem" }) ) {
        ui.notifications.warn("Você já escolheu esse talento em outra etapa.");
        return;
      }
      this._creation.semTalent = id;
    }
    this.render();
  }

  /* -------------------------------------------- */
  /*  Habilidades Básicas (HB)                    */
  /* -------------------------------------------- */

  /** HBs do compêndio (pasta "Categorias" › "Habilidades Básicas (HB)"). Cacheado.
      Pega TODOS os itens da pasta (e subpastas) — só descarta separadores/marcadores
      (nome com 3+ "=" seguidos, ex.: "==========Categorias=========="). */
  async _getBasicAbilities() {
    if ( this._hbList ) return this._hbList;
    const all = await this._collectFolderItems({ leaf: "habilidades basicas", ancestor: "categoria" });
    const list = all.filter(x => x.name && !/={3,}/.test(x.name));
    console.log(`[HunterCreation] HB: ${list.length} de ${all.length} itens na pasta "Habilidades Básicas (HB)" →`,
      list.map(x => `${x.name}${x.folderName ? ` [${x.folderName}]` : ""}`).join(" · "));
    return (this._hbList = list);
  }

  /**
   * UUIDs das HB escolhidas, por nível. Nível 1 → {1: [2 escolhas]}.
   * Nível 2 REFAZ o conjunto inteiro (hbFree = 3 escolhas): as 2 primeiras entram
   * como nível 1 e o resto como nível 2 no bookkeeping do advancement.
   */
  async _hbByLevel() {
    const all = await this._getBasicAbilities();
    const toUuid = id => all.find(x => x.id === id)?.uuid;
    const livres = (this._creation.hbFree ?? []).map(toUuid).filter(Boolean);
    if ( !this._levelup ) return { 1: livres };
    return { 1: livres.slice(0, 2), 2: livres.slice(2) };
  }

  /**
   * Linka as HB escolhidas ao advancement (ItemChoice/ItemGrant) da classe:
   * cria os itens com os flags de origem e grava `value.added` por nível,
   * de modo que contem como adquiridas e o advancement não as re-ofereça.
   * Retorna { found, items }. Se não houver advancement de HB, found=false.
   */
  async _linkHBToClass(classObj, classId, hbByLevel) {
    const hbUuids = new Set((await this._getBasicAbilities()).map(h => h.uuid));
    const advs = classObj.system?.advancement ?? [];
    const adv = advs.find(a => {
      if ( a.type !== "ItemChoice" && a.type !== "ItemGrant" ) return false;
      const refs = [].concat(a.configuration?.pool ?? []).concat(a.configuration?.items ?? []);
      return refs.some(r => hbUuids.has(typeof r === "string" ? r : r?.uuid));
    });
    if ( !adv ) { console.warn("[HunterCreation] HB: advancement de Habilidade Básica não encontrado na classe."); return { found: false, items: [] }; }
    console.log(`[HunterCreation] HB: linkando ao advancement "${adv.title ?? adv.type}" (${adv._id}) níveis:`, Object.keys(hbByLevel).filter(l => hbByLevel[l]?.length));

    adv.value ??= {};
    adv.value.added ??= (adv.type === "ItemGrant" ? {} : {});
    const items = [];
    for ( const [lvl, uuids] of Object.entries(hbByLevel) ) {
      if ( !uuids?.length ) continue;
      const added = {};
      for ( const uuid of uuids ) {
        const src = await fromUuid(uuid);
        if ( !src ) continue;
        const itemId = foundry.utils.randomID();
        const o = src.toObject();
        o._id = itemId;
        foundry.utils.setProperty(o, "flags.HunterLegacy.sourceId", uuid);
        foundry.utils.setProperty(o, "flags.HunterLegacy.advancementOrigin", `${classId}.${adv._id}`);
        foundry.utils.setProperty(o, "flags.hunter-system.creationItem", true);
        foundry.utils.setProperty(o, "flags.hunter-system.hbItem", true);
        foundry.utils.setProperty(o, "flags.hunter-system.featureSection", "jj-basic");
        items.push(o);
        added[itemId] = uuid;
      }
      if ( adv.type === "ItemGrant" ) adv.value.added = { ...adv.value.added, ...added };
      else adv.value.added[lvl] = added;
    }
    return { found: true, items };
  }

  /** Monta o contexto do picker de HB. Sem fixas: escolhe livremente 2 na criação
      (nível 1); no nível 2 REFAZ o conjunto todo — 3 (as 2 do nível 1 repensadas + 1 nova). */
  async _buildHBContext() {
    const all = await this._getBasicAbilities();
    // poda ids que não existem mais no compêndio (senão contariam contra o limite sem aparecer)
    this._creation.hbFree = (this._creation.hbFree ?? []).filter(id => all.some(x => x.id === id));
    const free = this._creation.hbFree;
    const freeLimit = this._levelup ? 3 : 2;
    return {
      available: all.length > 0,
      freeLimit, freeCount: free.length,
      free: all.map(x => ({
        ...x, selected: free.includes(x.id),
        disabled: !free.includes(x.id) && free.length >= freeLimit
      }))
    };
  }

  static #onToggleHBFree(event, target) {
    this._captureName();
    const id = target.dataset.hbId;
    const f = this._creation.hbFree;
    const limit = this._levelup ? 3 : 2;
    const i = f.indexOf(id);
    if ( i >= 0 ) { f.splice(i, 1); this.render(); return; }
    if ( f.length >= limit ) {
      ui.notifications.warn(`Escolha até ${limit} ${limit > 1 ? "Habilidades Básicas" : "Habilidade Básica"}.`);
      return;
    }
    f.push(id);
    this.render();
  }

  /* -------------------------------------------- */

  /** Recursos universais (compartilhados por todas as categorias) — ocultar. */
  static UNIVERSAL_FEATURES = [
    "habilidade basica", "ava", "evolucao sobre-humana", "evolucao sobrehumana",
    "ataque extra", "pontos de aura", "caminho hunter", "subclasse"
  ];

  /** Tipos de advancement que não são características de categoria — ocultar. */
  static SKIP_ADV_TYPES = ["HitPoints", "AbilityScoreImprovement", "ScaleValue", "Trait", "Size"];

  /** Atributo principal por categoria, usado quando a classe não declara `primaryAbility`. */
  static PRIMARY_FALLBACK = {
    aprimorador: ["str"], emissor: ["dex"], especialista: ["cha"],
    transmutador: ["dex"], conjurador: ["int"], manipulador: ["wis"]
  };

  /** Determina a categoria de um item de classe (por rótulo exato → inclusão). */
  _categoryForClass(doc) {
    const n = HunterCharacterCreation._norm(doc.name);
    if ( n === "sem categoria" ) return "sem";  // classe inicial (nível 1)
    // 1) nome exatamente igual ao rótulo da categoria
    for ( const id of HunterCharacterCreation.CATEGORY_IDS ) {
      if ( n === HunterCharacterCreation._norm(NEN_CATEGORIES_DATA[id]?.label ?? "") ) return id;
    }
    // 2) inclusão (ignorando itens de feat tipo "Mestre X"/"X Absoluto"/"Talento")
    if ( /\b(mestre|absoluto|talento|caminho)\b/.test(n) ) return null;
    for ( const id of HunterCharacterCreation.CATEGORY_IDS ) {
      const label = HunterCharacterCreation._norm(NEN_CATEGORIES_DATA[id]?.label ?? "");
      if ( label && n.includes(label) ) return id;
    }
    return null;
  }

  /** Texto puro a partir de HTML. */
  static _plain(html) {
    const div = document.createElement("div");
    div.innerHTML = html ?? "";
    return (div.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  /** HTML enriquecido (resolve @UUID, etc.) para exibir no hover. */
  static async _enrich(html) {
    if ( !html ) return "";
    const TE = foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
    try { return await TE.enrichHTML(html, { secrets: false }); }
    catch { return html; }
  }

  /**
   * Lê o advancement dos itens de CLASSE (categorias) no compêndio e monta,
   * por categoria, a lista de características de classe por nível.
   * Usa o TÍTULO do advancement como nome (as subclasses = caminhos são ignoradas).
   * Ignora nível 1, tipos não-características e recursos universais.
   * Resultado cacheado em `this._catProg`.
   */
  async _loadCategoryProgressions() {
    if ( this._catProg ) return this._catProg;
    const result = {};
    const savesMap = {};
    const primaryMap = {};
    const metaMap = {};
    const diag = [];

    // Coleta itens do tipo "class" dos compêndios de Item e do mundo.
    const docs = [];
    for ( const pack of game.packs ) {
      if ( pack.documentName !== "Item" ) continue;
      let index;
      try { index = await pack.getIndex(); } catch { continue; }
      for ( const e of index ) {
        if ( e.type !== "class" ) continue;
        try { const doc = await pack.getDocument(e._id); if ( doc ) docs.push(doc); } catch { /* ignore */ }
      }
    }
    for ( const it of game.items ?? [] ) if ( it.type === "class" ) docs.push(it);

    for ( const doc of docs ) {
      const cat = this._categoryForClass(doc);
      diag.push(`${doc.name} (class) → ${cat ?? "?"}`);
      if ( !cat || result[cat] ) continue;
      metaMap[cat] = {
        uuid: doc.uuid, img: doc.img, name: doc.name,
        desc: await HunterCharacterCreation._enrich(doc.system?.description?.value)
      };
      const feats = [];
      const seen = new Set();
      const advs = doc.system?.advancement ?? [];

      // Proficiências de Salvaguarda concedidas (advancement Trait, "saves:xxx").
      const saveKeys = [];
      for ( const adv of advs ) {
        if ( adv.type !== "Trait" ) continue;
        const cfg = adv.configuration ?? {};
        const refs = [].concat(Array.from(cfg.grants ?? [])).concat((cfg.choices ?? []).flatMap(c => Array.from(c.pool ?? [])));
        for ( const t of refs ) {
          const k = HunterCharacterCreation._saveFromTrait(t);
          if ( k && !saveKeys.includes(k) ) saveKeys.push(k);
        }
      }
      savesMap[cat] = saveKeys.map(k => game.i18n.localize(CONFIG.DND5E.abilities[k]?.label ?? k));

      // Atributo(s) principal(is) da categoria (system.primaryAbility).
      const pa = doc.system?.primaryAbility;
      let primaryKeys = [];
      if ( typeof pa === "string" ) primaryKeys = [pa];
      else if ( pa?.value ) primaryKeys = Array.from(pa.value);
      else if ( Array.isArray(pa) ) primaryKeys = pa;
      // Fallback 1: Atributo de Conjuração (spellcasting.ability), p/ categorias casters.
      if ( !primaryKeys.length ) {
        const sc = doc.system?.spellcasting?.ability;
        if ( sc ) primaryKeys = [sc];
      }
      // Fallback 2: mapa padrão da categoria.
      if ( !primaryKeys.length && HunterCharacterCreation.PRIMARY_FALLBACK[cat] )
        primaryKeys = HunterCharacterCreation.PRIMARY_FALLBACK[cat];
      primaryMap[cat] = primaryKeys;  // chaves de atributo (ex.: ["str"])

      for ( const adv of advs ) {
        if ( HunterCharacterCreation.SKIP_ADV_TYPES.includes(adv.type) ) continue;
        const level = Number(adv.level ?? adv.configuration?.level) || 0;
        if ( level < 2 ) continue;
        const cfg = adv.configuration ?? {};
        // Itens concedidos/escolhíveis por este advancement (ItemGrant/ItemChoice).
        const refs = [].concat(cfg.items ?? []).concat(cfg.pool ?? []);

        const push = (name, desc) => {
          name = (name ?? "").trim();
          if ( !name ) return;
          if ( HunterCharacterCreation.UNIVERSAL_FEATURES.includes(HunterCharacterCreation._norm(name)) ) return;
          const key = `${level}|${HunterCharacterCreation._norm(name)}`;
          if ( seen.has(key) ) return;
          seen.add(key);
          feats.push({ level, name, desc: desc ?? "" });
        };

        if ( refs.length ) {
          // Resolve cada feat concedido e usa o NOME real dele (descrição em HTML para o hover).
          for ( const ref of refs ) {
            const uuid = typeof ref === "string" ? ref : ref?.uuid;
            if ( !uuid ) continue;
            try {
              const gi = await fromUuid(uuid);
              if ( gi ) push(gi.name, await HunterCharacterCreation._enrich(gi.system?.description?.value));
            } catch { /* ignore */ }
          }
        } else {
          // Sem itens: usa o título (ex.: escolha de Caminho), ignorando placeholders genéricos.
          const title = (adv.title ?? "").trim();
          const nt = HunterCharacterCreation._norm(title);
          if ( title && nt !== "caracteristicas" && nt !== "caracteristica" ) {
            push(title, await HunterCharacterCreation._enrich(adv.hint));
          }
        }
      }
      feats.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
      result[cat] = feats;
    }

    this._catProg = result;
    this._catSaves = savesMap;
    this._catPrimary = primaryMap;
    this._catMeta = metaMap;
    return result;
  }

  /* -------------------------------------------- */
  /*  Passo: Espécie                              */
  /* -------------------------------------------- */

  /** Normaliza texto (sem acento, minúsculo). */
  static _norm(s) { return (s ?? "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  /**
   * Escolhas por espécie (variante/aparência). Casadas pelo NOME da espécie.
   * Por ora apenas registradas; o granting mecânico vem depois.
   */
  static SPECIES_CHOICES = [
    { match: "formiga quimera", type: "traits", maxCommon: 2, maxSpecific: 3 },
    { match: "humano", type: "variant", title: "Variante", options: [
      { id: "normal",     label: "Humano Normal",            note: "+2 talentos adicionais." },
      { id: "zoldyck",    label: "Zoldyck",                  note: "Resistência a Venenos + Instintos Bestiais." },
      { id: "guydondond", label: "Tribo Guydondond",         note: "Proficiência em Sobrevivência (SAB), Sobrenatural (ESP), Salvaguarda de Constituição + 2 talentos." },
      { id: "meteoro",    label: "Escória da Cidade Meteoro", note: "Maestria em Sobrevivência (SAB) + 2 talentos." },
      { id: "kurta",      label: "Tribo Kurta",              note: "+2 talentos adicionais." }
    ]},
    { match: "kiriko", type: "variant", title: "Variante", options: [
      { id: "humanos",  label: "Humanos",        note: "Escolhe 6 formas humanas; pode trocar 1 ao fim de um descanso longo." },
      { id: "bestas",   label: "Bestas Mágicas", note: "Toma a forma de bestas mágicas analisadas (até 3 na memória)." },
      { id: "monstros", label: "Monstros",       note: "Toma a forma de criaturas exóticas/monstros (até 5 na memória)." }
    ]}
  ];

  /** Config de escolha que casa com o nome da espécie (ou null). */
  static speciesChoiceConfig(name) {
    const n = HunterCharacterCreation._norm(name);
    return HunterCharacterCreation.SPECIES_CHOICES.find(c => n.includes(c.match)) ?? null;
  }

  /**
   * Carrega (cache) os Traços da Formiga Quimera: pasta "Traços ... Quimera"
   * com subpastas "Comuns" e "Específicos" em um compêndio de Item.
   * @returns {Promise<{common:object[], specific:object[]}>}
   */
  /**
   * Coleta itens de pastas (em compêndios de Item E nos Itens do Mundo) cujo
   * nome casa `leaf` e cujo ancestral (se `ancestor`) casa esse nome.
   * @returns {Promise<object[]>} [{ id, uuid, name, img }]
   */
  async _collectFolderItems({ leaf, ancestor = null, exclude = null }) {
    const N = HunterCharacterCreation._norm;
    const out = [];
    const parentId = f => f.folder?.id ?? (typeof f.folder === "string" ? f.folder : f.folder?._id) ?? null;
    // Conjunto de folder-ids desejados: pastas que casam `leaf` (preferindo as sob
    // um ancestral `ancestor`) + TODAS as suas descendentes (ex.: subpastas de tipos),
    // removendo as que estiverem sob um ancestral `exclude` (ex.: "Defeitos").
    const wantedIds = folders => {
      const byId = new Map(folders.map(f => [f.id, f]));
      const underName = (f, name) => {
        let cur = f, g = 0;
        while ( cur && g++ < 12 ) { if ( N(cur.name).includes(name) ) return true; cur = byId.get(parentId(cur)); }
        return false;
      };
      let matched = folders.filter(f => N(f.name).includes(leaf));
      if ( ancestor ) {
        const withAnc = matched.filter(f => underName(f, ancestor));
        if ( withAnc.length ) matched = withAnc; // prefere sob ancestral; senão usa todas
      }
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
    // Compêndios de Item
    for ( const pack of game.packs ) {
      if ( pack.metadata.type !== "Item" ) continue;
      const folders = Array.from(pack.folders ?? []);
      if ( !folders.length ) continue;
      const ids = wantedIds(folders);
      if ( !ids.size ) continue;
      const fname = new Map(folders.map(f => [f.id, f.name]));
      const index = await pack.getIndex({ fields: ["img", "name", "folder", "type"] });
      for ( const e of index ) {
        if ( e.type === "folder" || !ids.has(e.folder) ) continue;
        out.push({ id: e._id, uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`, name: e.name, img: e.img, folderName: fname.get(e.folder) ?? "" });
      }
    }
    // Itens do Mundo (sidebar)
    const wf = (game.folders ?? []).filter(f => f.type === "Item");
    if ( wf.length ) {
      const ids = wantedIds(wf);
      if ( ids.size ) for ( const i of game.items ) if ( ids.has(i.folder?.id) )
        out.push({ id: i.id, uuid: i.uuid, name: i.name, img: i.img, folderName: i.folder?.name ?? "" });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Traços da Formiga Quimera (Comuns/Específicos sob ancestral "Quimera"). */
  async _getQuimeraTraits() {
    if ( this._quimeraTraits ) return this._quimeraTraits;
    const common = await this._collectFolderItems({ leaf: "comu", ancestor: "quimera" });
    const specific = await this._collectFolderItems({ leaf: "especif", ancestor: "quimera" });
    // Diagnóstico: lista as pastas reais que o código enxerga (compêndio + mundo).
    const debug = [];
    if ( !common.length && !specific.length ) {
      for ( const pack of game.packs ) {
        if ( pack.metadata.type !== "Item" ) continue;
        const fs = Array.from(pack.folders ?? []);
        if ( !fs.length ) continue;
        const byId = new Map(fs.map(f => [f.id, f]));
        for ( const f of fs ) {
          const pid = f.folder?.id ?? (typeof f.folder === "string" ? f.folder : f.folder?._id);
          debug.push(`📦 ${pack.metadata.label}: "${f.name}" (pai: ${byId.get(pid)?.name ?? "—"})`);
        }
      }
      for ( const f of (game.folders ?? []).filter(f => f.type === "Item") ) {
        debug.push(`🌍 Mundo: "${f.name}" (pai: ${f.folder?.name ?? "—"})`);
      }
      console.warn("HunterCreation | traços Quimera não encontrados. Pastas vistas:", debug);
    }
    return (this._quimeraTraits = { common, specific, debug });
  }

  /** Talentos disponíveis (pasta "Talentos"), sem itens-cabeçalho/separadores. */
  async _getTalents() {
    if ( this._talents ) return this._talents;
    const N = HunterCharacterCreation._norm;
    // Defeitos obrigatórios de variante (não entram na escolha livre de talentos).
    const FORCED_DEFECTS = ["amor obsessivo", "instinto assassino", "lixo da sociedade", "existencia valiosa"];
    const list = (await this._collectFolderItems({ leaf: "talento" }))
      .filter(t => t.name
        && !t.name.includes("=")
        && !/\(npc\)/i.test(t.name)
        && !/\(\s*\d+\s*pontos?\s*\)/i.test(t.name)            // defeitos "(N Pontos)"
        && !FORCED_DEFECTS.some(d => N(t.name).startsWith(d))); // defeitos obrigatórios
    return (this._talents = list);
  }

  /** Pastas de talento específicas de espécie/tribo (nomes reais do compêndio). */
  static SPECIES_FOLDER_KEYS = ["zoldyck", "gyudondond", "guydondond", "guydon", "kurta", "kiriko", "formiga", "quimera", "humano", "escoria"];

  /** true se a pasta do talento é específica de alguma espécie/tribo. */
  static _isSpeciesFolder(folderName) {
    const fn = HunterCharacterCreation._norm(folderName);
    return HunterCharacterCreation.SPECIES_FOLDER_KEYS.some(k => fn.includes(k));
  }

  /** Palavras-chave de pasta de talento permitidas pela espécie/variante atual. */
  _allowedSpeciesKeys() {
    const N = HunterCharacterCreation._norm;
    const n = N(this._creation.speciesName ?? "");
    const v = this._creation.speciesChoice;
    if ( n.includes("formiga") || n.includes("quimera") ) return ["formiga", "quimera"];
    if ( n.includes("kiriko") ) return ["kiriko"];
    if ( n.includes("humano") ) {
      if ( v === "normal" || v === "meteoro" ) return ["humano", "escoria"];
      if ( v === "kurta" ) return ["humano", "escoria", "kurta"];
      if ( v === "zoldyck" ) return ["zoldyck"];
      if ( v === "guydondond" ) return ["gyudondond", "guydondond", "guydon"];
      return [];
    }
    return [];
  }

  /**
   * Limite de talentos escolhíveis na criação, conforme espécie/variante/aparência.
   * Base = 1 talento (Adaptação) + o que a variante/aparência der.
   */
  _talentLimit() {
    let limit = 1;
    const n = HunterCharacterCreation._norm(this._creation.speciesName ?? "");
    const choice = this._creation.speciesChoice;
    if ( n.includes("humano") ) {
      const bonus = { normal: 2, zoldyck: 2, guydondond: 2, meteoro: 2, kurta: 2 };
      limit += bonus[choice] ?? 0;
    } else if ( n.includes("quimera") ) {
      const app = this._quimeraAppearance();
      if ( app && (app.label === "Híbrida" || app.label === "Humana") ) limit += 1;
    }
    return limit;
  }

  /** Aparência da Formiga Quimera derivada da contagem de traços. */
  _quimeraAppearance() {
    const cc = this._creation.speciesTraits.common.length;
    const sc = this._creation.speciesTraits.specific.length;
    if ( cc === 2 && sc === 3 ) return { label: "Bestial", note: "Aparência totalmente bestial — preconceito Severo." };
    if ( cc === 2 && sc === 1 ) return { label: "Híbrida", note: "Memória Genética CD 14; +1 Talento Simples — preconceito Médio." };
    if ( cc === 1 && sc === 1 ) return { label: "Humana", note: "Memória Genética CD 10; +1 Talento — preconceito Leve." };
    return null;
  }

  /** Espécies customizadas (config do mundo). */
  static getCustomSpecies() {
    return foundry.utils.deepClone(game.settings.get("hunter-system", "customSpecies") ?? []);
  }
  static async setCustomSpecies(list) {
    await game.settings.set("hunter-system", "customSpecies", list);
  }

  /** Lista (cache) das espécies: customizadas (config) + compêndio (se achado). */
  async _getSpecies() {
    if ( this._speciesList ) return this._speciesList;
    const out = [];
    // 1) Customizadas (editor do Narrador)
    for ( const s of HunterCharacterCreation.getCustomSpecies() ) {
      out.push({ id: s.id, custom: true, name: s.name || "Sem nome", img: s.img || "icons/svg/mystery-man.svg", desc: s.desc ?? "" });
    }
    // 2) Itens dentro de uma pasta "Espécies" (e subpastas) em qualquer compêndio de Item.
    const N = HunterCharacterCreation._norm;
    let foundPack = false;
    for ( const pack of game.packs ) {
      if ( pack.metadata.type !== "Item" ) continue;
      const folders = Array.from(pack.folders ?? []);
      const named = folders.filter(f => N(f.name).includes("especie"));
      if ( !named.length ) continue;
      foundPack = true;
      // Reúne a pasta "Espécies" + todas as descendentes (ex.: PV)
      const wanted = new Set();
      const collect = fid => {
        if ( !fid || wanted.has(fid) ) return;
        wanted.add(fid);
        for ( const f of folders ) if ( (f.folder?.id ?? f.folder) === fid ) collect(f.id);
      };
      for ( const f of named ) collect(f.id);
      const index = await pack.getIndex({ fields: ["img", "name", "folder", "type"] });
      for ( const e of index ) {
        if ( e.type !== "race" ) continue;      // só espécies de verdade (têm ID de raça)
        if ( !wanted.has(e.folder) ) continue;  // dentro da pasta "Espécies"
        out.push({
          id: e._id, custom: false,
          uuid: e.uuid ?? `Compendium.${pack.collection}.${pack.documentName}.${e._id}`,
          name: e.name, img: e.img
        });
      }
    }
    if ( !foundPack ) console.warn("HunterCreation | pasta 'Espécies' não encontrada em nenhum compêndio de Item. Compêndios de Item + pastas:",
      game.packs.filter(p => p.metadata.type === "Item").map(p => `${p.title}: [${Array.from(p.folders ?? []).map(f => f.name).join(", ")}]`));
    this._speciesList = out.sort((a, b) => a.name.localeCompare(b.name));
    return this._speciesList;
  }

  /** Invalida o cache de espécies (após edição). */
  _refreshSpecies() { this._speciesList = null; this.render(); }

  /* -------------------------------------------- */
  /*  Passo: Origem                               */
  /* -------------------------------------------- */

  /** Backgrounds (origens) dos compêndios de Item e do mundo. Cacheado. */
  async _getBackgrounds() {
    if ( this._originList ) return this._originList;
    const out = [];
    for ( const pack of game.packs ) {
      if ( pack.metadata.type !== "Item" ) continue;
      let index;
      try { index = await pack.getIndex({ fields: ["img", "name", "type"] }); } catch { continue; }
      for ( const e of index ) {
        if ( e.type !== "background" ) continue;
        out.push({
          id: e._id, name: e.name, img: e.img,
          uuid: e.uuid ?? `Compendium.${pack.collection}.${pack.documentName}.${e._id}`
        });
      }
    }
    for ( const it of game.items ?? [] ) if ( it.type === "background" ) out.push({ id: it.id, name: it.name, img: it.img, uuid: it.uuid });
    this._originList = out.sort((a, b) => a.name.localeCompare(b.name));
    return this._originList;
  }

  /** Monta o contexto do passo de Origem. */
  async _prepareOriginContext(context) {
    const list = await this._getBackgrounds();
    const sel = this._creation.originId;
    context.origins = list.map(o => ({ id: o.id, name: o.name, img: o.img, selected: sel === o.id }));
    context.hasOrigins = list.length > 0;

    // Coluna lateral: atributos (base + bônus de espécie + pontos de ORIGEM com −/+).
    const ab = this._creation.abilityBonus ?? {};
    const ob = this._creation.originBonus ?? {};
    const oUsed = HunterCharacterCreation.#bonusUsed(ob);
    const oTotal = HunterCharacterCreation.ORIGIN_BONUS_POINTS;
    context.originPoints = { total: oTotal, used: oUsed, left: oTotal - oUsed };
    context.currentAbilities = HunterCharacterCreation.ABILITY_KEYS.map(k => {
      const oAdd = Number(ob[k]) || 0;
      return {
        key: k,
        abbr: game.i18n.localize(CONFIG.DND5E.abilities[k]?.abbreviation ?? k).toUpperCase(),
        label: game.i18n.localize(CONFIG.DND5E.abilities[k]?.label ?? k),
        value: this._baseAbility(k) + (Number(ab[k]) || 0) + oAdd,
        originAdd: oAdd,
        canInc: oUsed < oTotal,
        canDec: oAdd > 0
      };
    });

    // Salvaguarda à escolha (1 das 6). Bloqueia as que você JÁ recebeu por outra fonte
    // (categoria/Sem Categoria) — não dá pra pegar a mesma salvaguarda duas vezes.
    const ownedSaves = this._ownedSaves({ exceptOrigin: true });
    // Se a de origem virou "já possuída" (mudou a categoria/sem depois), limpa a escolha.
    if ( this._creation.originSave && ownedSaves.has(this._creation.originSave) ) this._creation.originSave = null;
    context.originSaves = HunterCharacterCreation.ABILITY_KEYS.map(k => ({
      key: k, label: game.i18n.localize(CONFIG.DND5E.abilities[k]?.label ?? k),
      selected: this._creation.originSave === k,
      disabled: ownedSaves.has(k)
    }));

    const chosen = sel ? list.find(o => o.id === sel) : null;
    context.chosenOrigin = null;
    if ( chosen ) {
      const doc = chosen.uuid ? await fromUuid(chosen.uuid) : null;
      const grants = [];
      for ( const adv of (doc?.system?.advancement ?? []) ) {
        const refs = [].concat(adv.configuration?.items ?? []).concat(adv.configuration?.pool ?? []);
        for ( const ref of refs ) {
          const uuid = typeof ref === "string" ? ref : ref?.uuid;
          if ( !uuid ) continue;
          try { const gi = await fromUuid(uuid); if ( gi ) grants.push(gi.name); } catch { /* ignore */ }
        }
        // Proficiências/idiomas concedidos (advancement do tipo Trait).
        if ( adv.type === "Trait" && adv.title ) grants.push(adv.title);
      }
      // Perícias à escolha: 1º do advancement (Trait, pelos códigos); fallback = texto.
      const trait = HunterCharacterCreation._traitSkills(doc);
      let count = trait.count, pool = trait.pool;
      if ( !pool.length ) {
        const parsed = HunterCharacterCreation._parseOriginSkills(doc?.system?.description?.value);
        count = parsed.count; pool = parsed.keys;
      }
      this._originSkillCount = count;
      // Remove seleções que não fazem parte do pool desta origem.
      this._creation.originSkills = this._creation.originSkills.filter(k => pool.includes(k));
      const chosenSkills = this._creation.originSkills;
      context.originGrantedSkills = trait.granted.map(k => game.i18n.localize(CONFIG.DND5E.skills[k]?.label ?? k));
      context.originSkills = pool.length ? {
        count, left: count - chosenSkills.length,
        options: pool.map(k => ({
          key: k, label: game.i18n.localize(CONFIG.DND5E.skills[k]?.label ?? k),
          selected: chosenSkills.includes(k),
          disabled: !chosenSkills.includes(k) && chosenSkills.length >= count
        }))
      } : null;

      context.chosenOrigin = {
        name: chosen.name, img: chosen.img,
        desc: await HunterCharacterCreation._enrich(doc?.system?.description?.value),
        grants: [...new Set(grants)]
      };
    }
  }

  /** Salvaguardas que o personagem JÁ recebeu por categoria / Sem Categoria (usado para
      bloquear escolher a mesma salvaguarda de novo na origem). */
  _ownedSaves({ exceptOrigin = false } = {}) {
    const set = new Set();
    for ( const k of (this._creation.semSaves ?? []) ) set.add(k);         // Sem Categoria (nível 1)
    const catKey = this._creation.category || "sem";
    for ( const k of (this._catSaves?.[catKey] ?? []) ) set.add(k);        // Categoria (advancement)
    if ( !exceptOrigin && this._creation.originSave ) set.add(this._creation.originSave);
    return set;
  }

  /** true se o talento já foi escolhido em OUTRA etapa (espécie / Sem Categoria / defeitos),
      pra não gastar duas escolhas no mesmo talento. `ignore` pula a etapa atual. */
  _talentChosenElsewhere(id, { ignore } = {}) {
    const inSpecies = ignore !== "species" && (this._creation.talents ?? []).includes(id);
    const inSem     = ignore !== "sem"     && this._creation.semTalent === id;
    const inCustom  = ignore !== "custom"  && (this._creation.customTalents ?? []).includes(id);
    return inSpecies || inSem || inCustom;
  }

  /** Extrai a chave de perícia de uma trait-key dnd5e (ex.: "skills:ath" → "ath"). */
  static _skillFromTrait(t) {
    const m = /^skills?:([a-z0-9]+)$/i.exec(String(t ?? ""));
    return (m && CONFIG.DND5E.skills[m[1]]) ? m[1] : null;
  }

  /** Extrai a chave de salvaguarda de uma trait-key dnd5e (ex.: "saves:con" → "con"). */
  static _saveFromTrait(t) {
    const m = /^saves?:([a-z]+)$/i.exec(String(t ?? ""));
    return (m && CONFIG.DND5E.abilities[m[1]]) ? m[1] : null;
  }

  /**
   * Lê do advancement (tipo Trait) as perícias concedidas e à escolha — pelos CÓDIGOS.
   * Retorna { count, pool:[skillKeys], granted:[skillKeys] }.
   */
  static _traitSkills(doc) {
    const out = { count: 0, pool: [], granted: [] };
    for ( const adv of (doc?.system?.advancement ?? []) ) {
      if ( adv.type !== "Trait" ) continue;
      const cfg = adv.configuration ?? {};
      for ( const t of Array.from(cfg.grants ?? []) ) {
        const k = HunterCharacterCreation._skillFromTrait(t);
        if ( k && !out.granted.includes(k) ) out.granted.push(k);
      }
      for ( const ch of (cfg.choices ?? []) ) {
        const pool = Array.from(ch.pool ?? []).map(t => HunterCharacterCreation._skillFromTrait(t)).filter(Boolean);
        if ( !pool.length ) continue; // pool vazio = "qualquer perícia"; ignorado aqui
        out.count += Number(ch.count) || 0;
        for ( const k of pool ) if ( !out.pool.includes(k) ) out.pool.push(k);
      }
    }
    return out;
  }

  /** Mapa (cache) de nome-de-perícia normalizado → chave dnd5e. */
  static _skillKeyMap() {
    if ( this.__skillMap ) return this.__skillMap;
    const map = {};
    for ( const [key, cfg] of Object.entries(CONFIG.DND5E.skills ?? {}) ) {
      const label = HunterCharacterCreation._norm(game.i18n.localize(cfg.label));
      if ( label ) map[label] = key;
    }
    return (this.__skillMap = map);
  }

  /** Resolve um nome (possivelmente com sigla entre parênteses) para uma chave de perícia. */
  static _matchSkill(raw) {
    // Remove parênteses (ex.: "Atletismo (FOR)") e pontuação solta.
    const cleaned = HunterCharacterCreation._norm(raw.replace(/\([^)]*\)/g, "")).replace(/[^a-z\s]/g, "").trim();
    if ( !cleaned ) return null;
    const map = HunterCharacterCreation._skillKeyMap();
    if ( map[cleaned] ) return map[cleaned];
    // Casamento por inclusão (rótulo contém o nome ou vice-versa).
    for ( const [label, key] of Object.entries(map) ) {
      if ( label === cleaned || label.includes(cleaned) || cleaned.includes(label) ) return key;
    }
    return null;
  }

  /** Extrai contagem e pool de perícias de "Escolha N entre ..." da descrição. */
  static _parseOriginSkills(html) {
    const text = HunterCharacterCreation._plain(html);
    const m = text.match(/per[ií]cias?:?\s*escolha\s+(\d+)\s+entre\s+([^.]+)/i);
    if ( !m ) { console.warn("[HunterCreation] Perícias: padrão 'Escolha N entre …' não encontrado em:", text.slice(0, 200)); return { count: 0, keys: [] }; }
    const count = Number(m[1]) || 0;
    const parts = m[2].split(/,|;| e /i).map(s => s.trim()).filter(Boolean);
    const keys = [], misses = [];
    for ( const part of parts ) {
      const key = HunterCharacterCreation._matchSkill(part);
      if ( key ) { if ( !keys.includes(key) ) keys.push(key); }
      else misses.push(part);
    }
    if ( misses.length ) console.warn("[HunterCreation] Perícias não reconhecidas:", misses,
      "| disponíveis:", Object.keys(HunterCharacterCreation._skillKeyMap()));
    return { count, keys };
  }

  /* -------------------------------------------- */
  /*  Passo: Personalização (Defeitos + Talentos) */
  /* -------------------------------------------- */

  /**
   * Defeitos do compêndio, agrupados por pontos {1,3,5}.
   * Lê a pasta "Defeitos" (subpastas "Defeitos - N ponto(s)"); ignora "Especiais".
   * Cacheado em `this._defeitos`.
   */
  async _getDefeitos() {
    if ( this._defeitos ) return this._defeitos;
    const N = HunterCharacterCreation._norm;
    const parentId = f => f.folder?.id ?? (typeof f.folder === "string" ? f.folder : f.folder?._id) ?? null;
    // Uma divisória por subpasta de "Defeitos" (dinâmico). Pontos vêm do nome da pasta
    // ("… 3 Pontos" → 3); pasta sem número (ex.: "Especiais") = 0. Nova pasta → nova divisória.
    const byFolder = new Map();   // folderId → { label, points, items:[] }
    // Registra as pastas válidas de uma coleção (raiz "Defeitos" TOP + descendentes),
    // valendo tanto para pastas de compêndio quanto para pastas de Item do Mundo.
    const registrar = folders => {
      if ( !folders.length ) return false;
      const byId = new Map(folders.map(f => [f.id, f]));
      // Raiz: prefere o nome EXATO "Defeitos", depois "Defeitos …", depois qualquer um
      // que contenha. Em estruturas como "Talentos e Defeitos" > "Defeitos" > "Defeitos -
      // 1 ponto", a regra antiga ("pai não contém defeito") elegia o ANCESTRAL compartilhado
      // e o veto de "talento" descartava todas as subpastas.
      const cands = folders.filter(f => N(f.name).includes("defeito"));
      if ( !cands.length ) return false;
      const nota = f => {
        const n = N(f.name).trim();
        if ( n === "defeitos" || n === "defeito" ) return 0;
        return n.startsWith("defeito") ? 1 : 2;
      };
      const root = cands.sort((a, b) => nota(a) - nota(b))[0];
      const isUnder = (f, rootId) => { let c = f, g = 0; while ( c && g++ < 12 ) { if ( c.id === rootId ) return true; c = byId.get(parentId(c)); } return false; };
      // Vetos por nome valem só ENTRE a pasta e a raiz (exclusivo): o nome de um ancestral
      // ACIMA da raiz (ex.: "Talentos e Defeitos") não pode desqualificar as subpastas.
      const entreAteRaiz = (f, name) => {
        let c = f, g = 0;
        while ( c && c.id !== root.id && g++ < 12 ) {
          if ( N(c.name).includes(name) ) return true;
          c = byId.get(parentId(c));
        }
        return false;
      };
      for ( const f of folders ) {
        if ( f.id !== root.id && !isUnder(f, root.id) ) continue;   // raiz "Defeitos" + descendentes
        if ( f.id !== root.id && entreAteRaiz(f, "talento") ) continue;   // pasta "Talentos" aninhada NÃO é defeito
        if ( f.id !== root.id && entreAteRaiz(f, "especia") ) continue;   // "Defeitos - Especiais" = obrigatórios de variante, fora da escolha livre
        if ( HunterCharacterCreation._isSpeciesFolder(f.name) ) continue;   // traços de espécie (concedidos pela espécie), não defeitos escolhíveis
        const m = N(f.name).match(/(\d+)\s*ponto/);
        byFolder.set(f.id, { label: f.name, points: m ? Number(m[1]) : 0, items: [] });
      }
      return true;
    };
    // Compêndios de Item
    for ( const pack of game.packs ) {
      if ( pack.metadata.type !== "Item" ) continue;
      if ( !registrar(Array.from(pack.folders ?? [])) ) continue;
      const index = await pack.getIndex({ fields: ["img", "name", "folder", "type"] });
      for ( const e of index ) {
        if ( e.type === "folder" || /={3,}/.test(e.name ?? "") ) continue;   // pula pastas e separadores ("==========")
        const g = byFolder.get(e.folder);
        if ( !g ) continue;
        g.items.push({ id: e._id, uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`, name: e.name, img: e.img, pts: g.points });
      }
    }
    // Itens do MUNDO (pasta "Defeitos" na barra lateral) também contam
    if ( registrar((game.folders ?? []).filter(f => f.type === "Item")) ) {
      for ( const i of game.items ) {
        if ( /={3,}/.test(i.name ?? "") ) continue;
        const g = byFolder.get(i.folder?.id);
        if ( g ) g.items.push({ id: i.id, uuid: i.uuid, name: i.name, img: i.img, pts: g.points });
      }
    }
    const groups = [...byFolder.values()].filter(g => g.items.length);
    groups.forEach(g => g.items.sort((a, b) => a.name.localeCompare(b.name)));
    groups.sort((a, b) => a.points - b.points || a.label.localeCompare(b.label));
    // Diagnóstico: se nada foi achado, lista as pastas reais que o código enxerga.
    if ( !groups.length ) {
      const vistas = [];
      for ( const pack of game.packs ) {
        if ( pack.metadata.type !== "Item" ) continue;
        for ( const f of (pack.folders ?? []) ) vistas.push(`📦 ${pack.metadata.label}: "${f.name}"`);
      }
      for ( const f of (game.folders ?? []).filter(f => f.type === "Item") ) vistas.push(`🌍 Mundo: "${f.name}"`);
      console.warn("HunterCreation | nenhuma pasta 'Defeitos' com itens foi encontrada (compêndios de Item + Mundo). Pastas vistas:", vistas);
    }
    console.log(`[HunterCreation] Defeitos: ${groups.length} pasta(s) →`, groups.map(g => `${g.label} (${g.items.length})`).join(" · "));
    this._defeitos = groups;
    return groups;
  }

  /** Nomes (normalizados) de talentos concedidos pela origem (descrição "Talentos: X"). */
  static _parseOriginTalents(html) {
    const text = HunterCharacterCreation._plain(html);
    const m = text.match(/talentos?:?\s*([^.]+)/i);
    if ( !m ) return [];
    return m[1].split(/,|;| e /i).map(s => HunterCharacterCreation._norm(s.replace(/\([^)]*\)/g, ""))).filter(Boolean);
  }

  /** Monta o contexto do passo de Personalização. */
  async _prepareCustomizationContext(context) {
    const groups = await this._getDefeitos();
    const sel = this._creation.defeitos;

    // Pontos de defeito e talentos liberados (1 talento a cada 2 pontos).
    const ptsById = new Map();
    for ( const g of groups ) for ( const d of g.items ) ptsById.set(d.id, d.pts);
    const totalPoints = sel.reduce((s, id) => s + (ptsById.get(id) ?? 0), 0);
    const talentSlots = Math.floor(totalPoints / 2);
    this._customTalentSlots = talentSlots;

    const maxDef = HunterCharacterCreation.MAX_DEFEITOS;
    const atMax = sel.length >= maxDef;
    // Uma divisória por pasta (dinâmico), com o nome da pasta como título.
    context.defeitoGroups = groups.map(g => ({
      label: g.label, points: g.points,
      items: g.items.map(d => ({ ...d, selected: sel.includes(d.id), disabled: atMax && !sel.includes(d.id) }))
    }));
    context.defeitoPoints = totalPoints;
    context.defeitoCount = sel.length;
    context.defeitoMax = maxDef;
    context.defeitoHasAny = context.defeitoGroups.length > 0;

    // Talentos liberados pelos defeitos — comuns + da ESPÉCIE escolhida, sem os já pegos em espécie/origem.
    const takenIds = new Set(this._creation.talents ?? []);
    const originDoc = this._creation.originId
      ? await fromUuid((await this._getBackgrounds()).find(o => o.id === this._creation.originId)?.uuid) : null;
    const originTalentNames = new Set(HunterCharacterCreation._parseOriginTalents(originDoc?.system?.description?.value));
    const N = HunterCharacterCreation._norm;
    const allowedKeys = this._allowedSpeciesKeys();
    const isKurta = this._creation.speciesChoice === "kurta";

    const allTalents = await this._getTalents();
    const pool = allTalents.filter(t => {
      if ( takenIds.has(t.id) ) return false;                   // já pego na espécie
      if ( originTalentNames.has(N(t.name)) ) return false;     // concedido pela origem
      if ( HunterCharacterCreation._isSpeciesFolder(t.folderName) ) {
        const fn = N(t.folderName);
        if ( !allowedKeys.some(k => fn.includes(k)) ) return false; // espécie diferente da escolhida
        if ( isKurta && N(t.name) === "resiliencia" ) return false;
      }
      return true;
    });
    // Limpa seleções inválidas (fora do pool ou acima do limite).
    this._creation.customTalents = this._creation.customTalents.filter(id => pool.some(t => t.id === id));
    const chosen = this._creation.customTalents;

    context.customTalentSlots = talentSlots;
    context.customTalentUsed = chosen.length;
    context.customTalentLeft = talentSlots - chosen.length;
    const mapped = pool.map(t => ({
      ...t, selected: chosen.includes(t.id),
      disabled: !chosen.includes(t.id) && chosen.length >= talentSlots
    }));
    // Agrupa por pasta (cada subpasta = divisória). "Talentos Especiais" (pasta à parte,
    // fora de "Talentos") vão num grupo separado, exibido embaixo.
    const isEsp = fn => N(fn ?? "").includes("especia");
    const regular = new Map(), especiais = [];
    for ( const t of mapped ) {
      if ( isEsp(t.folderName) ) { especiais.push(t); continue; }
      const key = t.folderName || "Talentos";
      if ( !regular.has(key) ) regular.set(key, []);
      regular.get(key).push(t);
    }
    context.talentGroups = [...regular.entries()]
      .map(([label, items]) => ({ label, items }))
      .sort((a, b) => a.label.localeCompare(b.label));
    context.talentEspeciais = especiais;
  }

  /** Número máximo de defeitos que um personagem pode ter. */
  static MAX_DEFEITOS = 5;

  static #onToggleDefeito(event, target) {
    this._captureName();
    const id = target.dataset.defeitoId;
    const arr = this._creation.defeitos;
    const i = arr.indexOf(id);
    if ( i >= 0 ) { arr.splice(i, 1); this.render(); return; }
    if ( arr.length >= HunterCharacterCreation.MAX_DEFEITOS ) {
      ui.notifications.warn(`Você pode ter no máximo ${HunterCharacterCreation.MAX_DEFEITOS} defeitos.`);
      return;
    }
    arr.push(id);
    this.render();
  }

  static #onToggleCustomTalent(event, target) {
    this._captureName();
    const id = target.dataset.talentId;
    const arr = this._creation.customTalents;
    const i = arr.indexOf(id);
    if ( i >= 0 ) { arr.splice(i, 1); this.render(); return; }
    if ( arr.length >= (this._customTalentSlots ?? 0) ) {
      ui.notifications.warn("Pegue mais defeitos para liberar talentos (1 talento a cada 2 pontos).");
      return;
    }
    if ( this._talentChosenElsewhere(id, { ignore: "custom" }) ) {
      ui.notifications.warn("Você já escolheu esse talento em outra etapa.");
      return;
    }
    arr.push(id);
    this.render();
  }

  /* -------------------------------------------- */
  /*  Passo: Métodos de Combate                   */
  /* -------------------------------------------- */

  /** Número de métodos de combate escolhidos na criação. */
  static COMBAT_METHODS_MAX = 3;

  /**
   * Métodos de combate do compêndio, por ramo (Divergente/Especialista) e arma.
   * Estrutura: "Métodos de Combate" → "Divergentes"/"Especialistas" → (arma) → itens.
   * Retorna { divergente: [{weapon, items:[…]}], especialista: [...] }. Cacheado.
   */
  async _getCombatMethods() {
    if ( this._combatData ) return this._combatData;
    const N = HunterCharacterCreation._norm;
    const result = { divergente: [], especialista: [] };
    const parentId = f => f.folder?.id ?? (typeof f.folder === "string" ? f.folder : f.folder?._id) ?? null;
    for ( const pack of game.packs ) {
      if ( pack.metadata.type !== "Item" ) continue;
      const folders = Array.from(pack.folders ?? []);
      if ( !folders.length ) continue;
      const byId = new Map(folders.map(f => [f.id, f]));
      // Topo "Métodos de Combate" (aceita sufixo, ex.: "(MC)"), mas NÃO o "…Avançados".
      const root = folders.find(f => {
        const n = N(f.name);
        return n.includes("metodos de combate") && !n.includes("avancad");
      });
      if ( !root ) continue;
      // Ramo de uma pasta: sobe até o filho direto da raiz.
      const branchOf = fid => {
        let cur = byId.get(fid), g = 0, child = null;
        while ( cur && g++ < 12 ) {
          if ( parentId(cur) === root.id ) { child = cur; break; }
          if ( cur.id === root.id ) break;
          cur = byId.get(parentId(cur));
        }
        if ( !child ) return null;
        const bn = N(child.name);
        return bn.includes("divergent") ? "divergente" : bn.includes("especialist") ? "especialista" : null;
      };
      const branchChildId = b => folders.find(f => parentId(f) === root.id
        && N(f.name).includes(b === "divergente" ? "divergent" : "especialist"))?.id;

      const index = await pack.getIndex({ fields: ["img", "name", "folder", "type"] });
      const groups = { divergente: new Map(), especialista: new Map() }; // weaponName -> items[]
      for ( const e of index ) {
        if ( e.type === "folder" || !e.folder ) continue;
        const branch = branchOf(e.folder);
        if ( !branch ) continue;
        // Arma = nome da pasta imediata (a menos que seja a própria pasta do ramo).
        const fld = byId.get(e.folder);
        const weapon = (fld && fld.id !== branchChildId(branch)) ? fld.name : "Geral";
        if ( !groups[branch].has(weapon) ) groups[branch].set(weapon, []);
        groups[branch].get(weapon).push({
          id: e._id, uuid: e.uuid ?? `Compendium.${pack.collection}.Item.${e._id}`, name: e.name, img: e.img
        });
      }
      for ( const b of ["divergente", "especialista"] ) {
        for ( const [weapon, items] of groups[b] ) {
          items.sort((a, c) => a.name.localeCompare(c.name));
          result[b].push({ weapon, items });
        }
      }
    }
    for ( const b of ["divergente", "especialista"] ) result[b].sort((a, c) => a.weapon.localeCompare(c.weapon));
    const cnt = b => result[b].reduce((s, g) => s + g.items.length, 0);
    console.log(`[HunterCreation] Métodos: divergente=${cnt("divergente")} (${result.divergente.map(g => g.weapon).join(", ")}) · especialista=${cnt("especialista")} (${result.especialista.map(g => g.weapon).join(", ")})`);
    this._combatData = result;
    return result;
  }

  /** Extrai o UUID da técnica linkada na descrição de um método. */
  static _linkedTechnique(html) {
    const s = String(html ?? "");
    const m = s.match(/@UUID\[([^\]]+)\]/) || s.match(/data-uuid="([^"]+)"/);
    return m ? m[1] : null;
  }

  /** Monta o contexto do passo de Métodos de Combate. */
  async _prepareCombatContext(context) {
    const data = await this._getCombatMethods();
    const branch = this._creation.combatBranch;
    const selected = this._creation.combatMethods;
    const focus = this._creation.combatFocus;
    const max = HunterCharacterCreation.COMBAT_METHODS_MAX;

    context.combatBranches = [
      { id: "divergente",   label: "Divergente",   selected: branch === "divergente",   count: data.divergente.reduce((s, g) => s + g.items.length, 0) },
      { id: "especialista", label: "Especialista", selected: branch === "especialista", count: data.especialista.reduce((s, g) => s + g.items.length, 0) }
    ];
    context.combatBranch = branch;
    context.combatCount = selected.length;
    context.combatMax = max;
    context.combatHasData = data.divergente.length > 0 || data.especialista.length > 0;

    if ( branch ) {
      context.combatGroups = data[branch].map(g => ({
        weapon: g.weapon,
        items: g.items.map(m => ({
          ...m, selected: selected.includes(m.id), focused: focus === m.id,
          disabled: !selected.includes(m.id) && selected.length >= max
        }))
      }));
    }

    // Detalhe do método em foco + card da técnica linkada.
    context.combatDetail = null;
    if ( focus ) {
      const all = data[branch] ? data[branch].flatMap(g => g.items) : [];
      const m = all.find(x => x.id === focus);
      if ( m ) {
        const doc = await fromUuid(m.uuid);
        const techUuid = HunterCharacterCreation._linkedTechnique(doc?.system?.description?.value);
        let technique = null;
        if ( techUuid ) {
          const tech = await fromUuid(techUuid);
          if ( tech ) technique = { name: tech.name, img: tech.img, desc: await HunterCharacterCreation._enrich(tech.system?.description?.value) };
        }
        context.combatDetail = {
          id: m.id, name: m.name, img: m.img,
          desc: await HunterCharacterCreation._enrich(doc?.system?.description?.value),
          selected: selected.includes(m.id),
          technique
        };
      }
    }
  }

  /* -------------------------------------------- */
  /*  Passo: Token / Imagens                      */
  /* -------------------------------------------- */

  /** Abre o seletor de arquivos para uma imagem (perfil ou token). */
  _pickImage(current, onPick) {
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    new FP({
      type: "image",
      current: current ?? "",
      callback: path => { onPick(path); this.render(); }
    }).render(true);
  }

  static #onPickProfileImg() {
    this._captureName();
    this._pickImage(this._creation.img, path => { this._creation.img = path; });
  }

  static #onPickTokenImg() {
    this._captureName();
    this._pickImage(this._creation.tokenImg, path => { this._creation.tokenImg = path; });
  }

  /** Copia a imagem de perfil para o token. */
  static #onUseImgAsToken() {
    this._captureName();
    this._creation.tokenImg = this._creation.img;
    this.render();
  }

  static #onChooseCombatBranch(event, target) {
    this._captureName();
    const b = target.dataset.branch;
    if ( this._creation.combatBranch === b ) return;
    this._creation.combatBranch = b;
    this._creation.combatMethods = []; // troca de ramo limpa a escolha
    this._creation.combatFocus = null;
    this.render();
  }

  static #onFocusCombatMethod(event, target) {
    this._captureName();
    this._creation.combatFocus = target.dataset.methodId ?? null;
    this.render();
  }

  static #onToggleCombatMethod(event, target) {
    this._captureName();
    const id = target.dataset.methodId;
    const arr = this._creation.combatMethods;
    const i = arr.indexOf(id);
    if ( i >= 0 ) { arr.splice(i, 1); this.render(); return; }
    if ( arr.length >= HunterCharacterCreation.COMBAT_METHODS_MAX ) {
      ui.notifications.warn(`Você pode escolher no máximo ${HunterCharacterCreation.COMBAT_METHODS_MAX} métodos de combate.`);
      return;
    }
    arr.push(id);
    this.render();
  }

  /** HTML do hovercard de um item (nome + descrição enriquecida), com cache. */
  async _itemTooltip(uuid) {
    this._tipCache ??= {};
    if ( uuid in this._tipCache ) return this._tipCache[uuid];
    const doc = await fromUuid(uuid);
    if ( !doc ) return (this._tipCache[uuid] = "");
    const TE = foundry.applications.ux.TextEditor.implementation;
    const desc = doc.system?.description?.value ?? "";
    const enriched = desc ? await TE.enrichHTML(desc, { secrets: false }) : "<em>Sem descrição.</em>";
    return (this._tipCache[uuid] = `<div class="hunter-tip-card"><h4>${doc.name}</h4>${enriched}</div>`);
  }

  /** Descrição (cache) de uma espécie. */
  async _speciesDesc(uuid) {
    this._speciesDescCache ??= {};
    if ( uuid in this._speciesDescCache ) return this._speciesDescCache[uuid];
    const doc = await fromUuid(uuid);
    return (this._speciesDescCache[uuid] = doc?.system?.description?.value ?? "");
  }

  /** Monta o contexto do passo de Espécie. */
  async _prepareSpeciesContext(context) {
    const list = await this._getSpecies();
    const selId = this._creation.species;
    context.isGM = game.user.isGM;
    context.actorUuid = this.actor?.uuid ?? "";
    context.speciesAvailable = list.length > 0;
    context.speciesList = list.map(s => ({ ...s, selected: s.id === selId }));
    const chosen = list.find(s => s.id === selId);
    if ( chosen ) {
      const desc = chosen.custom ? (chosen.desc ?? "") : await this._speciesDesc(chosen.uuid);
      const cfg = HunterCharacterCreation.speciesChoiceConfig(chosen.name);
      const cs = { ...chosen, desc, editable: context.isGM && chosen.custom, choice: null, traits: null };

      if ( cfg?.type === "variant" ) {
        cs.choice = {
          title: cfg.title,
          options: cfg.options.map(o => ({ ...o, selected: this._creation.speciesChoice === o.id })),
          selectedNote: cfg.options.find(o => o.id === this._creation.speciesChoice)?.note ?? ""
        };
      } else if ( cfg?.type === "traits" ) {
        const all = await this._getQuimeraTraits();
        const selC = this._creation.speciesTraits.common;
        const selS = this._creation.speciesTraits.specific;
        cs.traits = {
          maxCommon: cfg.maxCommon, maxSpecific: cfg.maxSpecific,
          common:   all.common.map(t => ({ ...t, selected: selC.includes(t.id) })),
          specific: all.specific.map(t => ({ ...t, selected: selS.includes(t.id) })),
          countCommon: selC.length, countSpecific: selS.length,
          appearance: this._quimeraAppearance(),
          available: all.common.length > 0 || all.specific.length > 0,
          debug: all.debug ?? []
        };
      }
      // Separa talentos COMUNS (gerais) dos de ESPÉCIE (filtrados pela espécie/variante).
      const N = HunterCharacterCreation._norm;
      const allowedKeys = this._allowedSpeciesKeys();
      const isKurta = this._creation.speciesChoice === "kurta";
      const allTalents = await this._getTalents();
      cs.talentFolders = [...new Set(allTalents.map(t => t.folderName || "(sem pasta)"))].sort();
      const common = [], speciesT = [];
      for ( const t of allTalents ) {
        const entry = { ...t, selected: this._creation.talents.includes(t.id) };
        if ( HunterCharacterCreation._isSpeciesFolder(t.folderName) ) {
          const fn = N(t.folderName);
          if ( !allowedKeys.some(k => fn.includes(k)) ) continue;       // não é da espécie/variante atual
          if ( isKurta && N(t.name) === "resiliencia" ) continue;       // Resiliência não vale pra Kurta
          speciesT.push(entry);
        } else common.push(entry);
      }
      cs.commonTalents = common;
      cs.speciesTalents = speciesT;
      cs.talentCount = this._creation.talents.length;
      cs.talentLimit = this._talentLimit();

      // Ajuste de Atributo da espécie — distribuir pontos com −/+ por atributo.
      const bonus = this._creation.abilityBonus ?? {};
      const used = HunterCharacterCreation.#bonusUsed(bonus);
      const total = HunterCharacterCreation.ABILITY_BONUS_POINTS;
      cs.abilityAdjust = {
        total, used, left: total - used,
        rows: HunterCharacterCreation.ABILITY_KEYS.map(k => {
          const base = this._baseAbility(k);
          const add = Number(bonus[k]) || 0;
          return {
            key: k,
            abbr: game.i18n.localize(CONFIG.DND5E.abilities[k]?.abbreviation ?? k).toUpperCase(),
            label: game.i18n.localize(CONFIG.DND5E.abilities[k]?.label ?? k),
            base, add, value: base + add,
            canInc: used < total,
            canDec: add > 0
          };
        })
      };
      context.chosenSpecies = cs;
    }
  }

  static #onChooseSpecies(event, target) {
    this._captureName();
    this._creation.species = target.dataset.speciesId;
    this._creation.speciesName = this._speciesList?.find(s => s.id === this._creation.species)?.name ?? "";
    this._creation.speciesChoice = null; // reseta variante ao trocar de espécie
    this._creation.speciesTraits = { common: [], specific: [] }; // reseta traços
    this.render();
  }

  /** Alterna um talento escolhido (respeitando o limite). */
  static #onToggleTalent(event, target) {
    const id = target.dataset.talentId;
    const arr = this._creation.talents;
    const i = arr.indexOf(id);
    if ( i >= 0 ) { arr.splice(i, 1); }
    else {
      const limit = this._talentLimit();
      if ( arr.length >= limit ) {
        ui.notifications.warn(`Você pode escolher no máximo ${limit} talento(s) nesta espécie/variante.`);
        return;
      }
      if ( this._talentChosenElsewhere(id, { ignore: "species" }) ) {
        ui.notifications.warn("Você já escolheu esse talento em outra etapa.");
        return;
      }
      arr.push(id);
    }
    this.render();
  }

  /** Formiga Quimera: alterna um traço (Comum/Específico), respeitando o máximo. */
  static #onToggleTrait(event, target) {
    const group = target.dataset.group; // "common" | "specific"
    const id = target.dataset.traitId;
    const arr = this._creation.speciesTraits[group];
    if ( !arr ) return;
    const i = arr.indexOf(id);
    if ( i >= 0 ) { arr.splice(i, 1); }
    else {
      const max = group === "common" ? 2 : 3;
      if ( arr.length >= max ) {
        ui.notifications.warn(`Máximo de ${max} traços ${group === "common" ? "comuns" : "específicos"}.`);
        return;
      }
      arr.push(id);
    }
    this.render();
  }

  /** GM: adiciona uma espécie customizada nova e a seleciona para edição. */
  static async #onAddSpecies() {
    this._captureName();
    const list = HunterCharacterCreation.getCustomSpecies();
    const id = foundry.utils.randomID();
    list.push({ id, name: "Nova Espécie", img: "icons/svg/mystery-man.svg", desc: "" });
    await HunterCharacterCreation.setCustomSpecies(list);
    this._creation.species = id;
    this._refreshSpecies();
  }

  /** GM: salva as edições (nome/descrição) da espécie selecionada. */
  static async #onSaveSpecies() {
    const root = this.element;
    const id = this._creation.species;
    const name = root?.querySelector(".hc-sp-name")?.value?.trim();
    const pm = root?.querySelector("prose-mirror[name='hc-sp-desc']");
    const desc = pm?.value ?? this._creation._descBuffer ?? "";
    const list = HunterCharacterCreation.getCustomSpecies();
    const sp = list.find(s => s.id === id);
    if ( !sp ) return;
    sp.name = name || "Sem nome";
    sp.desc = desc;
    await HunterCharacterCreation.setCustomSpecies(list);
    ui.notifications.info(`Espécie "${sp.name}" salva.`);
    this._refreshSpecies();
  }

  /** GM: troca a imagem da espécie selecionada via FilePicker. */
  static async #onSpeciesImage() {
    const id = this._creation.species;
    const list = HunterCharacterCreation.getCustomSpecies();
    const sp = list.find(s => s.id === id);
    if ( !sp ) return;
    const FP = foundry.applications?.apps?.FilePicker?.implementation ?? globalThis.FilePicker;
    if ( !FP ) return;
    new FP({
      type: "image", current: sp.img,
      callback: async (path) => {
        const l2 = HunterCharacterCreation.getCustomSpecies();
        const s2 = l2.find(s => s.id === id);
        if ( s2 ) { s2.img = path; await HunterCharacterCreation.setCustomSpecies(l2); this._refreshSpecies(); }
      }
    }).render(true);
  }

  /** GM: exclui a espécie customizada selecionada. */
  static async #onDeleteSpecies() {
    const id = this._creation.species;
    const list = HunterCharacterCreation.getCustomSpecies().filter(s => s.id !== id);
    await HunterCharacterCreation.setCustomSpecies(list);
    if ( this._creation.species === id ) this._creation.species = null;
    this._refreshSpecies();
  }

  /* -------------------------------------------- */
  /*  Passo: Atributos                            */
  /* -------------------------------------------- */

  static ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

  /** Valor base de um atributo (do passo Atributos), ou fallback. */
  _baseAbility(key) {
    const idx = this._creation.abilities?.[key];
    const pool = this._creation.rolledValues;
    if ( idx != null && Array.isArray(pool) && pool[idx] != null ) return pool[idx];
    return this.actor?.system?.abilities?.[key]?.value ?? 8;
  }

  /** Monta o contexto do passo de Atributos. */
  _prepareAttributesContext(context) {
    const pool = this._creation.rolledValues;
    const assigns = this._creation.abilities ?? {};
    context.attrMethod = this._creation.attrMethod;
    context.methodRoll = this._creation.attrMethod === "roll";
    context.methodLabel = this._creation.attrMethod === "standard" ? "Valores Padrão · 15·14·13·12·10·8"
      : this._creation.attrMethod === "roll" ? "Rolagem · 4d6 (descarta o menor)" : "";
    context.hasRolled = Array.isArray(pool);
    context.rolledSum = context.hasRolled ? pool.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
    // Pool exibido (chips) com marca de "usado"
    context.rolledPool = context.hasRolled
      ? pool.map((v, i) => ({ value: v, used: Object.values(assigns).includes(i) }))
      : [];
    // Por atributo: select com os valores do pool (desabilita os usados por outro)
    context.attrAbilities = HunterCharacterCreation.ABILITY_KEYS.map(key => {
      const conf = CONFIG.DND5E.abilities[key] ?? {};
      const assignedIdx = assigns[key] ?? null;
      const options = context.hasRolled ? pool.map((v, i) => ({
        idx: i, value: v,
        selected: assignedIdx === i,
        // desabilita se outro atributo já usa esse índice
        disabled: (assignedIdx !== i) && Object.entries(assigns).some(([k, ix]) => k !== key && ix === i)
      })) : [];
      return {
        key,
        label: game.i18n.localize(conf.label ?? key),
        abbr: game.i18n.localize(conf.abbreviation ?? key).toUpperCase(),
        value: (assignedIdx != null && context.hasRolled) ? pool[assignedIdx] : null,
        options
      };
    });
    context.allAssigned = context.hasRolled
      && HunterCharacterCreation.ABILITY_KEYS.every(k => assigns[k] != null);

    // ── Hexágono: nós (vértices) + pool central de valores ──
    const pick = this._creation.attrPick;
    context.attrPickActive = (pick != null) && context.hasRolled && !Object.values(assigns).includes(pick);
    // Posição de cada atributo no hexágono (CON topo · FOR/AGI · SAB/ESP · PRE base).
    const HEX_POS = { con: "top", dex: "ur", int: "lr", cha: "bottom", wis: "ll", str: "ul" };
    context.attrNodes = HunterCharacterCreation.ABILITY_KEYS.map(key => {
      const conf = CONFIG.DND5E.abilities[key] ?? {};
      const idx = assigns[key];
      return {
        key, pos: HEX_POS[key] ?? "top",
        label: game.i18n.localize(conf.label ?? key),
        abbr: game.i18n.localize(conf.abbreviation ?? key).toUpperCase(),
        assigned: idx != null && context.hasRolled,
        value: (idx != null && context.hasRolled) ? pool[idx] : null
      };
    });
    context.poolOrbs = context.hasRolled ? pool.map((v, i) => ({
      idx: i, value: v,
      used: Object.values(assigns).includes(i),
      picked: pick === i
    })) : [];
  }

  /** Rola 4d6 (descarta o menor) seis vezes, posta no chat e guarda o pool. */
  static async #onRollAttributes() {
    this._captureName();
    const rolls = [];
    for ( let i = 0; i < 6; i++ ) {
      const r = new Roll("4d6kh3");
      await r.evaluate();
      rolls.push(r);
    }
    const totals = rolls.map(r => Number(r.total));
    // Define o pool ANTES do chat (se o chat falhar, a distribuição ainda funciona).
    this._creation.attrMethod = "roll";
    this._creation.rolledValues = totals;
    this._creation.abilities = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
    this._creation.attrPick = null;
    try {
      if ( game.dice3d ) for ( const r of rolls ) game.dice3d.showForRoll(r, game.user, true);
      const msg = {
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: "🎲 Rolagem de Atributos — 4d6, descarta o menor",
        rolls,
        content: `<div class="hunter-attr-roll">${totals.map(t =>
          `<span style="display:inline-block;min-width:34px;text-align:center;font-weight:700;margin:2px;padding:2px 8px;border:1px solid #888;border-radius:6px;">${t}</span>`
        ).join("")}</div>`
      };
      ChatMessage.applyRollMode(msg, game.settings.get("core", "rollMode"));   // respeita Público/Privado/Cego
      await ChatMessage.create(msg);
    } catch(e) { console.error("HunterCreation | falha ao postar rolagem no chat:", e); }
    this.render();
  }

  /** Usa o array padrão (15, 14, 13, 12, 10, 8). */
  static #onUseStandardArray() {
    this._captureName();
    this._creation.attrMethod = "standard";
    this._creation.rolledValues = [15, 14, 13, 12, 10, 8];
    this._creation.abilities = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
    this._creation.attrPick = null;
    this.render();
  }

  /** Volta à escolha de método (padrão/rolagem). */
  static #onResetAttrMethod() {
    this._captureName();
    this._creation.attrMethod = null;
    this._creation.rolledValues = null;
    this._creation.abilities = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
    this._creation.attrPick = null;
    this.render();
  }

  /** Limpa as atribuições (mantém o pool). */
  static #onClearAttributes() {
    this._captureName();
    this._creation.abilities = { str: null, dex: null, con: null, int: null, wis: null, cha: null };
    this._creation.attrPick = null;
    this.render();
  }

  /** Seleciona/desseleciona um valor do pool central para colocar num atributo. */
  static #onPickPoolValue(event, target) {
    this._captureName();
    const idx = Number(target.dataset.poolIdx);
    if ( Object.values(this._creation.abilities).includes(idx) ) return; // já usado
    this._creation.attrPick = (this._creation.attrPick === idx) ? null : idx;
    this.render();
  }

  /** Clica num atributo: coloca o valor selecionado, ou limpa o atributo se nada estiver selecionado. */
  static #onAssignAttr(event, target) {
    this._captureName();
    const key = target.dataset.ability;
    const pick = this._creation.attrPick;
    if ( pick != null && !Object.values(this._creation.abilities).includes(pick) ) {
      this._creation.abilities[key] = pick;   // coloca (devolve o valor anterior ao pool automaticamente)
      this._creation.attrPick = null;
    } else if ( this._creation.abilities[key] != null ) {
      this._creation.abilities[key] = null;   // sem seleção ativa → limpa este atributo
    }
    this.render();
  }

  /* -------------------------------------------- */
  /*  Ajuste de Atributo da Espécie (+2 ou +1/+1) */
  /* -------------------------------------------- */

  /** Total de pontos de atributo que a espécie concede. */
  static ABILITY_BONUS_POINTS = 2;

  static #bonusUsed(b) {
    return HunterCharacterCreation.ABILITY_KEYS.reduce((s, k) => s + (Number(b?.[k]) || 0), 0);
  }

  static #onBonusInc(event, target) {
    this._captureName();
    const key = target.dataset.ability;
    const b = this._creation.abilityBonus;
    if ( HunterCharacterCreation.#bonusUsed(b) >= HunterCharacterCreation.ABILITY_BONUS_POINTS ) return;
    b[key] = (Number(b[key]) || 0) + 1;
    this.render();
  }

  static #onBonusDec(event, target) {
    this._captureName();
    const key = target.dataset.ability;
    const b = this._creation.abilityBonus;
    if ( (Number(b[key]) || 0) <= 0 ) return;
    b[key] = b[key] - 1;
    this.render();
  }

  /* -------------------------------------------- */
  /*  Navegação                                   */
  /* -------------------------------------------- */

  _goToStep(stepId) {
    if ( !this._activeSteps().some(s => s.id === stepId) ) return;
    this._creation.step = stepId;
    this.render();
  }

  static #onChangeStep(event, target) {
    this._captureName(target);
    this._goToStep(target.dataset.step);
  }

  static #onNext(event, target) {
    this._captureName(target);
    const steps = this._activeSteps();
    const idx = steps.findIndex(s => s.id === this._creation.step);
    const nextStep = steps[idx + 1];
    if ( nextStep ) this._goToStep(nextStep.id);
  }

  static #onPrev(event, target) {
    this._captureName(target);
    const steps = this._activeSteps();
    const idx = steps.findIndex(s => s.id === this._creation.step);
    const prevStep = steps[idx - 1];
    if ( prevStep ) this._goToStep(prevStep.id);
  }

  /** Lê o input de nome do DOM antes de re-renderizar (não perde o que foi digitado). */
  _captureName() {
    const input = this.element?.querySelector("#hunter-creation-name");
    if ( input ) this._creation.name = input.value;
  }

  /* -------------------------------------------- */
  /*  Passo: Categoria                            */
  /* -------------------------------------------- */

  static #onChooseCategory(event, target) {
    this._captureName();
    this._creation.category = target.dataset.categoryId ?? "";
    this._creation.randomCategory = false;
    this._creation.primaryAbility = null; // volta ao padrão da nova categoria
    this.render();
  }

  static #onRandomCategory() {
    this._captureName();
    this._creation.randomCategory = true;
    this._creation.category = "";
    this.render();
  }

  /** Água da Adivinhação: aponta a categoria combinada com o Narrador (ou "aleatorio"). */
  static #onAguaEscolher(event, target) {
    if ( this._creation.aguaRevelada ) return;   // a água já respondeu — não se pergunta duas vezes
    this._creation.aguaEscolha = target.dataset.categoria ?? null;
    this.render();
  }

  /** Água da Adivinhação: o Ren toca a água — a reação acontece e fica registrada. */
  static #onAguaObservar(event, target) {
    if ( this._creation.aguaRevelada ) return;
    const escolha = this._creation.aguaEscolha;
    if ( !escolha ) return void ui.notifications.warn("Aponte uma categoria — ou deixe a água decidir.");
    const ids = HunterCharacterCreation.CATEGORY_IDS;
    const cat = escolha === "aleatorio" ? ids[Math.floor(Math.random() * ids.length)] : escolha;
    this._creation.aguaRevelada = cat;
    // a revelação já deixa a Categoria pré-selecionada no passo seguinte
    // (mesmos efeitos do #onChooseCategory: zera o atributo principal da categoria antiga)
    this._creation.category = cat;
    this._creation.randomCategory = false;
    this._creation.primaryAbility = null;
    this.render();
  }

  static #onChooseOrigin(event, target) {
    this._captureName();
    this._creation.originId = target.dataset.originId ?? null;
    this.render();
  }

  /** Total de pontos de atributo que a origem concede. */
  static ORIGIN_BONUS_POINTS = 2;

  static #onOriginBonusInc(event, target) {
    this._captureName();
    const b = this._creation.originBonus;
    if ( HunterCharacterCreation.#bonusUsed(b) >= HunterCharacterCreation.ORIGIN_BONUS_POINTS ) return;
    b[target.dataset.ability] = (Number(b[target.dataset.ability]) || 0) + 1;
    this.render();
  }

  static #onOriginBonusDec(event, target) {
    this._captureName();
    const b = this._creation.originBonus;
    const k = target.dataset.ability;
    if ( (Number(b[k]) || 0) <= 0 ) return;
    b[k] = b[k] - 1;
    this.render();
  }

  static #onToggleOriginSkill(event, target) {
    this._captureName();
    const key = target.dataset.skill;
    const sel = this._creation.originSkills;
    const i = sel.indexOf(key);
    if ( i >= 0 ) { sel.splice(i, 1); this.render(); return; }
    if ( sel.length >= (this._originSkillCount ?? 0) ) {
      ui.notifications.warn(`Esta origem permite escolher apenas ${this._originSkillCount} perícia(s).`);
      return;
    }
    sel.push(key);
    this.render();
  }

  /* -------------------------------------------- */
  /*  Concluir / Cancelar                         */
  /* -------------------------------------------- */

  static async #onComplete() {
    this._captureName();
    if ( !this.actor ) return this.close();
    const updates = { name: this._creation.name?.trim() || this.actor.name };
    if ( this._creation.img ) updates.img = this._creation.img;
    // Imagem do token (e o token herda o nome do personagem).
    const tokenSrc = this._creation.tokenImg || this._creation.img;
    if ( tokenSrc ) updates["prototypeToken.texture.src"] = tokenSrc;
    if ( updates.name ) updates["prototypeToken.name"] = updates.name;
    // Atributos rolados e distribuídos
    const pool = this._creation.rolledValues;
    if ( Array.isArray(pool) ) {
      for ( const key of HunterCharacterCreation.ABILITY_KEYS ) {
        const idx = this._creation.abilities?.[key];
        if ( idx != null && pool[idx] != null ) updates[`system.abilities.${key}.value`] = pool[idx];
      }
    }
    // Ajuste de Atributo (espécie + origem) — pontos distribuídos por atributo.
    const ab = this._creation.abilityBonus ?? {};
    const ob = this._creation.originBonus ?? {};
    for ( const key of HunterCharacterCreation.ABILITY_KEYS ) {
      const amt = (Number(ab[key]) || 0) + (Number(ob[key]) || 0);
      if ( !amt ) continue;
      const path = `system.abilities.${key}.value`;
      const base = (path in updates) ? updates[path] : (this.actor.system.abilities?.[key]?.value ?? 8);
      updates[path] = base + amt;
    }
    // Proficiência em salvaguarda da origem.
    if ( this._creation.originSave ) updates[`system.abilities.${this._creation.originSave}.proficient`] = 1;
    // Sem Categoria (nível 1): 2 salvaguardas à escolha.
    if ( !this._levelup ) for ( const k of (this._creation.semSaves ?? []) ) {
      if ( CONFIG.DND5E.abilities[k] ) updates[`system.abilities.${k}.proficient`] = 1;
    }
    // Proficiência nas perícias escolhidas na origem.
    for ( const sk of (this._creation.originSkills ?? []) ) {
      if ( CONFIG.DND5E.skills[sk] ) updates[`system.skills.${sk}.value`] = 1;
    }
    // Flag da criação. No nível 2 só atualiza a categoria/primário (preserva o resto).
    if ( this._levelup ) {
      const prevFlag = this.actor.getFlag("hunter-system", "creation") ?? {};
      await this.actor.setFlag("hunter-system", "creation", {
        ...prevFlag,
        category: this._creation.randomCategory ? "random" : (this._creation.category || ""),
        primaryAbility: this._creation.primaryAbility ?? prevFlag.primaryAbility ?? null,
        basicAbilities: [...(this._creation.hbFree ?? [])],   // conjunto REFEITO — substitui, não acumula
        categoryChosenAt: Date.now()
      });
    } else {
      await this.actor.setFlag("hunter-system", "creation", {
        plannedCategory: this._creation.randomCategory ? "random" : (this._creation.category || ""),
        species: this._creation.species ?? null,
        speciesName: this._creation.speciesName ?? null,
        speciesChoice: this._creation.speciesChoice ?? null,
        speciesTraits: this._creation.speciesTraits ?? null,
        talents: this._creation.talents ?? [],
        abilityBonus: this._creation.abilityBonus ?? null,
        origin: this._creation.originId ?? null,
        originBonus: this._creation.originBonus ?? null,
        originSave: this._creation.originSave ?? null,
        originSkills: this._creation.originSkills ?? [],
        defeitos: this._creation.defeitos ?? [],
        customTalents: this._creation.customTalents ?? [],
        combatBranch: this._creation.combatBranch ?? null,
        combatMethods: this._creation.combatMethods ?? [],
        primaryAbility: this._creation.primaryAbility ?? null,
        basicAbilities: [...(this._creation.hbFree ?? [])],
        semSaves: this._creation.semSaves ?? [],
        semTalent: this._creation.semTalent ?? null,
        attrMethod: this._creation.attrMethod ?? null,
        rolledValues: this._creation.rolledValues ?? null,
        abilities: this._creation.abilities ?? null,
        completedAt: Date.now()
      });
    }
    const curLevel = this.actor.system?.details?.level ?? 1;
    await this.actor.update(updates);

    // Nível 2: remove a classe "Sem Categoria" e as HB antigas (recriadas linkadas à nova
    // classe). Espécie, origem, métodos, talentos e defeitos são mantidos.
    if ( this._levelup ) {
      // HBs legadas do fallback foram criadas com o _id do COMPÊNDIO e sem a flag
      // hbItem — sem removê-las, recriar a mesma HB colide o _id (keepId: true).
      const hbIdsCompendio = new Set((await this._getBasicAbilities()).map(h => h.id));
      const del = this.actor.items.filter(i =>
        (i.type === "class" && HunterCharacterCreation._norm(i.name) === "sem categoria")
        || i.getFlag("hunter-system", "hbItem")
        || hbIdsCompendio.has(i.id)
      ).map(i => i.id);
      if ( del.length ) await this.actor.deleteEmbeddedDocuments("Item", del);
    }

    // Marca todo item concedido pela criação (para poder removê-lo no nível 2).
    // O _id do compêndio SEMPRE cai fora — com keepId: true ele colidiria se o
    // ator já tivesse (ou voltasse a ter) o mesmo item; só classe/HB linkadas
    // precisam manter o id (gerado fresco pelo randomID).
    const tag = obj => {
      obj.flags ??= {};
      obj.flags["hunter-system"] = { ...(obj.flags["hunter-system"] ?? {}), creationItem: true };
      delete obj._id;
      return obj;
    };
    const toCreate = [];

    // Espécie
    if ( this._creation.species ) {
      const sp = (await this._getSpecies()).find(s => s.id === this._creation.species);
      if ( sp?.custom ) toCreate.push(tag({
        name: sp.name, type: "feat", img: sp.img,
        system: { description: { value: sp.desc ?? "" } },
        flags: { "hunter-system": { speciesItem: true } }
      }));
      else if ( sp?.uuid ) { const doc = await fromUuid(sp.uuid); if ( doc ) toCreate.push(tag(doc.toObject())); }
    }

    // Origem (background)
    if ( this._creation.originId ) {
      const bg = (await this._getBackgrounds()).find(o => o.id === this._creation.originId);
      if ( bg?.uuid ) { const doc = await fromUuid(bg.uuid); if ( doc ) toCreate.push(tag(doc.toObject())); }
    }

    // Classe: "Sem Categoria" (nível 1) ou a categoria escolhida (nível 2).
    await this._loadCategoryProgressions();
    const catKey = this._levelup
      ? (this._creation.randomCategory ? null : (this._creation.category && this._creation.category !== "sem" ? this._creation.category : null))
      : "sem";
    const classUuid = catKey ? this._catMeta?.[catKey]?.uuid : null;
    let hbLinked = false;
    if ( classUuid ) {
      const doc = await fromUuid(classUuid);
      if ( doc ) {
        const classId = foundry.utils.randomID();
        const obj = tag(doc.toObject());
        obj._id = classId;
        obj.system ??= {};
        obj.system.levels = this._levelup ? Math.max(curLevel, 1) : 1;
        // HP: a criação NÃO roda o flow do advancement de Pontos de Vida, então preenche o
        // `value` por nível à mão — senão getAdjustedTotal soma 0 e hp.max trava em 0.
        // Nível 1 = máximo do dado; demais = média (padrão do dnd5e para a classe original).
        // system.advancement é uma coleção keyed por _id (AdvancementCollectionField), não um array.
        const hpAdv = Object.values(obj.system.advancement ?? {}).find(a => a?.type === "HitPoints");
        if ( hpAdv ) {
          hpAdv.value = { ...(hpAdv.value ?? {}) };
          for ( let l = 1; l <= (obj.system.levels || 1); l++ ) {
            if ( hpAdv.value[l] == null ) hpAdv.value[l] = (l === 1) ? "max" : "avg";
          }
        } else console.warn("[HunterCreation] HP: classe sem advancement de Pontos de Vida — hp.max ficará 0.", obj.name);
        // Atributo Principal escolhido → usado no cálculo de técnicas.
        const primKey = this._creation.primaryAbility || this._catPrimary?.[catKey]?.[0];
        if ( primKey && CONFIG.DND5E.abilities[primKey] ) {
          obj.system.primaryAbility = { value: [primKey], all: true };
          if ( obj.system.spellcasting?.progression && obj.system.spellcasting.progression !== "none" )
            obj.system.spellcasting.ability = primKey;
        }
        // Linka as Habilidades Básicas ao advancement da classe (conta como adquirido).
        try {
          const byLevel = await this._hbByLevel();
          const link = await this._linkHBToClass(obj, classId, byLevel);
          if ( link.found ) { toCreate.push(...link.items); hbLinked = true; }
        } catch ( err ) { console.error("HunterCreation | falha ao linkar HB ao advancement:", err); }
        toCreate.push(obj);
      }
    }

    // Talentos (espécie + liberados por defeitos), defeitos e métodos de combate.
    const featUuids = new Set();
    const bioKindByUuid = new Map();   // uuid → "talento"/"defeito": marca p/ aparecer no seletor da Biografia
    const metodoUuids = new Set();     // métodos de combate → seção "Métodos de Combate" da ficha
    const allTalents = await this._getTalents();
    for ( const id of [...(this._creation.talents ?? []), ...(this._creation.customTalents ?? []),
                       ...(this._creation.semTalent ? [this._creation.semTalent] : [])] ) {
      const t = allTalents.find(x => x.id === id);
      if ( t?.uuid ) { featUuids.add(t.uuid); bioKindByUuid.set(t.uuid, "talento"); }
    }
    const defeitos = await this._getDefeitos();
    const flatDef = defeitos.flatMap(g => g.items);
    for ( const id of (this._creation.defeitos ?? []) ) {
      const d = flatDef.find(x => x.id === id);
      if ( d?.uuid ) { featUuids.add(d.uuid); bioKindByUuid.set(d.uuid, "defeito"); }
    }
    if ( this._creation.combatBranch && this._creation.combatMethods?.length ) {
      const cm = (await this._getCombatMethods())[this._creation.combatBranch] ?? [];
      const flatM = cm.flatMap(g => g.items);
      for ( const id of this._creation.combatMethods ) {
        const m = flatM.find(x => x.id === id);
        if ( m?.uuid ) { featUuids.add(m.uuid); metodoUuids.add(m.uuid); }
      }
    }
    // Fallback: se a classe não tiver advancement de HB, concede as HB como itens
    // soltos — com a flag hbItem (o nível 2 limpa e recria) e SEM o _id do compêndio.
    if ( !hbLinked ) {
      const allHB = await this._getBasicAbilities();
      for ( const id of (this._creation.hbFree ?? []) ) {
        const hb = allHB.find(x => x.id === id);
        if ( !hb?.uuid ) continue;
        const doc = await fromUuid(hb.uuid);
        if ( !doc ) continue;
        const o = tag(doc.toObject());
        foundry.utils.setProperty(o, "flags.hunter-system.hbItem", true);
        foundry.utils.setProperty(o, "flags.hunter-system.featureSection", "jj-basic");
        toCreate.push(o);
      }
    }
    for ( const uuid of featUuids ) {
      try {
        const doc = await fromUuid(uuid);
        if ( !doc ) continue;
        const o = tag(doc.toObject());
        const kind = bioKindByUuid.get(uuid);   // marca talento/defeito p/ o seletor da Biografia
        if ( kind ) foundry.utils.setProperty(o, "flags.hunter-system.bioKind", kind);
        // a ficha agrupa sozinha: método/talento/defeito caem na seção certa
        const secao = metodoUuids.has(uuid) ? "jj-methods"
          : kind === "talento" ? "jj-talents"
          : kind === "defeito" ? "jj-flaws" : null;
        if ( secao ) foundry.utils.setProperty(o, "flags.hunter-system.featureSection", secao);
        toCreate.push(o);
      } catch { /* ignore */ }
    }

    // keepId: true preserva os _id da classe e dos itens de HB (necessário para a
    // linkagem do advancement, que referencia esses IDs em value.added/advancementOrigin).
    if ( toCreate.length ) await this.actor.createEmbeddedDocuments("Item", toCreate, { keepId: true });
    // Vida cheia ao concluir: a criação não roda o flow que preenche hp.value. Só corrige o
    // estado quebrado (Vida ≤ 0); não mexe em quem já tem Vida positiva.
    const hpMax = this.actor.system.attributes.hp.max;
    if ( Number.isFinite(hpMax) && (hpMax > 0) && !(this.actor.system.attributes.hp.value > 0) ) {
      await this.actor.update({ "system.attributes.hp.value": hpMax });
    }
    ui.notifications.info(`${this.actor.name}: ${this._levelup ? "categoria definida" : "criação concluída"}.`);
    await this.close();
    this.actor.sheet?.render(true);
  }

  static async #onCancel() {
    await this.close();
  }
}
