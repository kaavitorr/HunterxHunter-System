import MappingField from "../fields/mapping-field.mjs";

const { BooleanField, ForeignDocumentField, NumberField, SchemaField, SetField, StringField } = foundry.data.fields;

/**
 * @import { UserSystemFlagsData } from "./_types.mjs";
 */

/**
 * A custom model to validate system flags on User Documents.
 * @extends {foundry.abstract.DataModel<UserSystemFlagsData>}
 * @mixes UserSystemFlagsData
 */
export default class UserSystemFlags extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      awardDestinations: new SetField(
        new ForeignDocumentField(foundry.documents.BaseActor, { idOnly: true }), { required: false }
      ),
      creation: new SchemaField({
        scrollExplanation: new StringField({initial: "reference"})
      }),
      sacrificeHudPinnedActorId: new ForeignDocumentField(
        foundry.documents.BaseActor, { idOnly: true, required: false, nullable: true, initial: null }
      ),
      sacrificeHudPos: new SchemaField({
        left: new NumberField({ integer: true, min: 0 }),
        top: new NumberField({ integer: true, min: 0 })
      }, { required: false }),
      // HUD do Narrador (Recursos dos Jogadores). Toda chave NOVA de flag de
      // usuário TEM que ser declarada aqui, ou o DataModel a descarta em silêncio.
      gmResHudOpen: new BooleanField({ required: false }),
      gmResHudMin: new BooleanField({ required: false }),
      gmResHudPos: new SchemaField({
        left: new NumberField({ integer: true, min: 0 }),
        top: new NumberField({ integer: true, min: 0 })
      }, { required: false }),
      gmResHudHidden: new SetField(new StringField(), { required: false }),
      sheetPrefs: new MappingField(new SchemaField({
        width: new NumberField({ integer: true, positive: true }),
        height: new NumberField({ integer: true, positive: true }),
        tabs: new MappingField(new SchemaField({
          collapseSidebar: new BooleanField({ required: false }),
          group: new StringField({ required: false }),
          sort: new StringField({ required: false, initial: "m", choices: [...foundry.documents.BaseFolder.SORTING_MODES, "p"] })
        }), { required: false })
      }))
    };
  }
}
