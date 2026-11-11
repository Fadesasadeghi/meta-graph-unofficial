import type { ProviderResult } from './instagram_provider.js';
import type { InstagramActionProvider, InstagramActionCapabilities, PublishContentRequest, PublishContentResult, ReplyToCommentRequest, SendDirectMessageRequest, InstagramActionResult, InstagramDirectMessage } from './instagram_action_provider.js';
export declare class MockInstagramActionProvider implements InstagramActionProvider {
    readonly source: 'mock';
    private readonly completed;
    private success;
    private failure;
    private validText;
    private validUrl;
    private execute;
    getCapabilities(accountId: string): Promise<ProviderResult<InstagramActionCapabilities>>;
    publishContent(request: PublishContentRequest): Promise<ProviderResult<PublishContentResult>>;
    replyToComment(request: ReplyToCommentRequest): Promise<ProviderResult<InstagramActionResult>>;
    listDirectMessages(accountId: string, conversationId: string): Promise<ProviderResult<InstagramDirectMessage[]>>;
    sendDirectMessage(request: SendDirectMessageRequest): Promise<ProviderResult<InstagramActionResult>>;
}
