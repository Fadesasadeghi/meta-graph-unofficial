export type PublishingMode = 'demo' | 'live';
export declare class LivePublishingNotConfiguredError extends Error {
    constructor();
}
export declare function assertPublishingAllowed(mode: PublishingMode, liveProviderConfigured?: boolean): void;
