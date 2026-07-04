/**
 * Dados estáticos dos Princípios de Nen (Cap. 7.5)
 * e dos Treinamentos (Cap. 6.5)
 *
 * Estrutura: cada habilidade pertence a um "princípio" (ten, zetsu, ren, hatsu, gyo, shu, in, en, ryu, ken, ko)
 * Os 4 primeiros (ten, zetsu, ren, hatsu) são FUNDAMENTAIS — desbloqueados pelo mestre, sem custo de PM.
 * Os demais são AVANÇADOS — requerem estágio e PM investido.
 */

// ============================================================
// HABILIDADES POR PRINCÍPIO
// ============================================================

export const MANIPULATION_ABILITIES = {

  // ── TEN ─────────────────────────────────────────────────
  defesaAura: {
    category: "ten",
    principle: "ten",
    label: "Defesa de Aura",
    stage: "beginner",
    cost: 3,
    description: "Você reduz todo dano sem aura pela metade.",
    techniques: ["Ten - Defesa Sólida"],
    requires: { stage: "beginner", abilities: [], principle: "ten" }
  },
  movimentacaoRapida: {
    category: "ten",
    principle: "ten",
    label: "Movimentação Rápida",
    stage: "expert",
    cost: 6,
    description: "Quando estiver fora de combate, você pode dobrar seu deslocamento padrão e utilizar disparada por quanto tempo quiser sem receber nenhum nível de exaustão. Esse efeito consome 1 PA na sua ativação e 1 PA adicional a cada 5 minutos.",
    techniques: [],
    requires: { stage: "expert", abilities: [], principle: "ten" }
  },
  defesaElevada: {
    category: "ten",
    principle: "ten",
    label: "Defesa Elevada",
    stage: "beginner",
    cost: 6,
    description: "Antes de reduzir o dano pela metade, você reduz o dano sofrido em 15 Pontos de Dano.",
    techniques: [],
    requires: { stage: "beginner", abilities: ["defesaAura"], principle: "ten" }
  },

  // ── ZETSU ───────────────────────────────────────────────
  supressaoAura: {
    category: "zetsu",
    principle: "zetsu",
    label: "Supressão de Aura",
    stage: "beginner",
    cost: 3,
    description: "Enquanto em Zetsu, você recebe +5 em Testes de Atributo de Agilidade (Furtividade).",
    techniques: ["Zetsu – Anular Presença"],
    requires: { stage: "beginner", abilities: [], principle: "zetsu" }
  },
  recuperacaoAcelerada: {
    category: "zetsu",
    principle: "zetsu",
    label: "Recuperação Acelerada",
    stage: "beginner",
    cost: 6,
    description: "Enquanto em Zetsu, você pode realizar descansos curtos e longos na metade do tempo padrão.",
    techniques: [],
    requires: { stage: "beginner", abilities: [], principle: "zetsu" }
  },
  mestreZetsu: {
    category: "zetsu",
    principle: "zetsu",
    label: "Mestre de Zetsu",
    stage: "master",
    cost: 10,
    description: "Você recebe proficiência em Testes de Atributo de Furtividade. Caso já possua, você recebe maestria.",
    techniques: [],
    requires: { stage: "master", abilities: ["supressaoAura"], principle: "zetsu" }
  },

  // ── REN ─────────────────────────────────────────────────
  explosaoOfensiva: {
    category: "ren",
    principle: "ren",
    label: "Explosão Ofensiva",
    stage: "beginner",
    cost: 3,
    description: "Você pode adicionar até um número de d4 no seu próximo ataque ou dados de dano de sua técnica até um valor igual ao seu bônus de proficiência. Você consome 1 PA para cada dado aumentado. Esse efeito pode ser utilizado em técnicas e habilidades de cura, mas você gasta 2 PA para cada dado.",
    techniques: ["Ren – Explosão de Aura", "Ren - Parede de Aura"],
    requires: { stage: "beginner", abilities: [], principle: "ren" }
  },
  explosaoDefensiva: {
    category: "ren",
    principle: "ren",
    label: "Explosão Defensiva",
    stage: "beginner",
    cost: 3,
    description: "Você pode gastar 1 PA para reduzir 1d4 de dano sofrido ou 2 dados de redução a sua próxima técnica redução, até um máximo igual o valor da sua aura disponível na rodada. A versão de 2 dados de redução não funciona em técnicas similares ao Transferência Rápida, que reduz o dano de cada um de seus ataques em um valor de d8 fixo.",
    techniques: [],
    requires: { stage: "beginner", abilities: [], principle: "ren" }
  },
  ultimoRecurso: {
    category: "ren",
    principle: "ren",
    label: "Último Recurso",
    stage: "expert",
    cost: 6,
    description: "Até 3 vezes por descanso longo, ao sofrer dano crítico de uma jogada de ataque (Comum), você pode escolher sofrer o dano normal. Adicionalmente, uma quantidade de vezes quaisquer, ao sofrer dano crítico de uma técnica, você pode escolher gastar 6 Pontos de Aura para sofrer o dano normal.",
    techniques: [],
    requires: { stage: "expert", abilities: ["explosaoDefensiva"], principle: "ren" }
  },

  // ── HATSU ───────────────────────────────────────────────
  auraAssassina: {
    category: "hatsu",
    principle: "hatsu",
    label: "Aura Assassina",
    stage: "beginner",
    cost: 3,
    description: "Você pode usar uma ação de poder para realizar uma jogada de ataque contra uma criatura que não possa utilizar aura. Você consome 2 Pontos de Aura e remove 4 Pontos de Vitalidade (PVE) dela.",
    techniques: ["Hatsu – Sede de Sangue"],
    requires: { stage: "beginner", abilities: [], principle: "hatsu" }
  },
  despertarAura: {
    category: "hatsu",
    principle: "hatsu",
    label: "Despertar Aura",
    stage: "beginner",
    cost: 6,
    description: "Você pode tocar uma criatura usando sua ação para enviar sua aura para dentro do corpo dela e abrir seus nós de aura, despertando a capacidade dela de utilizar aura. Para isso, você deve realizar um Teste de Atributo de Espírito (Nen) CD 16. Em caso de falha, ela recebe o dobro do dano do \"Aura Assassina\".",
    techniques: [],
    requires: { stage: "beginner", abilities: [], principle: "hatsu" }
  },
  habilidadeEspecial: {
    category: "hatsu",
    principle: "hatsu",
    label: "Habilidade Especial",
    stage: "beginner",
    cost: 3,
    description: "Desde que você possua Aura Assassina ou Despertar Aura, você pode pegar essa habilidade e liberar acesso ao seu Hatsu de acordo com o Manual Shingen-Ryu.",
    techniques: [],
    requires: { stage: "beginner", abilities: ["auraAssassina"], principle: "hatsu" }
  },

  // ── GYO ─────────────────────────────────────────────────
  pontoFraco: {
    category: "gyo",
    principle: "gyo",
    label: "Ponto Fraco",
    stage: "beginner",
    cost: 3,
    description: "Você pode utilizar uma ação bônus e 2 PA para realizar um Teste de Atributo de Espírito (Nen) com CD igual a 10 + ND da criatura para tentar encontrar um ponto fraco em seu corpo, se houver um. Caso contrário, você recebe duas informações entre ND, CR, PV atual, Resistências e Vulnerabilidades (à escolha do narrador). Você pode utilizar essa habilidade uma vez por criatura a cada descanso longo.",
    techniques: ["Salto Concentrado", "Investida Focada (4 PA)", "Sentidos Aprimorados", "Gyo – Foco Rápido", "Gyo – Golpe Devastador"],
    requires: { stage: "beginner", abilities: [], principle: "gyo" }
  },
  focoAgressivo: {
    category: "gyo",
    principle: "gyo",
    label: "Foco Agressivo",
    stage: "expert",
    cost: 6,
    description: "Suas jogadas de ataque (Comuns) recebem 1d4 de dano adicional.",
    techniques: [],
    requires: { stage: "expert", abilities: ["explosaoOfensiva"], principle: "gyo" }
  },
  focoDefensivo: {
    category: "gyo",
    principle: "gyo",
    label: "Foco Defensivo",
    stage: "expert",
    cost: 6,
    description: "Você envolve seu corpo com uma camada extra de aura, criando 20 Pontos de Armadura. Funcionam como PV temporários, mas coexistem com eles, são sempre consumidos primeiro e duram até o fim do encontro. Os Pontos de Armadura são totalmente restaurados após 10 minutos sem utilizar aura. Você não pode utilizar Foco Agressivo e Defensivo ao mesmo tempo.",
    techniques: [],
    requires: { stage: "expert", abilities: ["explosaoDefensiva"], principle: "gyo" }
  },
  analiseSuperior: {
    category: "gyo",
    principle: "gyo",
    label: "Análise Superior",
    stage: "master",
    cost: 10,
    description: "Quando uma criatura utilizar uma característica qualquer e você estiver com seu \"Detectar Aura\" ativo, você pode realizar um Teste de Atributo de Espírito (Nen) com CD igual o ND da criatura para saber exatamente o que a característica faz.",
    techniques: [],
    requires: { stage: "master", abilities: ["pontoFraco"], principle: "gyo" }
  },

  // ── SHU ─────────────────────────────────────────────────
  envolverObjeto: {
    category: "shu",
    principle: "shu",
    label: "Envolver Objeto",
    stage: "expert",
    cost: 3,
    description: "Você pode envolver objetos com sua aura aplicando dois dos seguintes efeitos: a Classe de Resistência do Objeto se torna igual a sua; o objeto passa a dar o dobro de dano em objetos e estruturas; o objeto recebe 50 Pontos de Armadura de acordo com as regras do Foco Defensivo; o dano base do objeto se torna 1d10 e você pode arremessa-lo no alcance do seu Emissão Treinada.",
    techniques: ["Shu - Revestimento"],
    requires: { stage: "expert", abilities: [], principle: "shu" }
  },
  escritaNen: {
    category: "shu",
    principle: "shu",
    label: "Escrita de Nen",
    stage: "expert",
    cost: 3,
    description: "Ao colocar Aura na ponta dos dedos, você pode escrever algo em uma superfície. Pode ser utilizado em conjunto com In para tornar a escrita invisível por até 2 horas.",
    techniques: [],
    requires: { stage: "expert", abilities: [], principle: "shu" }
  },

  // ── IN ──────────────────────────────────────────────────
  ocultacao: {
    category: "in",
    principle: "in",
    label: "Ocultação",
    stage: "expert",
    cost: 6,
    description: "Suas jogadas de ataque (Comuns e de Técnica) passam a receber +3 de acerto.",
    techniques: ["Ocultação Completa"],
    requires: { stage: "expert", abilities: [], principle: "in" }
  },
  mestreIn: {
    category: "in",
    principle: "in",
    label: "Mestre de In",
    stage: "master",
    cost: 10,
    description: "Você sempre está com o \"Ocultação Completa\" ativo fora de combate sem consumir Pontos de Aura.",
    techniques: [],
    requires: { stage: "master", abilities: ["ocultacao"], principle: "in" }
  },

  // ── EN ──────────────────────────────────────────────────
  sensitivo: {
    category: "en",
    principle: "en",
    label: "Sensitivo",
    stage: "expert",
    cost: 3,
    description: "Ao ser alvo de uma jogada de ataque dentro ou fora da área do seu En, você pode escolher ser atingido automaticamente para ver a direção exata em que o ataque veio, recebendo vantagem e +10 em Testes de Percepção para encontrar a criatura que o atacou.",
    techniques: ["Sentido Verdadeiro"],
    requires: { stage: "expert", abilities: [], principle: "en" }
  },
  aprimorarSentidos: {
    category: "en",
    principle: "en",
    label: "Aprimorar Sentidos",
    stage: "expert",
    cost: 3,
    description: "Você recebe +2 no Teste de Atributo de Espírito (Percepção) da ativação do seu En. Essa habilidade pode ser adquirida diversas vezes, aumentando em +2 a cada vez que você a comprar.",
    techniques: [],
    requires: { stage: "expert", abilities: [], principle: "en" }
  },
  expansaoAuraEn: {
    category: "en",
    principle: "en",
    label: "Expansão de Aura",
    stage: "expert",
    cost: 3,
    description: "A área do seu En aumenta para 6 metros. Você pode adquirir essa habilidade diversas vezes, aumentando seu alcance em 6 metros a cada vez. Se você usar um 1/3 do seu alcance, você não consome aura por rodada.",
    techniques: [],
    requires: { stage: "expert", abilities: [], principle: "en" }
  },

  // ── RYU ─────────────────────────────────────────────────
  fluxoVeloz: {
    category: "ryu",
    principle: "ryu",
    label: "Fluxo Veloz",
    stage: "expert",
    cost: 6,
    description: "Você pode manter o Foco Agressivo e Foco Defensivo ativos o tempo inteiro.",
    techniques: ["Ryu - Controle de Aura", "Ryu – Transferência Rápida"],
    requires: { stage: "expert", abilities: [], principle: "ryu" }
  },
  fluxoPerfeito: {
    category: "ryu",
    principle: "ryu",
    label: "Fluxo Perfeito",
    stage: "expert",
    cost: 10,
    description: "A margem de acerto crítico de suas jogadas de ataque (Comuns e de Técnica) se torna 19-20.",
    techniques: [],
    requires: { stage: "expert", abilities: ["fluxoVeloz"], principle: "ryu" }
  },
  fluxoConstante: {
    category: "ryu",
    principle: "ryu",
    label: "Fluxo Constante",
    stage: "expert",
    cost: 10,
    description: "O dano do seu Foco Agressivo aumenta em um passo e seu Foco Defensivo recebe 20 PV temporários adicionais.",
    techniques: [],
    requires: { stage: "expert", abilities: [], principle: "ryu" }
  },
  ativacaoFluxo: {
    category: "ryu",
    principle: "ryu",
    label: "Ativação de Fluxo",
    stage: "master",
    cost: 15,
    description: "Enquanto você estiver com \"Fluxo Veloz\" ativo, você pode aumentar um número de dados de dano do \"Explosão Ofensiva\" igual ao dobro do bônus de proficiência no lugar do original.",
    techniques: [],
    requires: { stage: "master", abilities: ["fluxoConstante"], principle: "ryu" }
  },

  // ── KEN ─────────────────────────────────────────────────
  disputaAura: {
    category: "ken",
    principle: "ken",
    label: "Disputa de Aura",
    stage: "master",
    cost: 10,
    description: "Quando você for alvo de um efeito intrusivo de Nen, como \"Supressão de Aura\", ou de uma condição ou efeito negativo qualquer, você pode usar sua reação e gastar 10 Pontos de Aura e realizar um Teste Resistido de Espírito (Nen) contra a mesma perícia da criatura. Em caso de sucesso, você nega o efeito e fica imune a ele até o fim do seu turno atual.",
    techniques: ["Defesa Absoluta"],
    requires: { stage: "master", abilities: [], principle: "ken" }
  },
  muralhaAura: {
    category: "ken",
    principle: "ken",
    label: "Muralha de Aura",
    stage: "master",
    cost: 15,
    description: "Uma vez por descanso longo, quando você for alvo de uma jogada de ataque (Comum ou de Técnica) ou tiver que realizar uma Salvaguarda para tomar todo ou metade do dano, você pode usar sua reação para reduzir o dano sobre você e toda criatura em um cone de 12 metros atrás de você a 0.",
    techniques: [],
    requires: { stage: "master", abilities: [], principle: "ken" }
  },

  // ── KO ──────────────────────────────────────────────────
  acumuloExtremo: {
    category: "ko",
    principle: "ko",
    label: "Acúmulo Extremo",
    stage: "master",
    cost: 10,
    description: "Ao pagar 4 Pontos de Aura, você pode fazer com que seu próximo dano se torne do tipo \"Verdadeiro\".",
    techniques: ["Ko – Ofensiva Absoluta", "Bloqueio Emergencial"],
    requires: { stage: "master", abilities: [], principle: "ko" }
  },
  mestreKo: {
    category: "ko",
    principle: "ko",
    label: "Mestre de Ko",
    stage: "master",
    cost: 15,
    description: "Você pode colocar quantos dados de dano quiser pelo \"Explosão Ofensiva\" até um limite igual sua aura gerada disponível, mas sua Classe de Resistência se torna 0 até o início do seu próximo turno caso você adicione um valor maior que seu nível de personagem.",
    techniques: [],
    requires: { stage: "master", abilities: [], principle: "ko" }
  }
};

