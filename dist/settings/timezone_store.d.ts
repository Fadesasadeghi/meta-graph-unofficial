export interface TimezoneSettings {
    timezone: string;
    confirmed: boolean;
}
export declare class TimezoneStore {
    private readonly filePath;
    constructor(filePath?: string);
    static validate(timezone: string): string;
    static detect(): string;
    get(): Promise<TimezoneSettings | null>;
    set(timezone: string): Promise<TimezoneSettings>;
}
