import { NONE, valueToString } from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('print', 1, (args, ev) => {
    const line = valueToString(args[0]);
    ev.output.push(line);
    ev.onOutput?.(line);
    return NONE;
  });

  native('probe', 1, (args, ev) => {
    const line = valueToString(args[0]);
    ev.output.push(line);
    ev.onOutput?.(line);
    return args[0];
  });
}
