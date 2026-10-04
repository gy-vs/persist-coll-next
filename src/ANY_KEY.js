/**
 * A keyPath wildcard which stands in for *every* key of the collection at
 * that level of the path. Used with `setIn`, `updateIn` and `removeIn` (both
 * the instance methods and the functional variants) to apply the rest of the
 * path to all children at once.
 *
 * Unlike ordinary key paths, a path containing `ANY_KEY` never creates
 * missing intermediate collections: branches whose path does not resolve to
 * an existing value are left untouched.
 *
 * <!-- runkit:activate -->
 * ```js
 * const { fromJS, ANY_KEY } = require('immutable')
 * const state = fromJS({ users: [{ name: 'a' }, { name: 'b' }] })
 * state.updateIn(['users', ANY_KEY, 'name'], name => name.toUpperCase())
 * // Map { "users": List [ Map { "name": "A" }, Map { "name": "B" } ] }
 * ```
 */
export const ANY_KEY =
  typeof Symbol === 'function'
    ? Symbol('ANY_KEY')
    : '@@__IMMUTABLE_ANY_KEY__@@';
