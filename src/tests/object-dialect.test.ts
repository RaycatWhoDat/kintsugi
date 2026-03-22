import { describe, test, expect } from 'bun:test';
import { Evaluator } from '@/evaluator';

describe('make clones context', () => {
  test('clone context with overrides', () => {
    const ev = new Evaluator();
    ev.evalString('p: context [name: "Ray" age: 30]');
    ev.evalString('p2: make p [age: 31]');
    expect(ev.evalString('p2/name')).toEqual({ type: 'string!', value: 'Ray' });
    expect(ev.evalString('p2/age')).toEqual({ type: 'integer!', value: 31 });
  });

  test('clone does not mutate original', () => {
    const ev = new Evaluator();
    ev.evalString('p: context [name: "Ray" age: 30]');
    ev.evalString('p2: make p [age: 31]');
    expect(ev.evalString('p/age')).toEqual({ type: 'integer!', value: 30 });
  });

  test('clone with empty overrides', () => {
    const ev = new Evaluator();
    ev.evalString('p: context [x: 10]');
    ev.evalString('p2: make p []');
    expect(ev.evalString('p2/x')).toEqual({ type: 'integer!', value: 10 });
  });
});

describe('object dialect', () => {
  test('basic object with fields and methods', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!]
        age [integer!]
        greet: function [] [
          rejoin ["Hi, I'm " self/name]
        ]
      ]
    `);
    const p = ev.evalString('make Person [name: "Ray" age: 30]');
    expect(p.type).toBe('context!');
  });

  test('field access on prototype', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Point: object [
        x [integer!] @default 0
        y [integer!] @default 0
      ]
    `);
    expect(ev.evalString('Point/x')).toEqual({ type: 'integer!', value: 0 });
    expect(ev.evalString('Point/y')).toEqual({ type: 'integer!', value: 0 });
  });

  test('make instance with overrides', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Point: object [
        x [integer!] @default 0
        y [integer!] @default 0
      ]
    `);
    ev.evalString('p: make Point [x: 10 y: 20]');
    expect(ev.evalString('p/x')).toEqual({ type: 'integer!', value: 10 });
    expect(ev.evalString('p/y')).toEqual({ type: 'integer!', value: 20 });
  });

  test('mixed required and defaulted fields', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Account: object [
        owner [string!]
        balance [money!] @default $0.00
        active [logic!] @default true
      ]
    `);
    ev.evalString('a: make Account [owner: "Ray"]');
    expect(ev.evalString('a/owner')).toEqual({ type: 'string!', value: 'Ray' });
    expect(ev.evalString('a/balance')).toEqual({ type: 'money!', cents: 0 });
    expect(ev.evalString('a/active')).toEqual({ type: 'logic!', value: true });
  });

  test('mixed fields with override on defaulted', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Account: object [
        owner [string!]
        balance [money!] @default $0.00
        active [logic!] @default true
      ]
    `);
    ev.evalString('a: make Account [owner: "Ray" balance: $100.00]');
    expect(ev.evalString('a/owner')).toEqual({ type: 'string!', value: 'Ray' });
    expect(ev.evalString('a/balance')).toEqual({ type: 'money!', cents: 10000 });
    expect(ev.evalString('a/active')).toEqual({ type: 'logic!', value: true });
  });

  test('mixed fields with methods that use both', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Account: object [
        owner [string!]
        balance [money!] @default $0.00
        deposit: function [amount [money!]] [
          self/balance: self/balance + amount
        ]
        summary: function [] [
          rejoin [self/owner ": " self/balance]
        ]
      ]
    `);
    ev.evalString('a: make Account [owner: "Ray"]');
    ev.evalString('a/deposit $50.00');
    expect(ev.evalString('a/summary')).toEqual({ type: 'string!', value: 'Ray: $50.00' });
  });

  test('methods see self', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!] @default none
        age [integer!] @default 0
        greet: function [] [
          rejoin ["Hi, I'm " self/name]
        ]
      ]
    `);
    ev.evalString('p: make Person [name: "Ray" age: 30]');
    expect(ev.evalString('p/greet')).toEqual({ type: 'string!', value: "Hi, I'm Ray" });
  });

  test('methods can mutate via self', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Counter: object [
        n [integer!] @default 0
        increment: function [] [
          self/n: self/n + 1
        ]
        value: function [] [self/n]
      ]
    `);
    ev.evalString('c: make Counter []');
    ev.evalString('c/increment');
    ev.evalString('c/increment');
    expect(ev.evalString('c/value')).toEqual({ type: 'integer!', value: 2 });
  });

  test('self refers to instance, not prototype', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Thing: object [
        x [integer!] @default 0
        get-x: function [] [self/x]
      ]
    `);
    ev.evalString('a: make Thing [x: 10]');
    ev.evalString('b: make Thing [x: 20]');
    expect(ev.evalString('a/get-x')).toEqual({ type: 'integer!', value: 10 });
    expect(ev.evalString('b/get-x')).toEqual({ type: 'integer!', value: 20 });
  });

  test('mutation via self/field: persists', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Counter: object [
        n [integer!] @default 0
        increment: function [] [self/n: self/n + 1]
        value: function [] [self/n]
      ]
    `);
    ev.evalString('c: make Counter []');
    ev.evalString('c/increment');
    ev.evalString('c/increment');
    ev.evalString('c/increment');
    expect(ev.evalString('c/value')).toEqual({ type: 'integer!', value: 3 });
  });

  test('mutation on one instance does not affect another', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Counter: object [
        n [integer!] @default 0
        increment: function [] [self/n: self/n + 1]
      ]
    `);
    ev.evalString('a: make Counter []');
    ev.evalString('b: make Counter []');
    ev.evalString('a/increment');
    ev.evalString('a/increment');
    ev.evalString('b/increment');
    expect(ev.evalString('a/n')).toEqual({ type: 'integer!', value: 2 });
    expect(ev.evalString('b/n')).toEqual({ type: 'integer!', value: 1 });
  });
});

describe('object type checking', () => {
  test('is? checks against prototype', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!] @default none
        age [integer!] @default 0
      ]
    `);
    ev.evalString('p: make Person [name: "Ray" age: 30]');
    expect(ev.evalString('is? :Person p')).toEqual({ type: 'logic!', value: true });
  });

  test('is? rejects non-matching context', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!] @default none
        age [integer!] @default 0
      ]
    `);
    ev.evalString('x: context [foo: 1]');
    expect(ev.evalString('is? :Person x')).toEqual({ type: 'logic!', value: false });
  });

  test('is? rejects non-context value', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!] @default none
      ]
    `);
    expect(ev.evalString('is? :Person 42')).toEqual({ type: 'logic!', value: false });
  });
});

