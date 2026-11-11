import type { InstagramDataProvider, InstagramCommentData } from '../providers/instagram_provider.js';
export declare class VerifiedCommentLookup {
    private readonly provider;
    constructor(provider: InstagramDataProvider);
    find(providerAccountId: string, mediaId: string, commentId: string): Promise<InstagramCommentData>;
}
