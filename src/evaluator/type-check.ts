import { KtgContext } from './context';
import { KtgValue, KtgBlock, KtgError, isTruthy } from './values';
import type { Evaluator } from './evaluator';

export const TYPE_UNIONS: Record<string, string[]> = {
  'number!': ['integer!', 'float!'],
  'any-word!': ['word!', 'set-word!', 'get-word!', 'lit-word!', 'meta-word!'],
  'any-block!': ['block!', 'paren!', 'path!'],
  'scalar!': ['integer!', 'float!', 'money!', 'date!', 'time!', 'pair!', 'tuple!'],
};

export const TYPE_NAMES = new Set([
  'integer!', 'float!', 'money!', 'string!', 'logic!', 'none!',
  'pair!', 'tuple!', 'date!', 'time!', 'file!',
  'url!', 'email!', 'word!', 'set-word!', 'get-word!', 'lit-word!', 'meta-word!',
  'path!', 'block!', 'paren!', 'map!', 'context!', 'function!',
  'native!', 'op!', 'type!',
  'any-type!', 'number!', 'any-word!', 'any-block!', 'scalar!',
]);

function matchesTypeCore(value: KtgValue, typeName: string): boolean {
  if (typeName === 'any-type!') return true;
  if (value.type === typeName) return true;
  if (typeName === 'function!' && value.type === 'native!') return true;
  const union = TYPE_UNIONS[typeName];
  return union ? union.includes(value.type) : false;
}

// Parse @type rule block as field declarations: 'field-name type! or 'field-name [type!]
function parseFieldSpecs(rule: KtgBlock): { name: string; type: string }[] | null {
  const fields: { name: string; type: string }[] = [];
  const values = rule.values;
  let i = 0;
  while (i < values.length) {
    const v = values[i];
    if (v.type !== 'lit-word!') return null; // not a field spec — fall back to parseBlock
    const fieldName = v.name;
    i++;
    if (i >= values.length) return null;
    const next = values[i];
    if (next.type === 'block!' && next.values.length > 0 && next.values[0].type === 'word!') {
      fields.push({ name: fieldName, type: (next.values[0] as any).name });
      i++;
    } else if (next.type === 'word!' && (next as any).name.endsWith('!')) {
      fields.push({ name: fieldName, type: (next as any).name });
      i++;
    } else {
      return null;
    }
  }
  return fields.length > 0 ? fields : null;
}

function matchesContextFields(value: KtgValue, fields: { name: string; type: string }[], ctx: KtgContext, ev: Evaluator): boolean {
  if (value.type !== 'context!') return false;
  const ctxVal = (value as any).context as KtgContext;
  for (const field of fields) {
    const fieldVal = ctxVal.get(field.name);
    if (fieldVal === undefined) return false;
    if (!matchesType(fieldVal, field.type, ctx, ev)) return false;
  }
  return true;
}

// Returns true if valid, throws KtgError with specific message on guard failure
export function validateCustomType(value: KtgValue, resolved: any, ctx: KtgContext, ev: Evaluator, paramName?: string, constraint?: string): boolean {
  // Try context field validation if the rule looks like field specs and value is a context
  if (value.type === 'context!') {
    const fields = parseFieldSpecs(resolved.rule);
    if (fields) {
      if (!matchesContextFields(value, fields, ctx, ev)) return false;
      if (resolved.guard) {
        const guardCtx = new KtgContext(ctx);
        guardCtx.set('it', value);
        const guardResult = ev.evalBlock(resolved.guard, guardCtx);
        if (!isTruthy(guardResult)) {
          if (paramName) throw new KtgError('type', `${paramName} fails where clause for ${constraint}`);
          return false;
        }
      }
      return true;
    }
  }

  // Fall back to parseBlock for blocks and other values
  const { parseBlock } = require('./parse');
  const input = value.type === 'block!'
    ? value
    : { type: 'block!' as const, values: [value] };
  if (!parseBlock(input as any, resolved.rule, ctx, ev, { caseSensitive: !!resolved.enum })) return false;
  if (resolved.guard) {
    const guardCtx = new KtgContext(ctx);
    guardCtx.set('it', value);
    const guardResult = ev.evalBlock(resolved.guard, guardCtx);
    if (!isTruthy(guardResult)) {
      if (paramName) throw new KtgError('type', `${paramName} fails where clause for ${constraint}`);
      return false;
    }
  }
  return true;
}

export function matchesType(value: KtgValue, typeName: string, ctx?: KtgContext, ev?: Evaluator): boolean {
  if (matchesTypeCore(value, typeName)) return true;

  if (ctx) {
    const resolved = ctx.get(typeName);
    if (resolved && resolved.type === 'type!' && resolved.rule && ev) {
      return validateCustomType(value, resolved, ctx, ev);
    }
  }

  return false;
}

export function checkType(value: KtgValue, constraint: string, paramName: string, ctx?: KtgContext, evaluator?: Evaluator, elementType?: string): void {
  if (matchesTypeCore(value, constraint)) {
    // Passed basic type match — check element types if needed
  } else if (ctx) {
    const resolved = ctx.get(constraint);
    if (resolved && resolved.type === 'type!' && resolved.rule && evaluator) {
      if (!validateCustomType(value, resolved, ctx, evaluator, paramName, constraint)) {
        throw new KtgError('type', `${paramName} expects ${constraint}, got ${value.type}`);
      }
    } else {
      throw new KtgError('type', `${paramName} expects ${constraint}, got ${value.type}`);
    }
  } else {
    throw new KtgError('type', `${paramName} expects ${constraint}, got ${value.type}`);
  }

  if (elementType && value.type === 'block!' && value.values) {
    for (const elem of value.values) {
      if (!matchesType(elem, elementType, ctx, evaluator)) {
        throw new KtgError('type', `${paramName} expects ${constraint} of ${elementType}, got ${elem.type} element`);
      }
    }
  }
}
