import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
export class AnalyticsSnapshotStore {
    accounts;
    directory;
    constructor(accounts, directory = join(process.cwd(), 'data', 'instagram_analytics_snapshots')) {
        this.accounts = accounts;
        this.directory = directory;
    }
    async accountDirectory(ownerId, accountId) {
        if (!ownerId?.trim() || !accountId?.trim()) {
            throw new Error('Valid owner and account IDs required.');
        }
        const owned = await this.accounts.list(ownerId);
        if (!owned.some(account => account.id === accountId)) {
            throw new Error('Account not found for this owner.');
        }
        const hash = (value) => createHash('sha256').update(value).digest('hex');
        return join(resolve(this.directory), hash(ownerId), hash(accountId));
    }
    async save(ownerId, report) {
        if (!report ||
            typeof report.accountId !== 'string' ||
            !['mock', 'live'].includes(report.source) ||
            !Number.isFinite(Date.parse(report.analyzedAt)) ||
            !Number.isInteger(report.analyzedPostCount) ||
            report.analyzedPostCount < 0 ||
            !Array.isArray(report.rankedPosts)) {
            throw new Error('Invalid analytics report.');
        }
        // Validate metrics before writing anything to disk.
        const nonNegative = (value) => typeof value === 'number' &&
            Number.isFinite(value) &&
            value >= 0;
        const count = (value) => nonNegative(value) && Number.isSafeInteger(value);
        const nullableMetric = (value) => value === null || nonNegative(value);
        const mix = report.contentMix;
        const quality = report.dataQuality;
        if (!nullableMetric(report.followersCount) ||
            (report.followersCount !== null &&
                !count(report.followersCount)) ||
            !nullableMetric(report.averageEngagementRatePct) ||
            report.engagementRateDenominator !== 'followers' ||
            !mix ||
            !quality ||
            !['image', 'video', 'carousel', 'reel'].every(type => count(mix[type])) ||
            !count(quality.postsWithCompleteEngagement) ||
            !count(quality.postsWithMissingEngagement) ||
            typeof quality.completeMediaHistory !== 'boolean') {
            throw new Error('Invalid analytics metrics.');
        }
        const mediaTotal = mix.image + mix.video + mix.carousel + mix.reel;
        const qualityTotal = quality.postsWithCompleteEngagement +
            quality.postsWithMissingEngagement;
        if (!Number.isSafeInteger(mediaTotal) ||
            !Number.isSafeInteger(qualityTotal) ||
            mediaTotal !== report.analyzedPostCount ||
            qualityTotal !== report.analyzedPostCount) {
            throw new Error('Inconsistent analytics totals.');
        }
        for (const post of report.rankedPosts) {
            if (!post ||
                typeof post.id !== 'string' ||
                !post.id.trim() ||
                !['image', 'video', 'carousel', 'reel'].includes(post.type) ||
                typeof post.publishedAt !== 'string' ||
                !Number.isFinite(Date.parse(post.publishedAt)) ||
                !nullableMetric(post.likes) ||
                !nullableMetric(post.comments) ||
                !nullableMetric(post.engagementRatePct) ||
                (post.likes !== null && !count(post.likes)) ||
                (post.comments !== null && !count(post.comments))) {
                throw new Error('Invalid analytics post metrics.');
            }
        }
        const directory = await this.accountDirectory(ownerId, report.accountId);
        const snapshot = {
            id: randomUUID(),
            ownerId,
            accountId: report.accountId,
            source: report.source,
            capturedAt: new Date().toISOString(),
            report: JSON.parse(JSON.stringify(report))
        };
        await mkdir(directory, {
            recursive: true,
            mode: 0o700
        });
        const file = join(directory, `${snapshot.id}.json`);
        const handle = await open(file, 'wx', 0o600);
        try {
            await handle.writeFile(JSON.stringify(snapshot, null, 2), 'utf8');
        }
        finally {
            await handle.close();
        }
        return snapshot;
    }
    async list(ownerId, accountId) {
        const directory = await this.accountDirectory(ownerId, accountId);
        let files;
        try {
            files = await readdir(directory);
        }
        catch (error) {
            if (error instanceof Error &&
                'code' in error &&
                error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
        const snapshots = [];
        for (const file of files) {
            if (!/^[0-9a-f-]{36}\.json$/i.test(file))
                continue;
            const item = JSON.parse(await readFile(join(directory, file), 'utf8'));
            if (item.ownerId !== ownerId ||
                item.accountId !== accountId ||
                item.report?.accountId !== accountId ||
                !['mock', 'live'].includes(item.source) ||
                item.report.source !== item.source) {
                throw new Error('Invalid snapshot or ownership mismatch.');
            }
            snapshots.push(item);
        }
        return snapshots.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) ||
            b.id.localeCompare(a.id));
    }
}
