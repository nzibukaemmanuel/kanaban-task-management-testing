import { signal, Signal, WritableSignal } from '@angular/core';

/**
 * A stand-in for NgRx's Store that exposes only what components use here: `selectSignal` and
 * `dispatch`. Each selector is backed by a writable signal the test controls through `set`, so a
 * component can be driven with any state without a reducer, effects or HTTP behind it.
 */
export function createMockStore(initial: [selector: unknown, value: unknown][] = []) {
  const signals = new Map<unknown, WritableSignal<unknown>>(
    initial.map(([selector, value]) => [selector, signal(value)]),
  );

  return {
    dispatch: jest.fn(),
    selectSignal: jest.fn(<T>(selector: unknown): Signal<T> => {
      if (!signals.has(selector)) {
        throw new Error('createMockStore: no value registered for the requested selector');
      }
      return signals.get(selector)!.asReadonly() as Signal<T>;
    }),
    /** Pushes a new value for a selector, as if the store state had changed. */
    set(selector: unknown, value: unknown): void {
      const target = signals.get(selector);
      if (!target) {
        throw new Error('createMockStore: no value registered for the given selector');
      }
      target.set(value);
    },
  };
}
