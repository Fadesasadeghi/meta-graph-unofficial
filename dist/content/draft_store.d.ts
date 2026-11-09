export type DraftType = 'post' | 'story' | 'reel';
export interface InstagramDraft {
    id: string;
    type: DraftType;
    caption: string;
    mediaUrl?: string;
    hashtags: string[];
    status: 'draft';
    createdAt: string;
}
export interface CreateDraftInput {
    type: DraftType;
    caption: string;
    mediaUrl?: string;
    hashtags?: string[];
}
export declare class DraftStore {
    private readonly directory;
    constructor(directory?: string);
    create(input: CreateDraftInput): Promise<InstagramDraft>;
    list(): Promise<InstagramDraft[]>;
    update(id: string, changes: Partial<Pick<InstagramDraft, 'caption' | 'mediaUrl' | 'hashtags'>>): Promise<InstagramDraft>;
    get(id: string): Promise<InstagramDraft>;
}
