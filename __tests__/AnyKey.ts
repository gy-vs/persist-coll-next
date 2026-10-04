import {
  ANY_KEY,
  fromJS,
  List,
  Map,
  OrderedMap,
  OrderedSet,
  Record,
  removeIn,
  Seq,
  setIn,
  updateIn,
} from 'immutable';

describe('ANY_KEY', () => {
  describe('updateIn', () => {
    it('applies the updater to every child of a wildcard segment', () => {
      const state = fromJS({ users: [{ name: 'a' }, { name: 'b' }] });
      expect(
        state
          .updateIn(
            ['users', ANY_KEY, 'name'],
            // @ts-expect-error -- fromJS returns Collection<unknown>
            (name: string) => name.toUpperCase()
          )
          .toJS()
      ).toEqual({ users: [{ name: 'A' }, { name: 'B' }] });
    });

    it('supports multiple wildcard segments in one path', () => {
      const state = fromJS({
        orders: [
          { items: [{ checked: false }, { checked: false }] },
          { items: [{ checked: false }] },
        ],
      });
      expect(
        state
          .setIn(['orders', ANY_KEY, 'items', ANY_KEY, 'checked'], true)
          .toJS()
      ).toEqual({
        orders: [
          { items: [{ checked: true }, { checked: true }] },
          { items: [{ checked: true }] },
        ],
      });
    });

    it('works as the only segment of a path', () => {
      const state = Map({ a: 1, b: 2 });
      expect(state.updateIn([ANY_KEY], v => (v as number) * 10).toJS()).toEqual(
        {
          a: 10,
          b: 20,
        }
      );
    });

    it('works at the root of a List', () => {
      const state = List([1, 2, 3]);
      expect(state.updateIn([ANY_KEY], v => (v as number) + 1).toJS()).toEqual([
        2, 3, 4,
      ]);
    });

    it('works with OrderedMap', () => {
      const state = OrderedMap({ a: Map({ n: 1 }), b: Map({ n: 2 }) });
      const out = state.updateIn([ANY_KEY, 'n'], v => (v as number) + 10);
      expect(out.toJS()).toEqual({ a: { n: 11 }, b: { n: 12 } });
      expect(out.keySeq().toArray()).toEqual(['a', 'b']);
      expect(OrderedMap.isOrderedMap(out)).toBe(true);
    });

    it('works with Record children', () => {
      const Person = Record({ name: '' });
      const state = Map({ a: Person({ name: 'a' }), b: Person({ name: 'b' }) });
      const out = state.setIn([ANY_KEY, 'name'], 'x');
      expect(out.getIn(['a', 'name'])).toBe('x');
      expect(out.getIn(['b', 'name'])).toBe('x');
    });

    it('accepts an ordered Collection (List, Seq, OrderedSet) as a wildcard keyPath', () => {
      const state = fromJS({ users: [{ name: 'a' }, { name: 'b' }] });
      const expected = { users: [{ name: 'A' }, { name: 'B' }] };
      const paths = [
        List(['users', ANY_KEY, 'name']),
        Seq(['users', ANY_KEY, 'name']),
        OrderedSet(['users', ANY_KEY, 'name']),
      ];
      paths.forEach(keyPath => {
        expect(
          state
            .updateIn(
              keyPath,
              // @ts-expect-error -- fromJS returns Collection<unknown>
              (name: string) => name.toUpperCase()
            )
            .toJS()
        ).toEqual(expected);
      });
    });

    it('only rebuilds changed branches', () => {
      const u0 = Map({ profile: Map({ x: 1 }) });
      const u1 = Map({ other: true });
      const state = Map({ users: List([u0, u1]) });
      const out = state.setIn(['users', ANY_KEY, 'profile', 'y'], 2);
      expect(out.getIn(['users', 1])).toBe(u1);
      expect(out.getIn(['users', 0])).not.toBe(u0);
    });
  });

  describe('setIn', () => {
    it('sets a value in every child', () => {
      const state = fromJS({
        users: [
          { profile: { keep: 1, phone: 'a' } },
          { profile: { phone: 'b' } },
          {},
        ],
      });
      expect(
        state.setIn(['users', ANY_KEY, 'profile', 'phone'], undefined).toJS()
      ).toEqual({
        users: [
          { profile: { keep: 1, phone: undefined } },
          { profile: { phone: undefined } },
          {},
        ],
      });
    });

    it('sets nested lists of lists', () => {
      const state = List([List([1, 2]), List([3, 4])]);
      expect(state.setIn([ANY_KEY, ANY_KEY], 0).toJS()).toEqual([
        [0, 0],
        [0, 0],
      ]);
    });

    it('creates the final key on an existing parent', () => {
      const state = fromJS({ users: [{ profile: {} }] });
      expect(
        state.setIn(['users', ANY_KEY, 'profile', 'phone'], '123').toJS()
      ).toEqual({ users: [{ profile: { phone: '123' } }] });
    });
  });

  describe('removeIn', () => {
    it('removes a value from every child', () => {
      const state = fromJS({
        users: [
          { profile: { phone: 'a', keep: 1 } },
          { profile: { phone: 'b' } },
          {},
        ],
      });
      expect(
        state.removeIn(['users', ANY_KEY, 'profile', 'phone']).toJS()
      ).toEqual({
        users: [{ profile: { keep: 1 } }, { profile: {} }, {}],
      });
    });

    it('removes items from indexed children while keeping indices consistent', () => {
      const state = List([List([1, 2]), List([3])]);
      const out = state.removeIn([ANY_KEY, ANY_KEY]);
      expect(out.toJS()).toEqual([[], []]);
      expect(out.size).toBe(2);
    });

    it('removing every value via a leaf wildcard empties the container', () => {
      const state = Map({ a: 1, b: 2 });
      expect(state.removeIn([ANY_KEY]).size).toBe(0);
    });
  });

  describe('plain JavaScript values', () => {
    it('walks plain objects and arrays', () => {
      const state = {
        users: [{ profile: { phone: 'a' } }, { profile: { phone: 'b' } }, {}],
      };
      expect(removeIn(state, ['users', ANY_KEY, 'profile', 'phone'])).toEqual({
        users: [{ profile: {} }, { profile: {} }, {}],
      });
    });

    it('supports the functional updateIn on raw JS', () => {
      expect(updateIn([1, 2], [ANY_KEY], v => (v as number) + 1)).toEqual([
        2, 3,
      ]);
      expect(
        updateIn(
          { users: [{ name: 'a' }, { name: 'b' }] },
          ['users', ANY_KEY, 'name'],
          v => (v as string).toUpperCase()
        )
      ).toEqual({ users: [{ name: 'A' }, { name: 'B' }] });
    });

    it('supports the functional setIn on raw JS', () => {
      expect(setIn({ a: [{ x: 1 }] }, ['a', ANY_KEY, 'x'], 2)).toEqual({
        a: [{ x: 2 }],
      });
    });

    it('supports a functional call on the root collection', () => {
      expect(
        updateIn({ a: 1, b: 2 }, [ANY_KEY], v => (v as number) * 3)
      ).toEqual({ a: 3, b: 6 });
    });

    it('walks mixed immutable and raw containers', () => {
      const state = fromJS({ groups: { a: [{ v: 1 }], b: [{ v: 2 }] } });
      expect(
        state
          .updateIn(['groups', ANY_KEY, ANY_KEY, 'v'], v => (v as number) + 1)
          .toJS()
      ).toEqual({
        groups: { a: [{ v: 2 }], b: [{ v: 3 }] },
      });
    });
  });

  describe('missing values', () => {
    it('does not create missing intermediate collections', () => {
      const state = fromJS({ users: [{ name: 'a' }] });
      expect(state.setIn(['users', ANY_KEY, 'profile', 'phone'], '123')).toBe(
        state
      );
    });

    it('does nothing when a wildcard segment points at an empty container', () => {
      const state = fromJS({ users: [] });
      expect(state.setIn(['users', ANY_KEY, 'name'], 'x')).toBe(state);
      expect(Map().setIn([ANY_KEY, 'name'], 'x')).toBe(Map());
      expect(removeIn({ users: [] }, ['users', ANY_KEY, 'name'])).toEqual({
        users: [],
      });
    });

    it('does not create a missing parent before the first wildcard', () => {
      expect(Map().setIn(['users', ANY_KEY, 'name'], 'x')).toBe(Map());
      expect(setIn({}, ['users', ANY_KEY, 'name'], 'x')).toEqual({});
    });

    it('skips branches whose intermediate value is not a data structure', () => {
      const state = Map({ a: 1, b: Map({ n: 1 }) });
      const out = state.setIn([ANY_KEY, 'n'], 5);
      expect(out.toJS()).toEqual({ a: 1, b: { n: 5 } });
    });

    it('skips sparse array holes', () => {
      const sparse: Array<{ v: number } | undefined> = [];
      sparse[2] = { v: 1 };
      const out = setIn(sparse, [ANY_KEY, 'v'], 5);
      expect(out[2]).toEqual({ v: 5 });
      expect(out.length).toBe(3);
    });

    it('skips null and primitive children', () => {
      const state = Map({ good: Map({ x: 1 }), bad: null, alsoBad: 5 });
      const out = state.setIn([ANY_KEY, 'x'], 9);
      expect(out.toJS()).toEqual({
        good: { x: 9 },
        bad: null,
        alsoBad: 5,
      });
    });

    it('creates a missing final leaf when its parent exists, but not an earlier gap', () => {
      expect(Map().setIn([ANY_KEY, 'a', 'b'], 1)).toBe(Map());
      const state = fromJS([{ a: {} }]);
      expect(state.setIn([ANY_KEY, 'a', 'b'], 1).toJS()).toEqual([
        { a: { b: 1 } },
      ]);
    });

    it('passes notSetValue to the updater for a missing final leaf, like ordinary updateIn', () => {
      const state = fromJS({ users: [{ profile: {} }] });
      const out = state.updateIn(
        ['users', ANY_KEY, 'profile', 'phone'],
        'default-phone',
        // @ts-expect-error -- fromJS returns Collection<unknown>
        (v: string | undefined) => v ?? 'fallback'
      );
      expect(out.toJS()).toEqual({
        users: [{ profile: { phone: 'default-phone' } }],
      });
    });

    it('treats an updater returning undefined as setting undefined, like ordinary updateIn', () => {
      const state = Map({
        users: Map({ a: Map({ n: 1 }), b: Map({ n: 2 }) }),
      });
      const out = state.updateIn(['users', ANY_KEY, 'n'], () => undefined);
      expect(out.getIn(['users', 'a', 'n'])).toBe(undefined);
      expect(out.getIn(['users', 'a']).has('n')).toBe(true);
      expect(
        state.removeIn(['users', ANY_KEY, 'n']).getIn(['users', 'a']).has('n')
      ).toBe(false);
    });

    it('walks three consecutive wildcard segments', () => {
      const state = Map({
        groupA: List([Map({ n: 1 }), Map({ n: 2 })]),
        groupB: List([Map({ n: 3 })]),
      });
      const out = state.updateIn([ANY_KEY, ANY_KEY, 'n'], v => {
        const n = v as number;
        return n + 100;
      });
      expect(out.toJS()).toEqual({
        groupA: [{ n: 101 }, { n: 102 }],
        groupB: [{ n: 103 }],
      });
    });
  });

  describe('identity', () => {
    it('returns the same reference when the updater changes nothing', () => {
      const state = fromJS({ users: [{ n: 1 }, { n: 2 }] });
      expect(state.updateIn(['users', ANY_KEY, 'n'], v => v)).toBe(state);
      expect(state.setIn(['users', ANY_KEY, 'n'], undefined)).not.toBe(state);
    });

    it('returns the same reference when no branch matches', () => {
      const state = fromJS({ users: [{}] });
      expect(state.removeIn(['users', ANY_KEY, 'n'])).toBe(state);
      expect(state.setIn(['users', ANY_KEY, 'a', 'b'], 1)).toBe(state);
    });

    it('returns the same reference when every leaf updater is an identity', () => {
      const state = Map({ a: Map({ x: 1 }) });
      expect(state.updateIn([ANY_KEY], v => v)).toBe(state);
    });
  });

  describe('non-wildcard behavior is unchanged', () => {
    it('still creates maps for gaps in an ordinary path', () => {
      expect(Map().setIn(['a', 'b'], 1).toJS()).toEqual({ a: { b: 1 } });
    });

    it('still throws a TypeError when updating within a non-data-structure', () => {
      const state = Map({ key: 123 });
      expect(() => state.updateIn(['key', 'foo'], () => 1)).toThrow(TypeError);
    });
  });
});