// ============================================================
// METADADOS DOS PRINCÍPIOS
// ============================================================

export const PRINCIPLES_DATA = {
  ten: {
    label: "Ten",
    type: "fundamental",
    description: "O princípio da envoltura. Mantém a circulação da aura dentro e ao redor do corpo, agindo como uma segunda pele protetora.",
    techniques: ["Ten - Defesa Sólida"],
    passive: "Enquanto sua aura estiver ativa, você não sofre dano dobrado de ataques com Ren.",
    unlockRequires: { type: "master_grant" }
  },
  zetsu: {
    label: "Zetsu",
    type: "fundamental",
    description: "O princípio do corte. Suprime o fluxo externo da aura, ocultando a presença de outros usuários de Nen.",
    techniques: ["Zetsu – Anular Presença"],
    passive: "Você se torna capaz de cortar totalmente o fluxo de aura, permitindo usar Furtividade contra criaturas que possam ver aura.",
    unlockRequires: { type: "master_grant" }
  },
  ren: {
    label: "Ren",
    type: "fundamental",
    description: "O princípio da prática. Expande e intensifica a aura ao máximo, aumentando a força e durabilidade do corpo.",
    techniques: ["Ren – Explosão de Aura", "Ren - Parede de Aura"],
    passive: "Você passa a causar o dobro de dano em criaturas que não possuam aura ou estejam com \"Zetsu\" ativo.",
    unlockRequires: { type: "master_grant" }
  },
  hatsu: {
    label: "Hatsu",
    type: "fundamental",
    description: "O princípio da liberação. Transmissão ou projeção da aura, geralmente utilizado antes de uma técnica avançada.",
    techniques: ["Hatsu – Sede de Sangue"],
    passive: "Nenhuma",
    unlockRequires: { type: "master_grant" }
  },
  gyo: {
    label: "Gyo",
    type: "advanced",
    description: "Concentração da aura em uma parte específica do corpo, aumentando dramaticamente a habilidade dessa parte.",
    techniques: ["Salto Concentrado", "Investida Focada (4 PA)", "Sentidos Aprimorados", "Gyo – Foco Rápido", "Gyo – Golpe Devastador"],
    passive: "Nenhuma",
    unlockRequires: { stage: "beginner", principles: ["ren"], cost: 3 }
  },
  shu: {
    label: "Shu",
    type: "advanced",
    description: "Aplicação avançada de Ten e Ren. Permite envolver um objeto com a própria aura, tornando-o uma extensão do corpo.",
    techniques: ["Shu - Revestimento"],
    passive: "Nenhum",
    unlockRequires: { stage: "expert", principles: ["ten", "hatsu"], cost: 3 }
  },
  in: {
    label: "In",
    type: "advanced",
    description: "Aplicação avançada de Zetsu. Esconde literalmente toda a presença de aura do indivíduo.",
    techniques: ["Ocultação Completa"],
    passive: "Nenhuma",
    unlockRequires: { stage: "expert", principles: ["zetsu"], cost: 3 }
  },
  en: {
    label: "En",
    type: "advanced",
    description: "Aplicação avançada de Ten e Ren. Expande a aura criando um campo extenso ao redor do usuário que detecta tudo dentro dele.",
    techniques: ["Sentido Verdadeiro"],
    passive: "Você pode usar sua ação de poder para realizar um Teste de Espírito (Percepção) com vantagem, detectando criaturas escondidas em 3m ao redor. Consome 2 PA na ativação e no início de cada turno. Você é imune à condição \"Surpreso\" dentro da área do En.",
    unlockRequires: { stage: "expert", principles: ["ten", "ren"], cost: 3 }
  },
  ryu: {
    label: "Ryu",
    type: "advanced",
    description: "Outra aplicação de Gyo. Foca maior quantidade de aura num soco para torná-lo mais potente, ou numa perna para defender-se melhor.",
    techniques: ["Ryu - Controle de Aura", "Ryu – Transferência Rápida"],
    passive: "Nenhuma",
    unlockRequires: { stage: "expert", principles: ["gyo"], abilities: ["focoAgressivo", "focoDefensivo"], cost: 5 }
  },
  ken: {
    label: "Ken",
    type: "advanced",
    description: "Outra aplicação avançada de Ren. Aumenta a potência do Ren tornando o corpo todo mais resistente.",
    techniques: ["Defesa Absoluta"],
    passive: "Nenhuma",
    unlockRequires: { stage: "master", principles: ["ren"], abilities: ["explosaoDefensiva", "ultimoRecurso", "focoDefensivo"], cost: 5 }
  },
  ko: {
    label: "Ko",
    type: "advanced",
    description: "Aplicação avançada de Gyo e Zetsu. Concentra toda a aura numa parte do corpo usando Zetsu para bloquear o fluxo nas demais.",
    techniques: ["Ko – Ofensiva Absoluta", "Bloqueio Emergencial"],
    passive: "Nenhuma",
    unlockRequires: { stage: "master", principles: ["ten", "zetsu", "ren", "hatsu", "gyo"], cost: 5 }
  }
};

