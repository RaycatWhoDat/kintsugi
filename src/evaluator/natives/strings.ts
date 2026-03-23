import { KtgValue, KtgError, valueToString, numVal } from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('join', 2, (args) => {
    const left = valueToString(args[0]);
    const right = args[1].type === 'block!'
      ? args[1].values.map(valueToString).join('')
      : valueToString(args[1]);
    return { type: 'string!', value: left + right };
  });

  native('rejoin', 1, (args, ev, callerCtx) => {
    const v = args[0];
    if (v.type !== 'block!') throw new KtgError('type', 'rejoin expects a block');
    // Evaluate each expression in the block, then join as strings
    const parts: string[] = [];
    const values = v.values;
    let pos = 0;
    while (pos < values.length) {
      let [result, nextPos] = ev.evalNext(values, pos, callerCtx);
      while (nextPos < values.length && ev.nextIsInfix(values, nextPos, callerCtx)) {
        [result, nextPos] = ev.applyInfix(result, values, nextPos, callerCtx);
      }
      parts.push(valueToString(result));
      pos = nextPos;
    }
    return { type: 'string!', value: parts.join('') };
  });

  native('trim', 1, (args) => {
    if (args[0].type !== 'string!') throw new KtgError('type', 'trim expects a string');
    return { type: 'string!', value: args[0].value.trim() };
  });

  native('split', 2, (args) => {
    if (args[0].type !== 'string!') throw new KtgError('type', 'split expects a string');
    const delim = valueToString(args[1]);
    const parts = args[0].value.split(delim);
    return { type: 'block!', values: parts.map(p => ({ type: 'string!' as const, value: p })) };
  });

  native('uppercase', 1, (args) => {
    if (args[0].type !== 'string!') throw new KtgError('type', 'uppercase expects a string');
    return { type: 'string!', value: args[0].value.toUpperCase() };
  });

  native('lowercase', 1, (args) => {
    if (args[0].type !== 'string!') throw new KtgError('type', 'lowercase expects a string');
    return { type: 'string!', value: args[0].value.toLowerCase() };
  });

  native('replace', 3, (args, _ev, _ctx, refinements) => {
    if (args[0].type !== 'string!') throw new KtgError('type', 'replace expects a string');
    const str = args[0].value;
    const from = valueToString(args[1]);
    const to = valueToString(args[2]);
    if (refinements.includes('first')) {
      return { type: 'string!', value: str.replace(from, to) };
    }
    return { type: 'string!', value: str.replaceAll(from, to) };
  }, { first: 0 });

  native('substring', 3, (args) => {
    if (args[0].type !== 'string!') throw new KtgError('type', 'substring expects a string');
    const str = args[0].value;
    const start = numVal(args[1]) - 1; // 1-based to 0-based
    const len = numVal(args[2]);
    return { type: 'string!', value: str.slice(start, start + len) };
  });
}
