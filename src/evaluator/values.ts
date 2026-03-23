import { AstAtom, AstContainer, AstNode, TOKEN_TYPES } from '@types';
import type { KtgContext } from './context';

// --- Signals (thrown, not returned) ---

export class BreakSignal {
  constructor(public value: KtgValue = NONE) {}
}

export class ReturnSignal {
  constructor(public value: KtgValue) {}
}

export interface KtgStackFrame {
  name: string;         // function/method name
  path?: string;        // full path if method call (e.g., "p/greet")
}

export class KtgError extends Error {
  public data: KtgValue;
  public ktgStack: KtgStackFrame[] = [];
  public details: string[] = [];
  constructor(
    public errorName: string,
    message: string,
    data?: KtgValue,
  ) {
    super(message);
    this.name = 'KtgError';
    this.data = data ?? NONE;
  }

  addDetail(line: string): KtgError {
    this.details.push(line);
    return this;
  }

  format(): string {
    let msg = `Error [${this.errorName}]: ${this.message}`;
    for (const d of this.details) {
      msg += `\n  ${d}`;
    }
    if (this.ktgStack.length > 0) {
      msg += '\n  where:';
      for (const frame of this.ktgStack) {
        msg += `\n    ${frame.path ?? frame.name}`;
      }
    }
    return msg;
  }
}

// --- Runtime Value Types ---

export type KtgInteger  = { type: 'integer!'; value: number };
export type KtgFloat    = { type: 'float!';   value: number };
export type KtgString   = { type: 'string!';  value: string };
export type KtgLogic    = { type: 'logic!';   value: boolean };
export type KtgNone     = { type: 'none!' };
export type KtgPair     = { type: 'pair!';    x: number; y: number };
export type KtgTuple    = { type: 'tuple!';   parts: number[] };
export type KtgMoney    = { type: 'money!';   cents: number };
export type KtgDate     = { type: 'date!';    value: string };
export type KtgTime     = { type: 'time!';    value: string };
export type KtgFile     = { type: 'file!';    value: string };
export type KtgUrl      = { type: 'url!';     value: string };
export type KtgEmail    = { type: 'email!';   value: string };

export type KtgWord     = { type: 'word!';     name: string; bound?: KtgContext; line?: number };
export type KtgSetWord  = { type: 'set-word!'; name: string; bound?: KtgContext; line?: number };
export type KtgGetWord  = { type: 'get-word!'; name: string; bound?: KtgContext; line?: number };
export type KtgLitWord  = { type: 'lit-word!'; name: string; line?: number };
export type KtgMetaWord = { type: 'meta-word!'; name: string; line?: number };
export type KtgPath     = { type: 'path!';     segments: string[]; line?: number };
export type KtgSetPath  = { type: 'set-path!'; segments: string[]; line?: number };
export type KtgGetPath  = { type: 'get-path!'; segments: string[]; line?: number };
export type KtgLitPath  = { type: 'lit-path!'; segments: string[]; line?: number };

export type KtgBlock    = { type: 'block!';    values: KtgValue[] };
export type KtgParen    = { type: 'paren!';    values: KtgValue[] };
export type KtgMap      = { type: 'map!';      entries: Map<string, KtgValue> };
export type KtgCtxValue = { type: 'context!';   context: KtgContext };

export type ParamSpec = { name: string; typeConstraint?: string; elementType?: string; optional?: boolean };

export type FuncSpec = {
  params: ParamSpec[];
  refinements: { name: string; params: ParamSpec[] }[];
  returnType?: string;
};

export type NativeFn = (args: KtgValue[], evaluator: any, callerCtx: any, refinements: string[]) => KtgValue;

export type KtgFunction = { type: 'function!'; spec: FuncSpec; body: KtgBlock; closure: KtgContext };
export type KtgNative   = { type: 'native!';   name: string; arity: number; refinementArgs?: Record<string, number>; fn: NativeFn };
export type KtgOp       = { type: 'op!';       name: string; fn: (l: KtgValue, r: KtgValue) => KtgValue };
export type KtgOpSymbol = { type: 'op!';       symbol: string };

export type KtgTypeName = { type: 'type!';     name: string; rule?: KtgBlock; guard?: KtgBlock; enum?: boolean };

export type KtgValue =
  | KtgInteger | KtgFloat | KtgString | KtgLogic | KtgNone
  | KtgPair | KtgTuple | KtgMoney | KtgDate | KtgTime
  | KtgFile | KtgUrl | KtgEmail
  | KtgWord | KtgSetWord | KtgGetWord | KtgLitWord | KtgMetaWord
  | KtgPath | KtgSetPath | KtgGetPath | KtgLitPath
  | KtgBlock | KtgParen | KtgMap | KtgCtxValue
  | KtgFunction | KtgNative | KtgOp | KtgOpSymbol
  | KtgTypeName;

