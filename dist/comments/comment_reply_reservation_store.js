import { createHash } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
export class CommentReplyReservationStore {
    accounts;
    directory;
    constructor(accounts, directory = process.env.INSTAGRAM_COMMENT_RESERVATIONS_DIR ||
        join(process.cwd(), 'data', 'instagram_comment_reservations')) {
        this.accounts = accounts;
        this.directory = directory;
    }
    async reserve(ownerId, accountId, commentId) {
        if (typeof ownerId !== 'string' ||
            !ownerId.trim() ||
            typeof accountId !== 'string' ||
            !accountId.trim() ||
            typeof commentId !== 'string' ||
            !commentId.trim() ||
            commentId.length > 256) {
            throw new Error('Valid owner, account and comment IDs required.');
        }
        const ownedAccounts = await this.accounts.list(ownerId);
        if (!ownedAccounts.some(account => account.id === accountId)) {
            throw new Error('Account not found for this owner.');
        }
        const hash = (value) => createHash('sha256')
            .update(value)
            .digest('hex');
        const folder = join(resolve(this.directory), hash(ownerId), hash(accountId));
        await mkdir(folder, {
            recursive: true,
            mode: 0o700
        });
        const file = join(folder, `${hash(commentId)}.json`);
        let handle;
        try {
            handle = await open(file, 'wx', 0o600);
        }
        catch (error) {
            if (error instanceof Error &&
                'code' in error &&
                error.code === 'EEXIST') {
                return {
                    accountId,
                    commentId,
                    status: 'duplicate',
                    simulated: true
                };
            }
            throw error;
        }
        try {
            await handle.writeFile(JSON.stringify({
                ownerId,
                accountId,
                commentId,
                status: 'reserved',
                createdAt: new Date().toISOString()
            }, null, 2), 'utf8');
        }
        finally {
            await handle.close();
        }
        return {
            accountId,
            commentId,
            status: 'reserved',
            simulated: true
        };
    }
}