describe('auto-generated type names', () => {
  test('Person generates person!', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!]
        age [integer!]
      ]
    `);
    ev.evalString('p: make Person [name: "Ray" age: 30]');
    expect(ev.evalString('is? person! p')).toEqual({ type: 'logic!', value: true });
  });

  test('person! rejects non-matching context', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!]
        age [integer!]
      ]
    `);
    expect(ev.evalString('is? person! context [foo: 1]')).toEqual({ type: 'logic!', value: false });
  });

  test('PascalCase to kebab-case conversion', () => {
    const ev = new Evaluator();
    ev.evalString('CardReader: object [events [block!] @default []]');
    ev.evalString('r: make CardReader []');
    expect(ev.evalString('is? card-reader! r')).toEqual({ type: 'logic!', value: true });
  });

  test('auto type works in function param constraints', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!]
        age [integer!]
      ]
      greet: function [p [person!]] [p/name]
    `);
    ev.evalString('p: make Person [name: "Ray" age: 30]');
    expect(ev.evalString('greet p')).toEqual({ type: 'string!', value: 'Ray' });
  });

  test('auto type rejects wrong type in function param', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!]
        age [integer!]
      ]
      greet: function [p [person!]] [p/name]
    `);
    expect(() => ev.evalString('greet 42')).toThrow('p expects person!');
  });
});

