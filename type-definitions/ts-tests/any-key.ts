import { expect, test } from 'tstyche';
import {
  ANY_KEY,
  List,
  Map,
  OrderedMap,
  Record,
  removeIn,
  setIn,
  updateIn,
} from 'immutable';

test('ANY_KEY constant type', () => {
  expect(ANY_KEY).type.toBe<'@@__IMMUTABLE_ANY__@@'>();
});

test('functional setIn with ANY_KEY', () => {
  const m = Map<string, Map<string, number>>();
  expect(setIn(m, [ANY_KEY, 'x'], 1)).type.toBe<
    Map<string, Map<string, number>>
  >();

  expect(setIn({ a: { n: 1 } }, [ANY_KEY, 'n'], 1)).type.toBe<{
    a: { n: number };
  }>();

  expect(
    setIn({ users: [{ name: 'a' }] }, ['users', ANY_KEY, 'name'], 'b')
  ).type.toBe<{
    users: Array<{ name: string }>;
  }>();
});

test('functional removeIn with ANY_KEY', () => {
  const l = List<Map<string, number>>();
  expect(removeIn(l, [ANY_KEY, 'x'])).type.toBe<List<Map<string, number>>>();

  expect(removeIn({ a: 1 }, [ANY_KEY])).type.toBe<{ a: number }>();
});

test('functional updateIn with ANY_KEY', () => {
  const om = OrderedMap<string, Map<string, number>>();
  expect(updateIn(om, [ANY_KEY, 'x'], v => v)).type.toBe<
    OrderedMap<string, Map<string, number>>
  >();

  expect(
    updateIn({ users: [{ n: 1 }] }, ['users', ANY_KEY, 'n'], v => v)
  ).type.toBe<{ users: Array<{ n: number }> }>();
});

test('instance methods with ANY_KEY', () => {
  const Person = Record({ name: '' });

  expect(
    Map<string, ReturnType<typeof Person>>().updateIn([ANY_KEY, 'name'], v => v)
  ).type.toBe<Map<string, ReturnType<typeof Person>>>();

  expect(
    List<Map<string, boolean>>().setIn([ANY_KEY, 'checked'], true)
  ).type.toBe<List<Map<string, boolean>>>();

  expect(List<Map<string, number>>().removeIn([ANY_KEY, 'x'])).type.toBe<
    List<Map<string, number>>
  >();
});
