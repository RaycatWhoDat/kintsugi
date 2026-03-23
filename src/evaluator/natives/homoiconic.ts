import {
  KtgValue, KtgBlock, KtgError,
  NONE, isCallable,
} from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';
import { createFunction } from '../functions';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('do', 1, (args, ev, callerCtx) => {
    const v = args[0];
    if (v.type === 'block!') return ev.evalBlock(v, callerCtx);
    if (v.type === 'string!') return ev.evalString(v.value);
    return v;
  });

  native('reduce', 1, (args, ev, callerCtx) => {
    const v = args[0];
    if (v.type !== 'block!') throw new KtgError('type', 'reduce expects a block');
    const results: KtgValue[] = [];
    const values = v.values;
    let pos = 0;
    while (pos < values.length) {
      let [result, nextPos] = ev.evalNext(values, pos, callerCtx);
      while (nextPos < values.length && ev.nextIsInfix(values, nextPos, callerCtx)) {
        [result, nextPos] = ev.applyInfix(result, values, nextPos, callerCtx);
      }
      results.push(result);
      pos = nextPos;
    }
    return { type: 'block!', values: results };
  });

  native('compose', 1, (args, ev, callerCtx) => {
    const v = args[0];
    if (v.type !== 'block!') throw new KtgError('type', 'compose expects a block');
    return { type: 'block!', values: composeBlock(v, ev, callerCtx) };
  });

  native('set', 2, (args, _ev, callerCtx) => {
    const [words, values] = args;
    if (words.type === 'block!' && values.type === 'block!') {
      for (let i = 0; i < words.values.length; i++) {
        const w = words.values[i];
        const v = values.values[i] ?? NONE;
        if (w.type === 'word!' || w.type === 'set-word!') {
          callerCtx.set(w.name, v);
        }
      }
      return values;
    }
    throw new KtgError('type', 'set expects two blocks');
  });

  native('apply', 2, (args, ev, callerCtx) => {
    const [fn, argBlock] = args;
    if (!isCallable(fn)) throw new KtgError('type', 'apply expects a function');
    if (argBlock.type !== 'block!') throw new KtgError('type', 'apply expects a block of arguments');
    const [result] = ev.callCallable(fn, argBlock.values, 0, callerCtx);
    return result;
  });

  // Register function keyword
  native('function', 2, (args, _ev, callerCtx) => {
    return createFunction(args[0], args[1], callerCtx);
  });

  native('does', 1, (args, _ev, callerCtx) => {
    const emptySpec: KtgBlock = { type: 'block!', values: [] };
    return createFunction(emptySpec, args[0], callerCtx);
  });

  native('bind', 2, (args) => {
    const [block, target] = args;
    if (block.type !== 'block!') throw new KtgError('type', 'bind expects a block');
    if (target.type !== 'context!') throw new KtgError('type', 'bind expects a context');
    bindBlock(block, target.context);
    return block;
  });

  native('words-of', 1, (args) => {
    const v = args[0];
    if (v.type !== 'context!') throw new KtgError('type', 'words-of expects a context');
    const words: KtgValue[] = [];
    for (const name of v.context.keys()) {
      words.push({ type: 'word!', name });
    }
    return { type: 'block!', values: words };
  });
}

// --- Private helpers ---

function bindBlock(block: KtgBlock, targetCtx: KtgContext): void {
  for (let i = 0; i < block.values.length; i++) {
    const v = block.values[i];
    if ((v.type === 'word!' || v.type === 'set-word!' || v.type === 'get-word!') && targetCtx.has(v.name)) {
      (v as any).bound = targetCtx;
    }
    // Recurse into nested blocks
    if (v.type === 'block!' || v.type === 'paren!') {
      bindBlock(v as KtgBlock, targetCtx);
    }
  }
}

function composeBlock(block: KtgBlock, ev: Evaluator, ctx: KtgContext): KtgValue[] {
  const result: KtgValue[] = [];
  for (const v of block.values) {
    if (v.type === 'paren!') {
      const inner: KtgBlock = { type: 'block!', values: v.values };
      result.push(ev.evalBlock(inner, ctx));
    } else if (v.type === 'block!') {
      result.push({ type: 'block!', values: composeBlock(v, ev, ctx) });
    } else {
      result.push(v);
    }
  }
  return result;
}
