import {
  KtgValue, KtgBlock, KtgError,
  NONE, isCallable,
} from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('error', 3, (args) => {
    const [kindVal, messageVal, dataVal] = args;
    if (kindVal.type !== 'lit-word!') throw new KtgError('type', 'error expects a lit-word as kind');
    const message = messageVal.type === 'string!' ? messageVal.value : '';
    throw new KtgError(kindVal.name, message, dataVal);
  });

  native('try', 1, (args, ev, callerCtx, refinements) => {
    const block = args[0];
    if (block.type !== 'block!') throw new KtgError('type', 'try expects a block');

    const hasHandler = refinements.includes('handle');
    const handler = hasHandler ? args[1] : null;

    try {
      const value = ev.evalBlock(block, callerCtx);
      return makeResult(true, value, NONE, NONE, NONE);
    } catch (e) {
      if (e instanceof KtgError) {
        const kind: KtgValue = { type: 'lit-word!', name: e.errorName };
        const message: KtgValue = e.message ? { type: 'string!', value: e.message } : NONE;
        const data: KtgValue = e.data ?? NONE;

        let handlerValue: KtgValue = NONE;
        if (handler && isCallable(handler)) {
          const handlerArgs: KtgValue[] = [kind, message, data];
          const [result] = ev.callCallable(handler, handlerArgs, 0, callerCtx);
          handlerValue = result;
        }

        return makeResult(false, handlerValue, kind, message, data);
      }
      throw e;
    }
  }, { handle: 1 });
}

// --- Private helper ---

function makeResult(ok: boolean, value: KtgValue, kind: KtgValue, message: KtgValue, data: KtgValue): KtgValue {
  const ctx = new KtgContext();
  ctx.set('ok', { type: 'logic!', value: ok });
  ctx.set('value', value);
  ctx.set('kind', kind);
  ctx.set('message', message);
  ctx.set('data', data);
  return { type: 'context!', context: ctx };
}
