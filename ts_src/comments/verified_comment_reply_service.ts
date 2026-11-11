import { CommentAccountBindingStore } from './comment_account_binding_store.js';
import { VerifiedCommentLookup } from './verified_comment_lookup.js';
import { CommentReplyService } from './comment_reply_service.js';

export class VerifiedCommentReplyService {
  constructor(
    private readonly bindings: CommentAccountBindingStore,
    private readonly lookup: VerifiedCommentLookup,
    private readonly replies: CommentReplyService
  ) {}

  async preview(
    ownerId: string,
    accountId: string,
    mediaId: string,
    commentId: string
  ) {
    if (
      typeof ownerId !== 'string' ||
      !ownerId.trim() ||
      typeof accountId !== 'string' ||
      !accountId.trim() ||
      typeof mediaId !== 'string' ||
      !mediaId.trim() ||
      typeof commentId !== 'string' ||
      !commentId.trim()
    ) {
      throw new Error(
        'Valid owner, account, media and comment IDs required.'
      );
    }

    // Ownership is enforced by the binding store.
    const binding = await this.bindings.get(
      ownerId,
      accountId
    );

    if (
      !binding ||
      binding.providerSource !== 'mock'
    ) {
      throw new Error(
        'A verified MOCK account binding is required.'
      );
    }

    // Never trust comment text supplied by an agent.
    const comment = await this.lookup.find(
      binding.providerAccountId,
      mediaId,
      commentId
    );

    // Uses the internal account's own reply settings.
    const decision = await this.replies.preview(
      ownerId,
      accountId,
      {
        commentId: comment.id,
        text: comment.text
      }
    );

    return {
      ...decision,
      mediaId: comment.mediaId,
      providerAccountId: binding.providerAccountId,
      commentText: comment.text,
      commentUsername: comment.username,
      providerSource: 'mock' as const,
      simulated: true as const,
      executed: false as const,
      message: 'Verified MOCK preview only. No reply was sent.'
    };
  }
}
