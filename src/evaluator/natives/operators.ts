import { isTruthy } from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';

export function register(_native: RegisterNativeFn, op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  op('and', (l, r) => isTruthy(l) ? r : l);
  op('or', (l, r) => isTruthy(l) ? l : r);
}