// ============================================================
// TREINAMENTOS
// ============================================================

export const TRAININGS_DATA = {

  // ── GERAIS ───────────────────────────────────────────────
  protecaoEnergia: {
    category: "general",
    label: "Proteção de Aura",
    ptCost: [2, 2, 2],
    paCost: [20, 40, 40],
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "CR aumenta em +1 (máx. 25). Sempre aplicado por último.",
    evolutionEffect: "CR aumenta em +2 (máx. 27).",
    perfectionEffect: "CR aumenta em +3 (máx. 30).",
    requires: {}
  },
  impactoEcoante: {
    category: "general",
    label: "Impacto Ecoante",
    ptCost: [2, 2, 2],
    paCost: [20, 40, 40],
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "Aumente o limite do Explosão Ofensiva em 2 dados adicionais.",
    evolutionEffect: "Limite aumenta em 4 dados.",
    perfectionEffect: "Limite aumenta em 6 dados.",
    requires: {}
  },
  robusto: {
    category: "general",
    label: "Robusto",
    ptCost: [3, 3, 3],
    paCost: [20, 40, 40],
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "Receba PV adicionais iguais ao seu nível de personagem.",
    evolutionEffect: "PV adicionais = 2× nível.",
    perfectionEffect: "PV adicionais = 3× nível.",
    requires: {}
  },
  agilidadeAvancada: {
    category: "general",
    label: "Agilidade Avançada",
    ptCost: [3, 3, 3],
    paCost: [20, 40, 40],
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "Receba +1,5m de deslocamento (máx. 15m).",
    evolutionEffect: "+3m (máx. 15m), ignora reações de movimento como Ataque de Oportunidade.",
    perfectionEffect: "+6m (máx. 15m), ignora Ataque de Oportunidade Superior.",
    requires: {}
  },
  energiaAdaptavel: {
    category: "general",
    label: "Aura Adaptável",
    ptCost: [3, 3, 3],
    paCost: [30, 60, 60],
    baseDC: 12,
    dcIncrement: 5,
    baseEffect: "Receba 3× seu mod. de CON em PV adicionais.",
    evolutionEffect: "4× mod. de CON em PV adicionais.",
    perfectionEffect: "5× mod. de CON em PV adicionais.",
    requires: {}
  },
  energiaBruta: {
    category: "general",
    label: "Aura Brutal",
    ptCost: [4, 4, 4],
    paCost: [40, 80, 80],
    baseDC: 12,
    dcIncrement: 5,
    baseEffect: "Até 3×/descanso longo: role dois dados de dano de um ataque/técnica e escolha o maior.",
    evolutionEffect: "5 vezes por descanso longo.",
    perfectionEffect: "Use em todos os seus ataques.",
    requires: {}
  },
  golpePenetrante: {
    category: "general",
    label: "Golpe Penetrante",
    ptCost: [4, 4, 4],
    paCost: [40, 80, 80],
    baseDC: 12,
    dcIncrement: 5,
    baseEffect: "+1 de acerto em jogadas de ataque (comuns e de técnica).",
    evolutionEffect: "+2 de acerto.",
    perfectionEffect: "+3 de acerto.",
    requires: {}
  },
  periciaNodavel: {
    category: "general",
    label: "Perícia Notável",
    ptCost: [5, 5, 5],
    paCost: [50, 100, 100],
    baseDC: 15,
    dcIncrement: 5,
    baseEffect: "Ao errar uma habilidade/técnica, pode escolher não consumir PA. Recupera ao final de descanso curto/longo.",
    evolutionEffect: "3×/descanso longo, ao errar, não consome PA.",
    perfectionEffect: "Sempre que errar técnica com acerto, não consome PA. Ilimitado ao errar habilidade/técnica sem resultado.",
    requires: {}
  },
  resistenciaAprimorada: {
    category: "general",
    label: "Resistência Aprimorada",
    ptCost: [3, 3, 3],
    paCost: [20, 40, 40],
    baseDC: 10,
    dcIncrement: 5,
    baseEffect: "Você recebe resistência a um tipo de dano à sua escolha.",
    evolutionEffect: "Resistência a dois tipos de dano.",
    perfectionEffect: "Resistência a três tipos de dano.",
    requires: {}
  },

  // ── DOMÍNIO ──────────────────────────────────────────────
  expansaoDominio: {
    category: "domain",
    label: "Expansão de Domínio",
    ptCost: [5, 5, 5],
    paCost: [60, 120, 120],
    baseDC: 14,
    dcIncrement: 5,
    baseEffect: "Você pode criar uma Expansão de Domínio simples com alcance de 1,5m ao redor.",
    evolutionEffect: "Expansão com regras adicionais e maior controle do interior.",
    perfectionEffect: "Expansão com poder máximo, regras completas e poderes extras.",
    requires: {}
  },
  expansaoAmpliada: {
    category: "domain",
    label: "Expansão Ampliada",
    ptCost: [3, 3, 3],
    paCost: [30, 60, 60],
    baseDC: 12,
    dcIncrement: 5,
    baseEffect: "Aumenta área do domínio simples em +1,5m e alcance de ataques comuns e técnicas associadas.",
    evolutionEffect: "Área do domínio simples passa a ser de 3m.",
    perfectionEffect: "Área do domínio simples passa a ser de 4,5m.",
    requires: {}
  },
  expansaoModificada: {
    category: "domain",
    label: "Expansão Modificada",
    ptCost: [5],
    paCost: [100],
    baseDC: 16,
    dcIncrement: 0,
    baseEffect: "Suas técnicas dentro da expansão de domínio têm CD +1 para tomar dano/condições. Requer Expansão de Domínio.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: { special: "expansaoDominio" }
  },
  expansaoFortalecida: {
    category: "domain",
    label: "Expansão Fortalecida",
    ptCost: [8, 8, 8],
    paCost: [120, 240, 240],
    baseDC: 16,
    dcIncrement: 5,
    baseEffect: "Expansão de domínio com barreira mais poderosa: 100 PV fora e 200 PV dentro. Requer Expansão de Domínio.",
    evolutionEffect: "200 PV fora e 350 PV dentro.",
    perfectionEffect: "300 PV fora e 500 PV dentro.",
    requires: { special: "expansaoDominio" }
  },

  // ── IMACULADO ────────────────────────────────────────────
  estiloVersatil: {
    category: "immaculate",
    label: "Estilo Versátil",
    ptCost: [5],
    paCost: [50],
    baseDC: 16,
    dcIncrement: 0,
    baseEffect: "Pode reduzir dados de dano de técnicas do Novo Estilo das Sombras para reduzir o custo em PA pelo mesmo valor (mín. 1 dado).",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  },
  laminaVeloz: {
    category: "immaculate",
    label: "Lâmina Veloz",
    ptCost: [5],
    paCost: [50],
    baseDC: 16,
    dcIncrement: 0,
    baseEffect: "Pode ativar Hazy Moon dentro ou fora do turno sem consumir ação. Recebe +2 nas rolagens de dano.",
    evolutionEffect: null,
    perfectionEffect: null,
    requires: {}
  }
};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Calcula o estágio a partir dos pontos investidos
 */
