import { InstagramAccount, InstagramAccountType } from './types.js';
export interface CreateAccountInput {
    ownerId: string;
    username: string;
    accountType: InstagramAccountType;
}
export declare class AccountStore {
    private readonly directory;
    constructor(directory?: string);
    private ownerDirectory;
    create(input: CreateAccountInput): Promise<InstagramAccount>;
    list(ownerId: string): Promise<InstagramAccount[]>;
}
