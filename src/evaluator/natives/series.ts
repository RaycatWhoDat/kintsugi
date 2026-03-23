import {
  KtgValue, KtgError,
  NONE, TRUE, FALSE,
  valueToString, valuesEqual, numVal, isNumeric, isCallable,
} from '../values';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { KtgContext } from '../context';
import type { Evaluator } from '../evaluator';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, _ctx: KtgContext, _evaluator: Evaluator): void {
  native('length?', 1, (args) => {
    const v = args[0];
    if (v.type === 'block!') return { type: 'integer!', value: v.values.length };
    if (v.type === 'string!') return { type: 'integer!', value: v.value.length };
    if (v.type === 'map!') return { type: 'integer!', value: v.entries.size };
    throw new KtgError('type', `length? not supported for ${v.type}`);
  });

  native('empty?', 1, (args) => {
    const v = args[0];
    if (v.type === 'block!') return { type: 'logic!', value: v.values.length === 0 };
    if (v.type === 'string!') return { type: 'logic!', value: v.value.length === 0 };
    if (v.type === 'map!') return { type: 'logic!', value: v.entries.size === 0 };
    throw new KtgError('type', `empty? not supported for ${v.type}`);
  });

  native('first', 1, (args) => {
    const v = args[0];
    if (v.type === 'block!') return v.values[0] ?? NONE;
    if (v.type === 'string!') return v.value.length > 0 ? { type: 'string!', value: v.value[0] } : NONE;
    throw new KtgError('type', `first not supported for ${v.type}`);
  });

  native('second', 1, (args) => {
    const v = args[0];
    if (v.type === 'block!') return v.values[1] ?? NONE;
    throw new KtgError('type', `second not supported for ${v.type}`);
  });

  native('last', 1, (args) => {
    const v = args[0];
    if (v.type === 'block!') return v.values.length > 0 ? v.values[v.values.length - 1] : NONE;
    if (v.type === 'string!') return v.value.length > 0 ? { type: 'string!', value: v.value[v.value.length - 1] } : NONE;
    throw new KtgError('type', `last not supported for ${v.type}`);
  });

  native('pick', 2, (args) => {
    const [series, index] = args;
    if (index.type !== 'integer!') throw new KtgError('type', 'pick expects integer index');
    if (series.type === 'block!') return series.values[index.value - 1] ?? NONE;
    if (series.type === 'string!') {
      const ch = series.value[index.value - 1];
      return ch ? { type: 'string!', value: ch } : NONE;
    }
    throw new KtgError('type', `pick not supported for ${series.type}`);
  });

  native('copy', 1, (args) => {
    const v = args[0];
    if (v.type === 'block!') return { type: 'block!', values: [...v.values] };
    if (v.type === 'string!') return { type: 'string!', value: v.value };
    if (v.type === 'map!') return { type: 'map!', entries: new Map(v.entries) };
    return v;
  });

  native('append', 2, (args) => {
    const [series, value] = args;
    if (series.type === 'block!') {
      series.values.push(value);
      return series;
    }
    throw new KtgError('type', `append expects a block — use join or rejoin for strings`);
  });

  native('insert', 3, (args) => {
    const [series, value, position] = args;
    if (position.type !== 'integer!') throw new KtgError('type', 'insert expects integer position');
    if (series.type === 'block!') {
      series.values.splice(position.value - 1, 0, value);
      return series;
    }
    throw new KtgError('type', `insert not supported for ${series.type}`);
  });

  native('remove', 2, (args) => {
    const [series, position] = args;
    if (series.type === 'block!') {
      if (position.type !== 'integer!') throw new KtgError('type', 'remove expects integer position');
      series.values.splice(position.value - 1, 1);
      return series;
    }
    if (series.type === 'map!') {
      const key = valueToString(position);
      series.entries.delete(key);
      return series;
    }
    throw new KtgError('type', `remove not supported for ${series.type}`);
  });

  native('select', 2, (args) => {
    const [series, key] = args;
    if (series.type === 'block!') {
      for (let i = 0; i < series.values.length - 1; i++) {
        if (valuesEqual(series.values[i], key)) return series.values[i + 1];
      }
      return NONE;
    }
    if (series.type === 'map!') {
      const k = valueToString(key);
      return series.entries.get(k) ?? NONE;
    }
    throw new KtgError('type', `select not supported for ${series.type}`);
  });

  native('has?', 2, (args) => {
    const [series, value] = args;
    if (series.type === 'block!') {
      for (const v of series.values) {
        if (valuesEqual(v, value)) return TRUE;
      }
      return FALSE;
    }
    if (series.type === 'string!') {
      if (value.type !== 'string!') throw new KtgError('type', 'has? in string expects string');
      return { type: 'logic!', value: series.value.includes(value.value) };
    }
    if (series.type === 'map!') {
      const k = valueToString(value);
      return { type: 'logic!', value: series.entries.has(k) };
    }
    throw new KtgError('type', `has? not supported for ${series.type}`);
  });

  native('index?', 2, (args) => {
    const [series, value] = args;
    if (series.type === 'block!') {
      for (let i = 0; i < series.values.length; i++) {
        if (valuesEqual(series.values[i], value)) return { type: 'integer!', value: i + 1 };
      }
      return NONE;
    }
    if (series.type === 'string!') {
      if (value.type !== 'string!') throw new KtgError('type', 'index? in string expects string');
      const idx = series.value.indexOf(value.value);
      return idx === -1 ? NONE : { type: 'integer!', value: idx + 1 };
    }
    throw new KtgError('type', `index? not supported for ${series.type}`);
  });

  native('sort', 1, (args, ev, callerCtx, refinements) => {
    const block = args[0];
    if (block.type !== 'block!') throw new KtgError('type', 'sort expects a block');
    const sorted = [...block.values];

    if (refinements.includes('with')) {
      const comparator = args[1];
      if (!isCallable(comparator)) throw new KtgError('type', 'sort/with expects a function');
      sorted.sort((a, b) => {
        const [result] = ev.callCallable(comparator, [a, b], 0, callerCtx);
        return numVal(result);
      });
    } else if (refinements.includes('by')) {
      const keyFn = args[1];
      if (!isCallable(keyFn)) throw new KtgError('type', 'sort/by expects a function');
      sorted.sort((a, b) => {
        const [ka] = ev.callCallable(keyFn, [a], 0, callerCtx);
        const [kb] = ev.callCallable(keyFn, [b], 0, callerCtx);
        return defaultCompare(ka, kb);
      });
    } else {
      sorted.sort(defaultCompare);
    }

    return { type: 'block!', values: sorted };
  }, { with: 1, by: 1 });
}

function defaultCompare(a: KtgValue, b: KtgValue): number {
  if (isNumeric(a) && isNumeric(b)) return numVal(a) - numVal(b);
  if (a.type === 'money!' && b.type === 'money!') return a.cents - b.cents;
  if (a.type === 'string!' && b.type === 'string!') return a.value < b.value ? -1 : a.value > b.value ? 1 : 0;
  return 0;
}
