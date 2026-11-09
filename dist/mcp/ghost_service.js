/**
 * Ghost Mode Service for Meta Graph Unofficial
 *
 * Provides 100% anonymous, read-only intelligence and data extraction
 * using authentic TwinGraph mobile/web client emulation.
 * Leaves zero footprint, zero story view notifications, and zero search history.
 */
import { TwinGraph } from '../twin_graph.js';
import { TwinTransport } from '../twins/transport.js';
export class GhostService {
    client;
    transport;
    offlineMode;
    constructor(client, options) {
        this.offlineMode = options?.offlineMode ?? (process.env.OFFLINE_MODE === 'true');
        this.client = client || new TwinGraph({ offlineMode: this.offlineMode });
        this.transport = new TwinTransport();
    }
    isOfflineMode() {
        return (this.offlineMode ||
            process.env.OFFLINE_MODE === 'true' ||
            Boolean(this.client?.discovery?.isOfflineMode()));
    }
    assertOnline(operationName) {
        if (this.isOfflineMode()) {
            throw new Error(`${operationName} is unavailable in offline mode.`);
        }
    }
    /**
     * Helper to decode HTML entities in web meta tags
     */
    decodeHtml(str) {
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
    parseCount(str) {
        if (str === undefined || str === null)
            return null;
        const clean = String(str).replace(/,/g, '').trim();
        if (clean === '')
            return null;
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
    async fetchLiveProfileMetadata(username) {
        this.assertOnline('Profile inspection');
        const cleanUser = username.replace(/^@/, '').trim();
        const url = `https://www.instagram.com/${cleanUser}/`;
        try {
            const headers = {
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
                let id = null;
                let followers = null;
                let following = null;
                let posts = null;
                let biography = null;
                let fullName = null;
                let profilePicUrl = null;
                let isVerified = null;
                let isPrivate = null;
                let isBusiness = null;
                let externalUrl = null;
                const metaDescMatch = data.match(/<meta\s+(?:name="description"|property="og:description")\s+content="([^"]*)"/i);
                if (metaDescMatch) {
                    const content = this.decodeHtml(metaDescMatch[1]);
                    const folMatch = content.match(/([0-9,KMkm.]+)\s*Followers/i);
                    const fowMatch = content.match(/([0-9,KMkm.]+)\s*Following/i);
                    const postMatch = content.match(/([0-9,KMkm.]+)\s*Posts/i);
                    if (folMatch)
                        followers = this.parseCount(folMatch[1]);
                    if (fowMatch)
                        following = this.parseCount(fowMatch[1]);
                    if (postMatch)
                        posts = this.parseCount(postMatch[1]);
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
                            const search = (obj) => {
                                if (!obj || typeof obj !== 'object')
                                    return;
                                if (typeof obj.username === 'string' && obj.username.toLowerCase() === cleanUser.toLowerCase()) {
                                    if (obj.id || obj.pk || obj.pk_id)
                                        id = String(obj.id || obj.pk || obj.pk_id);
                                    if (typeof obj.full_name === 'string' && obj.full_name.trim())
                                        fullName = obj.full_name.trim();
                                    if (typeof obj.profile_pic_url_hd === 'string' && obj.profile_pic_url_hd) {
                                        profilePicUrl = obj.profile_pic_url_hd;
                                    }
                                    else if (typeof obj.profile_pic_url === 'string' && obj.profile_pic_url) {
                                        profilePicUrl = obj.profile_pic_url;
                                    }
                                    if (typeof obj.biography === 'string' && obj.biography)
                                        biography = obj.biography;
                                    if (typeof obj.external_url === 'string' && obj.external_url)
                                        externalUrl = obj.external_url;
                                    if (typeof obj.follower_count === 'number') {
                                        followers = obj.follower_count;
                                    }
                                    else if (obj.edge_followed_by && typeof obj.edge_followed_by.count === 'number') {
                                        followers = obj.edge_followed_by.count;
                                    }
                                    if (typeof obj.following_count === 'number') {
                                        following = obj.following_count;
                                    }
                                    else if (obj.edge_follow && typeof obj.edge_follow.count === 'number') {
                                        following = obj.edge_follow.count;
                                    }
                                    if (typeof obj.media_count === 'number') {
                                        posts = obj.media_count;
                                    }
                                    else if (obj.edge_owner_to_timeline_media && typeof obj.edge_owner_to_timeline_media.count === 'number') {
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
                                    }
                                    else if (typeof obj.is_business_account === 'boolean') {
                                        isBusiness = obj.is_business_account;
                                    }
                                    else if (typeof obj.is_professional_account === 'boolean') {
                                        isBusiness = obj.is_professional_account;
                                    }
                                }
                                for (const k of Object.keys(obj))
                                    search(obj[k]);
                            };
                            search(json);
                        }
                        catch { }
                    }
                }
                return { id, followers, following, posts, biography, fullName, profilePicUrl, isVerified, isPrivate, isBusiness, externalUrl };
            }
            throw new Error(`Instagram returned HTTP ${res.status} (${res.statusText || 'Unexpected response'})`);
        }
        catch (err) {
            const msg = err?.message || err?.code || String(err || 'Connection failure');
            throw new Error(`Ghost Profile Error for @${cleanUser}: ${msg}`);
        }
    }
    /**
     * 1. Ghost Profile Inspection (100% Real, Zero Mock, Pure Guest Mode)
     */
    async getProfile(username) {
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
    async getTimelinePosts(params) {
        this.assertOnline('Timeline retrieval');
        const cleanUsername = (params.username || '').replace(/^@/, '').trim();
        let profile = params.profile || null;
        if (!profile && cleanUsername) {
            profile = await this.getProfile(cleanUsername);
        }
        const posts = [];
        const limit = params.limit || 12;
        let hasNextPage = false;
        let nextCursor = undefined;
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
                        const findContainer = (obj) => {
                            if (!obj || typeof obj !== 'object')
                                return null;
                            if (Array.isArray(obj.edges) && obj.edges.length > 0 && obj.edges[0]?.node) {
                                return { edges: obj.edges, page_info: obj.page_info };
                            }
                            for (const k of Object.keys(obj)) {
                                const r = findContainer(obj[k]);
                                if (r)
                                    return r;
                            }
                            return null;
                        };
                        const container = findContainer(json);
                        if (container && container.edges.length > 0) {
                            if (container.page_info) {
                                hasNextPage = Boolean(container.page_info.has_next_page);
                                nextCursor = container.page_info.end_cursor || undefined;
                            }
                            else {
                                hasNextPage = container.edges.length > limit;
                            }
                            for (const e of container.edges) {
                                const n = e.node;
                                const isVideo = n.media_type === 2 || n.__typename === 'XIGPolarisVideoMedia' || Boolean(n.is_video);
                                const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
                                const mediaProductType = isVideo ? 'REELS' : 'FEED';
                                // Apply feedType filter BEFORE limiting
                                if (params.feedType === 'reels' && mediaType !== 'VIDEO')
                                    continue;
                                if (params.feedType === 'posts' && mediaType === 'VIDEO')
                                    continue;
                                const shortcode = n.code || n.shortcode || '';
                                if (!shortcode)
                                    continue;
                                const captionText = n.caption?.text || n.accessibility_caption || '';
                                posts.push({
                                    id: String(n.id || n.pk || shortcode),
                                    shortcode,
                                    media_type: mediaType,
                                    media_product_type: mediaProductType,
                                    caption: captionText,
                                    timestamp: n.taken_at ? new Date(n.taken_at * 1000).toISOString() : undefined,
                                    like_count: typeof n.like_count === 'number' ? n.like_count : (n.edge_media_preview_like?.count ?? 0),
                                    comment_count: typeof n.comment_count === 'number' ? n.comment_count : (n.edge_media_to_comment?.count ?? 0),
                                    video_play_count: n.video_play_count || undefined,
                                    thumbnail_url: n.display_uri || n.display_url || '',
                                    permalink: `https://www.instagram.com/p/${shortcode}/`
                                });
                                if (posts.length >= limit)
                                    break;
                            }
                            break;
                        }
                    }
                    catch {
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
    async getMediaMetrics(mediaId) {
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
        let likes = null;
        let comments = null;
        let videoPlays = undefined;
        let jsonLikes;
        let jsonComments;
        let jsonPlays;
        let likesConflict = false;
        let commentsConflict = false;
        let playsConflict = false;
        let foundTargetJson = false;
        let caption = '';
        let timestamp = undefined;
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
                        const matchesRequestedMedia = (obj) => {
                            if (!obj || typeof obj !== 'object' || Array.isArray(obj))
                                return false;
                            const identifiers = [obj.shortcode, obj.code].filter((v) => typeof v === 'string' && v.length > 0);
                            return identifiers.length > 0 && identifiers.every(v => v === cleanId);
                        };
                        const findTarget = (obj) => {
                            if (!obj || typeof obj !== 'object')
                                return null;
                            if (!Array.isArray(obj) && obj.xdt_shortcode_media) {
                                const media = obj.xdt_shortcode_media;
                                if (media && typeof media === 'object' && !Array.isArray(media)) {
                                    const identifiers = [media.shortcode, media.code].filter((v) => typeof v === 'string' && v.length > 0);
                                    if (identifiers.length === 0 || matchesRequestedMedia(media)) {
                                        return media;
                                    }
                                }
                            }
                            if (!Array.isArray(obj) && matchesRequestedMedia(obj))
                                return obj;
                            for (const child of Object.values(obj)) {
                                const found = findTarget(child);
                                if (found)
                                    return found;
                            }
                            return null;
                        };
                        const media = findTarget(json);
                        if (media) {
                            const validCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
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
                            if (media.is_video === true)
                                mediaType = 'VIDEO';
                            if (typeof media.taken_at === 'number' && Number.isFinite(media.taken_at)) {
                                const date = new Date(media.taken_at * 1000);
                                if (!Number.isNaN(date.getTime()))
                                    timestamp = date.toISOString();
                            }
                            if (typeof media.caption?.text === 'string')
                                caption = media.caption.text;
                            else if (typeof media.caption === 'string')
                                caption = media.caption;
                            else if (typeof media.accessibility_caption === 'string' && !caption)
                                caption = media.accessibility_caption;
                        }
                    }
                    catch { }
                }
            }
        }
        if (foundTargetJson) {
            likes = likesConflict ? null : (jsonLikes ?? null);
            comments = commentsConflict ? null : (jsonComments ?? null);
            videoPlays = playsConflict ? undefined : jsonPlays;
        }
        const commentToLikeRatio = likes !== null && comments !== null && likes > 0
            ? Number((comments / likes).toFixed(4))
            : null;
        const engRate = likes !== null &&
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
    async getComments(mediaId, limit = 25) {
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
        const commentsList = [];
        if (res.data) {
            const jsonScripts = [...res.data.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi)];
            for (const s of jsonScripts) {
                const c = s[1];
                if (c.includes('XIGComment') || c.includes('edge_media_to_parent_comment')) {
                    try {
                        const json = JSON.parse(c);
                        const search = (obj) => {
                            if (!obj || typeof obj !== 'object')
                                return;
                            if ((obj.__typename === 'XIGComment' || obj.__typename === 'Comment') && obj.text) {
                                commentsList.push({
                                    id: String(obj.id || obj.pk || ''),
                                    username: obj.user?.username || obj.owner?.username || 'anonymous_user',
                                    text: obj.text,
                                    timestamp: obj.created_at ? new Date(obj.created_at * 1000).toISOString() : undefined,
                                    like_count: obj.comment_like_count ?? obj.edge_liked_by?.count ?? 0
                                });
                            }
                            for (const k of Object.keys(obj))
                                search(obj[k]);
                        };
                        search(json);
                    }
                    catch { }
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
    async search(query, type = 'all') {
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
    async getViralExplore(limit = 10, minCommentRatio) {
        this.assertOnline('Viral explore');
        return this.client.discovery.getViralExplore({ limit, minCommentRatio });
    }
    /**
     * 7. Comprehensive Ghost Audit Report (100% Real, Zero Fake Numbers)
     */
    async auditAccount(username, sampleCount = 15) {
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
        const reelsWithKnownPlays = reels.filter(r => typeof r.video_play_count === 'number' &&
            Number.isFinite(r.video_play_count) &&
            r.video_play_count >= 0);
        const totalPlays = reelsWithKnownPlays.reduce((acc, r) => acc + r.video_play_count, 0);
        const avgPlays = reelsWithKnownPlays.length > 0
            ? Math.round(totalPlays / reelsWithKnownPlays.length)
            : null;
        const totalLikes = posts.reduce((acc, p) => acc + p.like_count, 0);
        const avgLikes = posts.length > 0 ? Math.round(totalLikes / posts.length) : null;
        const totalComments = posts.reduce((acc, p) => acc + p.comment_count, 0);
        const avgComments = posts.length > 0 ? Math.round(totalComments / posts.length) : null;
        const hasFollowerDenominator = typeof profile.followers_count === 'number' && profile.followers_count > 0;
        const overallEng = hasFollowerDenominator && posts.length > 0 && avgLikes !== null && avgComments !== null
            ? Number((((avgLikes + avgComments) / profile.followers_count) * 100).toFixed(2))
            : null;
        // Rank top performing reels by plays or likes
        const sortedReels = [...reels].sort((a, b) => {
            const playsA = a.video_play_count || a.like_count || 0;
            const playsB = b.video_play_count || b.like_count || 0;
            return playsB - playsA;
        });
        const topPerformingReels = sortedReels.slice(0, 3).map(r => {
            const hasViewDenom = typeof r.video_play_count === 'number' && r.video_play_count > 0;
            const hasFollowerDenom = typeof profile.followers_count === 'number' && profile.followers_count > 0;
            let engRate = null;
            let engDenominator = null;
            if (hasViewDenom) {
                engRate = Number((((r.like_count + r.comment_count) / r.video_play_count) * 100).toFixed(2));
                engDenominator = 'views';
            }
            else if (hasFollowerDenom) {
                engRate = Number((((r.like_count + r.comment_count) / profile.followers_count) * 100).toFixed(2));
                engDenominator = 'followers';
            }
            return {
                id: r.id,
                shortcode: r.shortcode,
                plays: typeof r.video_play_count === 'number' ? r.video_play_count : null,
                likes: r.like_count,
                comments: r.comment_count,
                engagement_rate: engRate,
                engagement_rate_denominator: engDenominator,
                caption_snippet: r.caption ? r.caption.slice(0, 100) : '',
                permalink: r.permalink
            };
        });
        // Rank discussion driver posts by comments and comment-to-like ratio
        const sortedDiscussions = [...posts].sort((a, b) => {
            const ratioA = a.like_count > 0 ? (a.comment_count / a.like_count) : a.comment_count;
            const ratioB = b.like_count > 0 ? (b.comment_count / b.like_count) : b.comment_count;
            return (ratioB + b.comment_count) - (ratioA + a.comment_count);
        });
        const discussionDrivers = sortedDiscussions.slice(0, 3).map(p => ({
            id: p.id,
            shortcode: p.shortcode,
            comments: p.comment_count,
            comment_to_like_ratio: p.like_count > 0 ? Number((p.comment_count / p.like_count).toFixed(3)) : null,
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
                total_sampled_comments: totalComments,
                average_comments_per_post: avgComments,
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
