/**
 * Ghost Mode Service for Meta Graph Unofficial
 * 
 * Provides 100% anonymous, read-only intelligence and data extraction
 * using authentic TwinGraph mobile/web client emulation.
 * Leaves zero footprint, zero story view notifications, and zero search history.
 */

import { TwinGraph } from '../twin_graph.js';
import { TwinTransport } from '../twins/transport.js';
import type {
  GraphUser,
  GraphMedia,
  ProfileTimelineResponse,
  GraphSearchResponse,
  ViralExplorePost,
  GraphComment,
  GraphReelInsights
} from '../types/graph.js';

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

export class GhostService {
  private client: TwinGraph;
  private transport: TwinTransport;
  private offlineMode: boolean;

  constructor(client?: TwinGraph, options?: GhostServiceOptions) {
    this.offlineMode = options?.offlineMode ?? (process.env.OFFLINE_MODE === 'true');
    this.client = client || new TwinGraph({ offlineMode: this.offlineMode });
    this.transport = new TwinTransport();
  }

  public isOfflineMode(): boolean {
    return (
      this.offlineMode ||
      process.env.OFFLINE_MODE === 'true' ||
      Boolean(this.client?.discovery?.isOfflineMode())
    );
  }

  private assertOnline(operationName: string): void {
    if (this.isOfflineMode()) {
      throw new Error(`${operationName} is unavailable in offline mode.`);
    }
  }