export function getManipulationStage(pointsInvested) {
  if ( pointsInvested >= 46 ) return "master";
  if ( pointsInvested >= 15 ) return "expert";
  return "beginner";
}

const STAGE_ORDER = { beginner: 0, expert: 1, master: 2 };
export const STAGE_LABELS = { beginner: "Iniciante", expert: "Perito", master: "Mestre" };

/**
 * Verifica se um princípio está desbloqueado pelo ator
 */
export function isPrincipleUnlocked(principleId, actor) {
  const principles = actor.system.manipulation?.principles ?? {};
  return principles[principleId]?.unlocked ?? false;
}

/**
 * Verifica se uma habilidade pode ser desbloqueada
 */
export function canUnlockAbility(abilityId, actor) {
  const abilityDef = MANIPULATION_ABILITIES[abilityId];
  if ( !abilityDef ) return { can: false, reason: "Habilidade desconhecida" };

  const investedPts = actor.system.manipulation?.pointsInvested ?? 0;
  const currentStage = getManipulationStage(investedPts);
  const cursePoints = actor.system.curseResources?.cursePoints ?? 0;
  const unlockedAbilities = actor.system.manipulation?.abilities ?? {};

  // Já desbloqueada
  if ( unlockedAbilities[abilityId]?.unlocked ) return { can: false, reason: "Já desbloqueada" };

  // Princípio precisa estar desbloqueado
  if ( abilityDef.principle && !isPrincipleUnlocked(abilityDef.principle, actor) ) {
    const principleLabel = PRINCIPLES_DATA[abilityDef.principle]?.label ?? abilityDef.principle;
    return { can: false, reason: `Requer princípio: ${principleLabel}` };
  }

  // Estágio necessário
  const reqStage = abilityDef.requires.stage ?? "beginner";
  if ( STAGE_ORDER[currentStage] < STAGE_ORDER[reqStage] ) {
    return { can: false, reason: `Requer estágio ${STAGE_LABELS[reqStage]}` };
  }

  // Habilidades pré-requisito
  for ( const req of (abilityDef.requires.abilities ?? []) ) {
    if ( !unlockedAbilities[req]?.unlocked ) {
      return { can: false, reason: `Requer: ${MANIPULATION_ABILITIES[req]?.label ?? req}` };
    }
  }

  // PM suficientes
  if ( cursePoints < abilityDef.cost ) {
    return { can: false, reason: `Faltam ${abilityDef.cost - cursePoints} PM` };
  }

  return { can: true };
}

