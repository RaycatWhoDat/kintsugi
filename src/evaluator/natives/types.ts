import {
  KtgValue, KtgBlock, KtgNative, KtgError,
  NONE, TRUE, FALSE,
  isTruthy, typeOf, valueToString, numVal, isNumeric,
} from '../values';
import { KtgContext } from '../context';
import { matchesType, validateCustomType, checkType } from '../type-check';
import type { RegisterNativeFn, RegisterOpFn } from './registration';
import type { Evaluator } from '../evaluator';
import { parseObjectDialect } from '../dialect-object';
import { parseBlock } from '../parse';

export function register(native: RegisterNativeFn, _op: RegisterOpFn, ctx: KtgContext, _evaluator: Evaluator): void {
  native('type', 1, (args) => {
    return { type: 'type!', name: typeOf(args[0]) };
  });

  native('to', 2, (args) => {
    const [targetType, value] = args;
    const typeName = targetType.type === 'type!' ? targetType.name : valueToString(targetType);
    switch (typeName) {
      case 'integer!':
        if (value.type === 'string!') return { type: 'integer!', value: parseInt(value.value, 10) };
        if (value.type === 'logic!') return { type: 'integer!', value: value.value ? 1 : 0 };
        if (isNumeric(value)) return { type: 'integer!', value: Math.trunc(numVal(value)) };
        break;
      case 'float!':
        if (value.type === 'string!') return { type: 'float!', value: parseFloat(value.value) };
        if (value.type === 'logic!') return { type: 'float!', value: value.value ? 1.0 : 0.0 };
        if (isNumeric(value)) return { type: 'float!', value: numVal(value) };
        break;
      case 'string!':
        if (value.type === 'block!') return { type: 'string!', value: value.values.map(valueToString).join(' ') };
        return { type: 'string!', value: valueToString(value) };
      case 'logic!':
        return { type: 'logic!', value: isTruthy(value) };
      case 'word!': {
        const n = wordNameOf(value);
        if (n !== null) return { type: 'word!', name: n };
        break;
      }
      case 'set-word!': {
        const n = wordNameOf(value);
        if (n !== null) return { type: 'set-word!', name: n };
        break;
      }
      case 'lit-word!': {
        const n = wordNameOf(value);
        if (n !== null) return { type: 'lit-word!', name: n };
        break;
      }
      case 'get-word!': {
        const n = wordNameOf(value);
        if (n !== null) return { type: 'get-word!', name: n };
        break;
      }
      case 'meta-word!': {
        const n = wordNameOf(value);
        if (n !== null) return { type: 'meta-word!', name: n };
        break;
      }
      case 'block!':
        if (value.type === 'string!') return { type: 'block!', values: [value] };
        if (value.type === 'block!') return value;
        return { type: 'block!', values: [value] };
      case 'date!':
        if (value.type === 'string!') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value.value)) break;
          return { type: 'date!', value: value.value };
        }
        break;
      case 'time!':
        if (value.type === 'string!') {
          if (!/^\d{2}:\d{2}:\d{2}$/.test(value.value)) break;
          return { type: 'time!', value: value.value };
        }
        break;
      case 'money!':
        if (value.type === 'integer!' || value.type === 'float!') {
          return { type: 'money!', cents: Math.round(numVal(value) * 100) };
        }
        if (value.type === 'string!') {
          const str = value.value.replace(/^\$/, '');
          const n = parseFloat(str);
          if (isNaN(n)) break;
          return { type: 'money!', cents: Math.round(n * 100) };
        }
        if (value.type === 'money!') return value;
        break;
      case 'pair!':
        if (value.type === 'string!') {
          const pm = value.value.match(/^(-?\d+)x(-?\d+)$/);
          if (!pm) break;
          return { type: 'pair!', x: parseInt(pm[1], 10), y: parseInt(pm[2], 10) };
        }
        if (value.type === 'block!' && value.values.length === 2 && isNumeric(value.values[0]) && isNumeric(value.values[1])) {
          return { type: 'pair!', x: Math.trunc(numVal(value.values[0])), y: Math.trunc(numVal(value.values[1])) };
        }
        break;
      case 'tuple!':
        if (value.type === 'string!') {
          const tparts = value.value.split('.');
          if (tparts.length < 2 || tparts.some(p => !/^\d+$/.test(p))) break;
          return { type: 'tuple!', parts: tparts.map(Number) };
        }
        break;
      case 'file!':
        if (value.type === 'string!') return { type: 'file!', value: value.value };
        break;
      case 'url!':
        if (value.type === 'string!') return { type: 'url!', value: value.value };
        break;
      case 'email!':
        if (value.type === 'string!') return { type: 'email!', value: value.value };
        break;
      case 'map!':
        if (value.type === 'block!') {
          const entries = new Map<string, KtgValue>();
          for (let i = 0; i < value.values.length - 1; i += 2) {
            const key = value.values[i];
            const val = value.values[i + 1];
            const keyStr = key.type === 'set-word!' ? key.name : valueToString(key);
            entries.set(keyStr, val);
          }
          return { type: 'map!', entries };
        }
        break;
    }
    throw new KtgError('type', `Cannot convert ${value.type} to ${typeName}`);
  });

  native('make', 2, (args, ev, callerCtx) => {
    const [target, spec] = args;

    // make map! [...]
    if (target.type === 'type!' && target.name === 'map!' && spec.type === 'block!') {
      const entries = new Map<string, KtgValue>();
      for (let i = 0; i < spec.values.length - 1; i += 2) {
        const key = spec.values[i];
        const val = spec.values[i + 1];
        const keyStr = key.type === 'set-word!' ? key.name : valueToString(key);
        entries.set(keyStr, val);
      }
      return { type: 'map!', entries };
    }

    // make <context> [overrides]
    if (target.type === 'context!' && spec.type === 'block!') {
      const cloned = target.context.clone();
      const clonedValue: KtgValue = { type: 'context!', context: cloned };

      // Re-bind self if this is an object
      if (cloned.has('self')) {
        cloned.set('self', clonedValue);
      }

      // Copy field metadata if present
      if ((target as any).__fields) {
        (clonedValue as any).__fields = (target as any).__fields;
      }

      ev.evalBlock(spec as KtgBlock, cloned);

      // Type-check fields against spec
      if ((target as any).__fields) {
        for (const field of (target as any).__fields) {
          const val = cloned.get(field.name);
          if (val && val.type !== 'none!' && field.type !== 'any-type!') {
            checkType(val, field.type, field.name, callerCtx, ev);
          }
        }
      }

      return clonedValue;
    }

    const typeName = target.type === 'type!' ? target.name : valueToString(target);
    throw new KtgError('type', `make not supported for ${typeName}`);
  });

  native('context', 1, (args, ev, callerCtx, refinements) => {
    const block = args[0];
    if (block.type !== 'block!') throw new KtgError('type', 'context expects a block');
    const childCtx = new KtgContext(callerCtx);
    if (refinements.includes('from')) {
      for (const [key, val] of callerCtx.entries()) {
        childCtx.set(key, val);
      }
    }
    ev.evalBlock(block, childCtx);
    return { type: 'context!', context: childCtx };
  }, { from: 0 });

  native('object', 1, (args, ev, callerCtx) => {
    const block = args[0];
    if (block.type !== 'block!') throw new KtgError('type', 'object expects a block');

    const { fields, bodyStart } = parseObjectDialect(block as KtgBlock);

    // Build prototype context
    const objCtx = new KtgContext(callerCtx);

    // Set field defaults — evaluate the default value expression
    for (const field of fields) {
      if (field.hasDefault) {
        try {
          const [defaultVal] = ev.evalNext([field.defaultValue], 0, callerCtx);
          objCtx.set(field.name, defaultVal);
        } catch (e) {
          if (e instanceof KtgError) {
            e.addDetail(`while evaluating @default for field '${field.name}'`);
          }
          throw e;
        }
      } else {
        objCtx.set(field.name, NONE);
      }
    }

    // Create the context value so self can reference it
    const objValue: KtgValue = { type: 'context!', context: objCtx };

    // Bind self
    objCtx.set('self', objValue);

    // Evaluate the rest of the block (methods, computed fields) in the object context
    if (bodyStart < (block as KtgBlock).values.length) {
      const methodBlock: KtgBlock = {
        type: 'block!',
        values: (block as KtgBlock).values.slice(bodyStart),
      };
      try {
        ev.evalBlock(methodBlock, objCtx);
      } catch (e) {
        if (e instanceof KtgError) {
          e.addDetail('while evaluating object body');
        }
        throw e;
      }
    }

    // Store field specs as metadata for type checking and make
    (objValue as any).__fields = fields;

    return objValue;
  });

  native('is?', 2, (args, ev, callerCtx) => {
    const [typeArg, value] = args;

    // Object prototype — check fields structurally
    if (typeArg.type === 'context!' && (typeArg as any).__fields) {
      if (value.type !== 'context!') return FALSE;
      const fields = (typeArg as any).__fields;
      const ctxVal = (value as any).context as KtgContext;
      for (const field of fields) {
        const fieldVal = ctxVal.get(field.name);
        if (fieldVal === undefined) return FALSE;
        if (field.optional && fieldVal.type === 'none!') continue;
        if (!matchesType(fieldVal, field.type, callerCtx, ev)) return FALSE;
      }
      return TRUE;
    }

    // type! with rule — use validateCustomType (handles both contexts and blocks)
    if (typeArg.type === 'type!' && typeArg.rule) {
      return validateCustomType(value, typeArg, callerCtx, ev) ? TRUE : FALSE;
    }

    // Built-in type name like integer!
    if (typeArg.type === 'type!') {
      return matchesType(value, typeArg.name, callerCtx, ev) ? TRUE : FALSE;
    }

    // Raw parse rule block
    if (typeArg.type === 'block!') {
      const input = value.type === 'block!'
        ? value
        : { type: 'block!' as const, values: [value] };
      return parseBlock(input as any, typeArg, callerCtx, ev) ? TRUE : FALSE;
    }

    throw new KtgError('type', 'is? expects a type, @type value, or rule block');
  });

  // === @type — define types via parse rules ===
  native('@type', 1, (args, _ev, _callerCtx, refinements) => {
    const block = args[0];
    if (block.type !== 'block!') throw new KtgError('type', '@type expects a block');
    const rule = block as KtgBlock;
    const guard = refinements.includes('where') && args[1]?.type === 'block!' ? args[1] as KtgBlock : undefined;
    const isEnum = refinements.includes('enum');
    return { type: 'type!', name: '', rule, guard, enum: isEnum } as any;
  }, { where: 1, enum: 0 });

  // === Type Names ===

  const typeNames = [
    'integer!', 'float!', 'money!', 'string!', 'logic!', 'none!',
    'pair!', 'tuple!', 'date!', 'time!', 'file!',
    'url!', 'email!', 'word!', 'set-word!', 'get-word!', 'lit-word!', 'meta-word!',
    'path!', 'block!', 'paren!', 'map!', 'context!', 'function!',
    'native!', 'op!', 'type!',
    'any-type!', 'number!', 'any-word!', 'any-block!', 'scalar!',
  ];

  for (const name of typeNames) {
    ctx.set(name, { type: 'type!', name } as KtgValue);
  }

  // Logic aliases — bound as words so dialects can use 'on'/'off' as keywords
  ctx.set('on', TRUE);
  ctx.set('off', FALSE);
  ctx.set('yes', TRUE);
  ctx.set('no', FALSE);

  // === Type Predicates ===
  // Generated from typeNames: integer! -> integer?, etc.

  for (const tn of typeNames) {
    const predName = tn.replace('!', '?');
    native(predName, 1, (args) => ({ type: 'logic!', value: matchesType(args[0], tn) }));
  }

  // === time context ===
  const timeCtx = new KtgContext(null);
  timeCtx.set('now', {
    type: 'native!',
    name: 'time/now',
    arity: 0,
    fn: () => ({ type: 'integer!', value: Math.floor(Date.now() / 1000) }),
  } as KtgNative);
  ctx.set('time', { type: 'context!', context: timeCtx });
}

// --- Private helper ---

function wordNameOf(v: KtgValue): string | null {
  if (v.type === 'string!') return v.value;
  if (v.type === 'word!' || v.type === 'set-word!' || v.type === 'get-word!' || v.type === 'lit-word!' || v.type === 'meta-word!') return v.name;
  return null;
}
