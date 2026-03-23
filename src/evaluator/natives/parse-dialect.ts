import { KtgError } from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';
import { parseBlock, parseString } from '../parse';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {

  native('parse', 2, (args, ev, callerCtx) => {
    const [input, rules] = args;
    if (rules.type !== 'block!') throw new KtgError('type', 'parse expects a rule block');
    let ok: boolean;
    if (input.type === 'string!') {
      ok = parseString(input.value, rules, callerCtx, ev);
    } else if (input.type === 'block!') {
      ok = parseBlock(input, rules, callerCtx, ev);
    } else {
      throw new KtgError('type', 'parse expects a block or string');
    }
    // If top-level collect was used, return the collected block
    const collected = callerCtx.get('__parse_collect_result');
    if (collected && collected.type === 'block!') {
      callerCtx.unset('__parse_collect_result');
      return collected;
    }
    return { type: 'logic!', value: ok };
  });
}
