import { KtgError } from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';
import { parseBlock, parseString } from '../parse';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {

  native('parse', 2, (args, ev, callerCtx) => {
    const [input, rules] = args;
    if (rules.type !== 'block!') throw new KtgError('type', 'parse expects a rule block');
    if (input.type === 'string!') {
      return { type: 'logic!', value: parseString(input.value, rules, callerCtx, ev) };
    }
    if (input.type !== 'block!') throw new KtgError('type', 'parse expects a block or string');
    return { type: 'logic!', value: parseBlock(input, rules, callerCtx, ev) };
  });
}
