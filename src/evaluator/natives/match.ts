import {
  KtgValue, KtgBlock, KtgError,
  NONE, isTruthy, valuesEqual,
} from '../values';
import { matchesType } from '../type-check';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('match', 2, (args, ev, callerCtx) => {
    const [value, cases] = args;
    if (cases.type !== 'block!') throw new KtgError('type', 'match expects a cases block');

    // Normalize: wrap non-block values in a single-element block for positional matching
    const matchValues: KtgValue[] = value.type === 'block!' ? value.values : [value];

    const caseValues = cases.values;
    let i = 0;

    while (i < caseValues.length) {
      // Check for default:
      if (caseValues[i].type === 'set-word!' && (caseValues[i] as any).name === 'default') {
        i++;
        if (i < caseValues.length && caseValues[i].type === 'block!') {
          return ev.evalBlock(caseValues[i] as KtgBlock, callerCtx);
        }
        return NONE;
      }

      // Expect pattern block
      if (caseValues[i].type !== 'block!') { i++; continue; }
      const pattern = (caseValues[i] as KtgBlock).values;
      i++;

      // Check for 'when' guard before body
      let guard: KtgBlock | null = null;
      if (i < caseValues.length && caseValues[i].type === 'word!' && (caseValues[i] as any).name === 'when') {
        i++;
        if (i < caseValues.length && caseValues[i].type === 'block!') {
          guard = caseValues[i] as KtgBlock;
          i++;
        }
      }

      // Expect body block
      if (i >= caseValues.length || caseValues[i].type !== 'block!') continue;
      const body = caseValues[i] as KtgBlock;
      i++;

      // Try to match pattern against values
      const bindings = tryMatchPattern(pattern, matchValues, ev, callerCtx);
      if (bindings === null) continue;

      // Apply bindings to caller context
      for (const [name, val] of bindings) {
        callerCtx.set(name, val);
      }

      // Check guard if present
      if (guard) {
        if (!isTruthy(ev.evalBlock(guard, callerCtx))) continue;
      }

      // Match succeeded — evaluate body
      return ev.evalBlock(body, callerCtx);
    }

    return NONE;
  });
}

// --- Private helpers ---

// matchValuesEqual is now just valuesEqual — cross-type word matching is in the base
const matchValuesEqual = valuesEqual;

function tryMatchPattern(
  pattern: KtgValue[],
  values: KtgValue[],
  ev: Evaluator,
  ctx: KtgContext,
): Map<string, KtgValue> | null {
  // Special case: single wildcard [_] matches anything regardless of length
  if (pattern.length === 1 && pattern[0].type === 'word!' && (pattern[0] as any).name === '_') {
    return new Map();
  }

  // Single type match [integer!] — match single value by type
  if (pattern.length === 1 && pattern[0].type === 'word!' && (pattern[0] as any).name.endsWith('!')) {
    if (values.length === 1 && matchesType(values[0], (pattern[0] as any).name, ctx, ev)) {
      return new Map();
    }
    return null;
  }

  // Single capture word [x] matches single value (values may be length 1 from wrapping)
  if (pattern.length === 1 && pattern[0].type === 'word!' && (pattern[0] as any).name !== '_') {
    if (values.length === 1) {
      return new Map([[(pattern[0] as any).name, values[0]]]);
    }
    return new Map([[(pattern[0] as any).name, { type: 'block!', values } as KtgValue]]);
  }

  // Positional matching: pattern and values must be same length
  if (pattern.length !== values.length) return null;

  const bindings = new Map<string, KtgValue>();

  for (let j = 0; j < pattern.length; j++) {
    const p = pattern[j];
    const v = values[j];

    if (p.type === 'word!' && (p as any).name === '_') {
      continue;
    }

    // Type match: word ending in !
    if (p.type === 'word!' && (p as any).name.endsWith('!')) {
      if (!matchesType(v, (p as any).name, ctx, ev)) return null;
      continue;
    }

    if (p.type === 'word!') {
      bindings.set((p as any).name, v);
      continue;
    }

    if (p.type === 'lit-word!') {
      // Lit-word: match the word literally
      if (v.type === 'lit-word!' && v.name === (p as any).name) continue;
      if (v.type === 'word!' && v.name === (p as any).name) continue;
      return null;
    }

    if (p.type === 'paren!') {
      // Paren: evaluate expression, match against result
      const inner: KtgBlock = { type: 'block!', values: (p as any).values };
      const expected = ev.evalBlock(inner, ctx);
      if (!matchValuesEqual(expected, v)) return null;
      continue;
    }

    // Literal: match exactly
    if (!matchValuesEqual(p, v)) return null;
  }

  return bindings;
}
