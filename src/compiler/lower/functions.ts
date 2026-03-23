import type {
  IRDecl, IRExpr, IRStmt, IRType, IRParam,
  IRExprStmt, IRVarDecl, IRMakeClosure, IRMakeContext, IRBuiltinCall,
} from '../ir';
import type { KtgValue, KtgBlock } from '@/evaluator/values';
import { parseSpec } from '@/evaluator/functions';
import { parseObjectDialect } from '@/evaluator/dialect-object';
import { lowerBlockToStmts } from './helpers';
import { ctx } from './helpers';
import { lowerError as compileError } from '../errors';

function lowerExpr(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  return ctx.lowerExpr(values, pos, scope);
}

function lowerBlock(values: KtgValue[], scope: any): IRDecl[] {
  return ctx.lowerBlock(values, scope);
}

type ExprResult = IRExpr | { tag: 'func-raw'; params: IRParam[]; returnType: IRType; body: IRStmt[]; refinements?: any[] };

// Re-export the type for index.ts
export type { ExprResult };

export function lowerDoesExpr(values: KtgValue[], pos: number, scope: any, name?: string): [ExprResult, number] {
  // does [body] — like function [] [body]
  pos++; // skip 'does' word
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError(name ? `does ${name}` : 'does', 'expected body block');
  }
  const bodyBlock = values[pos] as KtgBlock;
  pos++;

  const params: IRParam[] = [];
  const returnType: IRType = 'any!';

  // Pre-register the function in scope for recursive calls
  if (name) {
    scope.set(name, {
      type: 'function!',
      arity: 0,
      params,
      returnType,
    });
  }

  const funcScope = scope.child();
  const bodyStmts = lowerBlockToStmts(bodyBlock.values, funcScope);

  if (name) {
    return [{
      tag: 'func-raw' as any,
      params,
      returnType,
      body: bodyStmts,
      refinements: [],
    }, pos];
  }

  return [{
    tag: 'make-closure',
    type: 'function!',
    params,
    returnType,
    captures: [],
    body: bodyStmts,
  } as IRMakeClosure, pos];
}

export function lowerContextExpr(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'context'
  const block = values[pos] as KtgBlock;
  pos++;

  // Walk the block: set-words followed by expressions become fields
  const fields: { name: string; type: IRType; value: IRExpr }[] = [];
  const fieldValues = block.values;
  let i = 0;

  while (i < fieldValues.length) {
    if (fieldValues[i].type === 'set-word!') {
      const fieldName = (fieldValues[i] as any).name;
      i++;
      const [value, nextI] = lowerExpr(fieldValues, i, scope);
      fields.push({ name: fieldName, type: value.type ?? 'any!', value });
      i = nextI;
    } else {
      i++;
    }
  }

  return [{ tag: 'make-context', type: 'context!', fields }, pos];
}

export function lowerFunctionExpr(values: KtgValue[], pos: number, scope: any, name?: string): [ExprResult, number] {
  // function [spec] [body]
  pos++; // skip 'function' word
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError(name ? `function ${name}` : 'function', 'expected spec block');
  }
  const specBlock = values[pos] as KtgBlock;
  pos++;
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError(name ? `function ${name}` : 'function', 'expected body block');
  }
  const bodyBlock = values[pos] as KtgBlock;
  pos++;

  const { params, returnType, refinements } = parseSpecBlock(specBlock);

  // Pre-register the function in scope for recursive calls
  if (name) {
    scope.set(name, {
      type: 'function!',
      arity: params.length,
      params,
      returnType,
    });
  }

  const funcScope = scope.child();
  for (const p of params) {
    funcScope.set(p.name, { type: p.type });
  }

  const bodyStmts = lowerBlockToStmts(bodyBlock.values, funcScope);

  // Infer return type from last statement if not explicitly declared
  let inferredReturnType = returnType;
  if (inferredReturnType === 'any!' && bodyStmts.length > 0) {
    const lastStmt = bodyStmts[bodyStmts.length - 1];
    if (lastStmt.tag === 'expr' && (lastStmt as IRExprStmt).expr.tag === 'make-closure') {
      inferredReturnType = 'function!';
    }
  }

  // Update scope with inferred return type
  if (name && inferredReturnType !== returnType) {
    scope.set(name, {
      type: 'function!',
      arity: params.length,
      params,
      returnType: inferredReturnType,
    });
  }

  // If named, return func-raw for the set-word handler to convert to IRFuncDecl
  // If anonymous, return IRMakeClosure directly
  if (name) {
    return [{
      tag: 'func-raw' as any,
      params,
      returnType: inferredReturnType,
      body: bodyStmts,
      refinements,
    }, pos];
  }

  return [{
    tag: 'make-closure',
    type: 'function!',
    params,
    returnType,
    captures: [], // Lua/JS handle captures natively
    body: bodyStmts,
  } as IRMakeClosure, pos];
}

