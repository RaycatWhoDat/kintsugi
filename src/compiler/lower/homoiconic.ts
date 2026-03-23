import type {
  IRDecl, IRExpr, IRStmt, IRType, IRParam,
  IRExprStmt, IRVarDecl, IRBinOp,
} from '../ir';
import type { KtgValue, KtgBlock } from '@/evaluator/values';
import { ctx } from './helpers';
import { lowerError as compileError } from '../errors';

function lowerExpr(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  return ctx.lowerExpr(values, pos, scope);
}

function lowerBlock(values: KtgValue[], scope: any): IRDecl[] {
  return ctx.lowerBlock(values, scope);
}

function lowerAtom(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  return ctx.lowerAtom(values, pos, scope);
}

export function lowerCompose(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'compose'
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError('compose', 'expected a block literal');
  }
  const block = values[pos] as KtgBlock;
  pos++;

  // Walk the block: plain values pass through, parens get lowered as expressions
  const resultValues: IRExpr[] = [];
  for (const v of block.values) {
    if (v.type === 'paren!') {
      // Lower the paren contents as an expression
      const innerDecls = lowerBlock((v as any).values, scope);
      const lastDecl = innerDecls[innerDecls.length - 1];
      if (lastDecl && lastDecl.tag === 'expr') {
        resultValues.push((lastDecl as IRExprStmt).expr);
      } else if (lastDecl && lastDecl.tag === 'var') {
        resultValues.push((lastDecl as IRVarDecl).value);
      } else {
        resultValues.push({ tag: 'none', type: 'none!' });
      }
    } else if (v.type === 'block!') {
      // Recurse into sub-blocks
      const [inner] = lowerCompose(
        [{ type: 'word!', name: 'compose' } as KtgValue, v],
        0, scope,
      );
      resultValues.push(inner);
    } else {
      // Literal value — pass through
      const [expr] = lowerAtom([v], 0, scope);
      resultValues.push(expr);
    }
  }

  const types = new Set(resultValues.map(v => v.type));
  const elementType: IRType = types.size === 1 ? [...types][0] as IRType : 'any!';
  return [{ tag: 'block', type: 'block!', elementType, values: resultValues }, pos];
}

export function lowerReduce(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'reduce'
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError('reduce', 'reduce requires a literal block in compiled code — use #preprocess for dynamic blocks');
  }
  const block = values[pos] as KtgBlock;
  pos++;

  // Evaluate each expression group in the block
  const resultValues: IRExpr[] = [];
  const bv = block.values;
  let i = 0;
  while (i < bv.length) {
    const [expr, nextI] = lowerExpr(bv, i, scope);
    resultValues.push(expr);
    i = nextI;
  }

  const types = new Set(resultValues.map(v => v.type));
  const elementType: IRType = types.size === 1 ? [...types][0] as IRType : 'any!';
  return [{ tag: 'block', type: 'block!', elementType, values: resultValues }, pos];
}

export function lowerBind(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'bind'
  // Consume both args, return the block unchanged.
  // In compiled code, bindings are already resolved by the compiler.
  const [blockExpr, afterBlock] = lowerExpr(values, pos, scope);
  const [_ctxExpr, afterCtx] = lowerExpr(values, afterBlock, scope);
  return [blockExpr, afterCtx];
}

export function lowerWordsOf(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'words-of'
  const [ctxExpr, nextPos] = lowerExpr(values, pos, scope);

  // If the context is a literal make-context, we know the keys
  if (ctxExpr.tag === 'make-context') {
    const keys: IRExpr[] = ctxExpr.fields.map(f => ({
      tag: 'literal' as const, type: 'string!' as IRType, value: f.name,
    }));
    return [{ tag: 'block', type: 'block!', elementType: 'string!', values: keys }, nextPos];
  }

  // Runtime: emit helper call to get table keys
  return [{ tag: 'builtin', type: 'block!', name: 'words-of', args: [ctxExpr] }, nextPos];
}

export function lowerAll(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'all'
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError('all', 'expected a block');
  }
  const block = values[pos] as KtgBlock;
  pos++;

  // Desugar: evaluate each expression, short-circuit with `and`
  const bv = block.values;
  const exprs: IRExpr[] = [];
  let i = 0;
  while (i < bv.length) {
    const [expr, nextI] = lowerExpr(bv, i, scope);
    exprs.push(expr);
    i = nextI;
  }

  if (exprs.length === 0) return [{ tag: 'literal', type: 'logic!', value: true }, pos];
  let result = exprs[0];
  for (let j = 1; j < exprs.length; j++) {
    result = { tag: 'binop', type: 'any!', op: 'and', left: result, right: exprs[j] };
  }
  return [result, pos];
}

export function lowerAny(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'any'
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError('any', 'expected a block');
  }
  const block = values[pos] as KtgBlock;
  pos++;

  // Desugar: evaluate each expression, short-circuit with `or`
  const bv = block.values;
  const exprs: IRExpr[] = [];
  let i = 0;
  while (i < bv.length) {
    const [expr, nextI] = lowerExpr(bv, i, scope);
    exprs.push(expr);
    i = nextI;
  }

  if (exprs.length === 0) return [{ tag: 'none', type: 'none!' }, pos];
  let result = exprs[0];
  for (let j = 1; j < exprs.length; j++) {
    result = { tag: 'binop', type: 'any!', op: 'or', left: result, right: exprs[j] };
  }
  return [result, pos];
}

export function lowerApply(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'apply'
  const [funcExpr, afterFunc] = lowerExpr(values, pos, scope);
  const [argsExpr, afterArgs] = lowerExpr(values, afterFunc, scope);

  // If args is a literal block, unpack to a direct call
  if (argsExpr.tag === 'block') {
    const funcRef = funcExpr.tag === 'get' ? funcExpr.name : funcExpr;
    return [{ tag: 'call', type: 'any!', func: funcRef as any, args: argsExpr.values }, afterArgs];
  }

  // Runtime: emit unpack call
  return [{ tag: 'builtin', type: 'any!', name: 'apply', args: [funcExpr, argsExpr] }, afterArgs];
}

export function lowerSet(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'set'
  const [wordsExpr, afterWords] = lowerExpr(values, pos, scope);
  const [valuesExpr, afterValues] = lowerExpr(values, afterWords, scope);

  // If both are literal blocks, desugar to individual assignments
  // and return the values block
  if (wordsExpr.tag === 'block' && valuesExpr.tag === 'block') {
    // We can't emit multiple statements from an expression lowerer,
    // so emit as a builtin that the emitter handles specially
    return [{ tag: 'builtin', type: 'block!', name: 'set', args: [wordsExpr, valuesExpr] }, afterValues];
  }

  return [{ tag: 'builtin', type: 'block!', name: 'set', args: [wordsExpr, valuesExpr] }, afterValues];
}
