/**
 * Trusted local owner identity for single-user MCP installations.
 *
 * This is NOT user authentication. It scopes local data to an
 * operator-configured identity and must not be used as a
 * multi-tenant authorization mechanism.
 */

export class LocalOwnerNotConfiguredError extends Error {
  constructor() {
    super(
      'Local Instagram owner is not configured. ' +
      'Set INSTAGRAM_LOCAL_OWNER_ID in the MCP server environment.'
    );

    this.name = 'LocalOwnerNotConfiguredError';
  }
}

export function getLocalOwnerId(
  env: NodeJS.ProcessEnv = process.env
): string {
  const ownerId = env.INSTAGRAM_LOCAL_OWNER_ID;

  if (
    typeof ownerId !== 'string' ||
    !ownerId.trim()
  ) {
    throw new LocalOwnerNotConfiguredError();
  }

  return ownerId.trim();
}
