import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
const METRICS = [
    'engagement_rate',
    'reach',
    'plays',
    'saves',
    'shares',
    'comments'
];
export class ExperimentStore {
    accounts;
    directory;
    constructor(accounts, directory = process.env.INSTAGRAM_EXPERIMENTS_DIR ||
        join(process.cwd(), 'data', 'instagram_experiments')) {
        this.accounts = accounts;
        this.directory = directory;
    }
    async accountDirectory(ownerId, accountId) {
        if (!ownerId?.trim()) {
            throw new Error('Valid ownerId is required.');
        }
        const ownedAccounts = await this.accounts.list(ownerId);
        if (!ownedAccounts.some(account => account.id === accountId)) {
            throw new Error('Account not found for this owner.');
        }
        const ownerHash = createHash('sha256')
            .update(ownerId)
            .digest('hex');
        return join(resolve(this.directory), ownerHash, accountId);
    }
    validateMeasurement(measurement) {
        if (measurement == null)
            return;
        if (!Number.isFinite(measurement.value) ||
            measurement.value < 0) {
            throw new Error('Measurement value must be non-negative and finite.');
        }
        if (!['mock', 'live'].includes(measurement.source)) {
            throw new Error('Invalid measurement source.');
        }
        if (typeof measurement.measuredAt !== 'string' ||
            !Number.isFinite(Date.parse(measurement.measuredAt))) {
            throw new Error('Invalid measurement timestamp.');
        }
    }
    async create(ownerId, input) {
        const directory = await this.accountDirectory(ownerId, input.accountId);
        if (!input.title?.trim() || !input.hypothesis?.trim()) {
            throw new Error('Title and hypothesis are required.');
        }
        if (!input.adviceExperimentId?.trim()) {
            throw new Error('Advice experiment ID is required.');
        }
        if (!METRICS.includes(input.metric)) {
            throw new Error('Invalid experiment metric.');
        }
        this.validateMeasurement(input.baseline);
        const now = new Date().toISOString();
        const record = {
            id: randomUUID(),
            ownerId,
            accountId: input.accountId,
            adviceExperimentId: input.adviceExperimentId,
            title: input.title,
            hypothesis: input.hypothesis,
            status: 'planned',
            metric: input.metric,
            baseline: input.baseline ?? null,
            outcome: null,
            notes: input.notes ?? '',
            createdAt: now,
            updatedAt: now
        };
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const file = join(directory, `${record.id}.json`);
        const handle = await open(file, 'wx', 0o600);
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
            if (!/^[0-9a-f-]{36}\.json$/i.test(file))
                continue;
            const raw = await readFile(join(directory, file), 'utf8');
            const record = JSON.parse(raw);
            if (record.ownerId !== ownerId ||
                record.accountId !== accountId) {
                throw new Error('Experiment ownership mismatch.');
            }
            records.push(record);
        }
        return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    async updateStatus(ownerId, accountId, experimentId, status, outcome) {
        const directory = await this.accountDirectory(ownerId, accountId);
        if (!/^[0-9a-f-]{36}$/i.test(experimentId)) {
            throw new Error('Invalid experiment ID.');
        }
        const file = join(directory, `${experimentId}.json`);
        const record = JSON.parse(await readFile(file, 'utf8'));
        if (record.ownerId !== ownerId || record.accountId !== accountId) {
            throw new Error('Experiment ownership mismatch.');
        }
        const allowed = {
            planned: ['running', 'cancelled'],
            running: ['completed', 'cancelled'],
            completed: [],
            cancelled: []
        };
        if (!allowed[record.status]?.includes(status)) {
            throw new Error('Invalid experiment status transition.');
        }
        if (status === 'completed' && !outcome) {
            throw new Error('Completed experiments require an outcome.');
        }
        if (outcome && status !== 'completed') {
            throw new Error('Outcome can only be set when completing an experiment.');
        }
        if (outcome) {
            this.validateMeasurement(outcome);
            if (record.baseline &&
                record.baseline.source !== outcome.source) {
                throw new Error('Baseline and outcome sources must match.');
            }
        }
        const updated = {
            ...record,
            status,
            outcome: outcome ?? record.outcome,
            updatedAt: new Date().toISOString()
        };
        const temporary = join(directory, `${experimentId}.${randomUUID()}.tmp`);
        const handle = await open(temporary, 'wx', 0o600);
        try {
            await handle.writeFile(JSON.stringify(updated, null, 2), 'utf8');
        }
        finally {
            await handle.close();
        }
        await rename(temporary, file);
        return updated;
    }
}