/**
 * Prepara os dados de habilidades agrupados por princípio para o template
 */
export function prepareManipulationAbilities(actor) {
  const result = {};
  for ( const principleId of Object.keys(PRINCIPLES_DATA) ) {
    result[principleId] = {};
  }

  const unlockedAbilities = actor.system.manipulation?.abilities ?? {};

  for ( const [id, def] of Object.entries(MANIPULATION_ABILITIES) ) {
    const { can, reason } = canUnlockAbility(id, actor);
    const principleUnlocked = def.principle ? isPrincipleUnlocked(def.principle, actor) : true;
    const data = {
      ...def,
      stageLabel: STAGE_LABELS[def.stage] ?? def.stage,
      unlocked: unlockedAbilities[id]?.unlocked ?? false,
      canUnlock: can && principleUnlocked,
      principleUnlocked,
      lockReason: reason ?? ""
    };
    const cat = def.principle ?? def.category;
    if ( result[cat] ) result[cat][id] = data;
  }

  return result;
}

/**
 * Prepara os metadados dos princípios com status de desbloqueio para o template
 */
export function preparePrinciples(actor) {
  const unlockedPrinciples = actor.system.manipulation?.principles ?? {};
  const investedPts = actor.system.manipulation?.pointsInvested ?? 0;
  const currentStage = getManipulationStage(investedPts);
  const cursePoints = actor.system.curseResources?.cursePoints ?? 0;
  const unlockedAbilities = actor.system.manipulation?.abilities ?? {};

  const result = {};
  for ( const [id, def] of Object.entries(PRINCIPLES_DATA) ) {
    const unlocked = unlockedPrinciples[id]?.unlocked ?? false;
    const req = def.unlockRequires;

    let canUnlock = false;
    let lockReason = "";

    if ( req.type === "master_grant" ) {
      canUnlock = false;
      lockReason = "Desbloqueado pelo Mestre";
    } else {
      const stageOk = !req.stage || STAGE_ORDER[currentStage] >= STAGE_ORDER[req.stage];
      const costOk = !req.cost || cursePoints >= req.cost;
      const principlesOk = !req.principles || req.principles.every(p => unlockedPrinciples[p]?.unlocked);
      const abilitiesOk = !req.abilities || req.abilities.every(a => unlockedAbilities[a]?.unlocked);

      if ( !stageOk ) lockReason = `Requer estágio ${STAGE_LABELS[req.stage]}`;
      else if ( !principlesOk ) lockReason = `Requer: ${req.principles?.map(p => PRINCIPLES_DATA[p]?.label ?? p).join(", ")}`;
      else if ( !abilitiesOk ) lockReason = "Requer habilidades pré-requisito";
      else if ( !costOk ) lockReason = `Faltam ${req.cost - cursePoints} PM`;

      canUnlock = stageOk && costOk && principlesOk && abilitiesOk;
    }

    result[id] = {
      ...def,
      id,
      unlocked,
      canUnlock: !unlocked && canUnlock,
      lockReason,
      isMasterGrant: req.type === "master_grant",
      cost: req.cost ?? 0
    };
  }

  return result;
}

/**
 * PT disponível para gastar = PT Jogador + PT Narrador - PT Perdidos - PT Gastos.
 * "PT Jogador" e "PT Narrador" são entradas (fontes) do extrato; "PT Perdidos" (rolagens
 * falhas) e "PT Gastos" (rolagens/treinos bem-sucedidos) são saídas — juntas somam todo PT
 * já gasto, sem sobreposição entre si.
 */
export function getAvailableTrainingPoints(actor) {
  const cr = actor.system.curseResources ?? {};
  return Math.max(0,
    (cr.trainingPoints ?? 0) + (cr.narratorTrainingPoints ?? 0)
    - (cr.lostTrainingPoints ?? 0) - (cr.spentTrainingPoints ?? 0)
  );
}

/**
 * Prepara os dados de treinamentos para o template
 */