  /**
   * Helper to decode HTML entities in web meta tags
   */
  private decodeHtml(str: string): string {
    return str
      .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 16)))
      .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#064;/g, '@');
  }

  /**
   * Helper to parse human-readable metric counts (e.g. "1,231", "12.5K", "3M")
   */
  private parseCount(str: string | null | undefined): number | null {
    if (str === undefined || str === null) return null;
    const clean = String(str).replace(/,/g, '').trim();
    if (clean === '') return null;
    if (clean.endsWith('K') || clean.endsWith('k')) {
      const val = parseFloat(clean);
      return isNaN(val) ? null : Math.round(val * 1000);
    }
    if (clean.endsWith('M') || clean.endsWith('m')) {
      const val = parseFloat(clean);
      return isNaN(val) ? null : Math.round(val * 1000000);
    }
    const parsed = parseInt(clean, 10);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Fetches authentic live metadata for any public username via web SSR headers (Zero Account / Zero Cookies)
   */
  private async fetchLiveProfileMetadata(username: string): Promise<{
    id: string | null;
    followers: number | null;
    following: number | null;
    posts: number | null;
    biography: string | null;
    fullName: string | null;
    profilePicUrl: string | null;
    isVerified: boolean | null;
    isPrivate: boolean | null;
    isBusiness: boolean | null;
    externalUrl?: string | null;
  }> {
    this.assertOnline('Profile inspection');
    const cleanUser = username.replace(/^@/, '').trim();
    const url = `https://www.instagram.com/${cleanUser}/`;

    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
        'X-IG-App-ID': '936619743392459',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      };

      const res = await this.transport.request(url, { method: 'GET', headers, timeoutMs: 25000 });
      if (res.status === 302) {
        const loc = res.headers['location'] || '';
        throw new Error(`Instagram Guest Challenge (Status 302 - is_from_rle): Instagram web requires login for this IP. Switch VPN location/server or wait a moment.`);
      }
      if (res.status === 200) {
        const data = res.data;
        let id: string | null = null;
        let followers: number | null = null;
        let following: number | null = null;
        let posts: number | null = null;
        let biography: string | null = null;
        let fullName: string | null = null;
        let profilePicUrl: string | null = null;
        let isVerified: boolean | null = null;
        let isPrivate: boolean | null = null;
        let isBusiness: boolean | null = null;
        let externalUrl: string | null = null;

        const metaDescMatch = data.match(/<meta\s+(?:name="description"|property="og:description")\s+content="([^"]*)"/i);
        if (metaDescMatch) {
          const content = this.decodeHtml(metaDescMatch[1]);
          const folMatch = content.match(/([0-9,KMkm.]+)\s*Followers/i);
          const fowMatch = content.match(/([0-9,KMkm.]+)\s*Following/i);
          const postMatch = content.match(/([0-9,KMkm.]+)\s*Posts/i);
          if (folMatch) followers = this.parseCount(folMatch[1]);
          if (fowMatch) following = this.parseCount(fowMatch[1]);
          if (postMatch) posts = this.parseCount(postMatch[1]);
        }

        const metaContentMatch = data.match(/<meta\s+content="([0-9,KMkm.]+\s*Followers[^"]*)"/i);
        if (metaContentMatch) {
          const fullContent = this.decodeHtml(metaContentMatch[1]);
          const bioMatch = fullContent.match(/on Instagram:\s*"(?:‎)?([\s\S]*?)(?:‎)?"\s*$/i) || fullContent.match(/:\s*"([\s\S]*?)"\s*$/i);
          if (bioMatch && bioMatch[1].trim()) {
            biography = bioMatch[1].trim();
          }
        }

        const ogTitleMatch = data.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i);
        if (ogTitleMatch) {
          const title = this.decodeHtml(ogTitleMatch[1]);
          const nameMatch = title.match(/^(?:‎)?(.*?)(?:‎)?\s*\(/);
          if (nameMatch && nameMatch[1].trim()) {
            fullName = nameMatch[1].trim();
          }
        }

        // Search JSON scripts for exact user profile properties
        const jsonScripts = [...data.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)];
        for (const s of jsonScripts) {
          const c = s[1];
          if (c.includes('username') && (c.includes('profile_pic_url') || c.includes('full_name') || c.includes('is_verified') || c.includes('is_private') || c.includes('is_business'))) {
            try {
              const json = JSON.parse(c);
              const search = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;
                if (typeof obj.username === 'string' && obj.username.toLowerCase() === cleanUser.toLowerCase()) {
                  if (obj.id || obj.pk || obj.pk_id) id = String(obj.id || obj.pk || obj.pk_id);
                  if (typeof obj.full_name === 'string' && obj.full_name.trim()) fullName = obj.full_name.trim();
                  if (typeof obj.profile_pic_url_hd === 'string' && obj.profile_pic_url_hd) {
                    profilePicUrl = obj.profile_pic_url_hd;
                  } else if (typeof obj.profile_pic_url === 'string' && obj.profile_pic_url) {
                    profilePicUrl = obj.profile_pic_url;
                  }
                  if (typeof obj.biography === 'string' && obj.biography) biography = obj.biography;
                  if (typeof obj.external_url === 'string' && obj.external_url) externalUrl = obj.external_url;

                  if (typeof obj.follower_count === 'number') {
                    followers = obj.follower_count;
                  } else if (obj.edge_followed_by && typeof obj.edge_followed_by.count === 'number') {
                    followers = obj.edge_followed_by.count;
                  }

                  if (typeof obj.following_count === 'number') {
                    following = obj.following_count;
                  } else if (obj.edge_follow && typeof obj.edge_follow.count === 'number') {
                    following = obj.edge_follow.count;
                  }

                  if (typeof obj.media_count === 'number') {
                    posts = obj.media_count;
                  } else if (obj.edge_owner_to_timeline_media && typeof obj.edge_owner_to_timeline_media.count === 'number') {
                    posts = obj.edge_owner_to_timeline_media.count;
                  }

                  if (typeof obj.is_verified === 'boolean') {
                    isVerified = obj.is_verified;
                  }
                  if (typeof obj.is_private === 'boolean') {
                    isPrivate = obj.is_private;
                  }
                  if (typeof obj.is_business === 'boolean') {
                    isBusiness = obj.is_business;
                  } else if (typeof obj.is_business_account === 'boolean') {
                    isBusiness = obj.is_business_account;
                  } else if (typeof obj.is_professional_account === 'boolean') {
                    isBusiness = obj.is_professional_account;
                  }
                }
                for (const k of Object.keys(obj)) search(obj[k]);
              };
              search(json);
            } catch {}
          }
        }

        return { id, followers, following, posts, biography, fullName, profilePicUrl, isVerified, isPrivate, isBusiness, externalUrl };
      }
      throw new Error(`Instagram returned HTTP ${res.status} (${res.statusText || 'Unexpected response'})`);
    } catch (err: any) {
      const msg = err?.message || err?.code || String(err || 'Connection failure');
      throw new Error(`Ghost Profile Error for @${cleanUser}: ${msg}`);
    }
  }

  /**
   * 1. Ghost Profile Inspection (100% Real, Zero Mock, Pure Guest Mode)
   */
  public async getProfile(username: string): Promise<GhostProfileResult> {
    this.assertOnline('Profile inspection');
    const cleanUsername = username.replace(/^@/, '').trim();
    const liveWeb = await this.fetchLiveProfileMetadata(cleanUsername);

    return {
      id: liveWeb.id,
      username: cleanUsername,
      full_name: liveWeb.fullName,
      biography: liveWeb.biography,
      external_url: liveWeb.externalUrl ?? undefined,
      followers_count: liveWeb.followers,
      following_count: liveWeb.following,
      media_count: liveWeb.posts,
      is_verified: liveWeb.isVerified,
      is_private: liveWeb.isPrivate,
      is_business: liveWeb.isBusiness,
      profile_pic_url: liveWeb.profilePicUrl
    };
  }

  /**
   * 2. Ghost Timeline & Feed Posts Pagination (100% Real, Zero Hardcoded Items)
   * Extracts up to 12 initial posts directly from the guest SSR payload without any account.
   */
  public async getTimelinePosts(params: {
    username?: string;
    userId?: string;
    limit?: number;
    cursor?: string;
    feedType?: 'all' | 'reels' | 'posts';
    profile?: GhostProfileResult;
  }): Promise<GhostTimelineResult> {
    this.assertOnline('Timeline retrieval');
    const cleanUsername = (params.username || '').replace(/^@/, '').trim();
    let profile: GhostProfileResult | null = params.profile || null;
    
    if (!profile && cleanUsername) {
      profile = await this.getProfile(cleanUsername);
    }

    const posts: GhostPostItem[] = [];
    const limit = params.limit || 12;
    let hasNextPage = false;
    let nextCursor: string | undefined = undefined;

    const url = `https://www.instagram.com/${cleanUsername || profile?.username}/`;
    const res = await this.transport.request(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      timeoutMs: 30000
    });

    if (res.status === 302) {
      throw new Error(`Instagram Guest Challenge (Status 302 - is_from_rle): Instagram web requires login for this IP. Switch VPN location/server.`);
    }
    if (res.status !== 200) {
      throw new Error(`Failed to fetch timeline for @${cleanUsername}: Instagram returned HTTP ${res.status} (${res.statusText || 'Failed to load timeline'})`);
    }

    if (res.data) {
      const data = res.data;
      const jsonScripts = [...data.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)];
      
      for (const s of jsonScripts) {
        const content = s[1];
        if (content.includes('edge_owner_to_timeline_media') || content.includes('xdt_api__v1__feed__user_timeline') || (content.includes('edges') && content.includes('__isXIGPolarisMedia'))) {
          try {
            const json = JSON.parse(content);
            const findContainer = (obj: any): { edges: any[]; page_info?: any } | null => {
              if (!obj || typeof obj !== 'object') return null;

              const timeline = obj.edge_owner_to_timeline_media;
              if (timeline && Array.isArray(timeline.edges)) {
                return { edges: timeline.edges, page_info: timeline.page_info };
              }

              for (const k of Object.keys(obj)) {
                const result = findContainer(obj[k]);
                if (result) return result;
              }
              return null;
            };

            const container = findContainer(json);
            if (container && container.edges.length > 0) {
              if (container.page_info) {
                hasNextPage = Boolean(container.page_info.has_next_page);
                nextCursor = container.page_info.end_cursor || undefined;
              } else {
                hasNextPage = container.edges.length > limit;
              }

              for (const e of container.edges) {
                const n = e.node;
                if (!n || typeof n !== 'object') continue;

                const owner = n.owner || n.user;
                if (owner && typeof owner === 'object') {
                  const ownerId = owner.id || owner.pk || owner.pk_id;
                  const ownerUsername = owner.username;
                  const expectedId = profile?.id || params.userId;

                  if (ownerId && expectedId && String(ownerId) !== String(expectedId)) {
                    continue;
                  }

                  if (ownerUsername && (profile?.username || cleanUsername) &&
                      String(ownerUsername).toLowerCase() !==
                      String(profile?.username || cleanUsername).toLowerCase()) {
                    continue;
                  }
                }

                const isVideo = n.media_type === 2 || n.__typename === 'XIGPolarisVideoMedia' || Boolean(n.is_video);
                const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
                const mediaProductType = isVideo ? 'REELS' : 'FEED';

                // Apply feedType filter BEFORE limiting
                if (params.feedType === 'reels' && mediaType !== 'VIDEO') continue;
                if (params.feedType === 'posts' && mediaType === 'VIDEO') continue;

                const shortcode = n.code || n.shortcode || '';
                if (!shortcode) continue;

                const captionText = n.caption?.text || n.accessibility_caption || '';
                posts.push({
                  id: String(n.id || n.pk || shortcode),
                  shortcode,
                  media_type: mediaType,
                  media_product_type: mediaProductType,
                  caption: captionText,
                  timestamp: n.taken_at ? new Date(n.taken_at * 1000).toISOString() : undefined,
                  like_count: typeof n.like_count === 'number' && Number.isFinite(n.like_count) && n.like_count >= 0
                    ? n.like_count
                    : (typeof n.edge_media_preview_like?.count === 'number' &&
                       Number.isFinite(n.edge_media_preview_like.count) &&
                       n.edge_media_preview_like.count >= 0
                        ? n.edge_media_preview_like.count : null),
                  comment_count: typeof n.comment_count === 'number' && Number.isFinite(n.comment_count) && n.comment_count >= 0
                    ? n.comment_count
                    : (typeof n.edge_media_to_comment?.count === 'number' &&
                       Number.isFinite(n.edge_media_to_comment.count) &&
                       n.edge_media_to_comment.count >= 0
                        ? n.edge_media_to_comment.count : null),
                  video_play_count: n.video_play_count || undefined,
                  thumbnail_url: n.display_uri || n.display_url || '',
                  permalink: `https://www.instagram.com/p/${shortcode}/`
                });

                if (posts.length >= limit) break;
              }
              break;
            }
          } catch {
            // Non-JSON script
          }
        }
      }
    }

    return {
      username: profile?.username || cleanUsername || 'unknown',
      user_id: profile?.id || params.userId || '0',
      total_media_count: typeof profile?.media_count === 'number' ? profile.media_count : posts.length,
      retrieved_count: posts.length,
      has_next_page: hasNextPage,
      next_cursor: nextCursor,
      posts
    };
  }

  /**
   * 3. Granular Media & Reel Metrics (100% Real)
   */
  public async getMediaMetrics(mediaId: string): Promise<GhostMediaMetricsResult> {
    this.assertOnline('Media metrics retrieval');
    const cleanId = mediaId.trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+).*/, '$1');
    const url = `https://www.instagram.com/reel/${cleanId}/`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    let likes: number | null = null;
    let comments: number | null = null;
    let videoPlays: number | undefined = undefined;
    let jsonLikes: number | undefined;
    let jsonComments: number | undefined;
    let jsonPlays: number | undefined;
    let likesConflict = false;
    let commentsConflict = false;
    let playsConflict = false;
    let foundTargetJson = false;
    let caption = '';
    let timestamp: string | undefined = undefined;
    let mediaType = 'IMAGE';

    const res = await this.transport.request(url, { headers, timeoutMs: 25000 });
    if (res.status === 302) {
      throw new Error(`Instagram Guest Challenge (Status 302 - is_from_rle): Instagram web requires login for this IP. Switch VPN location/server.`);
    }
    if (res.status !== 200) {
      throw new Error(`Failed to fetch media ${cleanId}: Instagram returned HTTP ${res.status} (${res.statusText || 'Inaccessible'})`);
    }

    if (res.data) {
      const data = res.data;
      if (data.includes('og:type" content="video') || data.includes('"video_url"') || data.includes('video_play_count') || data.includes('XIGPolarisVideoMedia')) {
        mediaType = 'VIDEO';
      }

      const metaDescMatch = data.match(/<meta\s+(?:name="description"|property="og:description")\s+content="([^"]*)"/i);
      if (metaDescMatch) {
        const rawDesc = this.decodeHtml(metaDescMatch[1]);
        const m = rawDesc.match(/([0-9,KMkm.]+)\s*likes,\s*([0-9,KMkm.]+)\s*comments/i);
        if (m) {
          likes = this.parseCount(m[1]);
          comments = this.parseCount(m[2]);
        }
        const capMatch = rawDesc.match(/:\s*"(?:‎)?([\s\S]*?)(?:‎)?"\s*$/);
        if (capMatch) {
          caption = capMatch[1].trim();
        }
      }

      const jsonScripts = [...data.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)];
      for (const s of jsonScripts) {
        const c = s[1];
        if ((c.includes('like_count') || c.includes('comment_count') || c.includes('video_play_count')) &&
            (c.includes('XIGPolarisMedia') || c.includes('POLARIS_') || c.includes('xdt_shortcode_media'))) {
          try {
            const json = JSON.parse(c);
            const matchesRequestedMedia = (obj: any): boolean => {
              if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
              const identifiers = [obj.shortcode, obj.code].filter(
                (v): v is string => typeof v === 'string' && v.length > 0
              );
              return identifiers.length > 0 && identifiers.every(v => v === cleanId);
            };

            const findTarget = (obj: any): any | null => {
              if (!obj || typeof obj !== 'object') return null;

              if (!Array.isArray(obj) && obj.xdt_shortcode_media) {
                const media = obj.xdt_shortcode_media;
                if (media && typeof media === 'object' && !Array.isArray(media)) {
                  const identifiers = [media.shortcode, media.code].filter(
                    (v): v is string => typeof v === 'string' && v.length > 0
                  );
                  if (identifiers.length === 0 || matchesRequestedMedia(media)) {
                    return media;
                  }
                }
              }

              if (!Array.isArray(obj) && matchesRequestedMedia(obj)) return obj;

              for (const child of Object.values(obj)) {
                const found = findTarget(child);
                if (found) return found;
              }
              return null;
            };

            const media = findTarget(json);
            if (media) {
              const validCount = (value: unknown): value is number =>
                typeof value === 'number' && Number.isFinite(value) && value >= 0;

              foundTargetJson = true;

              if (validCount(media.like_count)) {
                if (jsonLikes !== undefined && jsonLikes !== media.like_count)
                  likesConflict = true;
                else
                  jsonLikes = media.like_count;
              }

              if (validCount(media.comment_count)) {
                if (jsonComments !== undefined && jsonComments !== media.comment_count)
                  commentsConflict = true;
                else
                  jsonComments = media.comment_count;
              }

              if (validCount(media.video_play_count)) {
                if (jsonPlays !== undefined && jsonPlays !== media.video_play_count)
                  playsConflict = true;
                else
                  jsonPlays = media.video_play_count;
              }

              if (media.is_video === true) mediaType = 'VIDEO';
              if (typeof media.taken_at === 'number' && Number.isFinite(media.taken_at)) {
                const date = new Date(media.taken_at * 1000);
                if (!Number.isNaN(date.getTime()))
                  timestamp = date.toISOString();
              }

              if (typeof media.caption?.text === 'string') caption = media.caption.text;
              else if (typeof media.caption === 'string') caption = media.caption;
              else if (typeof media.accessibility_caption === 'string' && !caption)
                caption = media.accessibility_caption;
            }
          } catch {}
        }
      }
    }

    if (foundTargetJson) {
      likes = likesConflict ? null : (jsonLikes ?? null);
      comments = commentsConflict ? null : (jsonComments ?? null);
      videoPlays = playsConflict ? undefined : jsonPlays;
    }

    const commentToLikeRatio =
      likes !== null && comments !== null && likes > 0
        ? Number((comments / likes).toFixed(4))
        : null;

    const engRate =
      likes !== null &&
      comments !== null &&
      typeof videoPlays === 'number' &&
      videoPlays > 0
        ? Number((((likes + comments) / videoPlays) * 100).toFixed(2))
        : null;

    const engDenominator = engRate !== null ? 'views' : null;

    return {
      media_id: cleanId,
      shortcode: cleanId,
      media_type: mediaType,
      caption,
      timestamp,
      metrics: {
        video_plays: videoPlays,
        likes,
        comments,
        engagement_rate: engRate,
        engagement_rate_denominator: engDenominator,
        comment_to_like_ratio: commentToLikeRatio
      }
    };
  }

  /**
   * 4. Ghost Comment Harvesting (100% Real, Zero Account Session)
   */
  public async getComments(mediaId: string, limit: number = 25): Promise<{
    media_id: string;
    total_retrieved: number;
    comments: Array<{
      id: string;
      username: string;
      text: string;
      timestamp?: string;
      like_count: number;
    }>;
  }> {
    this.assertOnline('Comment harvesting');
    const cleanId = mediaId.trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+).*/, '$1');
    const url = `https://www.instagram.com/reel/${cleanId}/`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    const res = await this.transport.request(url, { headers, timeoutMs: 25000 });
    if (res.status === 302) {
      throw new Error(`Instagram Guest Challenge (Status 302 - is_from_rle): Instagram web requires login for this IP. Switch VPN location/server.`);
    }
    if (res.status !== 200) {
      throw new Error(`Failed to fetch comments for ${cleanId}: Instagram returned HTTP ${res.status}`);
    }

    const commentsList: Array<{
      id: string;
      username: string;
      text: string;
      timestamp?: string;
      like_count: number;
    }> = [];

    if (res.data) {
      const jsonScripts = [...res.data.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)];
      for (const s of jsonScripts) {
        const c = s[1];
        if (c.includes('XIGComment') || c.includes('edge_media_to_parent_comment')) {
          try {
            const json = JSON.parse(c);
            const search = (obj: any) => {
              if (!obj || typeof obj !== 'object') return;
              if ((obj.__typename === 'XIGComment' || obj.__typename === 'Comment') && obj.text) {
                commentsList.push({
                  id: String(obj.id || obj.pk || ''),
                  username: obj.user?.username || obj.owner?.username || 'anonymous_user',
                  text: obj.text,
                  timestamp: obj.created_at ? new Date(obj.created_at * 1000).toISOString() : undefined,
                  like_count: obj.comment_like_count ?? obj.edge_liked_by?.count ?? 0
                });
              }
              for (const k of Object.keys(obj)) search(obj[k]);
            };
            search(json);
          } catch {}
        }
      }
    }

    return {
      media_id: cleanId,
      total_retrieved: commentsList.length,
      comments: commentsList.slice(0, limit)
    };
  }

  /**
   * 5. Ghost Search (Users & Hashtags)
   */
  public async search(query: string, type: 'users' | 'hashtags' | 'all' = 'all'): Promise<GraphSearchResponse> {
    this.assertOnline('Search');
    const context = type === 'users' ? 'user' : type === 'hashtags' ? 'hashtag' : 'blended';
    const res = await this.client.discovery.search(query, { context });
    if (res.status === 'auth_required') {
      throw new Error('Instagram Search API requires an authenticated session; not available in guest mode.');
    }
    return res;
  }

  /**
   * 6. Ghost Viral & Debate Explore Radar
   */
  public async getViralExplore(limit: number = 10, minCommentRatio?: number): Promise<ViralExplorePost[]> {
    this.assertOnline('Viral explore');
    return this.client.discovery.getViralExplore({ limit, minCommentRatio });
  }

  /**
   * 7. Comprehensive Ghost Audit Report (100% Real, Zero Fake Numbers)
   */
  public async auditAccount(username: string, sampleCount: number = 15): Promise<GhostAuditReport> {
    this.assertOnline('Account audit');
    const profile = await this.getProfile(username);
    const timeline = await this.getTimelinePosts({
      userId: profile.id || undefined,
      username: profile.username,
      limit: sampleCount,
      profile
    });

    const posts = timeline.posts;
    const reels = posts.filter(p => p.media_type === 'VIDEO' || p.media_product_type === 'REELS');
    const feedPosts = posts.filter(p => p.media_type !== 'VIDEO');

    const reelsWithKnownPlays = reels.filter(
      r => typeof r.video_play_count === 'number' &&
           Number.isFinite(r.video_play_count) &&
           r.video_play_count >= 0
    );
    const totalPlays = reelsWithKnownPlays.reduce(
      (acc, r) => acc + (r.video_play_count as number), 0
    );
    const avgPlays = reelsWithKnownPlays.length > 0
      ? Math.round(totalPlays / reelsWithKnownPlays.length)
      : null;

    const validMetric = (value: number | null | undefined): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0;

    const knownLikes = posts.filter(p => validMetric(p.like_count));
    const knownComments = posts.filter(p => validMetric(p.comment_count));

    const totalLikes = knownLikes.length
      ? knownLikes.reduce((sum, p) => sum + (p.like_count as number), 0)
      : null;
    const totalComments = knownComments.length
      ? knownComments.reduce((sum, p) => sum + (p.comment_count as number), 0)
      : null;

    const avgLikes = totalLikes !== null
      ? Math.round(totalLikes / knownLikes.length) : null;
    const avgComments = totalComments !== null
      ? Math.round(totalComments / knownComments.length) : null;

    const completeEngagementPosts = posts.filter(
      p => validMetric(p.like_count) && validMetric(p.comment_count)
    );
    const followerCount = profile.followers_count;
    const overallEng = validMetric(followerCount) && followerCount > 0 &&
      completeEngagementPosts.length > 0
      ? Number((
          completeEngagementPosts.reduce(
            (sum, p) => sum + (p.like_count as number) + (p.comment_count as number), 0
          ) / completeEngagementPosts.length / followerCount * 100
        ).toFixed(2))
      : null;

    const reelsWithPlays = reels.filter(r => validMetric(r.video_play_count));
    const rankingCandidates = reelsWithPlays.length > 0
      ? reelsWithPlays
      : reels.filter(r => validMetric(r.like_count));

    const sortedReels = [...rankingCandidates].sort((a, b) =>
      reelsWithPlays.length > 0
        ? (b.video_play_count as number) - (a.video_play_count as number)
        : (b.like_count as number) - (a.like_count as number)
    );

    const topPerformingReels = sortedReels.slice(0, 3).map(r => {
      const hasPlays = validMetric(r.video_play_count) && r.video_play_count > 0;
      const hasFollowers = validMetric(followerCount) && followerCount > 0;
      const hasEngagement = validMetric(r.like_count) && validMetric(r.comment_count);

      const denominator = hasPlays ? r.video_play_count as number
        : hasFollowers ? followerCount as number : null;
      const denominatorType: 'views' | 'followers' | null =
        hasPlays ? 'views' : hasFollowers ? 'followers' : null;

      return {
        id: r.id,
        shortcode: r.shortcode,
        plays: validMetric(r.video_play_count) ? r.video_play_count : null,
        likes: r.like_count,
        comments: r.comment_count,
        engagement_rate: hasEngagement && denominator !== null
          ? Number((((r.like_count as number) + (r.comment_count as number)) /
              denominator * 100).toFixed(2))
          : null,
        engagement_rate_denominator: denominatorType,
        caption_snippet: r.caption ? r.caption.slice(0, 100) : '',
        permalink: r.permalink
      };
    });

    const sortedDiscussions = posts
      .filter(p => validMetric(p.comment_count))
      .sort((a, b) => (b.comment_count as number) - (a.comment_count as number));

    const discussionDrivers = sortedDiscussions.slice(0, 3).map(p => ({
      id: p.id,
      shortcode: p.shortcode,
      comments: p.comment_count,
      comment_to_like_ratio: validMetric(p.like_count) && p.like_count > 0
        ? Number(((p.comment_count as number) / p.like_count).toFixed(3))
        : null,
      caption_snippet: p.caption ? p.caption.slice(0, 100) : ''
    }));

    return {
      target: {
        username: profile.username,
        full_name: profile.full_name,
        followers: profile.followers_count,
        following: profile.following_count,
        total_posts: profile.media_count,
        is_verified: profile.is_verified,
        biography: profile.biography
      },
      analyzed_sample_size: posts.length,
      aggregate_metrics: {
        total_sampled_plays: totalPlays,
        average_plays_per_reel: avgPlays,
        total_sampled_likes: totalLikes,
        average_likes_per_post: avgLikes,
        known_likes_count: knownLikes.length,
        total_sampled_comments: totalComments,
        average_comments_per_post: avgComments,
        known_comments_count: knownComments.length,
        overall_engagement_rate_pct: overallEng
      },
      content_mix: {
        reels_count: reels.length,
        feed_posts_count: feedPosts.length,
        reels_share_pct: posts.length > 0 ? Math.round((reels.length / posts.length) * 100) : null
      },
      top_performing_reels: topPerformingReels,
      discussion_driver_posts: discussionDrivers,
      audit_timestamp: new Date().toISOString()
    };
  }
}
