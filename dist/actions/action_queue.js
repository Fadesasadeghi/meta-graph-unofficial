import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
export class ActionQueue {
    accounts;
    directory;
    constructor(accounts, directory = process.env.INSTAGRAM_ACTION_QUEUE_DIR ||
        join(process.cwd(), 'data', 'instagram_action_queue')) {
        this.accounts = accounts;
        this.directory = directory;
    }
    async accountDirectory(ownerId, accountId) {
        if (typeof ownerId !== 'string' || !ownerId.trim()) {
            throw new Error('Valid ownerId is required.');
        }
        const owned = await this.accounts.list(ownerId);
        if (!owned.some(account => account.id === accountId)) {
            throw new Error('Account not found for this owner.');
        }
        const ownerHash = createHash('sha256')
            .update(ownerId)
            .digest('hex');
        return join(resolve(this.directory), ownerHash, accountId);
    }
    validate(action) {
        if (!action || typeof action !== 'object') {
            throw new Error('Invalid action.');
        }
        if (action.kind === 'publish') {
            if (!['post', 'story', 'reel'].includes(action.type)) {
                throw new Error('Invalid publish type.');
            }
            if (typeof action.mediaUrl !== 'string' ||
                !/^https?:\/\/[^/]+/i.test(action.mediaUrl)) {
                throw new Error('Valid media URL is required.');
            }
            if (action.caption !== undefined &&
                (typeof action.caption !== 'string' ||
                    action.caption.length > 2200)) {
                throw new Error('Invalid caption.');
            }
            return;
        }
        if (action.kind === 'comment_reply') {
            if (typeof action.commentId !== 'string' ||
                !action.commentId.trim() ||
                typeof action.text !== 'string' ||
                !action.text.trim()) {
                throw new Error('Invalid comment reply.');
            }
            return;
        }
        if (action.kind === 'direct_message') {
            if (typeof action.conversationId !== 'string' ||
                !action.conversationId.trim() ||
                typeof action.text !== 'string' ||
                !action.text.trim()) {
                throw new Error('Invalid direct message.');
            }
            return;
        }
        throw new Error('Unsupported action kind.');
    }
    async enqueue(ownerId, accountId, idempotencyKey, action) {
        const directory = await this.accountDirectory(ownerId, accountId);
        if (typeof idempotencyKey !== 'string' ||
            !idempotencyKey.trim()) {
            throw new Error('Valid idempotencyKey is required.');
        }
        this.validate(action);
        await mkdir(directory, {
            recursive: true,
            mode: 0o700
        });
        const keyHash = createHash('sha256')
            .update(idempotencyKey)
            .digest('hex');
        const file = join(directory, `${keyHash}.json`);
        const record = {
            id: randomUUID(),
            ownerId,
            accountId,
            idempotencyKey,
            action,
            status: 'pending_approval',
            createdAt: new Date().toISOString()
        };
        let handle;
        try {
            handle = await open(file, 'wx', 0o600);
        }
        catch (error) {
            if (error?.code !== 'EEXIST')
                throw error;
            const existing = JSON.parse(await readFile(file, 'utf8'));
            if (existing.ownerId !== ownerId ||
                existing.accountId !== accountId ||
                existing.idempotencyKey !== idempotencyKey ||
                JSON.stringify(existing.action) !== JSON.stringify(action)) {
                throw new Error('Idempotency key already belongs to a different action.');
            }
            return existing;
        }
        try {
            await handle.writeFile(JSON.stringify(record, null, 2), 'utf8');
        }
        finally {
            await handle.close();
        }
        return record;
    }
    async list(ownerId, accountId) {
        const directory = await this.accountDirectory(ownerId, accountId);
        let files;
        try {
            files = await readdir(directory);
        }
        catch (error) {
            if (error?.code === 'ENOENT')
                return [];
            throw error;
        }
        const records = [];
        for (const file of files) {
            if (!/^[0-9a-f]{64}\.json$/.test(file))
                continue;
            const record = JSON.parse(await readFile(join(directory, file), 'utf8'));
            if (record.ownerId !== ownerId ||
                record.accountId !== accountId) {
                throw new Error('Action ownership mismatch.');
            }
            records.push(record);
        }
        return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
}
