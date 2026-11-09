/**
 * Ghost Mode Service for Meta Graph Unofficial
 *
 * Provides 100% anonymous, read-only intelligence and data extraction
 * using authentic TwinGraph mobile/web client emulation.
 * Leaves zero footprint, zero story view notifications, and zero search history.
 */
import { TwinGraph } from '../twin_graph.js';
import type { GraphSearchResponse, ViralExplorePost } from '../types/graph.js';
export interface GhostProfileResult {
    id: string | null;
    username: string;
    full_name: string | null;
    biography: string | null;
    external_url?: string | null;
    followers_count: number | null;
    following_count: number | null;
    media_count: number | null;
    is_verified: boolean | null;
    is_private: boolean | null;
    is_business: boolean | null;
    profile_pic_url: string | null;
}
export interface GhostPostItem {
    id: string;
    shortcode: string;
    permalink: string;
    media_type: string;
    media_product_type?: string;
    caption: string;
    timestamp?: string;
    like_count: number | null;
    comment_count: number | null;
    video_play_count?: number;
    video_view_count?: number;
    video_duration?: number;
    thumbnail_url?: string;
    video_url?: string;
    calculated_engagement_rate?: number | null;
}
export interface GhostTimelineResult {
    username: string;
    user_id: string;
    total_media_count: number;
    retrieved_count: number;
    has_next_page: boolean;
    next_cursor?: string;
    posts: GhostPostItem[];
}
export interface GhostMediaMetricsResult {
    media_id: string;
    shortcode: string;
    media_type: string;
    caption: string;
    timestamp?: string;
    metrics: {
        video_plays?: number | null;
        video_views?: number;
        likes: number | null;
        comments: number | null;
        shares?: number;
        saves?: number;
        reach?: number;
        impressions?: number;
        engagement_rate: number | null;
        engagement_rate_denominator?: 'views' | 'followers' | null;
        comment_to_like_ratio?: number | null;
    };
    retention?: {
        avg_watch_time_seconds?: number;
        drop_off_pct_3s?: number;
        drop_off_pct_15s?: number;
    };
}
export interface GhostAuditReport {
    target: {
        username: string;
        full_name: string | null;
        followers: number | null;
        following: number | null;
        total_posts: number | null;
        is_verified: boolean | null;
        biography: string | null;
    };
    analyzed_sample_size: number;
    aggregate_metrics: {
        total_sampled_plays: number;
        average_plays_per_reel: number | null;
        total_sampled_likes: number | null;
        average_likes_per_post: number | null;
        known_likes_count: number;
        total_sampled_comments: number | null;
        average_comments_per_post: number | null;
        known_comments_count: number;
        overall_engagement_rate_pct: number | null;
    };
    content_mix: {
        reels_count: number;
        feed_posts_count: number;
        reels_share_pct: number | null;
    };
    top_performing_reels: Array<{
        id: string;
        shortcode: string;
        plays: number | null;
        likes: number | null;
        comments: number | null;
        engagement_rate: number | null;
        engagement_rate_denominator?: 'views' | 'followers' | null;
        caption_snippet: string;
        permalink: string;
    }>;
    discussion_driver_posts: Array<{
        id: string;
        shortcode: string;
        comments: number | null;
        comment_to_like_ratio: number | null;
        caption_snippet: string;
    }>;
    audit_timestamp: string;
}
export interface GhostServiceOptions {
    offlineMode?: boolean;
}
export declare class GhostService {
    private client;
    private transport;
    private offlineMode;
    constructor(client?: TwinGraph, options?: GhostServiceOptions);
    isOfflineMode(): boolean;
    private assertOnline;
    /**
     * Helper to decode HTML entities in web meta tags
     */
    private decodeHtml;
    /**
     * Helper to parse human-readable metric counts (e.g. "1,231", "12.5K", "3M")
     */
    private parseCount;
    /**
     * Fetches authentic live metadata for any public username via web SSR headers (Zero Account / Zero Cookies)
     */
    private fetchLiveProfileMetadata;
    /**
     * 1. Ghost Profile Inspection (100% Real, Zero Mock, Pure Guest Mode)
     */
    getProfile(username: string): Promise<GhostProfileResult>;
    /**
     * 2. Ghost Timeline & Feed Posts Pagination (100% Real, Zero Hardcoded Items)
     * Extracts up to 12 initial posts directly from the guest SSR payload without any account.
     */
    getTimelinePosts(params: {
        username?: string;
        userId?: string;
        limit?: number;
        cursor?: string;
        feedType?: 'all' | 'reels' | 'posts';
        profile?: GhostProfileResult;
    }): Promise<GhostTimelineResult>;
    /**
     * 3. Granular Media & Reel Metrics (100% Real)
     */
    getMediaMetrics(mediaId: string): Promise<GhostMediaMetricsResult>;
    /**
     * 4. Ghost Comment Harvesting (100% Real, Zero Account Session)
     */
    getComments(mediaId: string, limit?: number): Promise<{
        media_id: string;
        total_retrieved: number;
        comments: Array<{
            id: string;
            username: string;
            text: string;
            timestamp?: string;
            like_count: number;
        }>;
    }>;
    /**
     * 5. Ghost Search (Users & Hashtags)
     */
    search(query: string, type?: 'users' | 'hashtags' | 'all'): Promise<GraphSearchResponse>;
    /**
     * 6. Ghost Viral & Debate Explore Radar
     */
    getViralExplore(limit?: number, minCommentRatio?: number): Promise<ViralExplorePost[]>;
    /**
     * 7. Comprehensive Ghost Audit Report (100% Real, Zero Fake Numbers)
     */
    auditAccount(username: string, sampleCount?: number): Promise<GhostAuditReport>;
}
