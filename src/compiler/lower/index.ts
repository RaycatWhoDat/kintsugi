import {
  IRModule, IRDecl, IRStmt, IRExpr, IRParam, IRType,
  IRFuncDecl, IRVarDecl, IRExprStmt, IRIf, IRForRange, IRForEach,
  IRLoop, IRBreak, IRReturn, IRSet, IRThrow, IRTry, IRFieldSet,
  IRLiteral, IRGet, IRCall, IRBuiltinCall, IRBinOp, IRUnaryOp,
  IRBlockLiteral, IRFieldGet, IRMakeContext, IRMakeClosure, IRInlineIf, IRNone,
} from '../ir';
import { parseString } from '@/helpers';
import { astToValue, valueToString } from '@/evaluator/values';
import type { KtgValue, KtgBlock, FuncSpec } from '@/evaluator/values';
import { lowerError as compileError } from '../errors';

// Domain imports
import { lowerIf, lowerIfExpr, lowerEither, lowerEitherExpr, lowerUnless, lowerUnlessExpr, lowerLoop, lowerLoopDialect, lowerMatch } from './control-flow';
import { lowerFunctionExpr, lowerDoesExpr, lowerContextExpr, lowerObjectExpr, lowerCallable, lowerRefinementCall, parseSpecBlock } from './functions';
import { lowerError, lowerTry, lowerTryHandle, lowerAttempt } from './errors';
import { lowerCompose, lowerReduce, lowerBind, lowerWordsOf, lowerAll, lowerAny, lowerApply, lowerSet } from './homoiconic';
import { lowerBlockToStmts, lowerBlockLiteral, inferBinopType, ctx } from './helpers';

// ============================================================
// Built-in arity table
// ============================================================

const BUILTINS: Record<string, number> = {
  'print': 1, 'probe': 1,
  'if': 2, 'either': 3, 'unless': 2,
  'loop': 1, 'break': 0, 'return': 1, 'not': 1,
  'length?': 1, 'empty?': 1, 'first': 1, 'second': 1, 'last': 1,
  'pick': 2, 'copy': 1, 'append': 2, 'insert': 3, 'remove': 2,
  'select': 2, 'has?': 2, 'index?': 2,
  'type': 1, 'to': 2, 'make': 2,
  'join': 2, 'rejoin': 1, 'trim': 1, 'split': 2,
  'uppercase': 1, 'lowercase': 1, 'replace': 3,
  'min': 2, 'max': 2, 'abs': 1, 'negate': 1, 'round': 1,
  'floor': 1, 'ceil': 1,
  'sqrt': 1, 'pow': 2,
  'sin': 1, 'cos': 1, 'tan': 1, 'asin': 1, 'acos': 1, 'atan2': 2,
  'random': 1, 'random-seed': 1,
  'odd?': 1, 'even?': 1,
  'codepoint': 1, 'from-codepoint': 1,
  'substring': 3,
  'sort': 1,
  'context': 1, 'object': 1, 'does': 1,
  'set': 2, 'apply': 2,
  'error': 3, 'try': 1,
  'match': 2, 'parse': 2, 'is?': 2,
  'function': 2, 'attempt': 1, 'require': 1,
  // Type predicates
  'none?': 1, 'integer?': 1, 'float?': 1, 'string?': 1, 'logic?': 1,
  'money?': 1,
  'block?': 1, 'context?': 1, 'function?': 1,
  'pair?': 1, 'tuple?': 1, 'date?': 1, 'time?': 1,
  'file?': 1, 'url?': 1, 'email?': 1, 'word?': 1, 'meta-word?': 1, 'map?': 1,
};

const INFIX_OPS = new Set(['+', '-', '*', '/', '%', '=', '<>', '<', '>', '<=', '>=']);
const INFIX_WORDS = new Set(['and', 'or']);

// ============================================================
// Scope — track what's defined and its arity/type
// ============================================================

interface ScopeEntry {
  type: IRType;
  arity?: number;    // if it's a callable
  params?: IRParam[];
  returnType?: IRType;
}

