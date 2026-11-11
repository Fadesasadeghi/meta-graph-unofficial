export class VerifiedCommentReplyService {
    bindings;
    lookup;
    replies;
    constructor(bindings, lookup, replies) {
        this.bindings = bindings;
        this.lookup = lookup;
        this.replies = replies;
    }
    async preview(ownerId, accountId, mediaId, commentId) {
        if (typeof ownerId !== 'string' ||
            !ownerId.trim() ||
            typeof accountId !== 'string' ||
            !accountId.trim() ||
            typeof mediaId !== 'string' ||
            !mediaId.trim() ||
            typeof commentId !== 'string' ||
            !commentId.trim()) {
            throw new Error('Valid owner, account, media and comment IDs required.');
        }
        // Ownership is enforced by the binding store.
        const binding = await this.bindings.get(ownerId, accountId);
        if (!binding ||
            binding.providerSource !== 'mock') {
            throw new Error('A verified MOCK account binding is required.');
        }
        // Never trust comment text supplied by an agent.
        const comment = await this.lookup.find(binding.providerAccountId, mediaId, commentId);
        // Uses the internal account's own reply settings.
        const decision = await this.replies.preview(ownerId, accountId, {
            commentId: comment.id,
            text: comment.text
        });
        return {
            ...decision,
            mediaId: comment.mediaId,
            providerAccountId: binding.providerAccountId,
            commentText: comment.text,
            commentUsername: comment.username,
            providerSource: 'mock',
            simulated: true,
            executed: false,
            message: 'Verified MOCK preview only. No reply was sent.'
        };
    }
}
