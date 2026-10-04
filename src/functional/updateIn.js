import { isImmutable } from '../predicates/isImmutable';
import { isIndexed } from '../predicates/isIndexed';
import { isRecord } from '../predicates/isRecord';
import { ANY_KEY } from '../ANY_KEY';
import coerceKeyPath from '../utils/coerceKeyPath';
import hasOwnProperty from '../utils/hasOwnProperty';
import isDataStructure from '../utils/isDataStructure';
import quoteString from '../utils/quoteString';
import shallowCopy from '../utils/shallowCopy';
import { NOT_SET } from '../TrieUtils';
import { emptyMap } from '../Map';
import { get } from './get';
import { remove } from './remove';
import { set } from './set';

// Internal signal that a wildcard branch has nothing to update (a missing
// key or a non-collection value below ANY_KEY). Unlike NOT_SET, it must not
// cause the wildcard level to remove the child key.
const SKIP = {};

function containsAnyKey(keyPath, fromIndex) {
  for (let i = fromIndex; i < keyPath.length; i++) {
    if (keyPath[i] === ANY_KEY) {
      return true;
    }
  }
  return false;
}

export function updateIn(collection, keyPath, notSetValue, updater) {
  if (!updater) {
    updater = notSetValue;
    notSetValue = undefined;
  }
  const updatedValue = updateInDeeply(
    isImmutable(collection),
    collection,
    coerceKeyPath(keyPath),
    0,
    notSetValue,
    updater,
    // While no wildcard segment has been visited yet, missing intermediate
    // keys keep creating empty structures. This becomes true below a
    // wildcard, where only already existing values may be touched.
    false
  );
  if (updatedValue === SKIP) {
    // A wildcard at the top level (or below a top-level gap) matched nothing.
    return collection;
  }
  return updatedValue === NOT_SET ? notSetValue : updatedValue;
}

function updateInDeeply(
  inImmutable,
  existing,
  keyPath,
  i,
  notSetValue,
  updater,
  noCreate
) {
  const wasNotSet = existing === NOT_SET;
  // Below a wildcard, a missing key or a non-collection value with more path
  // to follow means there is nothing existing to update: skip this branch
  // instead of dreaming up empty structures or throwing.
  if (
    noCreate &&
    (wasNotSet || (i < keyPath.length && !isDataStructure(existing)))
  ) {
    return SKIP;
  }
  if (i === keyPath.length) {
    const existingValue = wasNotSet ? notSetValue : existing;
    const newValue = updater(existingValue);
    return newValue === existingValue ? existing : newValue;
  }
  if (!wasNotSet && !isDataStructure(existing)) {
    throw new TypeError(
      'Cannot update within non-data-structure value in path [' +
        keyPath.slice(0, i).map(quoteString) +
        ']: ' +
        existing
    );
  }
  const key = keyPath[i];
  if (key === ANY_KEY) {
    return updateInAllChildren(existing, keyPath, i, notSetValue, updater);
  }
  const nextExisting = wasNotSet ? NOT_SET : get(existing, key, NOT_SET);
  // A missing key followed (later) by a wildcard has nothing existing to
  // iterate over: skip the branch instead of constructing an empty container.
  if (nextExisting === NOT_SET && containsAnyKey(keyPath, i + 1)) {
    return SKIP;
  }
  const nextUpdated = updateInDeeply(
    nextExisting === NOT_SET ? inImmutable : isImmutable(nextExisting),
    nextExisting,
    keyPath,
    i + 1,
    notSetValue,
    updater,
    noCreate
  );
  return nextUpdated === nextExisting || nextUpdated === SKIP
    ? existing
    : nextUpdated === NOT_SET
    ? remove(existing, key)
    : set(
        wasNotSet ? (inImmutable ? emptyMap() : {}) : existing,
        key,
        nextUpdated
      );
}

// Applies the remainder of the keyPath to every child of `existing` at the
// wildcard level. A missing, empty or non-collection level produces no
// change, and the returned collection keeps its identity unless some child
// actually changed.
function updateInAllChildren(existing, keyPath, i, notSetValue, updater) {
  if (existing === NOT_SET || !isDataStructure(existing)) {
    return existing;
  }
  // Collect every pending change first so that the resulting collection is
  // rebuilt only once, rather than once per changed child.
  let changed = false;
  let removed = false;
  const sets = {};
  const setKeys = [];
  const removeKeys = [];
  eachKey(existing, key => {
    const nextExisting = get(existing, key, NOT_SET);
    if (nextExisting === NOT_SET) {
      return;
    }
    const nextUpdated = updateInDeeply(
      isImmutable(nextExisting),
      nextExisting,
      keyPath,
      i + 1,
      notSetValue,
      updater,
      true
    );
    if (nextUpdated === SKIP || nextUpdated === nextExisting) {
      return;
    }
    changed = true;
    if (nextUpdated === NOT_SET) {
      removed = true;
      removeKeys.push(key);
    } else {
      sets[key] = nextUpdated;
      setKeys.push(key);
    }
  });
  if (!changed) {
    return existing;
  }
  if (isImmutable(existing)) {
    if (isIndexed(existing)) {
      // Entries may be removed, which shifts later indices, so the result has
      // to be rebuilt in ascending index order from the final list of values.
      const removedSet = new Set(removeKeys);
      const values = [];
      for (let index = 0; index < existing.size; index++) {
        if (!removedSet.has(index)) {
          values.push(
            hasOwnProperty.call(sets, index) ? sets[index] : existing.get(index)
          );
        }
      }
      return existing.clear().withMutations(collection => {
        values.forEach(value => {
          collection.push(value);
        });
      });
    }
    // Only Map, OrderedMap and Record (which all provide withMutations) can
    // reach this branch; other immutable collections lack keyed writes.
    if (typeof existing.withMutations !== 'function') {
      throw new TypeError(
        'Cannot update immutable value without .set() method: ' + existing
      );
    }
    return existing.withMutations(collection => {
      setKeys.forEach(key => {
        collection.set(key, sets[key]);
      });
      removeKeys.forEach(key => {
        collection.remove(key);
      });
    });
  }
  if (Array.isArray(existing)) {
    const removedSet = new Set(removeKeys);
    const next = [];
    for (let index = 0; index < existing.length; index++) {
      if (removedSet.has(index)) {
        continue;
      }
      next.push(
        hasOwnProperty.call(sets, index) ? sets[index] : existing[index]
      );
    }
    return next;
  }
  const next = shallowCopy(existing);
  setKeys.forEach(key => {
    next[key] = sets[key];
  });
  if (removed) {
    removeKeys.forEach(key => {
      delete next[key];
    });
  }
  return next;
}

// Enumerates the existing keys of any collection supported by the deep
// operations: keyed immutable collections (Map, OrderedMap, Record) and
// indexed ones (List), as well as plain Objects and Arrays.
function eachKey(collection, sideEffect) {
  if (isImmutable(collection)) {
    if (isIndexed(collection)) {
      for (let key = 0; key < collection.size; key++) {
        sideEffect(key);
      }
    } else {
      const seq = isRecord(collection) ? collection.toSeq() : collection;
      seq.forEach((_value, key) => {
        sideEffect(key);
      });
    }
  } else if (Array.isArray(collection)) {
    for (let key = 0; key < collection.length; key++) {
      sideEffect(key);
    }
  } else {
    const keys = Object.keys(collection);
    for (let i = 0; i < keys.length; i++) {
      sideEffect(keys[i]);
    }
  }
}
