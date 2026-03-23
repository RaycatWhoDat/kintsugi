import { describe, test, expect } from 'bun:test';
import { lower } from '@/compiler/lower';
import { IRModule, IRVarDecl, IRFuncDecl, IRExprStmt, IRIf } from '@/compiler/ir';

describe('lower — variables and literals', () => {
  test('integer assignment', () => {
    const mod = lower('x: 42');
    expect(mod.declarations).toHaveLength(1);
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.tag).toBe('var');
    expect(decl.name).toBe('x');
    expect(decl.value).toEqual({ tag: 'literal', type: 'integer!', value: 42 });
  });

  test('string assignment', () => {
    const mod = lower('name: "hello"');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value).toEqual({ tag: 'literal', type: 'string!', value: 'hello' });
  });

  test('arithmetic expression', () => {
    const mod = lower('x: 2 + 3');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value.tag).toBe('binop');
    if (decl.value.tag === 'binop') {
      expect(decl.value.op).toBe('+');
      expect(decl.value.left).toEqual({ tag: 'literal', type: 'integer!', value: 2 });
      expect(decl.value.right).toEqual({ tag: 'literal', type: 'integer!', value: 3 });
    }
  });

  test('left-to-right no precedence', () => {
    const mod = lower('x: 2 + 3 * 4');
    const decl = mod.declarations[0] as IRVarDecl;
    // (2 + 3) * 4 — left to right
    expect(decl.value.tag).toBe('binop');
    if (decl.value.tag === 'binop') {
      expect(decl.value.op).toBe('*');
      expect(decl.value.left.tag).toBe('binop');
    }
  });
});

describe('lower — function calls', () => {
  test('builtin call', () => {
    const mod = lower('print 42');
    expect(mod.declarations).toHaveLength(1);
    const stmt = mod.declarations[0] as IRExprStmt;
    expect(stmt.tag).toBe('expr');
    expect(stmt.expr.tag).toBe('builtin');
    if (stmt.expr.tag === 'builtin') {
      expect(stmt.expr.name).toBe('print');
      expect(stmt.expr.args).toHaveLength(1);
    }
  });

  test('builtin consumes infix argument', () => {
    const mod = lower('print 2 + 3');
    const stmt = mod.declarations[0] as IRExprStmt;
    expect(stmt.expr.tag).toBe('builtin');
    if (stmt.expr.tag === 'builtin') {
      expect(stmt.expr.args[0].tag).toBe('binop');
    }
  });
});

describe('lower — functions', () => {
  test('function declaration', () => {
    const mod = lower('add: function [a b] [a + b]');
    const decl = mod.declarations[0] as IRFuncDecl;
    expect(decl.tag).toBe('func');
    expect(decl.name).toBe('add');
    expect(decl.params).toEqual([
      { name: 'a', type: 'any!' },
      { name: 'b', type: 'any!' },
    ]);
  });

  test('typed function', () => {
    const mod = lower('add: function [a [integer!] b [integer!] return: [integer!]] [a + b]');
    const decl = mod.declarations[0] as IRFuncDecl;
    expect(decl.params).toEqual([
      { name: 'a', type: 'integer!' },
      { name: 'b', type: 'integer!' },
    ]);
    expect(decl.returnType).toBe('integer!');
  });
});

describe('lower — control flow', () => {
  test('if block', () => {
    const mod = lower('if true [42]');
    const stmt = mod.declarations[0];
    expect(stmt.tag).toBe('if');
  });

  test('either becomes if/else', () => {
    const mod = lower('either true [1] [2]');
    const stmt = mod.declarations[0] as IRIf;
    expect(stmt.tag).toBe('if');
    expect(stmt.else).toBeDefined();
  });
});

