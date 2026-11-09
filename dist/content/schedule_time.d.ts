export interface ScheduleTime {
    scheduledAt: string;
    timezone: string;
    localDateTime: string;
}
export declare function resolveScheduleTime(localDateTime: string, timezone: string, now?: Date): ScheduleTime;