export function prepareTrainings(actor) {
  const result = { general: {}, domain: {}, immaculate: {} };
  const savedTrainings = actor.system.trainings ?? {};
  const trainingPoints = getAvailableTrainingPoints(actor);
  const energyTotal = actor.system.energy?.total ?? 0;

  for ( const [id, def] of Object.entries(TRAININGS_DATA) ) {
    const saved = savedTrainings[id] ?? { rank: 0, currentDC: def.baseDC };
    const rank = saved.rank ?? 0;
    const currentDC = saved.currentDC ?? def.baseDC;

    const nextRankIdx = rank;
    const nextPtCost = def.ptCost[nextRankIdx] ?? def.ptCost[def.ptCost.length - 1];
    const nextPaCost = def.paCost[nextRankIdx] ?? def.paCost[def.paCost.length - 1];

    const maxRank = def.perfectionEffect !== null ? 3
      : def.evolutionEffect !== null ? 2
      : 1;

    const canTrain = rank < maxRank &&
      trainingPoints >= nextPtCost &&
      energyTotal >= nextPaCost;

    result[def.category][id] = {
      ...def,
      rank,
      maxRank,
      currentDC,
      nextPtCost,
      nextPaCost,
      canTrain,
      lockReason: !canTrain
        ? (trainingPoints < nextPtCost
          ? `Faltam ${nextPtCost - trainingPoints} PT`
          : `Faltam ${nextPaCost - energyTotal} PA Total`)
        : ""
    };
  }

  return result;
}

// ============================================================
// TREE_DATA — estrutura completa para renderização do HBS
// Espelha MANIPULATION_ABILITIES agrupado por princípio,
// com metadados de descrição para tooltip/painel no Foundry.
// ============================================================

