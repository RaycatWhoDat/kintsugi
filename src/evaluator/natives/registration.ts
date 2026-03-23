import type { KtgValue } from '../values';
import type { Evaluator } from '../evaluator';
import type { KtgContext } from '../context';

export type NativeFn = (
  args: KtgValue[],
  ev: Evaluator,
  callerCtx: KtgContext,
  refinements: string[],
) => KtgValue;

export type RegisterNativeFn = (
  name: string,
  arity: number,
  fn: NativeFn,
  refinementArgs?: Record<string, number>,
) => void;

export type RegisterOpFn = (
  name: string,
  fn: (l: KtgValue, r: KtgValue) => KtgValue,
) => void;
