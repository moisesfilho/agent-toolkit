export const TIME_ZONE = "America/Fortaleza";

/**
 * Operational limits. Tests import these values instead of restating literals,
 * so a boundary assertion always tracks the configured source of truth.
 */
export const LIMITS = Object.freeze({
  maxEntryBytes: 4096,
  maxFileBytes: 1024 * 1024,
  lockWaitMs: 500,
  lockStaleMs: 30_000,
  totalTimeoutMs: 2000,
});

/** One path segment: lowercase ASCII, digits and internal hyphens, 1-64 bytes. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const SLUG_MAX_BYTES = 64;

export const ROLE_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/** Roles that own a task note served by this MCP; the developer record is manual. */
export const NOTE_ROLES = Object.freeze(["planner", "coder", "tester", "reviewer"]);

export const TOOL_NAME = "append";

export function serverNameForRole(role) {
  return `note_${role}`;
}

export function lockFileName(role) {
  return `.note-writer-${role}.lock`;
}
