import {
  KtgValue, KtgError, BreakSignal, ReturnSignal,
  NONE, TRUE, FALSE, isTruthy,
} from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';
import { evalLoop } from '../dialect-loop';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('if', 2, (args, ev, callerCtx) => {
    const [cond, block] = args;
    if (block.type !== 'block!') throw new KtgError('type', 'if expects a block as second argument');
    if (isTruthy(cond)) return ev.evalBlock(block, callerCtx);
    return NONE;
  });

  native('either', 3, (args, ev, callerCtx) => {
    const [cond, trueBlock, falseBlock] = args;
    if (trueBlock.type !== 'block!') throw new KtgError('type', 'either expects blocks');
    if (falseBlock.type !== 'block!') throw new KtgError('type', 'either expects blocks');
    return isTruthy(cond) ? ev.evalBlock(trueBlock, callerCtx) : ev.evalBlock(falseBlock, callerCtx);
  });

  native('loop', 1, (args, ev, callerCtx, refinements) => {
    const [block] = args;
    if (block.type !== 'block!') throw new KtgError('type', 'loop expects a block');

    let loopRefinement: 'none' | 'collect' | 'fold' | 'partition' = 'none';
    if (refinements.includes('collect')) loopRefinement = 'collect';
    if (refinements.includes('fold')) loopRefinement = 'fold';
    if (refinements.includes('partition')) loopRefinement = 'partition';

    const firstVal = block.values[0];
    if (firstVal && firstVal.type === 'word!' && (firstVal.name === 'for' || firstVal.name === 'from')) {
      return evalLoop(block, loopRefinement, ev, callerCtx);
    }
    try {
      while (true) {
        ev.evalBlock(block, callerCtx);
      }
    } catch (e) {
      if (e instanceof BreakSignal) return e.value;
      throw e;
    }
  });

  native('break', 0, () => {
    throw new BreakSignal();
  });

  native('return', 1, (args) => {
    throw new ReturnSignal(args[0]);
  });

  native('not', 1, (args) => {
    return isTruthy(args[0]) ? FALSE : TRUE;
  });

  native('unless', 2, (args, ev, callerCtx) => {
    const [cond, block] = args;
    if (block.type !== 'block!') throw new KtgError('type', 'unless expects a block');
    if (!isTruthy(cond)) return ev.evalBlock(block, callerCtx);
    return NONE;
  });

  native('all', 1, (args, ev, callerCtx) => {
    const block = args[0];
    if (block.type !== 'block!') throw new KtgError('type', 'all expects a block');
    let result: KtgValue = NONE;
    const values = block.values;
    let pos = 0;
    while (pos < values.length) {
      [result, pos] = ev.evalNext(values, pos, callerCtx);
      while (pos < values.length && ev.nextIsInfix(values, pos, callerCtx)) {
        [result, pos] = ev.applyInfix(result, values, pos, callerCtx);
      }
      if (!isTruthy(result)) return result;
    }
    return result;
  });

  native('any', 1, (args, ev, callerCtx) => {
    const block = args[0];
    if (block.type !== 'block!') throw new KtgError('type', 'any expects a block');
    let result: KtgValue = NONE;
    const values = block.values;
    let pos = 0;
    while (pos < values.length) {
      [result, pos] = ev.evalNext(values, pos, callerCtx);
      while (pos < values.length && ev.nextIsInfix(values, pos, callerCtx)) {
        [result, pos] = ev.applyInfix(result, values, pos, callerCtx);
      }
      if (isTruthy(result)) return result;
    }
    return NONE;
  });
}
