import { describe, test, expect } from 'bun:test';
import { Evaluator } from '@/evaluator';

function withStr(): Evaluator {
  const ev = new Evaluator();
  ev.evalString('str: require %lib/string.ktg');
  return ev;
}

describe('string/starts-with?', () => {
  test('true when prefix matches', () => {
    const ev = withStr();
    expect(ev.evalString('str/starts-with? "hello world" "hello"')).toEqual({ type: 'logic!', value: true });
  });

  test('false when prefix does not match', () => {
    const ev = withStr();
    expect(ev.evalString('str/starts-with? "hello" "world"')).toEqual({ type: 'logic!', value: false });
  });

  test('true for empty prefix', () => {
    const ev = withStr();
    expect(ev.evalString('str/starts-with? "hello" ""')).toEqual({ type: 'logic!', value: true });
  });

  test('false when prefix longer than string', () => {
    const ev = withStr();
    expect(ev.evalString('str/starts-with? "hi" "hello"')).toEqual({ type: 'logic!', value: false });
  });

  test('exact match', () => {
    const ev = withStr();
    expect(ev.evalString('str/starts-with? "hello" "hello"')).toEqual({ type: 'logic!', value: true });
  });
});

describe('string/ends-with?', () => {
  test('true when suffix matches', () => {
    const ev = withStr();
    expect(ev.evalString('str/ends-with? "hello.ktg" ".ktg"')).toEqual({ type: 'logic!', value: true });
  });

  test('false when suffix does not match', () => {
    const ev = withStr();
    expect(ev.evalString('str/ends-with? "hello" ".ktg"')).toEqual({ type: 'logic!', value: false });
  });

  test('false when suffix longer than string', () => {
    const ev = withStr();
    expect(ev.evalString('str/ends-with? "hi" "hello"')).toEqual({ type: 'logic!', value: false });
  });

  test('exact match', () => {
    const ev = withStr();
    expect(ev.evalString('str/ends-with? "hello" "hello"')).toEqual({ type: 'logic!', value: true });
  });
});

describe('string/contains?', () => {
  test('true when substring present', () => {
    const ev = withStr();
    expect(ev.evalString('str/contains? "hello world" "world"')).toEqual({ type: 'logic!', value: true });
  });

  test('false when substring absent', () => {
    const ev = withStr();
    expect(ev.evalString('str/contains? "hello" "xyz"')).toEqual({ type: 'logic!', value: false });
  });

  test('true for empty substring', () => {
    const ev = withStr();
    expect(ev.evalString('str/contains? "hello" ""')).toEqual({ type: 'logic!', value: true });
  });
});

describe('string/pad-left', () => {
  test('pads to width', () => {
    const ev = withStr();
    expect(ev.evalString('str/pad-left "42" 5 "0"')).toEqual({ type: 'string!', value: '00042' });
  });

  test('no padding when already wide enough', () => {
    const ev = withStr();
    expect(ev.evalString('str/pad-left "hello" 3 "0"')).toEqual({ type: 'string!', value: 'hello' });
  });

  test('single character fill', () => {
    const ev = withStr();
    expect(ev.evalString('str/pad-left "x" 4 "."')).toEqual({ type: 'string!', value: '...x' });
  });
});

describe('string/pad-right', () => {
  test('pads to width', () => {
    const ev = withStr();
    expect(ev.evalString('str/pad-right "hi" 5 "."')).toEqual({ type: 'string!', value: 'hi...' });
  });

  test('no padding when already wide enough', () => {
    const ev = withStr();
    expect(ev.evalString('str/pad-right "hello" 3 "."')).toEqual({ type: 'string!', value: 'hello' });
  });
});

describe('string/repeat-string', () => {
  test('repeats n times', () => {
    const ev = withStr();
    expect(ev.evalString('str/repeat-string "ab" 3')).toEqual({ type: 'string!', value: 'ababab' });
  });

  test('repeat once', () => {
    const ev = withStr();
    expect(ev.evalString('str/repeat-string "hello" 1')).toEqual({ type: 'string!', value: 'hello' });
  });

  test('repeat zero times', () => {
    const ev = withStr();
    expect(ev.evalString('str/repeat-string "x" 0')).toEqual({ type: 'string!', value: '' });
  });
});

describe('string/char-at', () => {
  test('returns character at position', () => {
    const ev = withStr();
    expect(ev.evalString('str/char-at "hello" 1')).toEqual({ type: 'string!', value: 'h' });
    expect(ev.evalString('str/char-at "hello" 2')).toEqual({ type: 'string!', value: 'e' });
    expect(ev.evalString('str/char-at "hello" 5')).toEqual({ type: 'string!', value: 'o' });
  });
});

describe('string/reverse-string', () => {
  test('reverses string', () => {
    const ev = withStr();
    expect(ev.evalString('str/reverse-string "hello"')).toEqual({ type: 'string!', value: 'olleh' });
  });

  test('single character', () => {
    const ev = withStr();
    expect(ev.evalString('str/reverse-string "x"')).toEqual({ type: 'string!', value: 'x' });
  });

  test('empty string', () => {
    const ev = withStr();
    expect(ev.evalString('str/reverse-string ""')).toEqual({ type: 'string!', value: '' });
  });

  test('palindrome', () => {
    const ev = withStr();
    expect(ev.evalString('str/reverse-string "racecar"')).toEqual({ type: 'string!', value: 'racecar' });
  });
});
