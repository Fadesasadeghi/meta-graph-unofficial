import { Temporal } from '@js-temporal/polyfill';
import { TimezoneStore } from '../settings/timezone_store.js';
export function resolveScheduleTime(localDateTime, timezone, now = new Date()) {
    if (typeof localDateTime !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(localDateTime)) {
        throw new Error('Use local date and time in YYYY-MM-DDTHH:mm format.');
    }
    if (Number.isNaN(now.getTime())) {
        throw new Error('Invalid current time.');
    }
    const validTimezone = TimezoneStore.validate(timezone);
    let zoned;
    try {
        const plain = Temporal.PlainDateTime.from(localDateTime, {
            overflow: 'reject'
        });
        zoned = plain.toZonedDateTime(validTimezone, {
            disambiguation: 'reject'
        });
    }
    catch {
        throw new Error('Invalid or ambiguous local date/time. Choose another time.');
    }
    const scheduledAt = zoned.toInstant().toString();
    if (Date.parse(scheduledAt) <= now.getTime()) {
        throw new Error('Scheduled time must be in the future.');
    }
    return {
        scheduledAt: new Date(scheduledAt).toISOString(),
        timezone: validTimezone,
        localDateTime: zoned.toPlainDateTime().toString()
    };
}
