import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DEFAULT_DIRECT_REPLY_POLICY } from './direct_auto_reply_policy.js';
const CATEGORIES = [
    'compliment',
    'pricing',
    'product_question',
    'order_support',
    'complaint',
    'spam',
    'general'
];
const SAFE_AUTO = new Set([
    'compliment',
    'pricing',
    'product_question'
]);
export class DirectReplySettingsStore {
    accounts;
    directory;
    constructor(accounts, directory = process.env.INSTAGRAM_DIRECT_REPLY_SETTINGS_DIR ||
        join(process.cwd(), 'data', 'instagram_direct_reply_settings')) {
        this.accounts = accounts;
        this.directory = directory;
    }
    hash(value) {
        return createHash('sha256')
            .update(value)
            .digest('hex');
    }
    defaults() {
        return {
            autoReplyEnabled: false,
            policy: { ...DEFAULT_DIRECT_REPLY_POLICY },
            approvedTemplates: {}
        };
    }
    async pathFor(ownerId, accountId) {
        if (typeof ownerId !== 'string' ||
            !ownerId.trim() ||
            typeof accountId !== 'string' ||
            !accountId.trim()) {
            throw new Error('Valid owner and account IDs required.');
        }
        const accounts = await this.accounts.list(ownerId);
        if (!accounts.some(account => account.id === accountId)) {
            throw new Error('Account not found for this owner.');
        }
        return join(resolve(this.directory), this.hash(ownerId), `${this.hash(accountId)}.json`);
    }
    validate(input) {
        if (!input ||
            typeof input !== 'object' ||
            Array.isArray(input)) {
            throw new Error('Invalid direct reply settings.');
        }
        const data = input;
        if (typeof data.autoReplyEnabled !== 'boolean') {
            throw new Error('Invalid autoReplyEnabled value.');
        }
        const policy = data.policy;
        if (!policy ||
            typeof policy !== 'object' ||
            Array.isArray(policy)) {
            throw new Error('Invalid direct reply policy.');
        }
        const policyValues = policy;
        if (Object.keys(policyValues).length !== CATEGORIES.length ||
            Object.keys(policyValues).some(key => !CATEGORIES.includes(key))) {
            throw new Error('Invalid direct reply policy categories.');
        }
        for (const category of CATEGORIES) {
            const mode = policyValues[category];
            if (!['auto', 'manual', 'skip'].includes(String(mode))) {
                throw new Error('Invalid direct reply mode.');
            }
            if (!SAFE_AUTO.has(category) && mode === 'auto') {
                throw new Error('Unsafe categories cannot be automatic.');
            }
            if (category === 'spam' && mode !== 'skip') {
                throw new Error('Spam must always be skipped.');
            }
            if ((category === 'complaint' ||
                category === 'order_support' ||
                category === 'general') &&
                mode !== 'manual') {
                throw new Error('Sensitive categories must remain manual.');
            }
        }
        const templates = data.approvedTemplates;
        if (!templates ||
            typeof templates !== 'object' ||
            Array.isArray(templates)) {
            throw new Error('Invalid approved templates.');
        }
        const templateValues = templates;
        const approvedTemplates = {};
        for (const [category, value] of Object.entries(templateValues)) {
            if (!SAFE_AUTO.has(category)) {
                throw new Error('Templates are restricted to safe categories.');
            }
            if (typeof value !== 'string' ||
                !value.trim() ||
                value.length > 2000) {
                throw new Error('Invalid approved reply template.');
            }
            approvedTemplates[category] = value.trim();
        }
        return {
            autoReplyEnabled: data.autoReplyEnabled,
            policy: { ...policyValues },
            approvedTemplates
        };
    }
    async get(ownerId, accountId) {
        const file = await this.pathFor(ownerId, accountId);
        try {
            const contents = await readFile(file, 'utf8');
            return this.validate(JSON.parse(contents));
        }
        catch (error) {
            if (error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT') {
                return this.defaults();
            }
            // Corrupt settings must never silently enable auto replies.
            throw error;
        }
    }
    async save(ownerId, accountId, settings) {
        const file = await this.pathFor(ownerId, accountId);
        const validated = this.validate(settings);
        const folder = join(file, '..');
        await mkdir(folder, {
            recursive: true,
            mode: 0o700
        });
        const temp = join(folder, `${randomUUID()}.tmp`);
        try {
            await writeFile(temp, JSON.stringify(validated, null, 2), { mode: 0o600 });
            await rename(temp, file);
        }
        catch (error) {
            const { rm } = await import('node:fs/promises');
            await rm(temp, { force: true }).catch(() => { });
            throw error;
        }
        return validated;
    }
}
