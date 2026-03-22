import {
  KtgValue, KtgBlock, NONE,
} from './values';

export interface ObjectFieldSpec {
  name: string;
  type: string;
  hasDefault: boolean;
  defaultValue: KtgValue;  // NONE if no default
  optional: boolean;        // from [opt type!]
}

export function parseObjectDialect(block: KtgBlock): {
  fields: ObjectFieldSpec[];
  bodyStart: number;  // index where non-field entries begin
} {
  const fields: ObjectFieldSpec[] = [];
  const values = block.values;
  let i = 0;

  while (i < values.length) {
    const v = values[i];

    // A bare word followed by a type block = field declaration
    if (v.type === 'word!' && i + 1 < values.length && values[i + 1].type === 'block!') {
      const name = (v as any).name;
      const typeBlock = values[i + 1] as KtgBlock;
      let type = 'any-type!';
      let optional = false;

      if (typeBlock.values.length > 0) {
        let ti = 0;
        if (typeBlock.values[ti].type === 'word!' && (typeBlock.values[ti] as any).name === 'opt') {
          optional = true;
          ti++;
        }
        if (ti < typeBlock.values.length && typeBlock.values[ti].type === 'word!') {
          type = (typeBlock.values[ti] as any).name;
        }
      }
      i += 2;

      // Check for @default — implies opt
      let hasDefault = false;
      let defaultValue: KtgValue = NONE;
      if (i < values.length && values[i].type === 'meta-word!' && (values[i] as any).name === 'default') {
        hasDefault = true;
        optional = true;
        i++;
        if (i < values.length) {
          defaultValue = values[i];
          i++;
        }
      }

      fields.push({ name, type, hasDefault, defaultValue, optional });
      continue;
    }

    // Anything else (set-word, etc.) = end of field declarations
    break;
  }

  return { fields, bodyStart: i };
}
