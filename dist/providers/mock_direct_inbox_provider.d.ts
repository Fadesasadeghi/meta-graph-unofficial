import type { ProviderResult } from './instagram_provider.js';
import type { InstagramDirectMessage } from './instagram_action_provider.js';
export declare class MockDirectInboxProvider {
    readonly source: 'mock';
    private readonly accountId;
    private readonly conversations;
    private validId;
    private success;
    private failure;
    listConversationIds(accountId: string): Promise<ProviderResult<string[]>>;
    listDirectMessages(accountId: string, conversationId: string): Promise<ProviderResult<InstagramDirectMessage[]>>;
}
