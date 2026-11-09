export class LivePublishingNotConfiguredError extends Error {
    constructor() {
        super('Live Instagram publishing is not configured. ' +
            'Connect an authorized Instagram account through Meta OAuth ' +
            'and configure the official publishing provider.');
        this.name = 'LivePublishingNotConfiguredError';
    }
}
export function assertPublishingAllowed(mode, liveProviderConfigured = false) {
    if (mode === 'live' && !liveProviderConfigured) {
        throw new LivePublishingNotConfiguredError();
    }
}
