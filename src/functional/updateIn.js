import { isImmutable } from '../predicates/isImmutable';
import { isIndexed } from '../predicates/isIndexed';
import { ANY_KEY } from '../ANY_KEY';
import coerceKeyPath from '../utils/coerceKeyPath';
import isDataStructure from '../utils/isDataStructure';
import quoteString from '../utils/quoteString';
import { NOT_SET } from '../TrieUtils';
import { emptyMap } from '../Map';
import { get } from './get';
import { remove } from './remove';
import { set } from './set';

// Distinct from NOT_SET: the branch was skipped because its path did not
// resolve to an existing value, so nothing about it should change.
const SKIP = {};

export function updateIn(collection, keyPath, notSetValue, updater) {
  if (!updater) {
    updater = notSetValue;
    notSetValue = undefined;
  }
  const path = coerceKeyPath(keyPath);
  const wildcardIndex = path.indexOf(ANY_KEY);
  const updatedValue =
    wildcardIndex === 0
      ? updateWildcard(collection, path, 0, notSetValue, updater)
      : updateInDeeply(
          isImmutable(collection),
          collection,
          path,
          0,
          notSetValue,
          updater,
          wildcardIndex
        );
  return updatedValue === NOT_SET || updatedValue === SKIP
    ? notSetValue
    : updatedValue;
}

function updateInDeeply(
  inImmutable,
  existing,
  keyPath,
  i,
  notSetValue,
  updater,
  wildcardIndex
) {
  const wasNotSet = existing === NOT_SET;
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
  const nextExisting = wasNotSet ? NOT_SET : get(existing, key, NOT_SET);
  const nextUpdated =
    i + 1 === wildcardIndex
      ? updateWildcard(nextExisting, keyPath, i + 1, notSetValue, updater)
      : updateInDeeply(
          nextExisting === NOT_SET ? inImmutable : isImmutable(nextExisting),
          nextExisting,
          keyPath,
          i + 1,
          notSetValue,
          updater,
          wildcardIndex
        );
  if (nextUpdated === nextExisting || nextUpdated === SKIP) {
    return existing;
  }
  if (nextUpdated === NOT_SET) {
    return remove(existing, key);
  }
  return set(
    wasNotSet ? (inImmutable ? emptyMap() : {}) : existing,
    key,
    nextUpdated
  );
}

/**
 * Handles an `ANY_KEY` segment: applies the tail of the key path to every
 * child of `existing`. Missing or non-data-structure values are skipped and
 * no intermediate collections are ever created. Returns `SKIP` when the
 * container itself cannot be traversed; otherwise returns either the
 * original container (nothing changed) or a copy with the changes applied.
 */
function updateWildcard(existing, keyPath, i, notSetValue, updater) {
  if (existing === NOT_SET || !isDataStructure(existing)) {
    return SKIP;
  }
  return updateAllChildren(existing, keyPath, i, notSetValue, updater);
}

function updateAllChildren(existing, keyPath, i, notSetValue, updater) {
  const immutable = isImmutable(existing);
  const indexed = immutable ? isIndexed(existing) : Array.isArray(existing);
  let altered = false;
  let result = existing;
  let removed = 0;

  const applyToChild = (child, key) => {
    const nextUpdated = followPath(child, keyPath, i + 1, notSetValue, updater);
    if (nextUpdated === child || nextUpdated === SKIP) {
      return;
    }
    altered = true;
    if (indexed) {
      const index = key - removed;
      if (nextUpdated === NOT_SET) {
        result = remove(result, index);
        removed++;
      } else {
        result = set(result, index, nextUpdated);
      }
    } else if (nextUpdated === NOT_SET) {
      result = remove(result, key);
    } else {
      result = set(result, key, nextUpdated);
    }
  };

  if (immutable) {
    existing.forEach((child, key) => applyToChild(child, key));
  } else if (indexed) {
    for (let key = 0; key < existing.length; key++) {
      if (Object.prototype.hasOwnProperty.call(existing, key)) {
        applyToChild(existing[key], key);
      }
    }
  } else {
    for (const key in existing) {
      if (Object.prototype.hasOwnProperty.call(existing, key)) {
        applyToChild(existing[key], key);
      }
    }
  }

  return altered ? result : existing;
}

/**
 * Follows the tail of a key path underneath an `ANY_KEY` segment.
 *
 * The final key is always handed to the updater, mirroring ordinary
 * `updateIn` at the leaf, but a missing or non-data-structure value anywhere
 * before the leaf stops traversal and skips that branch instead of creating
 * intermediate collections.
 */
function followPath(existing, keyPath, i, notSetValue, updater) {
  if (i === keyPath.length) {
    const newValue = updater(existing === NOT_SET ? notSetValue : existing);
    return newValue === existing ? existing : newValue;
  }
  if (existing === NOT_SET || !isDataStructure(existing)) {
    return SKIP;
  }
  const key = keyPath[i];
  if (key === ANY_KEY) {
    return updateWildcard(existing, keyPath, i, notSetValue, updater);
  }
  const nextExisting = get(existing, key, NOT_SET);
  const nextUpdated = followPath(
    nextExisting,
    keyPath,
    i + 1,
    notSetValue,
    updater
  );
  if (nextUpdated === nextExisting || nextUpdated === SKIP) {
    return existing;
  }
  return nextUpdated === NOT_SET
    ? remove(existing, key)
    : set(existing, key, nextUpdated);
}
