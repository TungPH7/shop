// Whether a version, or a range, is inside the range of an approved library (review of shop PR #79): an install of
// zod@5 or a package.json that asks for "^5" is not what dep-check checked at ^4.6.6. The npm forms only, without
// prereleases: x.y.z, its partial and x forms, ^, ~, the comparators =, >, >=, <, <=, a set of them, and ||. Anything
// else, such as a tag, a hyphen range or a Maven interval, cannot be checked and gives null, which never counts as
// inside. Pure.

// A version as [major, minor, patch]; null for any other text.
const full = (text) => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text);
  return match ? match.slice(1).map(Number) : null;
};
// A partial version, as in ^4 or 1.6.x: the numbers given, up to the first x or *; null for any other text.
const partial = (text) => {
  const match = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/.exec(text);
  if (!match) return null;
  const parts = [];
  for (const part of match.slice(1)) {
    if (part === undefined || /^[xX*]$/.test(part)) break;
    parts.push(Number(part));
  }
  return parts;
};

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const next = ([major, minor, patch]) => [major, minor, patch + 1];
const ZERO = [0, 0, 0];

// One comparator as an interval { lo, hi }: lo is in it, hi is not; hi null has no end. null when it cannot be read.
function interval(text) {
  if (text === '' || text === '*' || /^[xX]$/.test(text)) return { lo: ZERO, hi: null };
  const op = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(text);
  const [, sign = '', rest] = op;
  if (['>=', '<=', '>', '<'].includes(sign)) {
    const version = full(rest);
    if (!version) return null;
    if (sign === '>=') return { lo: version, hi: null };
    if (sign === '>') return { lo: next(version), hi: null };
    if (sign === '<=') return { lo: ZERO, hi: next(version) };
    return { lo: ZERO, hi: version };
  }
  const parts = partial(rest);
  if (!parts) return null;
  const [major = 0, minor = 0, patch = 0] = parts;
  const lo = [major, minor, patch];
  if (sign === '^') {
    if (parts.length === 0) return { lo: ZERO, hi: null };
    if (major > 0 || parts.length === 1) return { lo, hi: [major + 1, 0, 0] };
    if (minor > 0 || parts.length === 2) return { lo, hi: [0, minor + 1, 0] };
    return { lo, hi: [0, 0, patch + 1] };
  }
  if (sign === '~') {
    if (parts.length <= 1) return { lo, hi: parts.length === 0 ? null : [major + 1, 0, 0] };
    return { lo, hi: [major, minor + 1, 0] };
  }
  if (parts.length === 0) return { lo: ZERO, hi: null };
  if (parts.length === 1) return { lo, hi: [major + 1, 0, 0] };
  if (parts.length === 2) return { lo, hi: [major, minor + 1, 0] };
  return { lo, hi: next(lo) };
}

// A range as a list of intervals, one per || branch; null when a part cannot be read.
function intervals(range) {
  const text = String(range ?? '').trim();
  if (text === '' || / - /.test(text)) return null;
  const branches = [];
  for (const branch of text.split('||')) {
    const parts = branch.trim().split(/\s+/).filter(Boolean).map(interval);
    if (parts.length === 0 || parts.includes(null)) return null;
    // A set of comparators is all of them at once.
    const lo = parts.map((p) => p.lo).reduce((a, b) => (compare(a, b) >= 0 ? a : b));
    const ends = parts.map((p) => p.hi).filter(Boolean);
    const hi = ends.length === 0 ? null : ends.reduce((a, b) => (compare(a, b) <= 0 ? a : b));
    branches.push({ lo, hi });
  }
  return branches;
}

const empty = ({ lo, hi }) => hi !== null && compare(lo, hi) >= 0;
const inside = (inner, outer) => compare(inner.lo, outer.lo) >= 0 && (outer.hi === null || (inner.hi !== null && compare(inner.hi, outer.hi) <= 0));

// Whether every version `asked` takes is in `approved`: true, false, or null when either cannot be read.
export function rangeWithin(asked, approved) {
  const want = intervals(asked);
  const have = intervals(approved);
  if (!want || !have) return null;
  return want.every((part) => empty(part) || have.some((outer) => inside(part, outer)));
}

// Whether `version`, one version, is in `range`: true, false, or null when either cannot be read.
export function versionWithin(version, range) {
  const value = full(String(version ?? '').trim());
  if (!value) return null;
  return rangeWithin(value.join('.'), range);
}
