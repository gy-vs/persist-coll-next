// A unique sentinel used as a wildcard segment within a keyPath passed to
// `updateIn`, `setIn` and `removeIn`. When encountered, the update is applied
// to every existing child value at that level of the path. A plain string is
// used instead of a Symbol so the sentinel survives ES5 transpilation and is
// identical across duplicate copies of the module.
export const ANY_KEY = '@@__IMMUTABLE_ANY__@@';
