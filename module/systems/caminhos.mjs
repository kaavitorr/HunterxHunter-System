/**
 * Caminhos do personagem — combinação de Objetivo × Meio (3×3 = 9).
 * Objetivo: Conhecimento / Liberdade / Poder.
 * Meio:     Companheirismo / Força / Enganação.
 * (Mesmo framework usado no OPRPG — motivação genérica, serve pro Hunter também.)
 */
export const CAMINHO_OBJETIVOS = [
  { id: "conhecimento", label: "Conhecimento", sigla: "C" },
  { id: "liberdade",    label: "Liberdade",    sigla: "L" },
  { id: "poder",        label: "Poder",        sigla: "P" }
];

export const CAMINHO_MEIOS = [
  { id: "companheirismo", label: "Companheirismo", sigla: "C" },
  { id: "forca",          label: "Força",          sigla: "F" },
  { id: "enganacao",      label: "Enganação",      sigla: "E" }
];

const _OBJ = Object.fromEntries(CAMINHO_OBJETIVOS.map(o => [o.id, o]));
const _MEIO = Object.fromEntries(CAMINHO_MEIOS.map(m => [m.id, m]));

const DESCRICOES = {
  "conhecimento-companheirismo": "É o sonho de ver, aprender ou compreender algo por meio da interação social. O personagem depende de aliados para alcançar seus objetivos, podendo liderar ou ser subordinado, desde que conte com outras pessoas em sua jornada.",
  "liberdade-companheirismo": "É o sonho de viver livremente ou fazer algo que traga felicidade pessoal por meio da interação social. O personagem depende de aliados para seguir seu caminho, seja liderando ou sendo liderado.",
  "poder-companheirismo": "É o sonho de alcançar prestígio, domínio ou poder — seja governar, possuir algo, impor sua vontade ou eliminar um inimigo — contando com alianças, influência e relações sociais para isso.",
  "conhecimento-forca": "É o sonho de ver, aprender ou compreender algo por meio da própria força. O personagem pode até ter aliados, superiores ou subordinados, mas não depende deles para alcançar seus objetivos.",
  "liberdade-forca": "É o sonho de viver livremente ou realizar algo que traga felicidade pessoal por meio da própria força. O personagem trilha seu caminho de forma independente, mesmo que possua companheiros.",
  "poder-forca": "É o sonho de alcançar poder, prestígio ou domínio por meio da própria força. O personagem confia em sua capacidade individual para governar, impor sua vontade ou conquistar aquilo que deseja.",
  "conhecimento-enganacao": "É o sonho de ver, aprender ou compreender algo por meio de mentiras, encenações, manipulação ou controle de outras pessoas.",
  "liberdade-enganacao": "É o sonho de viver livremente ou fazer o que desejar por meio de mentiras, disfarces, intrigas ou controle indireto das ações alheias.",
  "poder-enganacao": "É o sonho de alcançar poder, prestígio ou domínio por meio da manipulação, enganação, encenação ou controle de pessoas e informações."
};

const _CONECTOR = { companheirismo: "pelo", forca: "pela", enganacao: "pela" };

/** Retorna o caminho resultante de um objetivo + meio (ou null). */
export function getCaminho(objetivo, meio) {
  const o = _OBJ[objetivo], m = _MEIO[meio];
  if ( !o || !m ) return null;
  return {
    objetivo, meio,
    code: `${o.sigla}/${m.sigla}`,
    nome: `${o.label} ${_CONECTOR[meio]} ${m.label}`,
    desc: DESCRICOES[`${objetivo}-${meio}`] ?? ""
  };
}
