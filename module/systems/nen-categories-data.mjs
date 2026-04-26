/**
 * nen-categories-data.mjs
 * Hunter Legacy — Dados das Categorias Nen (HxH)
 *
 * Estrutura por categoria:
 *   minor: habilidades menores — adquiridas automaticamente ao atingir o nível (2, 5, 8)
 *   major: habilidades principais — desbloqueadas pelo jogador (3, 6, 10)
 *
 * Especialista não tem habilidades menores.
 */

export const NEN_CATEGORIES_DATA = {

  // ══════════════════════════════════════════════════════
  // APRIMORADOR
  // ══════════════════════════════════════════════════════
  aprimorador: {
    label: "Aprimorador",
    abbrev: "APR",
    color: "#E8A800",
    minor: {
      2: {
        id: "robusto_1",
        label: "Robusto ★",
        stars: 1,
        description: "Recebe vida adicional igual ao seu nível de personagem, recebendo 1 PV adicional a cada nível posterior.",
        type: "minor"
      },
      5: {
        id: "robusto_2",
        label: "Robusto ★★",
        stars: 2,
        description: "Recebe vida adicional igual a 2 vezes seu nível de personagem, recebendo 2 PVs adicionais a cada nível posterior.",
        type: "minor"
      },
      8: {
        id: "robusto_3",
        label: "Robusto ★★★",
        stars: 3,
        description: "Recebe vida adicional igual a 3 vezes seu nível de personagem, recebendo 3 PVs adicionais a cada nível posterior.",
        type: "minor"
      }
    },
    major: {
      3: {
        id: "ofensivaAprimorada",
        label: "Ofensiva Aprimorada",
        description: "Seu dado de dano base se torna d12. Adicionalmente, você pode adicionar 1 dado a mais no seu \"Explosão Ofensiva\" para cada 2 níveis que tiver atingido no treinamento de aprimorador.",
        type: "major"
      },
      6: {
        id: "resistenciaAprimorada",
        label: "Resistência Aprimorada",
        description: "Você recebe 3 Pontos de Armadura no Foco Defensivo para cada nível de treinamento de aprimorador que você se encontra.",
        type: "major"
      },
      10: {
        id: "corpoAprimorado",
        label: "Corpo Aprimorado",
        description: "Você se torna capaz de utilizar aura para aprimorar certos aspectos do seu corpo ao consumir 2 Pontos de Aura: Voz Aprimorada (audível por até 3 km), Musculatura Aprimorada (triplica carga), Atributos Aprimorados (1d4 na próxima rolagem de perícia, exceto Nen), Regeneração Aprimorada (role 1 dado de vida como descanso curto, consome 1 dado).",
        type: "major",
        exclusive: true
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // EMISSOR
  // ══════════════════════════════════════════════════════
  emissor: {
    label: "Emissor",
    abbrev: "EMI",
    color: "#B8860B",
    minor: {
      2: {
        id: "agilidadeAvancada_1",
        label: "Agilidade Avançada ★",
        stars: 1,
        description: "Você recebe 1,5 metros de deslocamento, até um máximo de 15 metros, e ignora reações geradas pelo seu movimento como \"Ataque de Oportunidade\".",
        type: "minor"
      },
      5: {
        id: "agilidadeAvancada_2",
        label: "Agilidade Avançada ★★",
        stars: 2,
        description: "Você recebe 3 metros de deslocamento, até um máximo de 15 metros, e ignora reações geradas pelo seu movimento — inclusive aquelas que normalmente ignorariam esse tipo de característica, como \"Ataque de Oportunidade Superior\".",
        type: "minor"
      },
      8: {
        id: "agilidadeAvancada_3",
        label: "Agilidade Avançada ★★★",
        stars: 3,
        description: "Você recebe 6 metros de deslocamento, até um máximo de 18 metros, e ignora terreno difícil, bem como reações geradas pelo seu movimento — inclusive aquelas que normalmente ignorariam esse tipo de característica, como \"Ataque de Oportunidade Superior\".",
        type: "minor"
      }
    },
    major: {
      3: {
        id: "emissaoTreinada",
        label: "Emissão Treinada",
        description: "Você pode substituir cada uma de suas jogadas de ataque (Comuns) por um ataque a distância de 3 metros. Você recebe 1,5 metros adicionais para cada nível no treinamento de Emissor.",
        type: "major"
      },
      6: {
        id: "reabsorcaoDeAura",
        label: "Reabsorção de Aura",
        description: "Ao executar uma técnica que envolva lacaios ou constructs, você pode consumir toda sua aura máxima para tornar a duração \"Especial\" (ativa até desativação manual). Ao cancelar, recupera aura atual e máxima se mais da metade dos lacaios ainda estiverem ativos. Alternativamente, ao alcançar toque em uma técnica sob \"Emissão de Aura\", recupera metade da aura gasta mais a aura gerada.",
        type: "major"
      },
      10: {
        id: "atravessarMateria",
        label: "Atravessar Matéria",
        description: "Uma vez por descanso curto ou longo, você pode executar uma técnica que irá ignorar qualquer objeto ou estrutura em seu caminho, acertando automaticamente se o alvo estiver surpreso ou realizando uma jogada de ataque (de Técnica) de outra forma. Essa técnica pode ser comum e neutra como uma técnica de princípio.",
        type: "major",
        exclusive: true
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // TRANSMUTADOR
  // ══════════════════════════════════════════════════════
  transmutador: {
    label: "Transmutador",
    abbrev: "TRA",
    color: "#9B59D0",
    minor: {
      2: {
        id: "aumentarDensidade_1",
        label: "Aumentar Densidade ★",
        stars: 1,
        description: "Sua Classe de Resistência aumenta em +1, até um máximo de 25. Esse efeito é sempre aplicado por último.",
        type: "minor"
      },
      5: {
        id: "aumentarDensidade_2",
        label: "Aumentar Densidade ★★",
        stars: 2,
        description: "Sua Classe de Resistência aumenta em +2, até um máximo de 28. Esse efeito é sempre aplicado por último.",
        type: "minor"
      },
      8: {
        id: "aumentarDensidade_3",
        label: "Aumentar Densidade ★★★",
        stars: 3,
        description: "Sua Classe de Resistência aumenta em +3, até um máximo de 30. Esse efeito é sempre aplicado por último.",
        type: "minor"
      }
    },
    major: {
      3: {
        id: "auraTraicoeira",
        label: "Aura Traiçoeira",
        description: "Você pode mudar livremente seu dano entre Contundente, Cortante ou Perfurante ao criar armas de aura enquanto mantém sua concentração. Adicionalmente, você recebe +1 de dano no Jogo Sujo ou Manto Elemental para cada 2 níveis no treinamento de transmutador. Caso não seja um transmutador, você passa a causar dano com a mesma regra do Golpe Traiçoeiro, mas apenas o dano adquirido por treinar esses níveis.",
        type: "major"
      },
      6: {
        id: "transmutacaoSutil",
        label: "Transmutação Sutil",
        description: "Ao usar uma ação bônus e 5 Pontos de Aura, você pode escolher ignorar a resistência da criatura e qualquer efeito de aumento de CR que mude ela para qualquer outra que não seja a base até o fim do turno.",
        type: "major"
      },
      10: {
        id: "períciaTranmutadora",
        label: "Perícia Transmutadora",
        description: "Você pode escolher um elemento ligado ao seu Hatsu e uma condição causada por sua transmutação, ganhando resistência ao dano desse tipo e vantagem contra a condição. Alternativamente, pode obter imunidade ao dano ou à condição. Além disso, pode definir uma forma para sua aura — animal, demônio, objeto etc. Sempre que atacar (Comum ou Técnica), pode gastar 3 PA para aumentar seu alcance de \"Toque\" em 3 metros até o fim do turno.",
        type: "major",
        exclusive: true
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // CONJURADOR
  // ══════════════════════════════════════════════════════
  conjurador: {
    label: "Conjurador",
    abbrev: "CON",
    color: "#3A8FD4",
    minor: {
      2: {
        id: "auraAdaptavel_1",
        label: "Aura Adaptável ★",
        stars: 1,
        description: "Você recebe 3 vezes o seu Modificador de Espírito em Pontos de Vida adicionais.",
        type: "minor"
      },
      5: {
        id: "auraAdaptavel_2",
        label: "Aura Adaptável ★★",
        stars: 2,
        description: "Você recebe 4 vezes o seu Modificador de Espírito em Pontos de Vida adicionais.",
        type: "minor"
      },
      8: {
        id: "auraAdaptavel_3",
        label: "Aura Adaptável ★★★",
        stars: 3,
        description: "Você recebe 5 vezes o seu Modificador de Espírito em Pontos de Vida adicionais.",
        type: "minor"
      }
    },
    major: {
      3: {
        id: "focoConjurador",
        label: "Foco Conjurador",
        description: "Você se torna capaz de conjurar itens da categoria \"Pequeno\", seja como foco da sua habilidade ou como parte dela, caso não seja um conjurador. O tamanho dos itens que você pode conjurar aumenta em 1 a cada 2 níveis adquiridos no Treinamento de Conjurador. Além disso, a cada 2 níveis nesse treinamento, você consome 1 PA a menos para ativar uma habilidade de conjuração (manifestação) que não seja de dano direto.",
        type: "major"
      },
      6: {
        id: "mudandoOJogo",
        label: "Mudando o Jogo",
        description: "Ao errar uma jogada de acerto (Comum ou de Técnica), você pode escolher ter um sucesso no acerto no lugar. Você pode usar essa característica um número de vezes igual ao seu bônus de proficiência. Você não pode utilizá-la novamente até realizar um descanso longo de pelo menos 4 horas.",
        type: "major"
      },
      10: {
        id: "liberacaoConjuradora",
        label: "Liberação Conjuradora",
        description: "Ao usar um ou mais dados de conjurador para qualquer coisa, você pode pegar o resultado dos 2 primeiros dados rolados nesse turno e gerar Pontos de Aura igual ao resultado da rolagem. Qualquer resultado além dos 2 primeiros dados rolados de uma única vez não conta para essa característica. Adicionalmente, você passa a poder usar dados de aura como dados de conjurador para ativar suas características.",
        type: "major",
        exclusive: true
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // MANIPULADOR
  // ══════════════════════════════════════════════════════
  manipulador: {
    label: "Manipulador",
    abbrev: "MAN",
    color: "#2ECC71",
    minor: {
      2: {
        id: "auraControlada_1",
        label: "Aura Controlada ★",
        stars: 1,
        description: "Sua capacidade de comandar a aura faz com que ela sempre seja capaz de percorrer o corpo de seus alvos causando a maior quantidade de malefícios possíveis. Até 3 vezes por descanso longo, você pode rolar duas vezes um dado de dano de um ataque ou técnica e escolher o maior resultado.",
        type: "minor"
      },
      5: {
        id: "auraControlada_2",
        label: "Aura Controlada ★★",
        stars: 2,
        description: "Até 5 vezes por descanso longo, você pode rolar duas vezes um dado de dano de um ataque ou técnica e escolher o maior resultado.",
        type: "minor"
      },
      8: {
        id: "auraControlada_3",
        label: "Aura Controlada ★★★",
        stars: 3,
        description: "Toda vez que você fizer uma rolagem de dano, você pode rolar uma segunda vez e escolher o maior resultado.",
        type: "minor"
      }
    },
    major: {
      3: {
        id: "objetoConfigurado",
        label: "Objeto Configurado",
        description: "Você pode criar objetos simples capazes de armazenar comandos de Nen. Os itens infundidos com sua aura possuem 30 Pontos de Armadura e 3 de CR para cada nível alcançado no Treinamento de Manipulador. Além disso, você pode manter simultaneamente um item criado para cada nível acima do 3º que alcançar no Treinamento de Manipulador.",
        type: "major"
      },
      6: {
        id: "criacaoDeEgo",
        label: "Criação de Ego",
        description: "Qualquer criatura ou objeto que você manipule pode receber instruções adicionais de aura, desenvolvendo uma forma de ego capaz de se comunicar. Caso seja um lacaio comum, ele passa a ter a capacidade de falar como uma pessoa. Você pode manter apenas um objeto desse tipo por vez ou até 5 lacaios criados por sua habilidade. Enquanto possuir uma existência dotada de ego, você pode atacar e utilizar técnicas através dela, gastando suas ações como se estivesse no local onde ela se encontra.",
        type: "major"
      },
      10: {
        id: "comandosAvancados",
        label: "Comandos Avançados",
        description: "Você pode escolher entre reduzir o custo de ativação de suas habilidades em 3 PA (mínimo de 1) ou o custo de suas técnicas em 1 PA. Qualquer objeto ou criatura sob seu controle continuará executando ações mesmo que você fique inconsciente. Se o objeto não possuir PV e CR próprios, ele passa a ter 150 PV e 20 de CR.",
        type: "major",
        exclusive: true
      }
    }
  },

  // ══════════════════════════════════════════════════════
  // ESPECIALISTA
  // ══════════════════════════════════════════════════════
  especialista: {
    label: "Especialista",
    abbrev: "ESP",
    color: "#AAAAAA",
    minor: {},
    major: {
      3: {
        id: "ativacaoEficiente",
        label: "Ativação Eficiente",
        description: "Você pode ter até 4 técnicas no total com efeitos de especialização, caso não seja um especialista. Além disso, você pode optar por reduzir o custo de ativação da sua habilidade em 3 PA (com mínimo equivalente à metade do custo total) ou reduzir o custo de todas as suas técnicas em 1 PA. A redução de custo só se aplica a especialistas e não se acumula com efeitos semelhantes.",
        type: "major"
      },
      6: {
        id: "entendimento",
        label: "Entendimento",
        description: "Você possui extrema facilidade em treinar qualquer categoria. Ao treinar qualquer categoria que não seja \"Especialista\" e cujo nível esteja abaixo do seu nível de treinamento de especialista, você consome apenas metade dos Pontos de Treinamento (arredondados para cima). Além disso, ao atingir o 10º nível de treinamento em uma categoria, você pode receber uma segunda \"habilidade de categoria\", além da habilidade de especialista.",
        type: "major"
      },
      10: {
        id: "movimentoEspecializado",
        label: "Movimento Especializado",
        description: "A movimentação de sua aura se tornou algo tão instintivo que você pode movê-la sem esforço. Até 3 vezes por descanso longo, ao usar a forma alternativa do Movimento Empoderado, você pode escolher receber uma Ação de Poder no lugar da ação bônus. Caso você receba esse efeito sem possuir Movimento Empoderado, você o recebe, mas sem a modificação dessa habilidade.",
        type: "major",
        exclusive: true
      }
    }
  }
};

/**
 * Retorna as habilidades menores desbloqueadas para uma categoria dado o nível.
 */
export function getUnlockedMinorAbilities(categoryId, level) {
  const cat = NEN_CATEGORIES_DATA[categoryId];
  if ( !cat ) return [];
  return Object.entries(cat.minor)
    .filter(([lvl]) => parseInt(lvl) <= level)
    .map(([, ability]) => ability);
}

/**
 * Retorna as habilidades principais disponíveis para desbloqueio dado o nível.
 */
export function getAvailableMajorAbilities(categoryId, level) {
  const cat = NEN_CATEGORIES_DATA[categoryId];
  if ( !cat ) return [];
  return Object.entries(cat.major)
    .filter(([lvl]) => parseInt(lvl) <= level)
    .map(([lvl, ability]) => ({ ...ability, requiredLevel: parseInt(lvl) }));
}


/**
 * Tabela de custos por nível — igual para todas as categorias.
 * Índice = nível (1-10)
 */
export const NEN_LEVEL_COSTS = {
  1:  { pt: 1,  pa: 15,  cd: 14 },
  2:  { pt: 2,  pa: 30,  cd: 16 },
  3:  { pt: 3,  pa: 45,  cd: 18 },
  4:  { pt: 4,  pa: 60,  cd: 20 },
  5:  { pt: 5,  pa: 90,  cd: 22 },
  6:  { pt: 6,  pa: 100, cd: 24 },
  7:  { pt: 7,  pa: 120, cd: 26 },
  8:  { pt: 8,  pa: 140, cd: 28 },
  9:  { pt: 9,  pa: 160, cd: 29 },
  10: { pt: 10, pa: 210, cd: 30 }
};

/**
 * Afinidade entre categorias — define o nível máximo que cada categoria
 * pode treinar em outra, baseado no diagrama hexagonal.
 * 100%→10, 80%→8, 60%→6, 40%→4, 1%→8(especialista), 0%→bloqueado
 */
export const NEN_AFFINITY = {
  aprimorador:  { aprimorador: 10, transmutador: 8, emissor: 8, conjurador: 6, manipulador: 6, especialista: 0 },
  emissor:      { emissor: 10, aprimorador: 8, manipulador: 8, transmutador: 6, conjurador: 4, especialista: 0 },
  transmutador: { transmutador: 10, aprimorador: 8, conjurador: 8, emissor: 6, manipulador: 4, especialista: 0 },
  manipulador:  { manipulador: 10, emissor: 8, conjurador: 6, aprimorador: 6, transmutador: 4, especialista: 8 },
  conjurador:   { conjurador: 10, transmutador: 8, manipulador: 6, aprimorador: 6, emissor: 4, especialista: 8 },
  especialista: { especialista: 10, aprimorador: 10, emissor: 10, transmutador: 10, conjurador: 10, manipulador: 10 }
};

/**
 * Retorna o nível máximo que um ator pode atingir em uma categoria,
 * baseado na categoria principal da sua classe.
 */
export function getMaxLevelForCategory(actor, targetCategoryId) {
  const CATEGORIES = ["aprimorador", "emissor", "transmutador", "conjurador", "manipulador", "especialista"];

  // 1. Detecta categoria principal pela classe na ficha
  let mainCategory = null;
  for ( const catId of CATEGORIES ) {
    const cls = Object.values(actor.classes ?? {}).find(c =>
      c.identifier === catId ||
      c.system?.identifier === catId ||
      c.name?.toLowerCase() === catId ||
      c.name?.toLowerCase() === NEN_AFFINITY[catId] // fallback
    );
    if ( cls ) { mainCategory = catId; break; }
  }

  // 2. Fallback: categoria com maior nível em nenCategories
  if ( !mainCategory ) {
    let maxLevel = 0;
    for ( const catId of CATEGORIES ) {
      const lvl = actor.system?.nenCategories?.[catId]?.level ?? 0;
      if ( lvl > maxLevel ) { maxLevel = lvl; mainCategory = catId; }
    }
  }

  if ( !mainCategory ) return 10; // Sem categoria definida, permite tudo

  return NEN_AFFINITY[mainCategory]?.[targetCategoryId] ?? 0;
}
