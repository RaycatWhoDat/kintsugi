import type {
  IRDecl, IRExpr, IRStmt, IRType, IRParam,
  IRExprStmt, IRVarDecl, IRSet, IRIf, IRForRange, IRForEach,
  IRLoop, IRInlineIf, IRUnaryOp, IRBinOp,
} from '../ir';
import type { KtgValue, KtgBlock } from '@/evaluator/values';
import { lowerBlockToStmts } from './helpers';
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

export function lowerIfExpr(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'if'
  const [condition, afterCond] = lowerExpr(values, pos, scope);
  if (afterCond >= values.length || values[afterCond].type !== 'block!') {
    compileError('if', 'expected a block after condition');
  }
  const bodyBlock = values[afterCond] as KtgBlock;
  const body = lowerBlockToStmts(bodyBlock.values, scope);
  return [{ tag: 'inline-if', type: 'any!', condition, then: body } as IRInlineIf, afterCond + 1];
}

export function lowerEitherExpr(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'either'
  const [condition, afterCond] = lowerExpr(values, pos, scope);
  if (afterCond >= values.length || values[afterCond].type !== 'block!') {
    compileError('either', 'expected a block after condition');
  }
  if (afterCond + 1 >= values.length || values[afterCond + 1].type !== 'block!') {
    compileError('either', 'expected two blocks');
  }
  const thenBlock = values[afterCond] as KtgBlock;
  const elseBlock = values[afterCond + 1] as KtgBlock;
  const thenBody = lowerBlockToStmts(thenBlock.values, scope);
  const elseBody = lowerBlockToStmts(elseBlock.values, scope);
  return [{ tag: 'inline-if', type: 'any!', condition, then: thenBody, else: elseBody } as IRInlineIf, afterCond + 2];
}

export function lowerUnlessExpr(values: KtgValue[], pos: number, scope: any): [IRExpr, number] {
  pos++; // skip 'unless'
  const [condition, afterCond] = lowerExpr(values, pos, scope);
  if (afterCond >= values.length || values[afterCond].type !== 'block!') {
    compileError('unless', 'expected a block after condition');
  }
  const bodyBlock = values[afterCond] as KtgBlock;
  const body = lowerBlockToStmts(bodyBlock.values, scope);
  const negated: IRUnaryOp = { tag: 'unary', type: 'logic!', op: 'not', operand: condition };
  return [{ tag: 'inline-if', type: 'any!', condition: negated, then: body } as IRInlineIf, afterCond + 1];
}

export function lowerIf(values: KtgValue[], pos: number, scope: any): [IRIf, number] {
  pos++; // skip 'if'
  const [condition, afterCond] = lowerExpr(values, pos, scope);
  if (afterCond >= values.length || values[afterCond].type !== 'block!') {
    compileError('if', 'expected a block after condition');
  }
  const bodyBlock = values[afterCond] as KtgBlock;
  const body = lowerBlockToStmts(bodyBlock.values, scope);
  return [{ tag: 'if', condition, then: body }, afterCond + 1];
}

export function lowerEither(values: KtgValue[], pos: number, scope: any): [IRIf, number] {
  pos++; // skip 'either'
  const [condition, afterCond] = lowerExpr(values, pos, scope);
  if (afterCond >= values.length || values[afterCond].type !== 'block!') {
    compileError('either', 'expected a block after condition');
  }
  if (afterCond + 1 >= values.length || values[afterCond + 1].type !== 'block!') {
    compileError('either', 'expected two blocks (then and else)');
  }
  const thenBlock = values[afterCond] as KtgBlock;
  const elseBlock = values[afterCond + 1] as KtgBlock;
  const thenBody = lowerBlockToStmts(thenBlock.values, scope);
  const elseBody = lowerBlockToStmts(elseBlock.values, scope);
  return [{ tag: 'if', condition, then: thenBody, else: elseBody }, afterCond + 2];
}

export function lowerUnless(values: KtgValue[], pos: number, scope: any): [IRIf, number] {
  pos++; // skip 'unless'
  const [condition, afterCond] = lowerExpr(values, pos, scope);
  const bodyBlock = values[afterCond] as KtgBlock;
  const body = lowerBlockToStmts(bodyBlock.values, scope);
  // unless = if (not condition)
  const negated: IRUnaryOp = { tag: 'unary', type: 'logic!', op: 'not', operand: condition };
  return [{ tag: 'if', condition: negated, then: body }, afterCond + 1];
}

