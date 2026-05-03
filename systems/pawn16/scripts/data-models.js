export class PawnDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { BooleanField, NumberField, StringField } = foundry.data.fields;

    return {
      side: new StringField({ required: true, initial: "white", blank: false }),
      file: new NumberField({ required: true, integer: true, min: 0, max: 15, initial: 0 }),
      rank: new NumberField({ required: true, integer: true, min: 0, max: 15, initial: 0 }),
      hasMoved: new BooleanField({ required: true, initial: false })
    };
  }
}
