import type { InstagramDataProvider, InstagramProfileData, InstagramMediaData, InstagramMediaInsights, InstagramCommentData, InstagramListOptions, InstagramPage, ProviderResult } from './instagram_provider.js';
export declare class MockInstagramProvider implements InstagramDataProvider {
    readonly source: 'mock';
    private success;
    private failure;
    private account;
    private paginate;
    getProfile(accountId: string): Promise<ProviderResult<InstagramProfileData>>;
    listMedia(accountId: string, options?: InstagramListOptions): Promise<ProviderResult<InstagramPage<InstagramMediaData>>>;
    getMediaInsights(accountId: string, mediaId: string): Promise<ProviderResult<InstagramMediaInsights>>;
    listComments(accountId: string, mediaId: string, options?: InstagramListOptions): Promise<ProviderResult<InstagramPage<InstagramCommentData>>>;
}
