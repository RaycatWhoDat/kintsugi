import { describe, test, expect } from 'bun:test';
import { Evaluator } from '@/evaluator';

function withMath(): Evaluator {
  const ev = new Evaluator();
  ev.evalString('math: require %lib/math.ktg');
  return ev;
}

describe('math/clamp', () => {
  test('value within range unchanged', () => {
    const ev = withMath();
    expect(ev.evalString('math/clamp 5 0 10')).toEqual({ type: 'integer!', value: 5 });
  });

  test('clamps below minimum', () => {
    const ev = withMath();
    expect(ev.evalString('math/clamp -3 0 10')).toEqual({ type: 'integer!', value: 0 });
  });

  test('clamps above maximum', () => {
    const ev = withMath();
    expect(ev.evalString('math/clamp 15 0 10')).toEqual({ type: 'integer!', value: 10 });
  });

  test('clamps at boundary', () => {
    const ev = withMath();
    expect(ev.evalString('math/clamp 0 0 10')).toEqual({ type: 'integer!', value: 0 });
    expect(ev.evalString('math/clamp 10 0 10')).toEqual({ type: 'integer!', value: 10 });
  });

  test('works with floats', () => {
    const ev = withMath();
    expect(ev.evalString('math/clamp 0.5 0.0 1.0')).toEqual({ type: 'float!', value: 0.5 });
    expect(ev.evalString('math/clamp -0.1 0.0 1.0')).toEqual({ type: 'float!', value: 0.0 });
  });
});

describe('math/lerp', () => {
  test('t=0 returns a', () => {
    const ev = withMath();
    expect(ev.evalString('math/lerp 0 100 0.0')).toEqual({ type: 'float!', value: 0 });
  });

  test('t=1 returns b', () => {
    const ev = withMath();
    expect(ev.evalString('math/lerp 0 100 1.0')).toEqual({ type: 'float!', value: 100 });
  });

  test('t=0.5 returns midpoint', () => {
    const ev = withMath();
    expect(ev.evalString('math/lerp 0 100 0.5')).toEqual({ type: 'float!', value: 50 });
  });

  test('t=0.25', () => {
    const ev = withMath();
    expect(ev.evalString('math/lerp 0 100 0.25')).toEqual({ type: 'float!', value: 25 });
  });

  test('works with negative range', () => {
    const ev = withMath();
    expect(ev.evalString('math/lerp -10 10 0.5')).toEqual({ type: 'float!', value: 0 });
  });
});

describe('math/sign', () => {
  test('positive returns 1', () => {
    const ev = withMath();
    expect(ev.evalString('math/sign 42')).toEqual({ type: 'integer!', value: 1 });
  });

  test('negative returns -1', () => {
    const ev = withMath();
    expect(ev.evalString('math/sign -7')).toEqual({ type: 'integer!', value: -1 });
  });

  test('zero returns 0', () => {
    const ev = withMath();
    expect(ev.evalString('math/sign 0')).toEqual({ type: 'integer!', value: 0 });
  });
});

describe('math/wrap', () => {
  test('wraps above range', () => {
    const ev = withMath();
    expect(ev.evalString('math/wrap 12 0 10')).toEqual({ type: 'integer!', value: 2 });
  });

  test('wraps below range', () => {
    const ev = withMath();
    expect(ev.evalString('math/wrap -3 0 10')).toEqual({ type: 'integer!', value: 7 });
  });

  test('value in range unchanged', () => {
    const ev = withMath();
    expect(ev.evalString('math/wrap 5 0 10')).toEqual({ type: 'integer!', value: 5 });
  });

  test('wraps at exact boundary', () => {
    const ev = withMath();
    expect(ev.evalString('math/wrap 10 0 10')).toEqual({ type: 'integer!', value: 0 });
  });
});

describe('math/deadzone', () => {
  test('within deadzone returns 0', () => {
    const ev = withMath();
    expect(ev.evalString('math/deadzone 0.02 0.1')).toEqual({ type: 'integer!', value: 0 });
  });

  test('outside deadzone returns value', () => {
    const ev = withMath();
    expect(ev.evalString('math/deadzone 0.5 0.1')).toEqual({ type: 'float!', value: 0.5 });
  });

  test('negative within deadzone returns 0', () => {
    const ev = withMath();
    expect(ev.evalString('math/deadzone -0.05 0.1')).toEqual({ type: 'integer!', value: 0 });
  });

  test('negative outside deadzone returns value', () => {
    const ev = withMath();
    expect(ev.evalString('math/deadzone -0.5 0.1')).toEqual({ type: 'float!', value: -0.5 });
  });
});

describe('math/remap', () => {
  test('midpoint maps correctly', () => {
    const ev = withMath();
    expect(ev.evalString('math/remap 5 0 10 0 100')).toEqual({ type: 'float!', value: 50 });
  });

  test('lo maps to out-lo', () => {
    const ev = withMath();
    expect(ev.evalString('math/remap 0 0 10 0 100')).toEqual({ type: 'integer!', value: 0 });
  });

  test('hi maps to out-hi', () => {
    const ev = withMath();
    expect(ev.evalString('math/remap 10 0 10 0 100')).toEqual({ type: 'integer!', value: 100 });
  });

  test('maps to different range', () => {
    const ev = withMath();
    expect(ev.evalString('math/remap 5 0 10 -1.0 1.0')).toEqual({ type: 'float!', value: 0 });
  });
});

describe('math/distance', () => {
  test('distance between same point is 0', () => {
    const ev = withMath();
    expect(ev.evalString('math/distance 0x0 0x0')).toEqual({ type: 'float!', value: 0 });
  });

  test('3-4-5 triangle', () => {
    const ev = withMath();
    expect(ev.evalString('math/distance 0x0 3x4')).toEqual({ type: 'float!', value: 5 });
  });
});

describe('math/smoothstep', () => {
  test('0 returns 0', () => {
    const ev = withMath();
    expect(ev.evalString('math/smoothstep 0.0')).toEqual({ type: 'float!', value: 0 });
  });

  test('1 returns 1', () => {
    const ev = withMath();
    expect(ev.evalString('math/smoothstep 1.0')).toEqual({ type: 'float!', value: 1 });
  });

  test('0.5 returns 0.5', () => {
    const ev = withMath();
    expect(ev.evalString('math/smoothstep 0.5')).toEqual({ type: 'float!', value: 0.5 });
  });
});

describe('math/fraction', () => {
  test('fractional part of positive', () => {
    const ev = withMath();
    const result = ev.evalString('math/fraction 3.75');
    expect(result.type).toBe('float!');
    if (result.type === 'float!') expect(result.value).toBeCloseTo(0.75);
  });

  test('integer has no fraction', () => {
    const ev = withMath();
    expect(ev.evalString('math/fraction 5.0')).toEqual({ type: 'float!', value: 0 });
  });
});

describe('math/magnitude', () => {
  test('3-4-5 triangle', () => {
    const ev = withMath();
    expect(ev.evalString('math/magnitude 3x4')).toEqual({ type: 'float!', value: 5 });
  });

  test('zero vector', () => {
    const ev = withMath();
    expect(ev.evalString('math/magnitude 0x0')).toEqual({ type: 'float!', value: 0 });
  });
});
