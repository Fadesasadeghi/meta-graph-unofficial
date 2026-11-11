import type { InstagramDataSource, ProviderResult } from './instagram_provider.js';
export type InstagramPublishType = 'post' | 'story' | 'reel';
export interface InstagramActionCapabilities {
    publishPost: boolean;
    publishStory: boolean;
    publishReel: boolean;
    replyToComment: boolean;
    readDirectMessages: boolean;
    sendDirectMessage: boolean;
}
export interface PublishContentRequest {
    accountId: string;
    type: InstagramPublishType;
    mediaUrl: string;
    caption?: string;
    idempotencyKey: string;
}
export interface PublishContentResult {
    accountId: string;
    mediaId: string | null;
    type: InstagramPublishType;
    simulated: boolean;
}
export interface ReplyToCommentRequest {
    accountId: string;
    commentId: string;
    text: string;
    idempotencyKey: string;
}
export interface SendDirectMessageRequest {
    accountId: string;
    conversationId: string;
    text: string;
    idempotencyKey: string;
}
export interface InstagramActionResult {
    actionId: string | null;
    simulated: boolean;
}
export interface InstagramDirectMessage {
    id: string;
    conversationId: string;
    senderId: string;
    text: string;
    createdAt: string;
}
export interface InstagramActionProvider {
    readonly source: InstagramDataSource;
    getCapabilities(accountId: string): Promise<ProviderResult<InstagramActionCapabilities>>;
    publishContent(request: PublishContentRequest): Promise<ProviderResult<PublishContentResult>>;
    replyToComment(request: ReplyToCommentRequest): Promise<ProviderResult<InstagramActionResult>>;
    listDirectMessages(accountId: string, conversationId: string): Promise<ProviderResult<InstagramDirectMessage[]>>;
    sendDirectMessage(request: SendDirectMessageRequest): Promise<ProviderResult<InstagramActionResult>>;
}
