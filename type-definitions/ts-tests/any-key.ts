import { expect, test } from 'tstyche';
import {
  ANY_KEY,
  fromJS,
  List,
  Map,
  removeIn,
  setIn,
  updateIn,
} from 'immutable';

test('ANY_KEY is exported', () => {
  expect(ANY_KEY).type.toBe<typeof ANY_KEY>();
});

test('ANY_KEY cannot be confused with an ordinary key', () => {
  expect<'x'>().type.not.toBeAssignableTo<typeof ANY_KEY>();
  expect<number>().type.not.toBeAssignableTo<typeof ANY_KEY>();
});

test('setIn with a wildcard keyPath', () => {
  const state = Map<string, List<Map<string, number>>>();
  expect(state.setIn(['users', ANY_KEY, 'name'], 1)).type.toBe<
    Map<string, List<Map<string, number>>>
  >();

  expect(
    setIn({ users: [{ name: 'a' }] }, ['users', ANY_KEY, 'name'], 'b')
  ).type.toBe<{ users: Array<{ name: string }> }>();
});

test('updateIn with a wildcard keyPath', () => {
  const state = fromJS({ users: [{ name: 'a' }] });
  expect(state.updateIn(['users', ANY_KEY, 'name'], name => name)).type.toBe<
    typeof state
  >();

  expect(
    updateIn({ users: [{ name: 'a' }] }, ['users', ANY_KEY, 'name'], name =>
      String(name)
    )
  ).type.toBe<{ users: Array<{ name: string }> }>();
});

test('removeIn with a wildcard keyPath', () => {
  const state = Map<string, List<Map<string, number>>>();
  expect(state.removeIn(['users', ANY_KEY, 'name'])).type.toBe<
    Map<string, List<Map<string, number>>>
  >();

  expect(
    removeIn({ users: [{ name: 'a' }] }, ['users', ANY_KEY, 'name'])
  ).type.toBe<{ users: Array<{ name: string }> }>();
});

test('multiple wildcard segments', () => {
  const state = Map<string, List<Map<string, number>>>();
  expect(
    state.setIn(['orders', ANY_KEY, 'items', ANY_KEY, 'checked'], true)
  ).type.toBe<Map<string, List<Map<string, number>>>>();
});

test('List and Seq keyPaths can contain the wildcard', () => {
  const state = Map<string, number>({ a: 1 });
  expect(state.updateIn(List([ANY_KEY]), (value: unknown) => value)).type.toBe<
    Map<string, number>
  >();
});
