import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { DraftStore } from '../content/draft_store.js';
export class AccountDraftStore {
    directory;
    accounts;
    constructor(accounts, directory = process.env.INSTAGRAM_ACCOUNT_DRAFTS_DIR ||
        join(process.cwd(), 'data', 'instagram_account_drafts')) {
        this.accounts = accounts;
        this.directory = resolve(directory);
    }
    async forAccount(ownerId, accountId) {
        if (typeof ownerId !== 'string' || !ownerId.trim()) {
            throw new Error('Valid ownerId is required.');
        }
        const accounts = await this.accounts.list(ownerId);
        const account = accounts.find(a => a.id === accountId);
        if (!account) {
            throw new Error('Account not found for this owner.');
        }
        const ownerHash = createHash('sha256')
            .update(ownerId)
            .digest('hex');
        return new DraftStore(join(this.directory, ownerHash, account.id));
    }
}