export function lowerLoop(values: KtgValue[], pos: number, scope: any, refinement?: string): [IRDecl | IRDecl[], number] {
  pos++; // skip 'loop'
  if (pos >= values.length || values[pos].type !== 'block!') {
    compileError('loop', 'expected a block');
  }
  const block = values[pos] as KtgBlock;
  pos++;

  const blockValues = block.values;
  if (blockValues.length === 0) {
    return [{ tag: 'loop', body: [] } as IRLoop, pos];
  }

  const first = blockValues[0];

  // Check for dialect: first word is 'for' or 'from'
  if (first.type === 'word!' && (first.name === 'for' || first.name === 'from')) {
    const decls = lowerLoopDialect(blockValues, scope, refinement);
    return [decls.length === 1 ? decls[0] : decls, pos];
  }

  // Simple infinite loop
  const body = lowerBlockToStmts(blockValues, scope);
  return [{ tag: 'loop', body } as IRLoop, pos];
}

export function lowerLoopDialect(values: KtgValue[], scope: any, refinement?: string): IRDecl[] {
  let i = 0;
  let vars: IRParam[] = [];
  let source: 'range' | 'series' = 'range';
  let fromExpr: IRExpr = { tag: 'literal', type: 'integer!', value: 1 };
  let toExpr: IRExpr = { tag: 'literal', type: 'integer!', value: 0 };
  let stepExpr: IRExpr = { tag: 'literal', type: 'integer!', value: 1 };
  let seriesExpr: IRExpr | null = null;
  let guard: IRExpr | null = null;
  let body: IRStmt[] = [];

  while (i < values.length) {
    const v = values[i];

    if (v.type === 'word!' && v.name === 'for') {
      i++;
      if (values[i]?.type === 'block!') {
        const varBlock = values[i] as KtgBlock;
        vars = varBlock.values
          .filter(v => v.type === 'word!')
          .map(v => ({ name: (v as any).name, type: 'any!' as IRType }));
        i++;
      }
      continue;
    }

    if (v.type === 'word!' && v.name === 'in') {
      i++;
      source = 'series';
      if (values[i]) {
        const [expr, next] = lowerExpr(values, i, scope);
        seriesExpr = expr;
        i = next;
      }
      continue;
    }

    if (v.type === 'word!' && v.name === 'from') {
      i++;
      source = 'range';
      if (values[i]) {
        const [expr, next] = lowerExpr(values, i, scope);
        fromExpr = expr;
        i = next;
      }
      continue;
    }

    if (v.type === 'word!' && v.name === 'to') {
      i++;
      if (values[i]) {
        const [expr, next] = lowerExpr(values, i, scope);
        toExpr = expr;
        i = next;
      }
      continue;
    }

    if (v.type === 'word!' && v.name === 'by') {
      i++;
      if (values[i]) {
        const [expr, next] = lowerExpr(values, i, scope);
        stepExpr = expr;
        i = next;
      }
      continue;
    }

    if (v.type === 'word!' && v.name === 'when') {
      i++;
      if (values[i]?.type === 'block!') {
        const guardBlock = values[i] as KtgBlock;
        const guardStmts = lowerBlockToStmts(guardBlock.values, scope);
        // Extract the last expression as the guard condition
        const lastStmt = guardStmts[guardStmts.length - 1];
        if (lastStmt && lastStmt.tag === 'expr') {
          guard = (lastStmt as IRExprStmt).expr;
        } else if (lastStmt && lastStmt.tag === 'set') {
          guard = (lastStmt as IRSet).value;
        }
        i++;
      }
      continue;
    }

    if (v.type === 'block!') {
      body = lowerBlockToStmts((v as KtgBlock).values, scope);
      i++;
      continue;
    }

    i++;
  }

  if (vars.length === 0) vars = [{ name: 'it', type: 'any!' }];

  // Wrap body with guard if present
  if (guard) {
    body = [{
      tag: 'if',
      condition: guard,
      then: body,
    } as IRIf];
  }

  // Handle refinements: collect, fold, partition
  if (refinement === 'collect') {
    return lowerLoopCollect(vars, source, fromExpr, toExpr, stepExpr, seriesExpr, body, scope);
  }
  if (refinement === 'fold') {
    return lowerLoopFold(vars, source, fromExpr, toExpr, stepExpr, seriesExpr, body, scope);
  }
  if (refinement === 'partition') {
    return lowerLoopPartition(vars, source, fromExpr, toExpr, stepExpr, seriesExpr, body, scope);
  }

  const loop = buildLoop(vars, source, fromExpr, toExpr, stepExpr, seriesExpr, body);
  return [loop];
}