describe('auto-generated constructors', () => {
  test('make-person with required fields', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!]
        age [integer!]
      ]
      p: make-person "Ray" 30
    `);
    expect(ev.evalString('p/name')).toEqual({ type: 'string!', value: 'Ray' });
    expect(ev.evalString('p/age')).toEqual({ type: 'integer!', value: 30 });
  });

  test('constructor preserves defaults', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Card: object [
        cardholder-name [string!]
        number [string!]
        balance [money!] @default $0.00
      ]
      c: make-card "Ray" "5555"
    `);
    expect(ev.evalString('c/cardholder-name')).toEqual({ type: 'string!', value: 'Ray' });
    expect(ev.evalString('c/balance')).toEqual({ type: 'money!', cents: 0 });
  });

  test('zero-arg constructor for all-defaulted object', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Counter: object [
        n [integer!] @default 0
        increment: function [] [self/n: self/n + 1]
        value: function [] [self/n]
      ]
      c: make-counter
      c/increment
      c/increment
    `);
    expect(ev.evalString('c/value')).toEqual({ type: 'integer!', value: 2 });
  });

  test('self works on constructed instances', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Thing: object [
        x [integer!]
        get-x: function [] [self/x]
      ]
    `);
    ev.evalString('a: make-thing 10');
    ev.evalString('b: make-thing 20');
    expect(ev.evalString('a/get-x')).toEqual({ type: 'integer!', value: 10 });
    expect(ev.evalString('b/get-x')).toEqual({ type: 'integer!', value: 20 });
  });

  test('PascalCase to kebab-case in constructor name', () => {
    const ev = new Evaluator();
    ev.evalString(`
      CardReader: object [
        events [block!] @default []
      ]
      r: make-card-reader
    `);
    expect(ev.evalString('r/events')).toMatchObject({ type: 'block!' });
  });

  test('constructed instance passes type check', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Person: object [
        name [string!]
        age [integer!]
      ]
      p: make-person "Ray" 30
    `);
    expect(ev.evalString('is? person! p')).toEqual({ type: 'logic!', value: true });
  });
});

describe('object dialect — card reader', () => {
  test('full card reader workflow', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Card: object [
        cardholder-name [string!]
        number [string!]
        balance [money!] @default $0.00
        ounces-poured [float!] @default 0.0
      ]

      Reader: object [
        events [block!] @default []
        current-card [opt context!] @default none

        insert-card: function [card] [
          append self/events "inserted"
          self/current-card: card
        ]

        remove-card: function [] [
          append self/events "removed"
          self/current-card: none
        ]
      ]

      my-card: make Card [cardholder-name: "Ray Perry" number: "5555"]
      my-reader: make Reader []
      my-reader/insert-card my-card
      my-reader/remove-card
    `);
    expect(ev.evalString('length? my-reader/events')).toEqual({ type: 'integer!', value: 2 });
    expect(ev.evalString('my-reader/current-card')).toEqual({ type: 'none!' });
  });

  test('card reader card has required and defaulted fields', () => {
    const ev = new Evaluator();
    ev.evalString(`
      Card: object [
        cardholder-name [string!]
        number [string!]
        balance [money!] @default $0.00
      ]
      my-card: make Card [cardholder-name: "Ray" number: "1234"]
    `);
    expect(ev.evalString('my-card/cardholder-name')).toEqual({ type: 'string!', value: 'Ray' });
    expect(ev.evalString('my-card/number')).toEqual({ type: 'string!', value: '1234' });
    expect(ev.evalString('my-card/balance')).toEqual({ type: 'money!', cents: 0 });
  });
});
