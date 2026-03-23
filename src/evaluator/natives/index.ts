import { KtgContext } from '../context';
import { KtgValue, KtgNative, KtgOp } from '../values';
import type { Evaluator } from '../evaluator';

import { register as registerOutput } from './output';
import { register as registerControlFlow } from './control-flow';
import { register as registerOperators } from './operators';
import { register as registerSeries } from './series';
import { register as registerTypes } from './types';
import { register as registerStrings } from './strings';
import { register as registerMath } from './math';
import { register as registerHomoiconic } from './homoiconic';
import { register as registerErrors } from './errors';
import { register as registerMatch } from './match';
import { register as registerAttempt } from './attempt';
import { register as registerIO } from './io';
import { register as registerParseDialect } from './parse-dialect';

export function registerNatives(ctx: KtgContext, evaluator: Evaluator): void {
  const native = (
    name: string,
    arity: number,
    fn: (args: KtgValue[], ev: Evaluator, callerCtx: KtgContext, refinements: string[]) => KtgValue,
    refinementArgs?: Record<string, number>,
  ) => {
    ctx.set(name, { type: 'native!', name, arity, refinementArgs, fn } as KtgNative);
  };

  const op = (name: string, fn: (l: KtgValue, r: KtgValue) => KtgValue) => {
    ctx.set(name, { type: 'op!', name, fn } as KtgOp);
  };

  registerOutput(native, op, ctx, evaluator);
  registerControlFlow(native, op, ctx, evaluator);
  registerOperators(native, op, ctx, evaluator);
  registerSeries(native, op, ctx, evaluator);
  registerTypes(native, op, ctx, evaluator);
  registerStrings(native, op, ctx, evaluator);
  registerMath(native, op, ctx, evaluator);
  registerHomoiconic(native, op, ctx, evaluator);
  registerErrors(native, op, ctx, evaluator);
  registerMatch(native, op, ctx, evaluator);
  registerAttempt(native, op, ctx, evaluator);
  registerIO(native, op, ctx, evaluator);
  registerParseDialect(native, op, ctx, evaluator);
}
