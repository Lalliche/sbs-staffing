/* Per-state memoisation. The store clones the state on every write, so a WeakMap keyed by the
   state object is invalidated automatically whenever anything changes. */
const caches = new WeakMap<object, Map<string, unknown>>();

export function memo<T>(state: object, key: string, compute: () => T): T {
  let m = caches.get(state);
  if (!m) {
    m = new Map();
    caches.set(state, m);
  }
  if (m.has(key)) return m.get(key) as T;
  const v = compute();
  m.set(key, v);
  return v;
}

/** Drop every cached value of a state. Call after mutating a state object in place (actions do it via audit()). */
export function invalidate(state: object): void {
  caches.delete(state);
}
