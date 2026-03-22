import { KtgError, type KtgValue } from './values';

export class KtgContext {
  private bindings: Map<string, KtgValue> = new Map();

  constructor(private parent: KtgContext | null = null) {}

  set(name: string, value: KtgValue): void {
    this.bindings.set(name, value);
  }

  setUp(name: string, value: KtgValue): void {
    if (this.bindings.has(name)) { this.bindings.set(name, value); return; }
    if (this.parent) { this.parent.setUp(name, value); return; }
    throw new KtgError('binding', `${name} has no value to update`);
  }

  get(name: string): KtgValue | undefined {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }

  has(name: string): boolean {
    return this.bindings.has(name);
  }

  child(): KtgContext {
    return new KtgContext(this);
  }

  clone(): KtgContext {
    const cloned = new KtgContext(this.parent);
    for (const [key, val] of this.bindings) {
      cloned.set(key, val);
    }
    return cloned;
  }

  keys(): IterableIterator<string> {
    return this.bindings.keys();
  }

  entries(): IterableIterator<[string, KtgValue]> {
    return this.bindings.entries();
  }
}
