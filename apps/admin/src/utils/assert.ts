/**
 * Runtime assertion that also narrows types (TS `asserts`).
 * Pure, framework-agnostic — safe to use from any layer.
 *
 * @example
 *   invariant(user, 'user must be loaded'); // after this, `user` is non-null
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[invariant] ${message}`);
  }
}
