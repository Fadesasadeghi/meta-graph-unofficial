/**
 * Trusted local owner identity for single-user MCP installations.
 *
 * This is NOT user authentication. It scopes local data to an
 * operator-configured identity and must not be used as a
 * multi-tenant authorization mechanism.
 */
export declare class LocalOwnerNotConfiguredError extends Error {
    constructor();
}
export declare function getLocalOwnerId(env?: NodeJS.ProcessEnv): string;
