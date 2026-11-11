import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DEFAULT_REPLY_POLICY } from './comment_auto_reply_policy.js';
const CATEGORIES = [
    'compliment',
    'pricing',
    'product_question',
    'complaint',
    'spam',
    'general'
];
export class CommentReplySettingsStore {
    accounts;
    directory;
    constructor(accounts, directory = process.env.INSTAGRAM_COMMENT_SETTINGS_DIR ||
        join(process.cwd(), 'data', 'instagram_comment_settings')) {
        this.accounts = accounts;
        this.directory = directory;
    }
    async fileFor(ownerId, accountId) {
        const owned = await this.accounts.list(ownerId);
        if (!owned.some(account => account.id === accountId)) {
            throw new Error('Account not found for this owner.');
        }
        const ownerHash = createHash('sha256')
            .update(ownerId)
            .digest('hex');
        const accountHash = createHash('sha256')
            .update(accountId)
            .digest('hex');
        return join(resolve(this.directory), ownerHash, `${accountHash}.json`);
    }
    validate(input) {
        if (typeof input?.autoReplyEnabled !== 'boolean') {
            throw new Error('Invalid autoReplyEnabled value.');
        }
        if (!input.policy ||
            typeof input.policy !== 'object' ||
            Array.isArray(input.policy)) {
            throw new Error('Invalid reply policy.');
        }
        const policyKeys = Object.keys(input.policy);
        if (policyKeys.length !== CATEGORIES.length ||
            !CATEGORIES.every(category => ['auto', 'manual', 'skip'].includes(input.policy[category]))) {
            throw new Error('Invalid reply policy categories.');
        }
        if (!input.approvedTemplates ||
            typeof input.approvedTemplates !== 'object' ||
            Array.isArray(input.approvedTemplates)) {
            throw new Error('Invalid approved templates.');
        }
        for (const [category, template] of Object.entries(input.approvedTemplates)) {
            if (!CATEGORIES.includes(category) ||
                typeof template !== 'string' ||
                !template.trim() ||
                template.length > 1000) {
                throw new Error('Invalid approved reply template.');
            }
        }
    }
    async get(ownerId, accountId) {
        const file = await this.fileFor(ownerId, accountId);
        try {
            const saved = JSON.parse(await readFile(file, 'utf8'));
            if (saved.accountId !== accountId) {
                throw new Error('Comment settings account mismatch.');
            }
            this.validate(saved);
            return saved;
        }
        catch (error) {
            if (error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT') {
                return {
                    accountId,
                    autoReplyEnabled: false,
                    policy: { ...DEFAULT_REPLY_POLICY },
                    approvedTemplates: {},
                    updatedAt: null
                };
            }
            throw error;
        }
    }
    async save(ownerId, accountId, input) {
        const file = await this.fileFor(ownerId, accountId);
        this.validate(input);
        const settings = {
            accountId,
            autoReplyEnabled: input.autoReplyEnabled,
            policy: { ...input.policy },
            approvedTemplates: { ...input.approvedTemplates },
            updatedAt: new Date().toISOString()
        };
        const directory = join(file, '..');
        await mkdir(directory, {
            recursive: true,
            mode: 0o700
        });
        const tempFile = join(directory, `${randomUUID()}.tmp`);
        await writeFile(tempFile, JSON.stringify(settings, null, 2), { mode: 0o600 });
        await rename(tempFile, file);
        return settings;
    }
}
