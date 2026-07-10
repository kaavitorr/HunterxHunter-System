# Merge dos módulos → hunter-world-building

Data: 2026-07-10 · Status: aplicado (dados do mundo descartados a pedido — eram testes)

## Decisão
hunter-economia + hunter-jornal + hunter-celular + hunter-cronica viram UM módulo:
**hunter-world-building** ("Hunter — World Building"). hunter-arquivos permanece
separado e vira a ÚNICA dependência entre módulos (requires no manifest).

## Estrutura
- `scripts/<area>/` , `templates/<area>/` , `data/<area>/` , `assets/economia/`,
  `styles/hunter-<area>.css` (4), `lang/pt-BR.json`, `scripts/aviso.mjs`.
- esmodules: aviso + os 4 mains (economia, jornal, celular, cronica).

## Reescritas mecânicas (build script, originais intactos como backup)
1. Literais `modules/hunter-X/(templates|data|assets|scripts)/` → caminho novo com área.
2. Template literals `${MOD}/(templates|data|assets|scripts)/` → + subpasta da área.
3. Imports cruzados `../../hunter-X/scripts/` → `../X/`.
4. Toda string `hunter-X` → `hunter-world-building` (MOD, settings namespace, flags
   scope, modules.get — os gates internos viram auto-checks sempre-verdadeiros).
   `hunter-arquivos` intocado (gate real).
5. hunter-arquivos repontado: modules.get/import/flags de `hunter-economia` → novo id.
6. `scripts/aviso.mjs`: erro permanente no ready se algum módulo antigo estiver ativo
   (duplicariam botões e hooks).

## Validação
31 .mjs `node --check` limpos; todos os .json parseiam; caminhos citados em código
(literais E `${MOD}`) conferidos contra o disco: 0 faltando; zero resíduos de ids
antigos fora de nomes de arquivo CSS e da lista do aviso.

## Operação
Manage Modules: desativar os 4 antigos, ativar hunter-world-building (exige
hunter-arquivos). Sem migração de dados (namespaces de settings mudaram — mundo
recomeça limpo). Pastas antigas ficam como backup até validação em jogo.
