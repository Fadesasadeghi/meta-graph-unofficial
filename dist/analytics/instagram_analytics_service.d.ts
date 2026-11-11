import type { InstagramDataProvider, InstagramDataSource, InstagramMediaType, ProviderResult } from '../providers/instagram_provider.js';
export interface AnalyzedMedia {
    id: string;
    type: InstagramMediaType;
    publishedAt: string;
    likes: number | null;
    comments: number | null;
    engagementRatePct: number | null;
}
export interface AnalyticsReport {
    accountId: string;
    username: string;
    source: InstagramDataSource;
    analyzedAt: string;
    followersCount: number | null;
    analyzedPostCount: number;
    averageEngagementRatePct: number | null;
    engagementRateDenominator: 'followers';
    contentMix: Record<InstagramMediaType, number>;
    rankedPosts: AnalyzedMedia[];
    dataQuality: {
        postsWithCompleteEngagement: number;
        postsWithMissingEngagement: number;
        completeMediaHistory: boolean;
    };
    recommendations: string[];
}
export declare class InstagramAnalyticsService {
    private readonly provider;
    constructor(provider: InstagramDataProvider);
    private round;
    private fetchMedia;
    analyzeAccount(accountId: string): Promise<ProviderResult<AnalyticsReport>>;
}