describe('lower — Tier 3 homoiconic words', () => {
  test('compose inlines paren expressions', () => {
    const mod = lower('x: compose [1 (2 + 3) 4]');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value.tag).toBe('block');
    if (decl.value.tag === 'block') {
      expect(decl.value.values).toHaveLength(3);
      expect(decl.value.values[0]).toEqual({ tag: 'literal', type: 'integer!', value: 1 });
      expect(decl.value.values[1].tag).toBe('binop'); // 2 + 3 lowered
      expect(decl.value.values[2]).toEqual({ tag: 'literal', type: 'integer!', value: 4 });
    }
  });

  test('reduce is a compile error', () => {
    expect(() => lower('x: reduce [1 + 2 3 + 4]')).toThrow('interpreter');
  });

  test('do is a compile error', () => {
    expect(() => lower('do [1 + 2]')).toThrow('interpreter');
  });

  test('bind is a compile error', () => {
    expect(() => lower('bind [1 2] context [x: 1]')).toThrow('interpreter');
  });

  test('words-of on literal context produces string array', () => {
    const mod = lower('w: words-of context [x: 10 y: 20]');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value.tag).toBe('block');
    if (decl.value.tag === 'block') {
      expect(decl.value.values).toHaveLength(2);
      expect(decl.value.values[0]).toEqual({ tag: 'literal', type: 'string!', value: 'x' });
      expect(decl.value.values[1]).toEqual({ tag: 'literal', type: 'string!', value: 'y' });
    }
  });

  test('words-of on variable emits runtime call', () => {
    const mod = lower('p: context [x: 10]\nw: words-of p');
    const decl = mod.declarations[1] as IRVarDecl;
    expect(decl.value.tag).toBe('builtin');
    if (decl.value.tag === 'builtin') {
      expect(decl.value.name).toBe('words-of');
    }
  });

  test('all desugars to chained and', () => {
    const mod = lower('x: all [1 2 3]');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value.tag).toBe('binop');
    if (decl.value.tag === 'binop') {
      expect(decl.value.op).toBe('and');
    }
  });

  test('any desugars to chained or', () => {
    const mod = lower('x: any [false 42]');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value.tag).toBe('binop');
    if (decl.value.tag === 'binop') {
      expect(decl.value.op).toBe('or');
    }
  });

  test('apply with literal args unpacks to direct call', () => {
    const mod = lower('add: function [a b] [a + b]\nx: apply :add [3 4]');
    const decl = mod.declarations[1] as IRVarDecl;
    expect(decl.value.tag).toBe('call');
    if (decl.value.tag === 'call') {
      expect(decl.value.args).toHaveLength(2);
    }
  });
});

describe('lower — try/handle', () => {
  test('try/handle produces IRTry with handler', () => {
    const mod = lower('handler: function [k m d] [print m]\ntry/handle [error \'test "oops" none] :handler');
    // First decl is the handler function, second is the try
    const tryDecl = mod.declarations[1];
    expect(tryDecl.tag).toBe('try');
    if (tryDecl.tag === 'try') {
      expect(tryDecl.handler).toBeDefined();
    }
  });
});

describe('lower — type predicates', () => {
  test('type predicate lowers as builtin call', () => {
    const mod = lower('x: integer? 42');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value.tag).toBe('builtin');
    if (decl.value.tag === 'builtin') {
      expect(decl.value.name).toBe('integer?');
    }
  });
});

describe('lower — objects', () => {
  test('object lowers as builtin call with structured args', () => {
    const mod = lower('P: object [name [string!] age [integer!] @default 0]');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value.tag).toBe('builtin');
    if (decl.value.tag === 'builtin') {
      expect(decl.value.name).toBe('object');
      expect(decl.value.args).toHaveLength(3);
      // arg 0: field names block
      expect(decl.value.args[0].tag).toBe('block');
      // arg 1: field defaults block
      expect(decl.value.args[1].tag).toBe('block');
      // arg 2: body closure
      expect(decl.value.args[2].tag).toBe('make-closure');
    }
  });

  test('object with methods includes methods in body closure', () => {
    const mod = lower('P: object [name [string!] greet: does [print "hi"]]');
    const decl = mod.declarations[0] as IRVarDecl;
    expect(decl.value.tag).toBe('builtin');
    if (decl.value.tag === 'builtin') {
      const body = decl.value.args[2];
      expect(body.tag).toBe('make-closure');
      if (body.tag === 'make-closure') {
        expect(body.body.length).toBeGreaterThan(0);
      }
    }
  });

});
