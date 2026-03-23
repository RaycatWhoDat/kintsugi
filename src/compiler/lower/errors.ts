import type {
  IRDecl, IRExpr, IRStmt, IRType, IRParam,
  IRExprStmt, IRVarDecl, IRSet, IRThrow, IRTry, IRIf,
  IRFuncDecl, IRReturn, IRUnaryOp, IRLiteral, IRNone,
} from '../ir';
import type { KtgValue, KtgBlock } from '@/evaluator/values';
import { lowerBlockToStmts } from './helpers';
import { ctx } from './helpers';
import { lowerError as compileError } from '../errors';

function lowerExpr(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  return ctx.lowerExpr(values, pos, scope);
}

export function lowerError(values: KtgValue[], pos: number, scope: any): [IRDecl, number] {
  pos++; // skip 'error'
  const args: IRExpr[] = [];
  for (let i = 0; i < 3 && pos < values.length; i++) {
    const [expr, nextPos] = lowerExpr(values, pos, scope);
    args.push(expr);
    pos = nextPos;
  }
  while (args.length < 3) args.push({ tag: 'none', type: 'none!' });

  return [{
    tag: 'throw',
    kind: args[0],
    message: args[1],
    data: args[2],
  } as IRThrow, pos];
}

export function lowerTry(values: KtgValue[], pos: number, scope: any): [IRDecl, number] {
  pos++; // skip 'try'
  const block = values[pos] as KtgBlock;
  pos++;

  const body = lowerBlockToStmts(block.values, scope);

  // Generate a temp var for the result
  const resultVar = '__try_result_' + pos;

  return [{
    tag: 'try',
    body,
    resultVar,
  } as IRTry, pos];
}

export function lowerTryHandle(values: KtgValue[], pos: number, scope: any): [IRDecl, number] {
  pos++; // skip 'try/handle' path

  // Consume the body block
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError('try/handle', 'expected a block');
  }
  const block = values[pos] as KtgBlock;
  pos++;

  // Consume the handler (a get-word referencing a function, or an inline function)
  const [handlerExpr, afterHandler] = lowerExpr(values, pos, scope);

  const body = lowerBlockToStmts(block.values, scope);

  // Desugar: try body, on error call handler with (kind, message, data)
  // and build a result! block
  return [{
    tag: 'try',
    body,
    handler: {
      kindVar: '__err_kind',
      messageVar: '__err_msg',
      dataVar: '__err_data',
      body: [
        { tag: 'set', name: '__handler_result', type: 'any!',
          value: { tag: 'call', type: 'any!', func: handlerExpr, args: [
            { tag: 'get', type: 'any!', name: '__err_kind' },
            { tag: 'get', type: 'any!', name: '__err_msg' },
            { tag: 'get', type: 'any!', name: '__err_data' },
          ] } } as any,
      ],
    },
    resultVar: '__try_result_' + pos,
  } as IRTry, afterHandler];
}