// --- Constants ---

export const NONE: KtgNone = { type: 'none!' };
export const TRUE: KtgLogic = { type: 'logic!', value: true };
export const FALSE: KtgLogic = { type: 'logic!', value: false };

// --- Conversion ---

const LOGIC_TRUE = new Set(['true']);

function withLine<T extends KtgValue>(val: T, line?: number): T {
  if (line != null) Object.defineProperty(val, 'line', { value: line, enumerable: false });
  return val;
}

export function astToValue(node: AstNode): KtgValue {
  if ('children' in node) {
    const values = node.children.map(astToValue);
    if (node.type === TOKEN_TYPES.BLOCK) return { type: 'block!', values };
    if (node.type === TOKEN_TYPES.PAREN) return { type: 'paren!', values };
    throw new KtgError('internal', `Unknown container type: ${node.type}`);
  }

  const atom = node as AstAtom;
  const v = atom.value;

  switch (atom.type) {
    case TOKEN_TYPES.INTEGER:  return { type: 'integer!', value: parseInt(v, 10) };
    case TOKEN_TYPES.FLOAT:    return { type: 'float!',   value: parseFloat(v) };
    case TOKEN_TYPES.STRING:   return { type: 'string!',  value: v };
    case TOKEN_TYPES.LOGIC:    return { type: 'logic!',   value: LOGIC_TRUE.has(v) };
    case TOKEN_TYPES.NONE:     return NONE;
    case TOKEN_TYPES.CHAR:     return { type: 'string!',  value: v };
    case TOKEN_TYPES.PAIR: {
      const [x, y] = v.split('x').map(Number);
      return { type: 'pair!', x, y };
    }
    case TOKEN_TYPES.TUPLE:    return { type: 'tuple!', parts: v.split('.').map(Number) };
    case TOKEN_TYPES.MONEY:    return { type: 'money!', cents: Math.round(parseFloat(v) * 100) };
    case TOKEN_TYPES.DATE:     return { type: 'date!',  value: v };
    case TOKEN_TYPES.TIME:     return { type: 'time!',  value: v };
    case TOKEN_TYPES.FILE:     return { type: 'file!',   value: v };
    case TOKEN_TYPES.URL:      return { type: 'url!',    value: v };
    case TOKEN_TYPES.EMAIL:    return { type: 'email!',  value: v };
    case TOKEN_TYPES.WORD:     return withLine({ type: 'word!',   name: v }, atom.line);
    case TOKEN_TYPES.SET_WORD: return withLine({ type: 'set-word!', name: v }, atom.line);
    case TOKEN_TYPES.GET_WORD: return withLine({ type: 'get-word!', name: v }, atom.line);
    case TOKEN_TYPES.LIT_WORD: return withLine({ type: 'lit-word!', name: v }, atom.line);
    case TOKEN_TYPES.PATH:     return withLine({ type: 'path!',     segments: v.split('/') }, atom.line);
    case TOKEN_TYPES.SET_PATH: return withLine({ type: 'set-path!', segments: v.split('/') }, atom.line);
    case TOKEN_TYPES.GET_PATH: return withLine({ type: 'get-path!', segments: v.split('/') }, atom.line);
    case TOKEN_TYPES.LIT_PATH: return withLine({ type: 'lit-path!', segments: v.split('/') }, atom.line);
    case TOKEN_TYPES.OPERATOR: return { type: 'op!', symbol: v };
    case TOKEN_TYPES.FUNCTION: return withLine({ type: 'word!', name: 'function' }, atom.line);
    case TOKEN_TYPES.DIRECTIVE: return withLine({ type: 'word!', name: `#${v}` }, atom.line);
    case TOKEN_TYPES.META_WORD: return withLine({ type: 'meta-word!', name: v }, atom.line);
    case TOKEN_TYPES.COMMENT:  return NONE; // comments are discarded
    case TOKEN_TYPES.STUB:     return NONE;
    default:
      throw new KtgError('internal', `Unknown atom type: ${atom.type}`);
  }
}

// --- Predicates ---

export function isTruthy(val: KtgValue): boolean {
  if (val.type === 'none!') return false;
  if (val.type === 'logic!' && val.value === false) return false;
  return true;
}

export function typeOf(val: KtgValue): string {
  return val.type;
}

// --- Display ---