function buildLoop(
  vars: IRParam[], source: string,
  fromExpr: IRExpr, toExpr: IRExpr, stepExpr: IRExpr,
  seriesExpr: IRExpr | null, body: IRStmt[],
): IRStmt {
  if (source === 'range') {
    return {
      tag: 'for-range', variable: vars[0].name, varType: vars[0].type,
      from: fromExpr, to: toExpr, step: stepExpr, body,
    } as IRForRange;
  }
  return {
    tag: 'for-each', variables: vars,
    source: seriesExpr ?? { tag: 'block', type: 'block!', elementType: 'any!', values: [] },
    stride: vars.length, body,
  } as IRForEach;
}

export function lowerLoopCollect(
  vars: IRParam[], source: string,
  fromExpr: IRExpr, toExpr: IRExpr, stepExpr: IRExpr,
  seriesExpr: IRExpr | null, body: IRStmt[], scope: any,
): IRDecl[] {
  const resultName = '__collect_result';
  const init: IRVarDecl = { tag: 'var', name: resultName, type: 'block!', value: { tag: 'block', type: 'block!', elementType: 'any!', values: [] } };

  const wrappedBody: IRStmt[] = [
    ...body,
    { tag: 'expr', expr: { tag: 'builtin', type: 'block!', name: 'append', args: [
      { tag: 'get', type: 'block!', name: resultName },
      { tag: 'get', type: 'any!', name: '__loop_val' },
    ] } } as IRExprStmt,
  ];

  const collectBody: IRStmt[] = [
    { tag: 'set', name: '__loop_val', type: 'any!', value: body.length > 0 && body[body.length - 1].tag === 'expr'
      ? (body[body.length - 1] as IRExprStmt).expr
      : { tag: 'none', type: 'none!' } } as IRSet,
    { tag: 'expr', expr: { tag: 'builtin', type: 'block!', name: 'append', args: [
      { tag: 'get', type: 'block!', name: resultName },
      { tag: 'get', type: 'any!', name: '__loop_val' },
    ] } } as IRExprStmt,
  ];

  const bodyPrefix = body.slice(0, -1);
  const fullBody = [...bodyPrefix, ...collectBody];

  const loop = buildLoop(vars, source, fromExpr, toExpr, stepExpr, seriesExpr, fullBody);
  return [init, loop, { tag: 'expr', expr: { tag: 'get', type: 'block!', name: resultName } } as IRExprStmt];
}

export function lowerLoopFold(
  vars: IRParam[], source: string,
  fromExpr: IRExpr, toExpr: IRExpr, stepExpr: IRExpr,
  seriesExpr: IRExpr | null, body: IRStmt[], scope: any,
): IRDecl[] {
  const accName = vars[0].name;
  const iterVars = vars.slice(1);
  const iterVarName = iterVars.length > 0 ? iterVars[0].name : '__fold_n';

  if (source === 'range') {
    const init: IRVarDecl = { tag: 'var', name: accName, type: 'any!', value: fromExpr };

    const lastStmt = body[body.length - 1];
    const bodyExpr = lastStmt?.tag === 'expr' ? (lastStmt as IRExprStmt).expr : { tag: 'none', type: 'none!' as const };
    const foldBody: IRStmt[] = [
      ...body.slice(0, -1),
      { tag: 'set', name: accName, type: 'any!', value: bodyExpr } as IRSet,
    ];

    const startExpr: IRExpr = { tag: 'binop', type: 'integer!', op: '+', left: fromExpr, right: stepExpr };

    const loop: IRForRange = {
      tag: 'for-range',
      variable: iterVarName,
      varType: 'any!',
      from: startExpr,
      to: toExpr,
      step: stepExpr,
      body: foldBody,
    };

    return [init, loop, { tag: 'expr', expr: { tag: 'get', type: 'any!', name: accName } } as IRExprStmt];
  }

  // Series fold
  const srcExpr = seriesExpr ?? { tag: 'block', type: 'block!' as const, elementType: 'any!' as const, values: [] };
  const init: IRVarDecl = {
    tag: 'var', name: accName, type: 'any!',
    value: { tag: 'index', type: 'any!', target: srcExpr, position: { tag: 'literal', type: 'integer!', value: 1 } },
  };

  const lastStmt = body[body.length - 1];
  const bodyExpr = lastStmt?.tag === 'expr' ? (lastStmt as IRExprStmt).expr : { tag: 'none', type: 'none!' as const };
  const foldBody: IRStmt[] = [
    ...body.slice(0, -1),
    { tag: 'set', name: accName, type: 'any!', value: bodyExpr } as IRSet,
  ];

  const loop: IRForRange = {
    tag: 'for-range',
    variable: '__fold_i',
    varType: 'integer!',
    from: { tag: 'literal', type: 'integer!', value: 2 },
    to: { tag: 'builtin', type: 'integer!', name: 'length?', args: [srcExpr] },
    step: { tag: 'literal', type: 'integer!', value: 1 },
    body: [
      { tag: 'set', name: iterVarName, type: 'any!',
        value: { tag: 'index', type: 'any!', target: srcExpr, position: { tag: 'get', type: 'integer!', name: '__fold_i' } } } as IRSet,
      ...foldBody,
    ],
  };

  return [init, loop, { tag: 'expr', expr: { tag: 'get', type: 'any!', name: accName } } as IRExprStmt];
}

