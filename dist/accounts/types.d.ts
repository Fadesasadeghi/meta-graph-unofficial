export type InstagramAccountType = 'personal' | 'creator' | 'business' | 'unknown';
export type InstagramConnectionStatus = 'local' | 'pending' | 'connected' | 'expired' | 'revoked';
export type InstagramCapability = 'drafts' | 'scheduling' | 'publish_post' | 'publish_reel' | 'publish_story' | 'manage_comments' | 'manage_messages' | 'read_insights';
export interface InstagramAccount {
    id: string;
    ownerId: string;
    username: string;
    accountType: InstagramAccountType;
    connectionStatus: InstagramConnectionStatus;
    capabilities: InstagramCapability[];
    metaUserId?: string;
    createdAt: string;
    updatedAt: string;
}
export declare function getLocalCapabilities(): InstagramCapability[];
