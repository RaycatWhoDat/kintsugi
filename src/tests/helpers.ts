import { Evaluator } from '@/evaluator';
import { KtgValue } from '@/evaluator/values';

/** Create a fresh evaluator and evaluate a string, returning the result. */
export function eval_(input: string): KtgValue {
  const ev = new Evaluator();
  return ev.evalString(input);
}

/** Create a fresh evaluator for multi-step tests. */
export function createEvaluator(): Evaluator {
  return new Evaluator();
}

/** Evaluate and return the output lines (from print/probe). */
export function evalOutput(input: string): string[] {
  const ev = new Evaluator();
  ev.evalString(input);
  return ev.output;
}