export function parseSpecBlock(spec: KtgBlock): { params: IRParam[]; returnType: IRType; refinements: any[] } {
  const funcSpec = parseSpec(spec);
  const params: IRParam[] = funcSpec.params.map(p => ({
    name: p.name,
    type: (p.typeConstraint ?? 'any!') as IRType,
  }));
  const refinements = funcSpec.refinements.map(r => ({
    name: r.name,
    params: r.params.map(p => ({ name: p.name, type: (p.typeConstraint ?? 'any!') as IRType })),
  }));
  const returnType = (funcSpec.returnType ?? 'any!') as IRType;
  return { params, returnType, refinements };
}

export function lowerCallable(
  name: string,
  entry: { type: IRType; arity?: number; params?: IRParam[]; returnType?: IRType },
  values: KtgValue[],
  pos: number,
  scope: any,
  BUILTINS: Record<string, number>,
): [IRExpr, number] {
  const arity = entry.arity!;
  const args: IRExpr[] = [];

  for (let i = 0; i < arity; i++) {
    if (pos >= values.length) break;
    const [arg, nextPos] = lowerExpr(values, pos, scope);
    args.push(arg);
    pos = nextPos;
  }

  const isBuiltin = BUILTINS[name] !== undefined;
  const returnType = entry.returnType ?? 'any!';

  if (isBuiltin) {
    return [{ tag: 'builtin', type: returnType, name, args }, pos];
  }

  return [{ tag: 'call', type: returnType, func: name, args }, pos];
}

export function lowerRefinementCall(
  name: string,
  entry: { type: IRType; arity?: number; params?: IRParam[]; returnType?: IRType },
  refinements: string[],
  values: KtgValue[],
  pos: number,
  scope: any,
  BUILTINS: Record<string, number>,
): [IRExpr, number] {
  const arity = entry.arity!;
  const args: IRExpr[] = [];

  for (let i = 0; i < arity; i++) {
    if (pos >= values.length) break;
    const [arg, nextPos] = lowerExpr(values, pos, scope);
    args.push(arg);
    pos = nextPos;
  }

  // TODO: consume extra args for refinement params

  const isBuiltin = BUILTINS[name] !== undefined;
  if (isBuiltin) {
    return [{ tag: 'builtin', type: 'any!', name, args, refinements }, pos];
  }
  return [{ tag: 'call', type: 'any!', func: name, args, refinements }, pos];
}

export function lowerObjectExpr(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'object'
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError('object', 'expected a block');
  }
  const block = values[pos] as KtgBlock;
  pos++;

  const { fields, bodyStart } = parseObjectDialect(block);

  // Build field name and default arrays as IR block literals
  const fieldNames: IRExpr[] = fields.map(f => ({
    tag: 'literal' as const, type: 'string!' as IRType, value: f.name,
  }));

  const fieldDefaults: IRExpr[] = fields.map(f => {
    if (f.hasDefault) {
      // Lower the default value expression
      const [defaultExpr] = lowerExpr([f.defaultValue], 0, scope);
      return defaultExpr;
    }
    return { tag: 'none' as const, type: 'none!' as const };
  });

  // Lower the body (methods, computed fields) in a scope with `self` and fields available
  const objScope = scope.child();
  objScope.set('self', { type: 'context!' });
  for (const f of fields) {
    objScope.set(f.name, { type: 'any!' });
  }

  let bodyStmts: IRStmt[] = [];
  if (bodyStart < block.values.length) {
    const bodyValues = block.values.slice(bodyStart);
    bodyStmts = lowerBlockToStmts(bodyValues, objScope);
  }

  // Encode as a builtin call with structured args:
  //   arg 0: block of field names
  //   arg 1: block of field defaults
  //   arg 2: closure for the body (takes self param, executed for side effects)
  const namesBlock: IRExpr = { tag: 'block', type: 'block!', elementType: 'string!', values: fieldNames };
  const defaultsBlock: IRExpr = { tag: 'block', type: 'block!', elementType: 'any!', values: fieldDefaults };
  const bodyClosure: IRExpr = {
    tag: 'make-closure',
    type: 'function!',
    params: [{ name: '__obj', type: 'context!' as IRType }],
    returnType: 'none!' as IRType,
    captures: [],
    body: bodyStmts,
  };

  return [{
    tag: 'builtin',
    type: 'context!',
    name: 'object',
    args: [namesBlock, defaultsBlock, bodyClosure],
  } as IRBuiltinCall, pos];
}
