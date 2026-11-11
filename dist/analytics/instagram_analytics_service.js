export class InstagramAnalyticsService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    round(value) {
        return Math.round(value * 100) / 100;
    }
    async fetchMedia(accountId) {
        const posts = [];
        const seenIds = new Set();
        const seenCursors = new Set();
        let cursor;
        let complete = false;
        // Limit requests to avoid unbounded API calls.
        for (let page = 0; page < 10; page++) {
            const result = await this.provider.listMedia(accountId, {
                limit: 50,
                cursor
            });
            if (!result.ok) {
                return { posts, complete: false, error: result.error };
            }
            for (const item of result.data.items) {
                if (!seenIds.has(item.id)) {
                    seenIds.add(item.id);
                    posts.push(item);
                }
            }
            const next = result.data.nextCursor;
            if (next === null) {
                complete = true;
                break;
            }
            if (next === cursor ||
                seenCursors.has(next) ||
                result.data.items.length === 0) {
                break;
            }
            seenCursors.add(next);
            cursor = next;
        }
        return { posts, complete };
    }
    async analyzeAccount(accountId) {
        const profileResult = await this.provider.getProfile(accountId);
        if (!profileResult.ok) {
            return {
                ok: false,
                source: this.provider.source,
                error: profileResult.error
            };
        }
        const profile = profileResult.data;
        const mediaResult = await this.fetchMedia(accountId);
        // Do not silently present partial data after API failure.
        if (mediaResult.error) {
            return {
                ok: false,
                source: this.provider.source,
                error: mediaResult.error
            };
        }
        const followers = profile.followersCount;
        const contentMix = {
            image: 0,
            video: 0,
            carousel: 0,
            reel: 0
        };
        const analyzedPosts = mediaResult.posts.map(post => {
            contentMix[post.type]++;
            const hasCompleteMetrics = post.likeCount !== null &&
                post.commentCount !== null;
            const rate = hasCompleteMetrics &&
                followers !== null &&
                followers > 0
                ? this.round(((post.likeCount + post.commentCount) / followers) * 100)
                : null;
            return {
                id: post.id,
                type: post.type,
                publishedAt: post.publishedAt,
                likes: post.likeCount,
                comments: post.commentCount,
                engagementRatePct: rate
            };
        });
        const rankedPosts = [...analyzedPosts].sort((a, b) => {
            if (a.engagementRatePct === null && b.engagementRatePct === null)
                return 0;
            if (a.engagementRatePct === null)
                return 1;
            if (b.engagementRatePct === null)
                return -1;
            return b.engagementRatePct - a.engagementRatePct;
        });
        const completePosts = analyzedPosts.filter(post => post.engagementRatePct !== null);
        const averageEngagementRatePct = completePosts.length > 0
            ? this.round(completePosts.reduce((sum, post) => sum + ((post.likes + post.comments) / followers) * 100, 0) / completePosts.length)
            : null;
        const recommendations = [];
        if (completePosts.length === 0) {
            recommendations.push('Not enough complete engagement data for recommendations.');
        }
        else {
            recommendations.push('Review the highest-engagement posts for reusable content patterns.');
        }
        if (completePosts.length < analyzedPosts.length) {
            recommendations.push('Some posts have missing metrics. Rankings are incomplete.');
        }
        if (!mediaResult.complete) {
            recommendations.push('Media history was truncated. Results describe only the retrieved sample.');
        }
        const report = {
            accountId,
            username: profile.username,
            source: this.provider.source,
            analyzedAt: new Date().toISOString(),
            followersCount: followers,
            analyzedPostCount: analyzedPosts.length,
            averageEngagementRatePct,
            engagementRateDenominator: 'followers',
            contentMix,
            rankedPosts,
            dataQuality: {
                postsWithCompleteEngagement: completePosts.length,
                postsWithMissingEngagement: analyzedPosts.length - completePosts.length,
                completeMediaHistory: mediaResult.complete
            },
            recommendations
        };
        return {
            ok: true,
            data: report,
            source: this.provider.source,
            fetchedAt: report.analyzedAt
        };
    }
}
