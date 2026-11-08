export class OutboundLimiter {
    states = new Map();
    hourlyCap;
    minIntervalMs;
    maxQueueWaitMs;
    constructor(options = {}) {
        this.hourlyCap = options.hourlyCap ?? 100;
        this.minIntervalMs = options.minIntervalMs ?? 1800;
        this.maxQueueWaitMs = options.maxQueueWaitMs ?? 30000;
        if (!Number.isInteger(this.hourlyCap) ||
            this.hourlyCap < 1 ||
            !Number.isFinite(this.minIntervalMs) ||
            this.minIntervalMs < 0 ||
            !Number.isFinite(this.maxQueueWaitMs) ||
            this.maxQueueWaitMs < 0) {
            throw new Error('Invalid outbound limiter configuration');
        }
    }
    getState(key) {
        const now = Date.now();
        let state = this.states.get(key);
        if (!state) {
            state = {
                windowStart: now,
                count: 0,
                cooldownUntil: 0,
                nextAllowedAt: 0
            };
            this.states.set(key, state);
        }
        if (now - state.windowStart >= 3_600_000) {
            state.windowStart = now;
            state.count = 0;
        }
        return state;
    }
    async acquire(key) {
        const state = this.getState(key);
        const now = Date.now();
        if (now < state.cooldownUntil) {
            throw new Error(`Outbound rate limit cooldown: retry after ${Math.ceil((state.cooldownUntil - now) / 1000)} seconds`);
        }
        if (state.count >= this.hourlyCap) {
            throw new Error('Outbound hourly rate limit exceeded');
        }
        const scheduledAt = Math.max(now, state.nextAllowedAt);
        const waitMs = scheduledAt - now;
        if (waitMs > this.maxQueueWaitMs) {
            throw new Error('Outbound rate limit: queue wait exceeds maximum');
        }
        state.nextAllowedAt = scheduledAt + this.minIntervalMs;
        if (waitMs > 0) {
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
        const current = this.getState(key);
        const currentTime = Date.now();
        if (currentTime < current.cooldownUntil) {
            throw new Error('Outbound rate limit cooldown activated while waiting');
        }
        if (current.count >= this.hourlyCap) {
            throw new Error('Outbound hourly rate limit exceeded');
        }
        current.count += 1;
    }
    recordRateLimit(key, retryAfterSeconds) {
        const state = this.getState(key);
        const seconds = Number.isFinite(retryAfterSeconds)
            ? Math.max(0, retryAfterSeconds)
            : 60;
        state.cooldownUntil = Math.max(state.cooldownUntil, Date.now() + seconds * 1000);
    }
    recordResponse(key, status, headers = {}) {
        if (status !== 429)
            return;
        const retryAfter = Object.entries(headers).find(([name]) => name.toLowerCase() === 'retry-after')?.[1];
        let seconds = 60;
        if (retryAfter) {
            const numeric = Number(retryAfter);
            if (Number.isFinite(numeric) && numeric >= 0) {
                seconds = numeric;
            }
            else {
                const date = Date.parse(retryAfter);
                if (Number.isFinite(date)) {
                    seconds = Math.max(0, (date - Date.now()) / 1000);
                }
            }
        }
        this.recordRateLimit(key, seconds);
    }
}
