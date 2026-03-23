import type {
  IRDecl, IRExpr, IRStmt, IRType, IRParam,
  IRExprStmt, IRVarDecl, IRSet, IRIf, IRTry,
  IRLiteral, IRBlockLiteral, IRNone,
} from '../ir';
import type { KtgValue, KtgBlock } from '@/evaluator/values';

// Forward references — set by index.ts at module init time
export const ctx = {
  lowerBlock: null as unknown as (values: KtgValue[], scope: any) => IRDecl[],
  lowerExpr: null as unknown as (values: KtgValue[], pos: number, scope: any) => [IRExpr, number],
  lowerAtom: null as unknown as (values: KtgValue[], pos: number, scope: any) => [IRExpr, number],
};

export function lowerBlockToStmts(values: KtgValue[], scope: any): IRStmt[] {
  // Extract lifecycle hooks before lowering
  const { body: bodyValues, enter, exit } = extractHooksFromValues(values);

  const decls = ctx.lowerBlock(bodyValues, scope);
  let stmts: IRStmt[] = decls.map(d => {
    if (d.tag === 'var') {
      return { tag: 'set', name: d.name, type: d.type, value: d.value } as IRSet;
    }
    if (d.tag === 'func') {
      return { tag: 'set', name: d.name, type: 'function!', value: {
        tag: 'make-closure',
        type: 'function!',
        params: d.params,
        returnType: d.returnType,
        captures: [],
        body: d.body,
      }} as IRSet;
    }
    return d as IRStmt;
  });

  // If hooks present, wrap in try/finally
  if (enter || exit) {
    const enterStmts = enter ? lowerBlockToStmts(enter, scope) : [];
    const exitStmts = exit ? lowerBlockToStmts(exit, scope) : [];
    stmts = [
      ...enterStmts,
      { tag: 'try', body: stmts, finally: exitStmts } as IRTry,
    ];
  }

  return stmts;
}

function extractHooksFromValues(values: KtgValue[]): {
  body: KtgValue[];
  enter: KtgValue[] | null;
  exit: KtgValue[] | null;
} {
  let enter: KtgValue[] | null = null;
  let exit: KtgValue[] | null = null;
  const body: KtgValue[] = [];
  let i = 0;

  while (i < values.length) {
    const v = values[i];
    if (v.type === 'meta-word!' && v.name === 'enter' && i + 1 < values.length && values[i + 1].type === 'block!') {
      enter = (values[i + 1] as KtgBlock).values;
      i += 2;
    } else if (v.type === 'meta-word!' && v.name === 'exit' && i + 1 < values.length && values[i + 1].type === 'block!') {
      exit = (values[i + 1] as KtgBlock).values;
      i += 2;
    } else {
      body.push(v);
      i++;
    }
  }

  return { body, enter, exit };
}

export function lowerBlockLiteral(block: KtgBlock, scope: any): IRBlockLiteral {
  const values: IRExpr[] = block.values.map(v => {
    switch (v.type) {
      case 'integer!': return { tag: 'literal', type: 'integer!', value: v.value } as IRLiteral;
      case 'float!': return { tag: 'literal', type: 'float!', value: v.value } as IRLiteral;
      case 'string!': return { tag: 'literal', type: 'string!', value: v.value } as IRLiteral;
      case 'logic!': return { tag: 'literal', type: 'logic!', value: v.value } as IRLiteral;
      case 'word!': return { tag: 'literal', type: 'word!', value: v.name } as IRLiteral;
      case 'set-word!': return { tag: 'literal', type: 'word!', value: v.name } as IRLiteral;
      case 'lit-word!': return { tag: 'literal', type: 'lit-word!', value: v.name } as IRLiteral;
      case 'meta-word!': return { tag: 'literal', type: 'meta-word!', value: v.name } as IRLiteral;
      case 'none!': return { tag: 'none', type: 'none!' } as IRNone;
      default: return { tag: 'none', type: 'none!' } as IRNone;
    }
  });

  // Infer element type
  const types = new Set(values.map(v => v.type));
  const elementType: IRType = types.size === 1 ? [...types][0] as IRType : 'any!';

  return { tag: 'block', type: 'block!', elementType, values };
}

export function inferBinopType(op: string, leftType: IRType, rightType: IRType): IRType {
  // Comparison ops always return logic
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) return 'logic!';
  // Division always returns float
  if (op === '/') return 'float!';
  // If both are known and same numeric type
  if (leftType === 'integer!' && rightType === 'integer!') return 'integer!';
  if (leftType === 'float!' || rightType === 'float!') return 'float!';
  // String concatenation
  if (op === '+' && (leftType === 'string!' || rightType === 'string!')) return 'string!';
  return 'any!';
}