export function lowerLoopPartition(
  vars: IRParam[], source: string,
  fromExpr: IRExpr, toExpr: IRExpr, stepExpr: IRExpr,
  seriesExpr: IRExpr | null, body: IRStmt[], scope: any,
): IRDecl[] {
  const truthyName = '__partition_truthy';
  const falsyName = '__partition_falsy';
  const emptyBlock: IRExpr = { tag: 'block', type: 'block!', elementType: 'any!', values: [] };

  const init: IRDecl[] = [
    { tag: 'var', name: truthyName, type: 'block!', value: emptyBlock } as IRVarDecl,
    { tag: 'var', name: falsyName, type: 'block!', value: emptyBlock } as IRVarDecl,
  ];

  const iterVar = vars[0].name;
  const partitionBody: IRStmt[] = [
    ...body.slice(0, -1),
    {
      tag: 'if',
      condition: body.length > 0 && body[body.length - 1].tag === 'expr'
        ? (body[body.length - 1] as IRExprStmt).expr
        : { tag: 'literal', type: 'logic!', value: true },
      then: [{ tag: 'expr', expr: { tag: 'builtin', type: 'block!', name: 'append', args: [
        { tag: 'get', type: 'block!', name: truthyName },
        { tag: 'get', type: 'any!', name: iterVar },
      ] } } as IRExprStmt],
      else: [{ tag: 'expr', expr: { tag: 'builtin', type: 'block!', name: 'append', args: [
        { tag: 'get', type: 'block!', name: falsyName },
        { tag: 'get', type: 'any!', name: iterVar },
      ] } } as IRExprStmt],
    } as IRIf,
  ];

  const loop = buildLoop(vars, source, fromExpr, toExpr, stepExpr, seriesExpr, partitionBody);

  const resultExpr: IRExpr = {
    tag: 'block', type: 'block!', elementType: 'block!',
    values: [
      { tag: 'get', type: 'block!', name: truthyName },
      { tag: 'get', type: 'block!', name: falsyName },
    ],
  };

  return [...init, loop, { tag: 'expr', expr: resultExpr } as IRExprStmt];
}

export function lowerMatch(values: KtgValue[], pos: number, scope: any): [IRIf, number] {
  pos++; // skip 'match'
  const [matchValue, afterValue] = lowerExpr(values, pos, scope);
  const casesBlock = values[afterValue] as KtgBlock;
  pos = afterValue + 1;

  const ifChain = lowerMatchCases(matchValue, casesBlock.values, scope);
  return [ifChain, pos];
}

export function lowerMatchCases(matchValue: IRExpr, cases: KtgValue[], scope: any): IRIf {
  let i = 0;
  const branches: { condition: IRExpr; bindings: IRStmt[]; guardExpr?: IRExpr; body: IRStmt[] }[] = [];
  let defaultBody: IRStmt[] | undefined;

  while (i < cases.length) {
    // default:
    if (cases[i].type === 'set-word!' && (cases[i] as any).name === 'default') {
      i++;
      if (cases[i]?.type === 'block!') {
        defaultBody = lowerBlockToStmts((cases[i] as KtgBlock).values, scope);
        i++;
      }
      continue;
    }

    // pattern block
    if (cases[i].type !== 'block!') { i++; continue; }
    const pattern = cases[i] as KtgBlock;
    i++;

    // when guard
    let guardExpr: IRExpr | undefined;
    if (i < cases.length && cases[i].type === 'word!' && (cases[i] as any).name === 'when') {
      i++;
      if (i < cases.length && cases[i].type === 'block!') {
        const guardStmts = lowerBlockToStmts((cases[i] as KtgBlock).values, scope);
        const lastStmt = guardStmts[guardStmts.length - 1];
        if (lastStmt?.tag === 'expr') guardExpr = (lastStmt as IRExprStmt).expr;
        i++;
      }
    }

    // body block
    if (i >= cases.length || cases[i].type !== 'block!') continue;
    const body = lowerBlockToStmts((cases[i] as KtgBlock).values, scope);
    i++;

    const { condition, bindings } = buildPatternMatch(matchValue, pattern, scope);
    branches.push({ condition, bindings, guardExpr, body });
  }

  if (branches.length === 0) {
    return { tag: 'if', condition: { tag: 'literal', type: 'logic!', value: false }, then: [] };
  }

  // Build nested if/else chain from bottom up
  let result: IRIf;
  const lastBranch = branches[branches.length - 1];
  const lastCond = lastBranch.guardExpr
    ? { tag: 'binop' as const, type: 'logic!' as IRType, op: 'and' as const, left: lastBranch.condition, right: lastBranch.guardExpr }
    : lastBranch.condition;
  result = {
    tag: 'if',
    condition: lastCond,
    then: [...lastBranch.bindings, ...lastBranch.body],
    else: defaultBody,
  };

  for (let j = branches.length - 2; j >= 0; j--) {
    const branch = branches[j];
    const cond = branch.guardExpr
      ? { tag: 'binop' as const, type: 'logic!' as IRType, op: 'and' as const, left: branch.condition, right: branch.guardExpr }
      : branch.condition;
    result = {
      tag: 'if',
      condition: cond,
      then: [...branch.bindings, ...branch.body],
      else: [result],
    };
  }

  return result;
}

