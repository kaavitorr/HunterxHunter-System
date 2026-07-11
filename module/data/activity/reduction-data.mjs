import FormulaField from "../fields/formula-field.mjs";
import BaseActivityData from "./base-activity.mjs";

const { BooleanField, SchemaField } = foundry.data.fields;

/**
 * Data model da atividade de Redução de Dano.
 *
 * Guarda a fórmula do escudo (dado ou valor fixo) configurada na aba Efeito.
 * O modo (ataque único ou até o início do próximo turno) é escolhido no diálogo
 * ao usar; a fórmula pode ser ajustada na hora, partindo desta como padrão.
 *
 * @extends {BaseActivityData}
 */
export default class ReductionActivityData extends BaseActivityData {
  /** @inheritDoc */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      reduction: new SchemaField({
        formula: new FormulaField({ label: "Fórmula de Redução" }),
        // Redução Constante: técnica sustentada que reduz TODO dano sofrido pela
        // fórmula acima, rolada a cada golpe (aparece no HUD de combate; desliga lá).
        constant: new BooleanField({ label: "Redução Constante" })
      })
    };
  }
}
