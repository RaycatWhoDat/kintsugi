import { KtgError, NONE } from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';
import { requireModule } from '../require';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  // === Header ===
  // When running a file directly, the header is a no-op.
  // require consumes it before evaluation.
  native('Kintsugi', 1, () => NONE);

  native('require', 1, (args, ev, callerCtx, refinements) => {
    const fileVal = args[0];
    if (fileVal.type !== 'file!') throw new KtgError('type', 'require expects a file! path');
    const headerOnly = refinements.includes('header');
    return requireModule(fileVal.value, ev, callerCtx, headerOnly);
  }, { header: 0 });
}
