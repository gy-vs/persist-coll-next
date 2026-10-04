// @flow
// Type-level checks for the ANY_KEY wildcard segment in setIn/removeIn/
// updateIn keyPaths.

import {
  List,
  Map,
  OrderedMap,
  Record,
  ANY_KEY,
  removeIn,
  setIn,
  updateIn,
} from 'immutable';

// ANY_KEY has its branded string literal type.
(ANY_KEY: '@@__IMMUTABLE_ANY__@@');

const users = Map({ users: List([Map({ name: 'a' })]) });

(users.setIn(['users', ANY_KEY, 'name'], 'b'): typeof users);
(users.removeIn(['users', ANY_KEY, 'name']): typeof users);
(users.updateIn(['users', ANY_KEY, 'name'], v => v): typeof users);
(users.updateIn(
  ['users', ANY_KEY, 'name'],
  '',
  v => v
): typeof users);

// Several wildcard segments in one path.
const orders = Map({ orders: List() });
(setIn(orders, [ANY_KEY, ANY_KEY, ANY_KEY, 'checked'], true): typeof orders);

// Functional API on plain JS values.
(updateIn({ users: [{ name: 'a' }] }, ['users', ANY_KEY, 'name'], v => v): {
  users: Array<{ name: string }>,
});
(setIn({ users: [{ name: 'a' }] }, ['users', ANY_KEY, 'name'], 'b'): {
  users: Array<{ name: string }>,
});
(removeIn({ users: [{ name: 'a' }] }, ['users', ANY_KEY, 'name']): {
  users: Array<{ name: mixed }>,
});

// Records and OrderedMaps.
const Person = Record({ name: '' });
const people = Map({ alice: Person({ name: 'alice' }) });
(people.updateIn([ANY_KEY, 'name'], v => v.toUpperCase()): typeof people);
(OrderedMap({ a: OrderedMap({ n: 1 }) }).setIn([ANY_KEY, 'n'], 0): OrderedMap<
  string,
  OrderedMap<string, number>
>);