export class Scope {
  private entries: Map<string, ScopeEntry> = new Map();
  private parent: Scope | null;

  constructor(parent: Scope | null = null) {
    this.parent = parent;
  }

  set(name: string, entry: ScopeEntry): void {
    this.entries.set(name, entry);
  }

  get(name: string): ScopeEntry | undefined {
    return this.entries.get(name) ?? this.parent?.get(name);
  }

  child(): Scope {
    return new Scope(this);
  }
}

// ============================================================
// Wire up the late-binding context for domain files
// ============================================================

ctx.lowerBlock = lowerBlock;
ctx.lowerExpr = lowerExpr;
ctx.lowerAtom = lowerAtom;

// ============================================================
// Public API
// ============================================================

export function lower(source: string): IRModule {
  const ast = parseString(source);
  const block = astToValue(ast) as KtgBlock;

  const scope = new Scope();
  // Register builtins in scope
  for (const [name, arity] of Object.entries(BUILTINS)) {
    scope.set(name, { type: 'native!', arity });
  }

  // Strip header: if first two values are word 'Kintsugi' (or path 'Kintsugi/Lua' etc) + block, skip them
  let bodyValues = block.values;
  if (bodyValues.length >= 2) {
    const first = bodyValues[0];
    const isHeader = (first.type === 'word!' && first.name === 'Kintsugi')
      || (first.type === 'path!' && first.segments[0] === 'Kintsugi');
    if (isHeader && bodyValues[1].type === 'block!') {
      bodyValues = bodyValues.slice(2);
    }
  }

  const declarations = lowerBlock(bodyValues, scope);

  return {
    name: '',
    dialect: 'script',
    exports: [],
    imports: [],
    declarations,
  };
}

// Re-export for the old import path
export { lowerProgram };
function lowerProgram(source: string): IRModule {
  return lower(source);
}

// ============================================================
// Block lowering — sequence of expressions/statements
// ============================================================

function lowerBlock(values: KtgValue[], scope: Scope): IRDecl[] {
  const decls: IRDecl[] = [];
  let pos = 0;

  while (pos < values.length) {
    const [decl, nextPos] = lowerNext(values, pos, scope);
    if (decl) decls.push(decl);
    pos = nextPos;
  }

  return decls;
}

