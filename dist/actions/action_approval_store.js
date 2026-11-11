import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
export class ActionApprovalStore {
    accounts;
    queue;
    directory;
    constructor(accounts, queue, directory = process.env.INSTAGRAM_ACTION_APPROVALS_DIR ||
        join(process.cwd(), 'data', 'instagram_action_approvals')) {
        this.accounts = accounts;
        this.queue = queue;
        this.directory = directory;
    }
    fingerprint(record) {
        return createHash('sha256')
            .update(JSON.stringify({
            id: record.id,
            ownerId: record.ownerId,
            accountId: record.accountId,
            idempotencyKey: record.idempotencyKey,
            action: record.action
        }))
            .digest('hex');
    }
    async locate(ownerId, accountId, actionId) {
        if (typeof ownerId !== 'string' ||
            !ownerId.trim() ||
            typeof actionId !== 'string' ||
            !/^[0-9a-f-]{36}$/i.test(actionId)) {
            throw new Error('Invalid owner or action ID.');
        }
        const actions = await this.queue.list(ownerId, accountId);
        const record = actions.find(item => item.id === actionId);
        if (!record) {
            throw new Error('Action not found for this account.');
        }
        // Queue.list already checks account ownership.
        const ownedAccounts = await this.accounts.list(ownerId);
        if (!ownedAccounts.some(item => item.id === accountId)) {
            throw new Error('Account not found for this owner.');
        }
        const ownerHash = createHash('sha256')
            .update(ownerId)
            .digest('hex');
        const file = join(resolve(this.directory), ownerHash, accountId, `${actionId}.json`);
        return { record, file };
    }
    async decide(ownerId, accountId, actionId, decision) {
        if (!['approved', 'rejected'].includes(decision)) {
            throw new Error('Invalid approval decision.');
        }
        const { record, file } = await this.locate(ownerId, accountId, actionId);
        const approval = {
            actionId,
            accountId,
            decision,
            actionHash: this.fingerprint(record),
            decidedAt: new Date().toISOString()
        };
        await mkdir(join(file, '..'), {
            recursive: true,
            mode: 0o700
        });
        // Exclusive creation prevents silently overwriting decisions.
        const handle = await open(file, 'wx', 0o600);
        try {
            await handle.writeFile(JSON.stringify(approval, null, 2), 'utf8');
        }
        finally {
            await handle.close();
        }
        return approval;
    }
    async get(ownerId, accountId, actionId) {
        const { record, file } = await this.locate(ownerId, accountId, actionId);
        let approval;
        try {
            approval = JSON.parse(await readFile(file, 'utf8'));
        }
        catch (error) {
            if (error?.code === 'ENOENT')
                return null;
            throw error;
        }
        if (approval.actionId !== actionId ||
            approval.accountId !== accountId ||
            approval.actionHash !== this.fingerprint(record)) {
            throw new Error('Action changed after approval.');
        }
        return approval;
    }
}
