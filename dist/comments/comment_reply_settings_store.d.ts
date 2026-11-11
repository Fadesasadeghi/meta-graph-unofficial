import { AccountStore } from '../accounts/account_store.js';
import { type ReplyPolicy } from './comment_auto_reply_policy.js';
import type { CommentCategory } from './comment_reply_advisor.js';
export interface CommentReplySettings {
    accountId: string;
    autoReplyEnabled: boolean;
    policy: ReplyPolicy;
    approvedTemplates: Partial<Record<CommentCategory, string>>;
    updatedAt: string | null;
}
type SettingsUpdate = Pick<CommentReplySettings, 'autoReplyEnabled' | 'policy' | 'approvedTemplates'>;
export declare class CommentReplySettingsStore {
    private readonly accounts;
    private readonly directory;
    constructor(accounts: AccountStore, directory?: string);
    private fileFor;
    private validate;
    get(ownerId: string, accountId: string): Promise<CommentReplySettings>;
    save(ownerId: string, accountId: string, input: SettingsUpdate): Promise<CommentReplySettings>;
}
export {};
