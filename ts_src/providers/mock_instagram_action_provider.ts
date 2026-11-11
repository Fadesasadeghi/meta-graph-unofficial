import { randomUUID } from 'node:crypto';

import type { ProviderResult } from './instagram_provider.js';

import type {
  InstagramActionProvider,
  InstagramActionCapabilities,
  PublishContentRequest,
  PublishContentResult,
  ReplyToCommentRequest,
  SendDirectMessageRequest,
  InstagramActionResult,
  InstagramDirectMessage
} from './instagram_action_provider.js';

type ActionOutput =
  | PublishContentResult
  | InstagramActionResult;

export class MockInstagramActionProvider
  implements InstagramActionProvider {

  readonly source = 'mock' as const;

  private readonly completed = new Map<
    string,
    { payload: string; data: ActionOutput }
  >();

  private success<T>(data: T): ProviderResult<T> {
    return {
      ok: true,
      data,
      source: 'mock',
      fetchedAt: new Date().toISOString()
    };
  }

  private failure<T>(
    message: string
  ): ProviderResult<T> {
    return {
      ok: false,
      source: 'mock',
      error: {
        code: 'INVALID_REQUEST',
        message,
        retryable: false
      }
    };
  }

  private validText(value: unknown): value is string {
    return typeof value === 'string' &&
      value.trim().length > 0;
  }

  private validUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;

    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  private execute<T extends ActionOutput>(
    operation: string,
    accountId: string,
    idempotencyKey: string,
    input: object,
    create: () => T
  ): ProviderResult<T> {
    if (
      !this.validText(accountId) ||
      !this.validText(idempotencyKey)
    ) {
      return this.failure(
        'Valid accountId and idempotencyKey are required.'
      );
    }

    const key = JSON.stringify([
      operation,
      accountId,
      idempotencyKey
    ]);

    const payload = JSON.stringify(input);
    const existing = this.completed.get(key);

    if (existing) {
      if (existing.payload !== payload) {
        return this.failure(
          'Idempotency key was already used with different content.'
        );
      }

      return this.success(existing.data as T);
    }

    const data = create();

    this.completed.set(key, { payload, data });

    return this.success(data);
  }

  async getCapabilities(
    accountId: string
  ): Promise<ProviderResult<InstagramActionCapabilities>> {
    if (!this.validText(accountId)) {
      return this.failure('Valid accountId is required.');
    }

    return this.success({
      publishPost: true,
      publishStory: true,
      publishReel: true,
      replyToComment: true,
      readDirectMessages: true,
      sendDirectMessage: true
    });
  }

  async publishContent(
    request: PublishContentRequest
  ): Promise<ProviderResult<PublishContentResult>> {
    if (
      !['post', 'story', 'reel'].includes(request.type) ||
      !this.validUrl(request.mediaUrl) ||
      (
        request.caption !== undefined &&
        typeof request.caption !== 'string'
      )
    ) {
      return this.failure('Invalid publishing request.');
    }

    return this.execute(
      'publish',
      request.accountId,
      request.idempotencyKey,
      request,
      () => ({
        accountId: request.accountId,
        mediaId: `mock-${randomUUID()}`,
        type: request.type,
        simulated: true
      })
    );
  }

  async replyToComment(
    request: ReplyToCommentRequest
  ): Promise<ProviderResult<InstagramActionResult>> {
    if (
      !this.validText(request.commentId) ||
      !this.validText(request.text)
    ) {
      return this.failure('Valid commentId and text are required.');
    }

    return this.execute(
      'comment-reply',
      request.accountId,
      request.idempotencyKey,
      request,
      () => ({
        actionId: `mock-${randomUUID()}`,
        simulated: true
      })
    );
  }

  async listDirectMessages(
    accountId: string,
    conversationId: string
  ): Promise<ProviderResult<InstagramDirectMessage[]>> {
    if (
      !this.validText(accountId) ||
      !this.validText(conversationId)
    ) {
      return this.failure(
        'Valid accountId and conversationId are required.'
      );
    }

    return this.success([]);
  }

  async sendDirectMessage(
    request: SendDirectMessageRequest
  ): Promise<ProviderResult<InstagramActionResult>> {
    if (
      !this.validText(request.conversationId) ||
      !this.validText(request.text)
    ) {
      return this.failure(
        'Valid conversationId and text are required.'
      );
    }

    return this.execute(
      'direct-message',
      request.accountId,
      request.idempotencyKey,
      request,
      () => ({
        actionId: `mock-${randomUUID()}`,
        simulated: true
      })
    );
  }
}
