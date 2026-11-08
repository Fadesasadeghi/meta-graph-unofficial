export interface OutboundLimiterOptions {
    hourlyCap?: number;
    minIntervalMs?: number;
    maxQueueWaitMs?: number;
}
export declare class OutboundLimiter {
    private readonly states;
    private readonly hourlyCap;
    private readonly minIntervalMs;
    private readonly maxQueueWaitMs;
    constructor(options?: OutboundLimiterOptions);
    private getState;
    acquire(key: string): Promise<void>;
    recordRateLimit(key: string, retryAfterSeconds: number): void;
    recordResponse(key: string, status: number, headers?: Record<string, string>): void;
}
