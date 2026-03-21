import { KtgContext } from './context';
import { KtgValue, KtgBlock, KtgError, isTruthy } from './values';
import type { Evaluator } from './evaluator';

export const TYPE_UNIONS: Record<string, string[]> = {
  'number!': ['integer!', 'float!'],
  'any-word!': ['word!', 'set-word!', 'get-word!', 'lit-word!', 'meta-word!'],
  'any-block!': ['block!', 'paren!', 'path!'],
  'scalar!': ['integer!', 'float!', 'date!', 'time!', 'pair!', 'tuple!'],
};

export const TYPE_NAMES = new Set([
  'integer!', 'float!', 'string!', 'logic!', 'none!',
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

export function matchesType(value: KtgValue, typeName: string, ctx?: KtgContext, ev?: Evaluator): boolean {
  if (matchesTypeCore(value, typeName)) return true;

  // User-defined types (@type) from context
  if (ctx) {
    const resolved = ctx.get(typeName);
    if (resolved && resolved.type === 'type!' && resolved.rule && ev) {
      const { parseBlock } = require('./parse');
      const input = value.type === 'block!'
        ? value
        : { type: 'block!' as const, values: [value] };
      if (!parseBlock(input as any, resolved.rule, ctx, ev)) return false;
      if (resolved.guard) {
        const guardCtx = new KtgContext(ctx);
        guardCtx.set('it', value);
        const guardResult = ev.evalBlock(resolved.guard, guardCtx);
        if (!isTruthy(guardResult)) return false;
      }
      return true;
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
      const { parseBlock } = require('./parse');
      const input = value.type === 'block!'
        ? value
        : { type: 'block!' as const, values: [value] };
      if (!parseBlock(input as any, resolved.rule, ctx, evaluator)) {
        throw new KtgError('type', `${paramName} expects ${constraint}, got ${value.type}`);
      }
      if (resolved.guard) {
        const guardCtx = new KtgContext(ctx);
        guardCtx.set('it', value);
        const guardResult = evaluator.evalBlock(resolved.guard, guardCtx);
        if (!isTruthy(guardResult)) {
          throw new KtgError('type', `${paramName} fails where clause for ${constraint}`);
        }
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