function buildPatternMatch(matchValue: IRExpr, pattern: KtgBlock, scope: any): { condition: IRExpr; bindings: IRStmt[] } {
  const pv = pattern.values;

  // Single wildcard [_] — always matches
  if (pv.length === 1 && pv[0].type === 'word!' && (pv[0] as any).name === '_') {
    return { condition: { tag: 'literal', type: 'logic!', value: true }, bindings: [] };
  }

  // Single type match [integer!]
  if (pv.length === 1 && pv[0].type === 'word!' && (pv[0] as any).name.endsWith('!')) {
    return {
      condition: { tag: 'binop', type: 'logic!', op: '=',
        left: { tag: 'builtin', type: 'string!', name: 'type', args: [matchValue] },
        right: { tag: 'literal', type: 'string!', value: (pv[0] as any).name },
      },
      bindings: [],
    };
  }

  // Single capture [x] — always matches, binds
  if (pv.length === 1 && pv[0].type === 'word!') {
    return {
      condition: { tag: 'literal', type: 'logic!', value: true },
      bindings: [{ tag: 'set', name: (pv[0] as any).name, type: 'any!', value: matchValue } as IRSet],
    };
  }

  // Single literal [42]
  if (pv.length === 1) {
    const [patExpr] = lowerAtom(pv, 0, scope);
    return {
      condition: { tag: 'binop', type: 'logic!', op: '=', left: matchValue, right: patExpr },
      bindings: [],
    };
  }

  // Multi-element: build conditions and bindings for each position
  const conditions: IRExpr[] = [];
  const bindings: IRStmt[] = [];

  for (let j = 0; j < pv.length; j++) {
    const p = pv[j];
    const elemAccess: IRExpr = { tag: 'index', type: 'any!', target: matchValue, position: { tag: 'literal', type: 'integer!', value: j + 1 } };

    if (p.type === 'word!' && (p as any).name === '_') {
      continue; // wildcard — no condition, no binding
    }
    if (p.type === 'word!' && (p as any).name.endsWith('!')) {
      // Type match at position
      conditions.push({ tag: 'binop', type: 'logic!', op: '=',
        left: { tag: 'builtin', type: 'string!', name: 'type', args: [elemAccess] },
        right: { tag: 'literal', type: 'string!', value: (p as any).name },
      });
      continue;
    }
    if (p.type === 'word!') {
      // Capture
      bindings.push({ tag: 'set', name: (p as any).name, type: 'any!', value: elemAccess } as IRSet);
      continue;
    }
    // Literal match
    const [litExpr] = lowerAtom(pv, j, scope);
    conditions.push({ tag: 'binop', type: 'logic!', op: '=', left: elemAccess, right: litExpr });
  }

  // Also check length matches
  conditions.unshift({ tag: 'binop', type: 'logic!', op: '=',
    left: { tag: 'builtin', type: 'integer!', name: 'length?', args: [matchValue] },
    right: { tag: 'literal', type: 'integer!', value: pv.length },
  });

  // AND all conditions together
  let condition: IRExpr = conditions.length > 0
    ? conditions.reduce((acc, c) => ({ tag: 'binop', type: 'logic!', op: 'and', left: acc, right: c } as IRBinOp))
    : { tag: 'literal', type: 'logic!', value: true };

  return { condition, bindings };
}
