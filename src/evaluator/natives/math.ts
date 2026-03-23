import { KtgError, NONE, numVal } from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('min', 2, (args) => {
    return numVal(args[0]) <= numVal(args[1]) ? args[0] : args[1];
  });

  native('max', 2, (args) => {
    return numVal(args[0]) >= numVal(args[1]) ? args[0] : args[1];
  });

  native('abs', 1, (args) => {
    const v = numVal(args[0]);
    return args[0].type === 'float!' ? { type: 'float!', value: Math.abs(v) } : { type: 'integer!', value: Math.abs(v) };
  });

  native('negate', 1, (args) => {
    if (args[0].type === 'money!') return { type: 'money!', cents: -args[0].cents };
    const v = numVal(args[0]);
    return args[0].type === 'float!' ? { type: 'float!', value: -v } : { type: 'integer!', value: -v };
  });

  native('round', 1, (args, _ev, _ctx, refinements) => {
    const v = numVal(args[0]);
    if (refinements.includes('down')) {
      return { type: 'integer!', value: Math.trunc(v) };
    }
    if (refinements.includes('up')) {
      return { type: 'integer!', value: v >= 0 ? Math.ceil(v) : Math.floor(v) };
    }
    return { type: 'integer!', value: Math.round(v) };
  });

  native('floor', 1, (args) => {
    return { type: 'integer!', value: Math.floor(numVal(args[0])) };
  });

  native('ceil', 1, (args) => {
    return { type: 'integer!', value: Math.ceil(numVal(args[0])) };
  });

  // --- Powers & roots ---

  native('sqrt', 1, (args) => {
    return { type: 'float!', value: Math.sqrt(numVal(args[0])) };
  });

  native('pow', 2, (args) => {
    const base = numVal(args[0]);
    const exp = numVal(args[1]);
    const result = Math.pow(base, exp);
    if (args[0].type === 'integer!' && args[1].type === 'integer!' && exp >= 0 && result === Math.floor(result)) {
      return { type: 'integer!', value: result };
    }
    return { type: 'float!', value: result };
  });

  // --- Trigonometry (degrees by default) ---

  native('sin', 1, (args) => {
    return { type: 'float!', value: Math.sin(numVal(args[0]) * Math.PI / 180) };
  });

  native('cos', 1, (args) => {
    return { type: 'float!', value: Math.cos(numVal(args[0]) * Math.PI / 180) };
  });

  native('tan', 1, (args) => {
    return { type: 'float!', value: Math.tan(numVal(args[0]) * Math.PI / 180) };
  });

  native('asin', 1, (args) => {
    return { type: 'float!', value: Math.asin(numVal(args[0])) * 180 / Math.PI };
  });

  native('acos', 1, (args) => {
    return { type: 'float!', value: Math.acos(numVal(args[0])) * 180 / Math.PI };
  });

  native('atan2', 2, (args) => {
    return { type: 'float!', value: Math.atan2(numVal(args[0]), numVal(args[1])) * 180 / Math.PI };
  });

  // --- Random ---

  native('random', 1, (args) => {
    const max = numVal(args[0]);
    if (args[0].type === 'integer!') {
      return { type: 'integer!', value: Math.floor(Math.random() * max) };
    }
    return { type: 'float!', value: Math.random() * max };
  });

  native('random-seed', 1, () => {
    // JS Math.random can't be seeded — this is a no-op in the interpreter.
    // Lua output uses math.randomseed which does work.
    return NONE;
  });

  native('odd?', 1, (args) => {
    return { type: 'logic!', value: numVal(args[0]) % 2 !== 0 };
  });

  native('even?', 1, (args) => {
    return { type: 'logic!', value: numVal(args[0]) % 2 === 0 };
  });

  native('codepoint', 1, (args) => {
    if (args[0].type !== 'string!' || args[0].value.length === 0) throw new KtgError('type', 'codepoint expects a non-empty string');
    return { type: 'integer!', value: args[0].value.codePointAt(0) ?? 0 };
  });

  native('from-codepoint', 1, (args) => {
    if (args[0].type !== 'integer!') throw new KtgError('type', 'from-codepoint expects an integer');
    return { type: 'string!', value: String.fromCodePoint(args[0].value) };
  });
}
