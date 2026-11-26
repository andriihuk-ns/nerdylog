/** Postgres SQLSTATE for unique_violation. */
export const UNIQUE_VIOLATION = "23505";

interface PgLikeError {
  code?: unknown;
  constraint_name?: unknown;
  constraint?: unknown;
  cause?: unknown;
}

/**
 * True when `error` (or any error in its `cause` chain, e.g. a DrizzleQueryError
 * wrapping a postgres-js PostgresError) is a unique violation on `constraint`.
 */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    const e = current as PgLikeError;
    const name = e.constraint_name ?? e.constraint;
    if (e.code === UNIQUE_VIOLATION && name === constraint) return true;
    current = e.cause;
  }
  return false;
}
