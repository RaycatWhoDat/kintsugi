import { describe, test, expect } from 'bun:test';
import { Evaluator } from '@/evaluator';

function withCol(): Evaluator {
  const ev = new Evaluator();
  ev.evalString('col: require %lib/collections.ktg');
  return ev;
}

describe('collections/flatten', () => {
  test('flattens nested blocks', () => {
    const ev = withCol();
    expect(ev.evalString('col/flatten [[1 2] [3 4] [5]]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 3 },
        { type: 'integer!', value: 4 },
        { type: 'integer!', value: 5 },
      ],
    });
  });

  test('non-block elements pass through', () => {
    const ev = withCol();
    expect(ev.evalString('col/flatten [1 [2 3] 4]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 3 },
        { type: 'integer!', value: 4 },
      ],
    });
  });

  test('empty block', () => {
    const ev = withCol();
    expect(ev.evalString('col/flatten []')).toEqual({ type: 'block!', values: [] });
  });

  test('already flat', () => {
    const ev = withCol();
    expect(ev.evalString('col/flatten [1 2 3]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 3 },
      ],
    });
  });

  test('only one level deep', () => {
    const ev = withCol();
    const result = ev.evalString('col/flatten [[1 [2 3]]]');
    expect(result.type).toBe('block!');
    if (result.type === 'block!') {
      expect(result.values).toHaveLength(2);
      expect(result.values[0]).toEqual({ type: 'integer!', value: 1 });
      expect(result.values[1].type).toBe('block!');
    }
  });
});

describe('collections/flatten/deep', () => {
  test('flattens all levels', () => {
    const ev = withCol();
    expect(ev.evalString('col/flatten/deep [[1 [2 [3]]] [4]]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 3 },
        { type: 'integer!', value: 4 },
      ],
    });
  });

  test('already flat block unchanged', () => {
    const ev = withCol();
    expect(ev.evalString('col/flatten/deep [1 2 3]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 3 },
      ],
    });
  });

  test('deeply nested', () => {
    const ev = withCol();
    expect(ev.evalString('col/flatten/deep [[[[[1]]]]]')).toEqual({
      type: 'block!',
      values: [{ type: 'integer!', value: 1 }],
    });
  });

  test('empty blocks removed', () => {
    const ev = withCol();
    expect(ev.evalString('col/flatten/deep [[] [1] []]')).toEqual({
      type: 'block!',
      values: [{ type: 'integer!', value: 1 }],
    });
  });
});

describe('collections/zip', () => {
  test('zips equal-length blocks', () => {
    const ev = withCol();
    const result = ev.evalString('col/zip [1 2 3] ["a" "b" "c"]');
    expect(result.type).toBe('block!');
    if (result.type === 'block!') {
      expect(result.values).toHaveLength(3);
      expect(result.values[0]).toEqual({
        type: 'block!',
        values: [{ type: 'integer!', value: 1 }, { type: 'string!', value: 'a' }],
      });
      expect(result.values[2]).toEqual({
        type: 'block!',
        values: [{ type: 'integer!', value: 3 }, { type: 'string!', value: 'c' }],
      });
    }
  });

  test('stops at shorter block', () => {
    const ev = withCol();
    const result = ev.evalString('col/zip [1 2 3] ["a" "b"]');
    expect(result.type).toBe('block!');
    if (result.type === 'block!') {
      expect(result.values).toHaveLength(2);
    }
  });

  test('empty blocks', () => {
    const ev = withCol();
    expect(ev.evalString('col/zip [] []')).toEqual({ type: 'block!', values: [] });
  });

  test('one empty block', () => {
    const ev = withCol();
    expect(ev.evalString('col/zip [1 2] []')).toEqual({ type: 'block!', values: [] });
  });
});

describe('collections/reverse-block', () => {
  test('reverses block', () => {
    const ev = withCol();
    expect(ev.evalString('col/reverse-block [1 2 3]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 3 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 1 },
      ],
    });
  });

  test('single element', () => {
    const ev = withCol();
    expect(ev.evalString('col/reverse-block [42]')).toEqual({
      type: 'block!',
      values: [{ type: 'integer!', value: 42 }],
    });
  });

  test('empty block', () => {
    const ev = withCol();
    expect(ev.evalString('col/reverse-block []')).toEqual({ type: 'block!', values: [] });
  });

  test('preserves types', () => {
    const ev = withCol();
    const result = ev.evalString('col/reverse-block ["c" "b" "a"]');
    expect(result).toEqual({
      type: 'block!',
      values: [
        { type: 'string!', value: 'a' },
        { type: 'string!', value: 'b' },
        { type: 'string!', value: 'c' },
      ],
    });
  });
});

describe('collections/unique', () => {
  test('removes duplicates', () => {
    const ev = withCol();
    expect(ev.evalString('col/unique [1 2 1 3 2 4]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 3 },
        { type: 'integer!', value: 4 },
      ],
    });
  });

  test('preserves order of first occurrence', () => {
    const ev = withCol();
    expect(ev.evalString('col/unique [3 1 2 1 3]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 3 },
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
      ],
    });
  });

  test('already unique', () => {
    const ev = withCol();
    expect(ev.evalString('col/unique [1 2 3]')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 3 },
      ],
    });
  });

  test('empty block', () => {
    const ev = withCol();
    expect(ev.evalString('col/unique []')).toEqual({ type: 'block!', values: [] });
  });

  test('works with strings', () => {
    const ev = withCol();
    expect(ev.evalString('col/unique ["a" "b" "a" "c"]')).toEqual({
      type: 'block!',
      values: [
        { type: 'string!', value: 'a' },
        { type: 'string!', value: 'b' },
        { type: 'string!', value: 'c' },
      ],
    });
  });
});

describe('collections/shuffle', () => {
  test('preserves length', () => {
    const ev = withCol();
    expect(ev.evalString('length? col/shuffle [1 2 3 4 5]')).toEqual({ type: 'integer!', value: 5 });
  });

  test('preserves elements', () => {
    const ev = withCol();
    ev.evalString('s: sort col/shuffle [1 2 3 4 5]');
    expect(ev.evalString('s')).toEqual({
      type: 'block!',
      values: [
        { type: 'integer!', value: 1 },
        { type: 'integer!', value: 2 },
        { type: 'integer!', value: 3 },
        { type: 'integer!', value: 4 },
        { type: 'integer!', value: 5 },
      ],
    });
  });

  test('empty block', () => {
    const ev = withCol();
    expect(ev.evalString('col/shuffle []')).toEqual({ type: 'block!', values: [] });
  });

  test('single element', () => {
    const ev = withCol();
    expect(ev.evalString('col/shuffle [42]')).toEqual({
      type: 'block!',
      values: [{ type: 'integer!', value: 42 }],
    });
  });
});

describe('collections/find-where', () => {
  test('finds first match', () => {
    const ev = withCol();
    expect(ev.evalString('col/find-where [1 2 3 4 5] function [x] [x > 3]'))
      .toEqual({ type: 'integer!', value: 4 });
  });

  test('returns none when no match', () => {
    const ev = withCol();
    expect(ev.evalString('col/find-where [1 2 3] function [x] [x > 10]'))
      .toEqual({ type: 'none!' });
  });

  test('empty block returns none', () => {
    const ev = withCol();
    expect(ev.evalString('col/find-where [] function [x] [true]'))
      .toEqual({ type: 'none!' });
  });

  test('finds string match', () => {
    const ev = withCol();
    expect(ev.evalString('col/find-where ["apple" "banana" "cherry"] function [s] [(length? s) > 5]'))
      .toEqual({ type: 'string!', value: 'banana' });
  });
});
