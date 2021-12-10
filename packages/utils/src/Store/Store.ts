import {
  createDraft,
  finishDraft,
  Patch,
  enableMapSet,
  enablePatches,
} from 'immer';
import isEqual from 'lodash/isEqual';

enableMapSet();
enablePatches();

// A Generic Store class to hold stateful values
export class Store<S = any> {
  private subscribers: Set<(state: S) => void> = new Set();
  private state: S;

  isFlushing = false;

  constructor(initialState: S) {
    this.state = initialState;
  }

  subscribe<C>(
    collector: (state: S) => C,
    onChange: (collected: C) => void,
    init: boolean = false
  ) {
    let current;
    let isInvalidated = false;

    const subscriber = (state: S) => {
      if (isInvalidated) {
        return;
      }

      const newCollectedValues = collector(state);

      if (current && isEqual(newCollectedValues, current)) {
        return;
      }

      current = newCollectedValues;
      onChange(current);
    };

    if (init) {
      subscriber(this.getState());
    }

    this.subscribers.add(subscriber);

    return () => {
      isInvalidated = true;
      this.subscribers.delete(subscriber);
    };
  }

  getState() {
    return this.state;
  }

  setState(
    setter: (state: S) => void,
    opts: Partial<{
      onPatch: (patches: Patch[], inversePatches: Patch[]) => void;
    }> = {}
  ) {
    const { onPatch } = {
      onPatch: null,
      ...opts,
    };

    const draft = createDraft(this.state);
    setter(draft as S);
    this.state = finishDraft(draft, onPatch) as S;

    if (!this.isFlushing) {
      this.isFlushing = true;

      /**
       * Batch multiple subsequent state changes into a single notify call
       */
      Promise.resolve().then(() => {
        this.isFlushing = false;
        this.notify();
      });
    }
  }

  protected notify() {
    this.subscribers.forEach((subscriber) => subscriber(this.getState()));
  }
}

export type StateForStore<S extends Store> = S extends Store<infer I>
  ? I
  : never;