export const TREE_DATA = [
  {
    section: "Princípios Fundamentais",
    principles: [
      {
        id: "ten", label: "Ten", type: "fundamental", cost: 0, req: {},
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.B31kjVBwgkCWsfXz",
        passive: "Enquanto sua aura estiver ativa, você não sofre dano dobrado de ataques com Ren.",
        desc: "O princípio da envoltura. Mantém a circulação da aura dentro e ao redor do corpo, agindo como uma segunda pele protetora.\n\nTécnicas: Ten – Defesa Sólida.",
        abilities: [
          { id: "defesaAura",         label: "Defesa de Aura",       cost: 3,  stage: "beginner", req: [],
            desc: "Você reduz todo dano sem aura pela metade (armas mundanas, disparos de fogo, etc.).\n\nRequisito: Ten · 3 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.XBIoo4Xvi3i15IRh" },
          { id: "movimentacaoRapida", label: "Movimentação Rápida",  cost: 6,  stage: "expert",   req: [],
            desc: "Quando você estiver fora de combate, você pode dobrar seu deslocamento padrão e utilizar disparada por quanto tempo quiser sem receber nenhum nível de exaustão. Esse efeito consome 1 PA na sua ativação e 1 PA adicional a cada 5 minutos.\n\nRequisito: Ten · Estágio Perito · 6 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.VQsD5uqmj05cF69D" },
          { id: "defesaElevada",      label: "Defesa Elevada",       cost: 6,  stage: "beginner", req: ["defesaAura"],
            desc: "Antes de reduzir o dano pela metade, você reduz o dano sofrido em 15 Pontos de Dano.\n\nRequisito: Defesa de Aura · 6 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.7QdlIOprxGZpVhrn" },
        ]
      },
      {
        id: "zetsu", label: "Zetsu", type: "fundamental", cost: 0, req: {},
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.axXvXFEDtbEAk2zG",
        passive: "Você se torna capaz de cortar totalmente o fluxo de aura, permitindo usar Furtividade contra criaturas que possam ver aura.",
        desc: "O princípio do corte. Suprime o fluxo externo da aura, ocultando sua presença. Alivia a fadiga mas deixa desprotegido contra ataques de Nen.\n\nTécnicas: Zetsu – Anular Presença.",
        abilities: [
          { id: "supressaoAura",        label: "Supressão de Aura",    cost: 3,  stage: "beginner", req: [],
            desc: "Enquanto em Zetsu, você recebe +5 em Testes de Atributo de Agilidade (Furtividade).\n\nRequisito: Zetsu · 3 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.1WhcKsywuRe6rRrZ" },
          { id: "recuperacaoAcelerada", label: "Recuperação Acelerada", cost: 6, stage: "beginner", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.elwPQxF9MatFBD8w",
            desc: "Enquanto em Zetsu, você pode realizar descansos curtos e longos na metade do tempo padrão.\n\nRequisito: Zetsu · 6 Pontos de Nen." },
          { id: "mestreZetsu",          label: "Mestre de Zetsu",       cost: 10, stage: "master",  req: ["supressaoAura"],
            desc: "Você recebe proficiência em Testes de Atributo de Furtividade. Caso já possua, você recebe maestria.\n\nRequisito: Supressão de Aura · Estágio Mestre · 10 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.WAJeQl7F7ZntqeCr" },
        ]
      },
      {
        id: "ren", label: "Ren", type: "fundamental", cost: 0, req: {},
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.dDA3JlaAxNcwh9q4",
        passive: "Você passa a causar o dobro de dano em criaturas que não possuam aura ou estejam com Zetsu ativo.",
        desc: "O princípio da prática. Expande e intensifica a aura ao máximo, aumentando força e durabilidade.\n\nTécnicas: Ren – Explosão de Aura, Ren – Parede de Aura.",
        abilities: [
          { id: "explosaoOfensiva",  label: "Explosão Ofensiva",  cost: 3, stage: "beginner", req: [],
            desc: "Você pode adicionar até um número de d4 no seu próximo ataque ou dados de dano de sua técnica até um valor igual ao seu bônus de proficiência. Você consome 1 PA para cada dado aumentado. Em técnicas e habilidades de cura, gasta 2 PA para cada dado.\n\nRequisito: Ren · 3 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.lsZAEHuvcDNXDNW1" },
          { id: "explosaoDefensiva", label: "Explosão Defensiva", cost: 3, stage: "beginner", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.qnmlbd0KIkiHcjXA",
            desc: "Você pode gastar 1 PA para reduzir 1d4 de dano sofrido ou 2 dados de redução a sua próxima técnica redução, até um máximo igual o valor da sua aura disponível na rodada.\n\nRequisito: Ren · 3 Pontos de Nen." },
          { id: "ultimoRecurso",     label: "Último Recurso",     cost: 6, stage: "expert",   req: ["explosaoDefensiva"],
            desc: "Até 3 vezes por descanso longo, ao sofrer dano crítico de uma jogada de ataque (Comum), você pode escolher sofrer o dano normal. Adicionalmente, ao sofrer dano crítico de uma técnica, você pode gastar 6 Pontos de Aura para sofrer o dano normal.\n\nRequisito: Explosão Defensiva · Estágio Perito · 6 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.bIKcB3ifBGoUXdqy" },
        ]
      },
      {
        id: "hatsu", label: "Hatsu", type: "fundamental", cost: 0, req: {},
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.g4ekIubZUuTZrb2D",
        passive: "Nenhuma.",
        desc: "O princípio da liberação. Transmissão ou projeção da aura para técnicas pessoais únicas.\n\nTécnicas: Hatsu – Sede de Sangue.",
        abilities: [
          { id: "auraAssassina",      label: "Aura Assassina",      cost: 3, stage: "beginner", req: [],
            desc: "Você pode usar uma ação de poder para realizar uma jogada de ataque contra uma criatura que não possa utilizar aura. Você consome 2 Pontos de Aura e remove 4 Pontos de Vitalidade (PVE) dela.\n\nRequisito: Hatsu · 3 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.d3zR2XlDvuh8CwMz" },
          { id: "despertarAura",      label: "Despertar Aura",      cost: 6, stage: "beginner", req: [],
            desc: "Você pode tocar uma criatura usando sua ação para abrir seus nós de aura. Realize um Teste de Atributo de Espírito (Nen) CD 16. Em caso de falha, ela recebe o dobro do dano do Aura Assassina.\n\nRequisito: Hatsu · 6 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.4V5U5LAnXTHSK7Uo" },
          { id: "habilidadeEspecial", label: "Habilidade Especial", cost: 3, stage: "beginner", req: ["auraAssassina"],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.jJyINc1pObzIzdIx",
            desc: "Desde que você possua Aura Assassina ou Despertar Aura, você pode liberar acesso ao seu Hatsu de acordo com o Manual Shingen-Ryu.\n\nRequisito: Aura Assassina · 3 Pontos de Nen." },
        ]
      },
    ]
  },
  {
    section: "Princípios Avançados",
    principles: [
      {
        id: "gyo", label: "Gyo", type: "advanced", cost: 3, req: { pr: ["ren"] },
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.tKUzIPAxkmVdRG7C",
        passive: "Nenhuma.",
        desc: "Concentração da aura em uma parte específica do corpo. Nos olhos, permite enxergar aura de outras pessoas e objetos ocultos.\n\nRequisito: Ren · 3 PM.\nTécnicas: Detectar Aura, Salto Concentrado, Investida Focada, Sentidos Aprimorados, Gyo – Foco Rápido, Gyo – Golpe Devastador, Gyo – Foco Destruidor.",
        abilities: [
          { id: "pontoFraco",      label: "Ponto Fraco",      cost: 3,  stage: "beginner", req: [],
            desc: "Você pode utilizar uma ação bônus e 2 PA para realizar um Teste de Atributo de Espírito (Nen) com CD igual a 10 + ND da criatura para tentar encontrar um ponto fraco. Caso contrário, recebe duas informações (à escolha do narrador). Uma vez por criatura por descanso longo.\n\nRequisito: Gyo · 3 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.ygkT8BcKxrb6W1iB" },
          { id: "focoAgressivo",   label: "Foco Agressivo",   cost: 6,  stage: "expert",   req: ["explosaoOfensiva"],
            desc: "Suas jogadas de ataque (Comuns) recebem 1d4 de dano adicional. Você não pode utilizar Foco Agressivo e Defensivo ao mesmo tempo.\n\nRequisito: Explosão Ofensiva · Estágio Perito · 6 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.7NlxD1VceHNVLqu0" },
          { id: "focoDefensivo",   label: "Foco Defensivo",   cost: 6,  stage: "expert",   req: ["explosaoDefensiva"],
            desc: "Você envolve seu corpo com uma camada extra de aura, criando 20 Pontos de Armadura. Coexistem com PV temporários, são sempre consumidos primeiro e duram até o fim do encontro. Enquanto ativos, você adquire resistência a todos os tipos de dano. Restauram após 10 minutos sem utilizar aura.\n\nRequisito: Explosão Defensiva · Estágio Perito · 6 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.5q2sTRGdGk3w8erf" },
          { id: "analiseSuperior", label: "Análise Superior", cost: 10, stage: "master",   req: ["pontoFraco"],
            desc: "Com 'Detectar Aura' ativo, você pode realizar um Teste de Atributo de Espírito (Nen) com CD igual o ND da criatura para saber exatamente o que uma característica dela faz.\n\nRequisito: Ponto Fraco · Estágio Mestre · 10 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.YFrNnBf3wn7Xtu9F" },
        ]
      },
      {
        id: "shu", label: "Shu", type: "advanced", cost: 3, req: { pr: ["ten", "hatsu"] },
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.hP0lVBbd9a5aveNP",
        passive: "Nenhum.",
        desc: "Aplicação avançada de Ten e Ren. Permite ao usuário envolver um objeto com sua própria aura, tornando-o extensão do corpo.\n\nRequisito: Ten e Hatsu · Estágio Perito · 3 PM.\nTécnicas: Shu – Revestimento.",
        abilities: [
          { id: "envolverObjeto", label: "Envolver Objeto", cost: 3, stage: "expert", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.KFRBt9Qs9pux4FJR",
            desc: "Você pode envolver objetos com sua aura aplicando dois dos seguintes efeitos: a CR do Objeto se torna igual a sua; o objeto dá o dobro de dano em objetos e estruturas; o objeto recebe 50 Pontos de Armadura; o dano base se torna 1d10 e você pode arremessá-lo no alcance do Emissão Treinada.\n\nRequisito: Shu · 3 Pontos de Nen." },
          { id: "escritaNen",    label: "Escrita de Nen",  cost: 3, stage: "expert", req: [],
            desc: "Ao colocar Aura na ponta dos dedos, você pode escrever algo em uma superfície. Com In, a escrita fica invisível por até 2 horas.\n\nRequisito: Shu · In · 3 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.NIE24eRBWMfZAfvK" },
        ]
      },
      {
        id: "in", label: "In", type: "advanced", cost: 6, req: { pr: ["zetsu"] },
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.fAkJ48umoWpTUtfO",
        passive: "Nenhuma.",
        desc: "Aplicação avançada de Zetsu. Esconde literalmente toda a presença de aura. Principal uso: tornar o Hatsu invisível aos inimigos.\n\nRequisito: Zetsu · Estágio Perito · 6 PM.\nTécnicas: In – Ocultação Completa.",
        abilities: [
          { id: "ocultacao", label: "Ocultação",    cost: 6,  stage: "expert", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.o1W5rSuj3beI8aaO",
            desc: "Suas jogadas de ataque (Comuns e de Técnica) passam a receber +3 de acerto.\n\nRequisito: In · Estágio Perito · 6 Pontos de Nen." },
          { id: "mestreIn",  label: "Mestre de In", cost: 10, stage: "master", req: ["ocultacao"],
            desc: "Você sempre está com o 'Ocultação Completa' ativo fora de combate sem consumir Pontos de Aura.\n\nRequisito: Ocultação · Estágio Mestre · 10 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.aqzzs67p474TmiWR" },
        ]
      },
      {
        id: "en", label: "En", type: "advanced", cost: 3, req: { pr: ["ten", "ren"] },
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.0JfFZMXVsuGW6vV6",
        passive: "Você pode usar sua ação de poder para realizar um Teste de Espírito (Percepção) com vantagem, detectando criaturas escondidas em 3m ao redor. Consome 2 PA na ativação e no início de cada turno. Você é imune à condição Surpreso dentro da área do En.",
        desc: "O usuário expande sua aura através do Ren, criando um campo de aura extenso normalmente em círculo. Qualquer coisa que aparecer ou se mover dentro desse campo será imediatamente sentida.\n\nRequisito: Ten e Ren · Estágio Perito · 3 PM.\nTécnicas: En – Sentido Verdadeiro.",
        abilities: [
          { id: "sensitivo",         label: "Sensitivo",          cost: 3, stage: "expert", req: [],
            desc: "Ao ser alvo de uma jogada de ataque, você pode escolher ser atingido automaticamente para ver a direção exata em que o ataque veio, recebendo vantagem e +10 em Testes de Percepção para encontrar a criatura.\n\nRequisito: En · 3 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.HXJzPSeSOjeSiwdT" },
          { id: "aprimorarSentidos", label: "Aprimorar Sentidos", cost: 3, stage: "expert", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.KunfCiUJvA0Tp5Tf",
            desc: "Você recebe +2 no Teste de Atributo de Espírito (Percepção) da ativação do seu En. Essa habilidade pode ser adquirida diversas vezes (+2 cada).\n\nRequisito: En · 3 Pontos de Nen." },
          { id: "expansaoAuraEn",    label: "Expansão de Aura",   cost: 3, stage: "expert", req: [],
            desc: "A área do seu En aumenta para 6 metros. Pode ser adquirida diversas vezes (+6m cada). Se você usar um 1/3 do seu alcance, você não consome aura por rodada.\n\nRequisito: En · 3 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.ik1yO9wtVRNfz1JC" },
        ]
      },
      {
        id: "ryu", label: "Ryu", type: "advanced", cost: 5, req: { pr: ["gyo"], ab: ["focoAgressivo", "focoDefensivo"] },
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.qJkP08ONDKUSw7HC",
        passive: "Nenhuma.",
        desc: "Outra aplicação de Gyo. Foca maior quantidade de aura num soco para torná-lo mais potente, ou focando na perna para defender-se melhor.\n\nRequisito: Foco Agressivo e Foco Defensivo · Estágio Perito · 5 PM.\nTécnicas: Ryu – Controle de Aura, Ryu – Transferência Rápida.",
        abilities: [
          { id: "fluxoVeloz",     label: "Fluxo Veloz",      cost: 6,  stage: "expert", req: [],
            desc: "Você pode manter o Foco Agressivo e Foco Defensivo ativos o tempo inteiro.\n\nRequisito: Ryu · 6 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.6XSRr50Ar7Ma3xsi" },
          { id: "fluxoPerfeito",  label: "Fluxo Perfeito",   cost: 10, stage: "expert", req: ["fluxoVeloz"],
            desc: "A margem de acerto crítico de suas jogadas de ataque (Comuns e de Técnica) se torna 19-20.\n\nRequisito: Fluxo Veloz · Estágio Perito · 10 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.k0E29NXdCk7SgDgl" },
          { id: "fluxoConstante", label: "Fluxo Constante",  cost: 10, stage: "expert", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.QDjwDQaCvoIX8DQM",
            desc: "O dano do seu Foco Agressivo aumenta em um passo de dado e o Foco Defensivo recebe +20 Pontos de Armadura adicionais.\n\nRequisito: Ryu · Estágio Perito · 10 Pontos de Nen." },
          { id: "ativacaoFluxo",  label: "Ativação de Fluxo", cost: 15, stage: "master", req: ["fluxoConstante"],
            desc: "Enquanto com 'Fluxo Veloz' ativo, você pode aumentar um número de dados de dano do 'Explosão Ofensiva' igual ao dobro do bônus de proficiência no lugar do original.\n\nRequisito: Fluxo Constante · Estágio Mestre · 15 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.NzUjuPxfWz3j5r8m" },
        ]
      },
      {
        id: "ken", label: "Ken", type: "advanced", cost: 5, req: { pr: ["ren"], ab: ["explosaoDefensiva", "ultimoRecurso", "focoDefensivo"] },
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.av09UxDGuKYO0qpv",
        passive: "Nenhuma.",
        desc: "Outra aplicação avançada de Ren para fins defensivos. Aumenta a potência do Ren tornando o corpo todo mais resistente.\n\nRequisito: Explosão Defensiva, Último Recurso e Foco Defensivo · Mestre · 5 PM.\nTécnicas: Ken – Defesa Absoluta.",
        abilities: [
          { id: "disputaAura", label: "Disputa de Aura", cost: 10, stage: "master", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.GAMRCaZxKgGDK5Zq",
            desc: "Quando você for alvo de um efeito intrusivo de Nen, você pode usar sua reação e gastar 10 Pontos de Aura e realizar um Teste Resistido de Espírito (Nen) contra a mesma perícia da criatura. Em caso de sucesso, você nega o efeito e fica imune a ele até o fim do seu turno atual.\n\nRequisito: Ken · 10 Pontos de Nen." },
          { id: "muralhaAura", label: "Muralha de Aura", cost: 15, stage: "master", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.jX9LwCNSVMGWUYWH",
            desc: "Uma vez por descanso longo, você pode usar sua reação para reduzir a 0 o dano sobre você e toda criatura em um cone de 12 metros atrás de você.\n\nRequisito: Ken · 15 Pontos de Nen." },
        ]
      },
      {
        id: "ko", label: "Ko", type: "advanced", cost: 5, req: { pr: ["ten", "zetsu", "ren", "hatsu", "gyo"] },
        reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.gRJeXaWBvPWczeIH",
        passive: "Nenhuma.",
        desc: "Aplicação avançada de Gyo e Zetsu. Usa-se Gyo em uma parte do corpo e Zetsu para fechar o fluxo nas demais. Um ataque direto com Ko carrega 100% da aura.\n\nRequisito: Ten, Zetsu, Ren, Hatsu e Gyo · Mestre · 5 PM.\nTécnicas: Ko – Ofensiva Absoluta, Bloqueio Emergencial.",
        abilities: [
          { id: "acumuloExtremo", label: "Acúmulo Extremo", cost: 10, stage: "master", req: [],
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.YJPOuVrZW9hp2pF5",
            desc: "Ao pagar 4 Pontos de Aura, você pode fazer com que seu próximo dano se torne do tipo 'Verdadeiro'.\n\nRequisito: Ko · 10 Pontos de Nen." },
          { id: "mestreKo",       label: "Mestre de Ko",    cost: 15, stage: "master", req: [],
            desc: "Você pode colocar quantos dados de dano quiser pelo 'Explosão Ofensiva' até um limite igual sua aura gerada disponível, mas sua CR se torna 0 até o início do seu próximo turno caso você adicione um valor maior que seu nível de personagem.\n\nRequisito: Ko · 15 Pontos de Nen.",
            reference: "Compendium.hunter-system.conteudo.JournalEntry.NTLmGaxbRETZzwYX.JournalEntryPage.9SbAGwJaZMc4UTab" },
        ]
      },
    ]
  },
];