export function lowerAttempt(values: KtgValue[], pos: number, scope: any): [IRDecl, number] {
  pos++; // skip 'attempt'
  const block = values[pos] as KtgBlock;
  pos++;

  // Parse the attempt dialect
  const bv = block.values;
  let hasSource = false;
  let sourceBlock: KtgValue[] | null = null;
  const steps: { type: 'then' | 'when'; values: KtgValue[] }[] = [];
  const handlers: { kind: string; values: KtgValue[] }[] = [];
  let fallbackValues: KtgValue[] | null = null;
  let retries = 0;

  let i = 0;
  while (i < bv.length) {
    const v = bv[i];
    if (v.type !== 'word!' && !(v.type === 'logic!' && v.value === true)) { i++; continue; }
    const name = v.type === 'word!' ? v.name : 'on';

    if (name === 'source' && i + 1 < bv.length && bv[i + 1].type === 'block!') {
      hasSource = true;
      sourceBlock = (bv[i + 1] as KtgBlock).values;
      i += 2;
    } else if (name === 'then' && i + 1 < bv.length && bv[i + 1].type === 'block!') {
      steps.push({ type: 'then', values: (bv[i + 1] as KtgBlock).values });
      i += 2;
    } else if (name === 'when' && i + 1 < bv.length && bv[i + 1].type === 'block!') {
      steps.push({ type: 'when', values: (bv[i + 1] as KtgBlock).values });
      i += 2;
    } else if (name === 'on' && i + 1 < bv.length && bv[i + 1].type === 'lit-word!' && i + 2 < bv.length && bv[i + 2].type === 'block!') {
      handlers.push({ kind: (bv[i + 1] as any).name, values: (bv[i + 2] as KtgBlock).values });
      i += 3;
    } else if (name === 'retries' && i + 1 < bv.length && bv[i + 1].type === 'integer!') {
      retries = (bv[i + 1] as any).value;
      i += 2;
    } else if (name === 'fallback' && i + 1 < bv.length && bv[i + 1].type === 'block!') {
      fallbackValues = (bv[i + 1] as KtgBlock).values;
      i += 2;
    } else {
      i++;
    }
  }

  // Build the pipeline body: source -> then -> then -> ...
  const pipelineBody: IRStmt[] = [];

  if (hasSource && sourceBlock) {
    const sourceStmts = lowerBlockToStmts(sourceBlock, scope);
    // Last expression becomes 'it'
    const lastStmt = sourceStmts[sourceStmts.length - 1];
    const sourceExpr = lastStmt?.tag === 'expr' ? (lastStmt as IRExprStmt).expr
      : lastStmt?.tag === 'set' ? (lastStmt as IRSet).value
      : { tag: 'none', type: 'none!' } as IRNone;
    pipelineBody.push(...sourceStmts.slice(0, -1));
    pipelineBody.push({ tag: 'set', name: 'it', type: 'any!', value: sourceExpr } as IRSet);
  }

  for (const step of steps) {
    if (step.type === 'when') {
      const guardStmts = lowerBlockToStmts(step.values, scope);
      const lastGuard = guardStmts[guardStmts.length - 1];
      const guardExpr = lastGuard?.tag === 'expr' ? (lastGuard as IRExprStmt).expr
        : { tag: 'literal', type: 'logic!', value: true } as IRLiteral;
      pipelineBody.push({
        tag: 'if',
        condition: { tag: 'unary', type: 'logic!', op: 'not', operand: guardExpr } as IRUnaryOp,
        then: [{ tag: 'return', value: { tag: 'none', type: 'none!' } } as IRReturn],
      } as IRIf);
    } else {
      const thenStmts = lowerBlockToStmts(step.values, scope);
      const lastThen = thenStmts[thenStmts.length - 1];
      const thenExpr = lastThen?.tag === 'expr' ? (lastThen as IRExprStmt).expr
        : lastThen?.tag === 'set' ? (lastThen as IRSet).value
        : { tag: 'none', type: 'none!' } as IRNone;
      pipelineBody.push(...thenStmts.slice(0, -1));
      pipelineBody.push({ tag: 'set', name: 'it', type: 'any!', value: thenExpr } as IRSet);
    }
  }

  // Final: return it
  pipelineBody.push({ tag: 'return', value: { tag: 'get', type: 'any!', name: 'it' } } as IRReturn);

  if (!hasSource) {
    // No source -> reusable function with 'it' as parameter
    const funcDecl: IRFuncDecl = {
      tag: 'func',
      name: '__attempt_pipeline',
      params: [{ name: 'it', type: 'any!' }],
      returnType: 'any!',
      body: pipelineBody,
    };
    return [funcDecl, pos];
  }

  // Has source -> wrap in try, inline the pipeline
  if (handlers.length > 0 || fallbackValues) {
    const tryStmt: IRTry = {
      tag: 'try',
      body: pipelineBody,
      handler: handlers.length > 0 ? {
        kindVar: '__err_kind',
        messageVar: '__err_msg',
        dataVar: '__err_data',
        body: fallbackValues ? lowerBlockToStmts(fallbackValues, scope) : [],
      } : undefined,
    };
    return [tryStmt, pos];
  }

  // No error handling — just inline the pipeline
  return [{ tag: 'expr', expr: { tag: 'none', type: 'none!' } } as IRExprStmt, pos];
}
