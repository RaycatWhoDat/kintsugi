import {
  KtgValue, KtgBlock, KtgNative, KtgError,
  NONE, isTruthy,
} from '../values';
import { KtgContext } from '../context';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { Evaluator } from '../evaluator';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('attempt', 1, (args, ev, callerCtx) => {
    const block = args[0];
    if (block.type !== 'block!') throw new KtgError('type', 'attempt expects a block');
    const pipeline = parseAttemptDialect(block);

    // No source → return a reusable function
    if (!pipeline.source) {
      return createAttemptFunction(pipeline, ev, callerCtx);
    }

    return executeAttempt(pipeline, null, ev, callerCtx);
  });
}

// --- Private helpers ---

interface AttemptPipeline {
  source: KtgBlock | null;
  steps: { type: 'then' | 'when'; block: KtgBlock }[];
  handlers: { kind: string; block: KtgBlock }[];
  retries: number;
  fallback: KtgBlock | null;
}

function parseAttemptDialect(block: KtgBlock): AttemptPipeline {
  const pipeline: AttemptPipeline = {
    source: null, steps: [], handlers: [], retries: 0, fallback: null,
  };
  const vals = block.values;
  let i = 0;

  while (i < vals.length) {
    const v = vals[i];
    if (v.type !== 'word!' && v.type !== 'lit-word!') { i++; continue; }

    const name = v.type === 'word!' ? v.name : '';

    if (name === 'on' && i + 2 < vals.length && vals[i + 1].type === 'lit-word!' && vals[i + 2].type === 'block!') {
      pipeline.handlers.push({ kind: (vals[i + 1] as any).name, block: vals[i + 2] as KtgBlock });
      i += 3;
    } else if (name === 'source' && i + 1 < vals.length && vals[i + 1].type === 'block!') {
      pipeline.source = vals[i + 1] as KtgBlock;
      i += 2;
    } else if (name === 'then' && i + 1 < vals.length && vals[i + 1].type === 'block!') {
      pipeline.steps.push({ type: 'then', block: vals[i + 1] as KtgBlock });
      i += 2;
    } else if (name === 'when' && i + 1 < vals.length && vals[i + 1].type === 'block!') {
      pipeline.steps.push({ type: 'when', block: vals[i + 1] as KtgBlock });
      i += 2;
    } else if (name === 'retries' && i + 1 < vals.length && vals[i + 1].type === 'integer!') {
      pipeline.retries = (vals[i + 1] as any).value;
      i += 2;
    } else if (name === 'fallback' && i + 1 < vals.length && vals[i + 1].type === 'block!') {
      pipeline.fallback = vals[i + 1] as KtgBlock;
      i += 2;
    } else {
      i++;
    }
  }

  return pipeline;
}

function executeAttempt(
  pipeline: AttemptPipeline,
  initialIt: KtgValue | null,
  ev: Evaluator,
  callerCtx: KtgContext,
): KtgValue {
  const attemptCtx = new KtgContext(callerCtx);
  let retriesLeft = pipeline.retries;

  const runPipeline = (): KtgValue => {
    let it: KtgValue = initialIt ?? NONE;

    // Run source if present
    if (pipeline.source) {
      attemptCtx.set('it', it);
      it = ev.evalBlock(pipeline.source, attemptCtx);
    }

    // Run steps
    for (const step of pipeline.steps) {
      attemptCtx.set('it', it);
      if (step.type === 'when') {
        const guardResult = ev.evalBlock(step.block, attemptCtx);
        if (!isTruthy(guardResult)) return NONE;
      } else {
        it = ev.evalBlock(step.block, attemptCtx);
      }
    }

    return it;
  };

  while (true) {
    try {
      return runPipeline();
    } catch (e) {
      if (e instanceof KtgError) {
        // Check named handlers
        for (const handler of pipeline.handlers) {
          if (handler.kind === e.errorName) {
            attemptCtx.set('it', e.data ?? NONE);
            return ev.evalBlock(handler.block, attemptCtx);
          }
        }

        // Retry if allowed
        if (retriesLeft > 0) {
          retriesLeft--;
          continue;
        }

        // Fallback
        if (pipeline.fallback) {
          return ev.evalBlock(pipeline.fallback, attemptCtx);
        }

        // Re-throw if nothing handles it
        throw e;
      }
      throw e;
    }
  }
}

function createAttemptFunction(
  pipeline: AttemptPipeline,
  ev: Evaluator,
  callerCtx: KtgContext,
): KtgNative {
  return {
    type: 'native!',
    name: 'attempt-pipeline',
    arity: 1,
    fn: (args: KtgValue[]) => {
      return executeAttempt(pipeline, args[0], ev, callerCtx);
    },
  };
}