export function valueToString(val: KtgValue): string {
  switch (val.type) {
    case 'integer!':   return String(val.value);
    case 'float!':     return String(val.value);
    case 'string!':    return val.value;
    case 'logic!':     return val.value ? 'true' : 'false';
    case 'none!':      return 'none';
    case 'pair!':      return `${val.x}x${val.y}`;
    case 'tuple!':     return val.parts.join('.');
    case 'money!': {
      const sign = val.cents < 0 ? '-' : '';
      const abs = Math.abs(val.cents);
      return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
    }
    case 'date!':      return val.value;
    case 'time!':      return val.value;
    case 'file!':      return `%${val.value}`;
    case 'url!':       return val.value;
    case 'email!':     return val.value;
    case 'word!':      return val.name;
    case 'set-word!':  return `${val.name}:`;
    case 'get-word!':  return `:${val.name}`;
    case 'lit-word!':  return val.name;
    case 'meta-word!': return `@${val.name}`;
    case 'path!':      return val.segments.join('/');
    case 'set-path!':  return `${val.segments.join('/')}:`;
    case 'get-path!':  return `:${val.segments.join('/')}`;
    case 'lit-path!':  return `'${val.segments.join('/')}`;
    case 'block!':     return `[${val.values.map(valueToString).join(' ')}]`;
    case 'paren!':     return `(${val.values.map(valueToString).join(' ')})`;
    case 'map!': {
      const pairs: string[] = [];
      val.entries.forEach((v, k) => pairs.push(`${k} ${valueToString(v)}`));
      return `#(${pairs.join(' ')})`;
    }
    case 'context!':    return 'context!';
    case 'function!':  return 'function!';
    case 'native!':    return `native!:${val.name}`;
    case 'op!':        return 'symbol' in val ? val.symbol : `op!:${val.name}`;
    case 'type!':      return val.name;
  }
}

export function valuesEqual(a: KtgValue, b: KtgValue): boolean {
  if (a.type === 'none!' && b.type === 'none!') return true;
  if (isNumeric(a) && isNumeric(b)) return numVal(a) === numVal(b);
  if (a.type === 'money!' && b.type === 'money!') return a.cents === b.cents;
  if (a.type === 'string!' && b.type === 'string!') return a.value === b.value;
  if (a.type === 'logic!' && b.type === 'logic!') return a.value === b.value;
  if (a.type === 'date!' && b.type === 'date!') return a.value === b.value;
  if (a.type === 'time!' && b.type === 'time!') return a.value === b.value;
  if (a.type === 'pair!' && b.type === 'pair!') return a.x === b.x && a.y === b.y;
  if (a.type === 'tuple!' && b.type === 'tuple!') {
    return a.parts.length === b.parts.length && a.parts.every((v, i) => v === b.parts[i]);
  }
  if (a.type === 'block!' && b.type === 'block!') {
    return a.values.length === b.values.length && a.values.every((v, i) => valuesEqual(v, b.values[i]));
  }
  // All word types compare by name (cross-type, Rebol style)
  const wordName = (v: KtgValue): string | null => {
    if (v.type === 'word!' || v.type === 'set-word!' || v.type === 'get-word!' || v.type === 'lit-word!' || v.type === 'meta-word!') return v.name;
    return null;
  };
  const an = wordName(a), bn = wordName(b);
  if (an !== null && bn !== null) return an === bn;
  return false;
}

export function isCallable(val: KtgValue): val is KtgFunction | KtgNative {
  return val.type === 'function!' || val.type === 'native!';
}

export function isNumeric(val: KtgValue): val is KtgInteger | KtgFloat {
  return val.type === 'integer!' || val.type === 'float!';
}

export function numVal(val: KtgValue): number {
  if (val.type === 'integer!' || val.type === 'float!') return val.value;
  throw new KtgError('type', `Expected number, got ${val.type}`);
}

// --- Type guards ---

export function isWord(v: KtgValue): v is KtgWord { return v.type === 'word!'; }
export function isSetWord(v: KtgValue): v is KtgSetWord { return v.type === 'set-word!'; }
export function isGetWord(v: KtgValue): v is KtgGetWord { return v.type === 'get-word!'; }
export function isLitWord(v: KtgValue): v is KtgLitWord { return v.type === 'lit-word!'; }
export function isMetaWord(v: KtgValue): v is KtgMetaWord { return v.type === 'meta-word!'; }
export function isBlock(v: KtgValue): v is KtgBlock { return v.type === 'block!'; }
export function isParen(v: KtgValue): v is KtgParen { return v.type === 'paren!'; }
export function isString(v: KtgValue): v is KtgString { return v.type === 'string!'; }
export function isContext(v: KtgValue): v is KtgCtxValue { return v.type === 'context!'; }
export function isMoney(v: KtgValue): v is KtgMoney { return v.type === 'money!'; }