// Lower the next expression/statement from the values array.
// Returns [IRDecl | null, newPos]
function lowerNext(values: KtgValue[], pos: number, scope: Scope): [IRDecl | null, number] {
  const val = values[pos];

  // Set-word: variable or function declaration
  if (val.type === 'set-word!') {
    const name = val.name;

    // Check if next is 'function' keyword — pre-register for recursion
    if (pos + 1 < values.length && values[pos + 1].type === 'word!' && (values[pos + 1] as any).name === 'function') {
      const [expr, nextPos] = lowerFunctionExpr(values, pos + 1, scope, name);
      const funcDecl: IRFuncDecl = {
        tag: 'func',
        name,
        params: (expr as any).params,
        returnType: (expr as any).returnType,
        body: (expr as any).body,
        refinements: (expr as any).refinements,
      };
      return [funcDecl, nextPos];
    }

    // Check if next is 'does' keyword — like function but no spec (zero params)
    if (pos + 1 < values.length && values[pos + 1].type === 'word!' && (values[pos + 1] as any).name === 'does') {
      const [expr, nextPos] = lowerDoesExpr(values, pos + 1, scope, name);
      const funcDecl: IRFuncDecl = {
        tag: 'func',
        name,
        params: (expr as any).params,
        returnType: (expr as any).returnType,
        body: (expr as any).body,
        refinements: [],
      };
      return [funcDecl, nextPos];
    }

    const [expr, nextPos] = lowerExpr(values, pos + 1, scope);

    const varDecl: IRVarDecl = { tag: 'var', name, type: expr.type ?? 'any!', value: expr };

    // Track callable variables
    if (expr.tag === 'make-closure') {
      scope.set(name, { type: 'function!', arity: expr.params.length, returnType: expr.returnType });
    } else if (expr.type === 'function!' && expr.tag === 'call') {
      // Result of a function that returns a function — we don't know arity
      // Look up the called function's return info
      const calledName = typeof expr.func === 'string' ? expr.func : null;
      const calledEntry = calledName ? scope.get(calledName) : null;
      // Check if the called function's body returns a closure we can inspect
      scope.set(name, { type: 'function!', arity: 1 }); // Default arity 1
    } else {
      scope.set(name, { type: expr.type ?? 'any!' });
    }

    return [varDecl, nextPos];
  }

  // Word: could be a function call, control flow, or variable reference
  if (val.type === 'word!') {
    const name = val.name;

    // Control flow — statement context
    if (name === 'if') return lowerIf(values, pos, scope);
    if (name === 'either') return lowerEither(values, pos, scope);
    if (name === 'unless') return lowerUnless(values, pos, scope);
    if (name === 'loop') return lowerLoop(values, pos, scope);
    if (name === 'break') return [{ tag: 'break' }, pos + 1];
    if (name === 'return') {
      const [expr, nextPos] = lowerExpr(values, pos + 1, scope);
      return [{ tag: 'return', value: expr }, nextPos];
    }
    if (name === 'match') return lowerMatch(values, pos, scope);
    if (name === 'error') return lowerError(values, pos, scope);
    if (name === 'try') return lowerTry(values, pos, scope);
    if (name === 'attempt') return lowerAttempt(values, pos, scope);
    if (name === 'do') { compileError('do', 'do requires the interpreter — use #preprocess for compile-time evaluation'); }
    if (name === 'bind') { compileError('bind', 'bind requires the interpreter — rebinding is a runtime-only operation'); }

    // Function/builtin call — lower as expression statement
    const [expr, nextPos] = lowerExpr(values, pos, scope);
    return [{ tag: 'expr', expr } as IRExprStmt, nextPos];
  }

  // Path: could be loop/collect, loop/fold, loop/partition, try/handle, or field access
  if (val.type === 'path!') {
    const segments = val.segments;

    // try/handle [body] :handler
    if (segments[0] === 'try' && segments.length === 2 && segments[1] === 'handle') {
      return lowerTryHandle(values, pos, scope);
    }

    if (segments[0] === 'loop' && segments.length === 2) {
      const refinement = segments[1];
      // pos points to the path token; the block is at pos+1
      const block = values[pos + 1] as KtgBlock;
      const blockValues = block.values;
      const first = blockValues[0];

      if (first && first.type === 'word!' && (first.name === 'for' || first.name === 'from')) {
        const decls = lowerLoopDialect(blockValues, scope, refinement);
        // Return all decls — for multi-decl refinements we flatten
        if (decls.length === 1) return [decls[0], pos + 2];
        // For multiple decls, return first and note we need to splice
        // For now, wrap in a block-like structure
        return [decls[0], pos + 2]; // Simplified
      }
    }

    // Regular path expression
    const [expr, nextPos] = lowerExpr(values, pos, scope);
    return [{ tag: 'expr', expr } as IRExprStmt, nextPos];
  }

  // Set-path: obj/field: value
  if (val.type === 'set-path!') {
    const segments = val.segments;
    let target: IRExpr = { tag: 'get', type: 'any!', name: segments[0] };
    for (let i = 1; i < segments.length - 1; i++) {
      target = { tag: 'field-get', type: 'any!', target, field: segments[i] };
    }
    const [value, nextPos] = lowerExpr(values, pos + 1, scope);
    return [{
      tag: 'field-set',
      target,
      field: segments[segments.length - 1],
      value,
    } as IRFieldSet, nextPos];
  }

  // Anything else: lower as expression
  const [expr, nextPos] = lowerExpr(values, pos, scope);
  return [{ tag: 'expr', expr } as IRExprStmt, nextPos];
}

// ============================================================
// Expression lowering
// ============================================================

