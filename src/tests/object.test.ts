import { describe, test, expect } from 'bun:test';
import { Evaluator } from '@/evaluator';

const eval_ = (input: string) => {
  const ev = new Evaluator();
  return ev.evalString(input);
};

describe('context', () => {
  test('create and access fields', () => {
    const ev = new Evaluator();
    ev.evalString('point: context [x: 10 y: 20]');
    expect(ev.evalString('point/x')).toEqual({ type: 'integer!', value: 10 });
    expect(ev.evalString('point/y')).toEqual({ type: 'integer!', value: 20 });
  });

  test('set-path assignment', () => {
    const ev = new Evaluator();
    ev.evalString('point: context [x: 10 y: 20]');
    ev.evalString('point/x: 30');
    expect(ev.evalString('point/x')).toEqual({ type: 'integer!', value: 30 });
  });

  test('context with computed values', () => {
    const ev = new Evaluator();
    ev.evalString('p: context [x: 2 + 3 y: x * 2]');
    expect(ev.evalString('p/x')).toEqual({ type: 'integer!', value: 5 });
    expect(ev.evalString('p/y')).toEqual({ type: 'integer!', value: 10 });
  });

  test('type returns context!', () => {
    const ev = new Evaluator();
    ev.evalString('p: context [x: 1]');
    expect(ev.evalString('type p')).toEqual({ type: 'type!', name: 'context!' });
  });
});

describe('set/upvalue', () => {
  test('mutates parent context binding from closure', () => {
    const ev = new Evaluator();
    ev.evalString(`
      p: context [
        age: 30
        birthday: function [] [
          set/upvalue 'age (age + 1)
        ]
      ]
      p/birthday
    `);
    expect(ev.evalString('p/age')).toEqual({ type: 'integer!', value: 31 });
  });

  test('multiple calls accumulate', () => {
    const ev = new Evaluator();
    ev.evalString(`
      c: context [
        n: 0
        inc: function [] [set/upvalue 'n (n + 1)]
      ]
      c/inc
      c/inc
      c/inc
    `);
    expect(ev.evalString('c/n')).toEqual({ type: 'integer!', value: 3 });
  });

  test('throws on nonexistent binding', () => {
    const ev = new Evaluator();
    expect(() => ev.evalString("set/upvalue 'nope 42")).toThrow('nope has no value to update');
  });

  test('updates nearest parent binding', () => {
    const ev = new Evaluator();
    ev.evalString(`
      outer: context [
        x: 1
        inner: context [
          bump: function [] [set/upvalue 'x (x + 10)]
        ]
      ]
      outer/inner/bump
    `);
    expect(ev.evalString('outer/x')).toEqual({ type: 'integer!', value: 11 });
  });

  test('works with word (not just lit-word)', () => {
    const ev = new Evaluator();
    ev.evalString(`
      p: context [
        v: 5
        update: function [] [
          name: 'v
          set/upvalue name (v * 2)
        ]
      ]
      p/update
    `);
    expect(ev.evalString('p/v')).toEqual({ type: 'integer!', value: 10 });
  });
});
