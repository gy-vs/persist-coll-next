import {
  ANY_KEY,
  fromJS,
  List,
  Map,
  MapOf,
  OrderedMap,
  Record,
  removeIn,
  setIn,
  Set,
  updateIn,
} from 'immutable';

describe('ANY_KEY wildcard in keyPath', () => {
  it('is exported as a unique constant', () => {
    expect(typeof ANY_KEY).toBe('string');
    expect(ANY_KEY).toBe('@@__IMMUTABLE_ANY__@@');
  });

  describe('updateIn', () => {
    it('updates every item of a List', () => {
      const state = fromJS({ users: [{ name: 'a' }, { name: 'b' }] });
      const next = state.updateIn(['users', ANY_KEY, 'name'], s =>
        (s as string).toUpperCase()
      );
      expect(next.toJS()).toEqual({
        users: [{ name: 'A' }, { name: 'B' }],
      });
    });

    it('supports several wildcard segments in one path', () => {
      const state = fromJS({
        orders: [
          { items: [{ checked: false }, { checked: false }] },
          { items: [{ checked: false }] },
        ],
      });
      const next = state.updateIn(
        ['orders', ANY_KEY, 'items', ANY_KEY, 'checked'],
        checked => !checked
      );
      expect(next.toJS()).toEqual({
        orders: [
          { items: [{ checked: true }, { checked: true }] },
          { items: [{ checked: true }] },
        ],
      });
    });

    it('works with the functional API on raw JS', () => {
      const state = { users: [{ name: 'a' }, { name: 'b' }] };
      expect(
        updateIn(state, ['users', ANY_KEY, 'name'], s =>
          (s as string).toUpperCase()
        )
      ).toEqual({ users: [{ name: 'A' }, { name: 'B' }] });
    });

    it('traverses Map and OrderedMap children', () => {
      const m = Map({ a: Map({ n: 1 }), b: Map({ n: 2 }) });
      expect(m.updateIn([ANY_KEY, 'n'], v => (v as number) + 1).toJS()).toEqual(
        {
          a: { n: 2 },
          b: { n: 3 },
        }
      );

      const om = OrderedMap({
        a: OrderedMap({ n: 1 }),
        b: OrderedMap({ n: 2 }),
      });
      expect(
        om.updateIn([ANY_KEY, 'n'], v => (v as number) + 1).toJS()
      ).toEqual({
        a: { n: 2 },
        b: { n: 3 },
      });
    });

    it('traverses Record children', () => {
      const Person = Record({ name: '' }, 'Person');
      const people = Map({
        alice: Person({ name: 'alice' }),
        bob: Person({ name: 'bob' }),
      });
      const next = people.updateIn([ANY_KEY, 'name'], v =>
        (v as string).toUpperCase()
      );
      expect(next.toJS()).toEqual({
        alice: { name: 'ALICE' },
        bob: { name: 'BOB' },
      });
    });

    it('traverses plain JS objects nested inside immutable collections', () => {
      const m = Map({ users: List([{ name: 'a' }, { name: 'b' }]) });
      const next = m.updateIn(['users', ANY_KEY, 'name'], s =>
        (s as string).toUpperCase()
      );
      expect(next.toJS()).toEqual({
        users: [{ name: 'A' }, { name: 'B' }],
      });
    });

    it('skips children missing the next segment instead of creating it', () => {
      const state = fromJS({
        users: [
          { profile: { phone: '1' }, name: 'a' },
          { name: 'b' },
          { profile: { phone: '3' }, name: 'c' },
        ],
      });
      const next = state.updateIn(
        ['users', ANY_KEY, 'profile', 'phone'],
        phone => `+${phone as string}`
      );
      expect(next.toJS()).toEqual({
        users: [
          { profile: { phone: '+1' }, name: 'a' },
          { name: 'b' },
          { profile: { phone: '+3' }, name: 'c' },
        ],
      });
      // The child without a profile keeps its identity.
      expect(next.getIn(['users', 1])).toBe(state.getIn(['users', 1]));
    });

    it('does nothing when the wildcard level is empty or missing', () => {
      const m = Map({ users: List() }) as MapOf<{ users: List<unknown> }>;
      expect(m.updateIn(['users', ANY_KEY, 'x'], () => 1)).toBe(m);
      expect(Map().updateIn(['missing', ANY_KEY, 'x'], () => 1)).toBe(Map());

      const raw = { users: [] as Array<{ x?: number }> };
      expect(updateIn(raw, ['users', ANY_KEY, 'x'], () => 1)).toBe(raw);
    });

    it('keeps the original root when a wildcard follows a top-level gap', () => {
      const empty = Map();
      expect(setIn(empty, ['missing', ANY_KEY, 'x'], 1)).toBe(empty);
      expect(updateIn(empty, ['missing', ANY_KEY, 'x'], () => 1)).toBe(empty);
      expect(removeIn(empty, ['missing', ANY_KEY])).toBe(empty);

      const emptyList = List();
      expect(emptyList.setIn([ANY_KEY, 'x'], 1)).toBe(emptyList);
      expect(removeIn(emptyList, [ANY_KEY])).toBe(emptyList);

      const raw = {};
      expect(setIn(raw, ['missing', ANY_KEY, 'x'], 1)).toBe(raw);
      expect(removeIn(raw, ['missing', ANY_KEY])).toBe(raw);
    });

    it('skips non-collection children when the path continues', () => {
      const m = Map({ a: 1, b: Map({ x: 2 }) });
      expect(m.updateIn([ANY_KEY, 'x'], v => (v as number) + 1).toJS()).toEqual(
        {
          a: 1,
          b: { x: 3 },
        }
      );
    });

    it('applies the updater to all children when the wildcard is last', () => {
      expect(
        Map({ a: 1, b: 2 })
          .updateIn([ANY_KEY], v => (v as number) * 10)
          .toJS()
      ).toEqual({ a: 10, b: 20 });
      expect(
        List([1, 2, 3])
          .updateIn([ANY_KEY], v => (v as number) + 1)
          .toJS()
      ).toEqual([2, 3, 4]);
    });

    it('never invokes the updater (or notSetValue) below a wildcard for missing leaves', () => {
      const m = Map({ a: Map({ x: 1 }) });
      let calls = 0;
      const next = m.updateIn([ANY_KEY, 'y'], 10, v => {
        calls++;
        return v;
      });
      expect(next).toBe(m);
      expect(calls).toBe(0);
    });

    it('returns the original collection when no value changes', () => {
      const m = fromJS({ users: [{ n: 1 }, { n: 2 }] });
      // updater returns the same value
      expect(m.updateIn(['users', ANY_KEY, 'n'], v => v)).toBe(m);
      // no matching children at all
      expect(m.updateIn(['users', ANY_KEY, 'missing'], v => v)).toBe(m);
    });
  });

  describe('setIn', () => {
    it('sets a value in every matching child', () => {
      const state = fromJS({
        orders: [
          { items: [{ checked: false }] },
          { items: [{ checked: false }] },
        ],
      });
      expect(
        state
          .setIn(['orders', ANY_KEY, 'items', ANY_KEY, 'checked'], true)
          .toJS()
      ).toEqual({
        orders: [
          { items: [{ checked: true }] },
          { items: [{ checked: true }] },
        ],
      });
    });

    it('works with the functional API on raw JS', () => {
      const state = { users: [{ name: 'a' }, { name: 'b' }] };
      expect(setIn(state, ['users', ANY_KEY, 'name'], 'x')).toEqual({
        users: [{ name: 'x' }, { name: 'x' }],
      });
    });

    it('does not create missing intermediate values below a wildcard', () => {
      const state = fromJS({ users: [{ profile: { phone: '1' } }, {}] });
      const next = state.setIn(['users', ANY_KEY, 'profile', 'phone'], '123');
      expect(next.toJS()).toEqual({
        users: [{ profile: { phone: '123' } }, {}],
      });
      // A brand new leaf key is not conjured up below the wildcard either.
      expect(state.setIn(['users', ANY_KEY, 'profile', 'email'], 'x')).toBe(
        state
      );
    });

    it('returns the original collection for a complete no-op', () => {
      const m = Map();
      expect(m.setIn([ANY_KEY, 'x'], 1)).toBe(m);

      const state = fromJS({ users: [{ a: 1 }, { a: 2 }] });
      expect(setIn(state, ['users', ANY_KEY, 'missing', 'deep'], 1)).toBe(
        state
      );

      const raw = { a: {} };
      expect(setIn(raw, ['a', ANY_KEY, 'x'], 1)).toBe(raw);
    });
  });

  describe('removeIn', () => {
    it('removes a value from every matching child', () => {
      const state = fromJS({
        users: [
          { profile: { phone: '1', keep: true } },
          { profile: { phone: '2', keep: true } },
        ],
      });
      expect(
        state.removeIn(['users', ANY_KEY, 'profile', 'phone']).toJS()
      ).toEqual({
        users: [{ profile: { keep: true } }, { profile: { keep: true } }],
      });
    });

    it('works as deleteIn alias and with the functional API', () => {
      const m = fromJS({ users: [{ x: 1 }, { x: 2 }] });
      expect(m.deleteIn(['users', ANY_KEY, 'x']).toJS()).toEqual({
        users: [{}, {}],
      });
      expect(removeIn({ users: [{ x: 1 }] }, ['users', ANY_KEY, 'x'])).toEqual({
        users: [{}],
      });
    });

    it('removes entries from indexed collections', () => {
      const l = List([Map({ a: 1 }), Map({ a: 2 })]);
      expect(l.removeIn([ANY_KEY, 'a']).toJS()).toEqual([{}, {}]);
      const raw = [{ a: 1 }, { a: 2 }];
      expect(removeIn(raw, [ANY_KEY, 'a'])).toEqual([{}, {}]);
    });

    it('leaves children without the path untouched and keeps identity', () => {
      const state = fromJS({ users: [{ a: 1 }, { b: 2 }] });
      const next = state.removeIn(['users', ANY_KEY, 'a']);
      expect(next.toJS()).toEqual({ users: [{}, { b: 2 }] });
      expect(next.getIn(['users', 1])).toBe(state.getIn(['users', 1]));
      expect(state.removeIn(['users', ANY_KEY, 'missing'])).toBe(state);
    });
  });

  describe('interaction with ordinary path behavior', () => {
    it('still creates empty Maps for gaps in paths without a wildcard', () => {
      expect(Map().setIn(['a', 'b'], 1).toJS()).toEqual({ a: { b: 1 } });
      expect(setIn({}, ['a', 'b'], 1)).toEqual({ a: { b: 1 } });
    });

    it('still throws TypeError for non-collection intermediate values without a wildcard', () => {
      const m = Map({ key: 123 });
      expect(() => m.setIn(['key', 'foo'], 'x')).toThrow(
        'Cannot update within non-data-structure value in path ["key"]: 123'
      );
      expect(() => updateIn({ key: 123 }, ['key', 'foo'], () => 'x')).toThrow(
        TypeError
      );
    });

    it('supports withMutations', () => {
      const m = fromJS({ users: [{ n: 1 }, { n: 2 }] });
      const next = m.withMutations(state => {
        state.setIn(['users', ANY_KEY, 'n'], 0);
      });
      expect(next.toJS()).toEqual({ users: [{ n: 0 }, { n: 0 }] });
    });

    it('handles a wildcard as the first segment', () => {
      const m = Map({ a: Map({ n: 1 }), b: Map({ n: 2 }) });
      expect(m.setIn([ANY_KEY, 'n'], 0).toJS()).toEqual({
        a: { n: 0 },
        b: { n: 0 },
      });
    });

    it('accepts an immutable List as keyPath containing ANY_KEY', () => {
      const state = fromJS({ users: [{ n: 1 }, { n: 2 }] });
      const next = state.updateIn(
        fromJS(['users', ANY_KEY, 'n']),
        v => (v as number) * 10
      );
      expect(next.toJS()).toEqual({ users: [{ n: 10 }, { n: 20 }] });
    });

    it('preserves OrderedMap insertion order', () => {
      const om = OrderedMap({ z: Map({ x: 1 }), a: Map({ x: 2 }) });
      expect(om.setIn([ANY_KEY, 'x'], 0).keySeq().toJS()).toEqual(['z', 'a']);
    });

    it('updates leaf collection values via a trailing wildcard', () => {
      const m = Map({ a: Set([1, 2]), b: Set([3]) });
      const out = m.updateIn([ANY_KEY], v => (v as Set<number>).add(10));
      expect(
        out
          .get('a')
          .toJS()
          .sort((x: number, y: number) => x - y)
      ).toEqual([1, 2, 10]);
      expect(
        out
          .get('b')
          .toJS()
          .sort((x: number, y: number) => x - y)
      ).toEqual([3, 10]);
    });

    it('skips null and undefined children below a wildcard', () => {
      const m = Map({ a: null, b: undefined, c: Map({ x: 1 }) });
      expect(m.setIn([ANY_KEY, 'x'], 9).toJS()).toEqual({
        a: null,
        b: undefined,
        c: { x: 9 },
      });
    });

    it('propagates exceptions thrown by the updater', () => {
      const m = Map({ a: Map({ x: 1 }) });
      expect(() =>
        m.updateIn([ANY_KEY, 'x'], () => {
          throw new Error('boom');
        })
      ).toThrow('boom');
    });

    it('honors the functional notSetValue signature on existing leaves', () => {
      const m = Map({ a: Map({ x: 1 }), b: Map({}) });
      expect(
        updateIn(m, [ANY_KEY, 'x'], 100, v => (v as number) + 1).toJS()
      ).toEqual({
        a: { x: 2 },
        b: {},
      });
    });
  });
});