function lowerExpr(values: KtgValue[], pos: number, scope: Scope): [IRExpr, number] {
  let [expr, nextPos] = lowerAtom(values, pos, scope);

  // Infix continuation — left to right, no precedence
  while (nextPos < values.length) {
    const next = values[nextPos];
    if (next.type === 'op!' && INFIX_OPS.has(next.symbol)) {
      const op = next.symbol as IRBinOp['op'];
      const [right, afterRight] = lowerAtom(values, nextPos + 1, scope);
      const resultType = inferBinopType(op, expr.type, right.type);
      expr = { tag: 'binop', type: resultType, op, left: expr, right };
      nextPos = afterRight;
    } else if (next.type === 'word!' && INFIX_WORDS.has(next.name)) {
      const op = next.name as 'and' | 'or';
      const [right, afterRight] = lowerAtom(values, nextPos + 1, scope);
      expr = { tag: 'binop', type: 'any!', op, left: expr, right };
      nextPos = afterRight;
    } else {
      break;
    }
  }

  return [expr, nextPos];
}

function lowerAtom(values: KtgValue[], pos: number, scope: Scope): [IRExpr, number] {
  if (pos >= values.length) {
    return [{ tag: 'none', type: 'none!' }, pos];
  }

  const val = values[pos];

  switch (val.type) {
    case 'integer!':
      return [{ tag: 'literal', type: 'integer!', value: val.value }, pos + 1];
    case 'float!':
      return [{ tag: 'literal', type: 'float!', value: val.value }, pos + 1];
    case 'string!':
      return [{ tag: 'literal', type: 'string!', value: val.value }, pos + 1];
    case 'logic!':
      return [{ tag: 'literal', type: 'logic!', value: val.value }, pos + 1];
    case 'none!':
      return [{ tag: 'none', type: 'none!' }, pos + 1];
    case 'lit-word!':
      return [{ tag: 'literal', type: 'lit-word!', value: val.name }, pos + 1];

    case 'block!':
      return [lowerBlockLiteral(val as KtgBlock, scope), pos + 1];

    case 'paren!': {
      // Paren evaluates its contents
      const innerDecls = lowerBlock((val as any).values, scope);
      // Last expression is the result
      const lastDecl = innerDecls[innerDecls.length - 1];
      if (lastDecl && lastDecl.tag === 'expr') {
        return [(lastDecl as IRExprStmt).expr, pos + 1];
      }
      if (lastDecl && lastDecl.tag === 'var') {
        return [(lastDecl as IRVarDecl).value, pos + 1];
      }
      return [{ tag: 'none', type: 'none!' }, pos + 1];
    }

    case 'word!': {
      const name = val.name;

      // Control flow in expression position → inline-if
      if (name === 'if') {
        return lowerIfExpr(values, pos, scope);
      }
      if (name === 'either') {
        return lowerEitherExpr(values, pos, scope);
      }
      if (name === 'unless') {
        return lowerUnlessExpr(values, pos, scope);
      }

      // function keyword — returns a raw function descriptor
      if (name === 'function') {
        return lowerFunctionExpr(values, pos, scope) as any;
      }

      // context [fields] — lower to IRMakeContext
      if (name === 'context') {
        return lowerContextExpr(values, pos, scope);
      }

      // object [fields... methods...] — lower to __ktg_object runtime call
      if (name === 'object') {
        return lowerObjectExpr(values, pos, scope);
      }

      // does [body] — like function [] [body] (zero params)
      if (name === 'does') {
        return lowerDoesExpr(values, pos, scope) as any;
      }

      // Tier 3 homoiconic words — special lowering
      if (name === 'compose') return lowerCompose(values, pos, scope);
      if (name === 'reduce') return lowerReduce(values, pos, scope);
      if (name === 'do') return compileError('do', 'do requires the interpreter — use #preprocess for compile-time evaluation'), [{ tag: 'none', type: 'none!' } as any, pos + 1];
      if (name === 'bind') return compileError('bind', 'bind requires the interpreter — rebinding is a runtime-only operation'), [{ tag: 'none', type: 'none!' } as any, pos + 1];
      if (name === 'words-of') return lowerWordsOf(values, pos, scope);

      // Control flow words — special lowering
      if (name === 'all') return lowerAll(values, pos, scope);
      if (name === 'any') return lowerAny(values, pos, scope);
      if (name === 'apply') return lowerApply(values, pos, scope);
      if (name === 'set') return lowerSet(values, pos, scope);

      // Check if it's a known callable
      const entry = scope.get(name);
      if (entry && entry.arity !== undefined) {
        return lowerCallable(name, entry, values, pos + 1, scope, BUILTINS);
      }

      // Variable reference
      return [{ tag: 'get', type: entry?.type ?? 'any!', name }, pos + 1];
    }

    case 'get-word!':
      return [{ tag: 'get', type: 'any!', name: val.name }, pos + 1];

    case 'path!': {
      const segments = val.segments;
      const headName = segments[0];
      const entry = scope.get(headName);

      // Known callable with refinements: func/refine args
      if (entry && entry.arity !== undefined && segments.length === 2) {
        const refinements = segments.slice(1);
        return lowerRefinementCall(headName, entry, refinements, values, pos + 1, scope, BUILTINS);
      }

      // Build field access chain
      let expr: IRExpr = { tag: 'get', type: entry?.type ?? 'any!', name: headName };
      for (let i = 1; i < segments.length; i++) {
        expr = { tag: 'field-get', type: 'any!', target: expr, field: segments[i] };
      }

      // Deep path call: if the next value looks like an argument (not an operator
      // or set-word), treat this path as a callable and consume args eagerly.
      // This handles love/graphics/circle "fill" x y 20
      if (pos + 1 < values.length) {
        const next = values[pos + 1];
        const isArg = next && next.type !== 'set-word!' && next.type !== 'set-path!'
          && !(next.type === 'op!' && INFIX_OPS.has((next as any).symbol))
          && !(next.type === 'word!' && INFIX_WORDS.has((next as any).name));

        if (isArg && next.type !== 'block!') {
          // Consume scalar args until we hit a block, set-word, keyword, or another path
          const args: IRExpr[] = [];
          let argPos = pos + 1;
          while (argPos < values.length) {
            const peek = values[argPos];
            // Stop at blocks (they're bodies for control flow), set-words, set-paths,
            // keywords, paths, or get-words
            if (peek.type === 'block!' || peek.type === 'set-word!' || peek.type === 'set-path!') break;
            if (peek.type === 'path!' || peek.type === 'get-word!') break;
            if (peek.type === 'word!' && (BUILTINS[peek.name] !== undefined || peek.name === 'if'
              || peek.name === 'either' || peek.name === 'unless' || peek.name === 'loop'
              || peek.name === 'return' || peek.name === 'break' || peek.name === 'error'
              || peek.name === 'match' || peek.name === 'try')) break;

            const [arg, nextArgPos] = lowerExpr(values, argPos, scope);
            args.push(arg);
            argPos = nextArgPos;
          }
          if (args.length > 0) {
            return [{ tag: 'call', type: 'any!', func: expr, args } as IRCall, argPos];
          }
        }
      }

      // No args consumed. If the root is unknown (extern), wrap in __call_or_get
      // for the zero-arg ambiguity. If root is known in scope, it's a value access.
      if (!entry && segments.length > 1) {
        return [{ tag: 'builtin', type: 'any!', name: '__call_or_get', args: [expr] } as IRBuiltinCall, pos + 1];
      }

      return [expr, pos + 1];
    }

    case 'get-path!': {
      // Get-path: always value access, never call
      const segments = val.segments;
      let expr: IRExpr = { tag: 'get', type: 'any!', name: segments[0] };
      for (let i = 1; i < segments.length; i++) {
        expr = { tag: 'field-get', type: 'any!', target: expr, field: segments[i] };
      }
      return [expr, pos + 1];
    }

    case 'set-path!': {
      return [{ tag: 'none', type: 'none!' }, pos + 1];
    }

    default:
      return [{ tag: 'none', type: 'none!' }, pos + 1];
  }
}
