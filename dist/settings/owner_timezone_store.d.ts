import { TimezoneStore } from './timezone_store.js';
export declare class OwnerTimezoneStore {
    private readonly directory;
    constructor(directory?: string);
    forOwner(ownerId: string): TimezoneStore;
}
