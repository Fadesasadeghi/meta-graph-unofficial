import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  rename,
  writeFile
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { VerifiedCommentReplyService } from './verified_comment_reply_service.js';
import { MockInstagramActionProvider } from '../providers/mock_instagram_action_provider.js';

export interface AutoCommentExecutionResult {
  accountId: string;
  providerAccountId: string;
  commentId: string;
  status: 'completed' | 'blocked';
  simulated: true;
  resultId: string | null;
  reason: string;
  executedAt: string | null;
}

export class MockAutoCommentExecutor {
  private readonly provider = new MockInstagramActionProvider();

  constructor(
    private readonly verifiedReplies: VerifiedCommentReplyService,
    private readonly directory =
      process.env.INSTAGRAM_AUTO_COMMENT_EXECUTIONS_DIR ||
      join(process.cwd(), 'data', 'instagram_auto_comment_executions')
  ) {}

  private hash(value: string): string {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }

  async execute(
    ownerId: string,
    accountId: string,
    mediaId: string,
    commentId: string
  ): Promise<AutoCommentExecutionResult> {
    // Read the comment from the trusted MOCK provider.
    const first = await this.verifiedReplies.preview(
      ownerId,
      accountId,
      mediaId,
      commentId
    );

    if (
      first.providerSource !== 'mock' ||
      first.mode !== 'auto' ||
      !first.suggestedReply
    ) {
      throw new Error('Comment is not eligible for automatic reply.');
    }

    // Shared across internal accounts bound to the same provider account.
    const folder = join(
      resolve(this.directory),
      this.hash(first.providerAccountId)
    );

    await mkdir(folder, {
      recursive: true,
      mode: 0o700
    });

    const file = join(
      folder,
      `${this.hash(commentId)}.json`
    );

    let handle;

    try {
      handle = await open(file, 'wx', 0o600);
    } catch (error: unknown) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'EEXIST'
      ) {
        throw error;
      }

      let existing: AutoCommentExecutionResult;

      try {
        existing = JSON.parse(
          await readFile(file, 'utf8')
        ) as AutoCommentExecutionResult;
      } catch {
        throw new Error(
          'Execution status is uncertain; reconciliation required.'
        );
      }

      const validCompleted =
        existing.status === 'completed' &&
        typeof existing.resultId === 'string' &&
        existing.resultId.startsWith('mock-') &&
        typeof existing.executedAt === 'string' &&
        Number.isFinite(Date.parse(existing.executedAt));

      const validBlocked =
        existing.status === 'blocked' &&
        existing.resultId === null &&
        existing.executedAt === null;

      if (
        typeof existing.accountId !== 'string' ||
        !existing.accountId.trim() ||
        existing.commentId !== commentId ||
        existing.providerAccountId !== first.providerAccountId ||
        existing.simulated !== true ||
        typeof existing.reason !== 'string' ||
        !existing.reason.trim() ||
        !(validCompleted || validBlocked)
      ) {
        throw new Error(
          'Execution status is uncertain; reconciliation required.'
        );
      }

      return existing;
    }

    try {
      await handle.writeFile(
        JSON.stringify({
          status: 'claimed',
          accountId,
          providerAccountId: first.providerAccountId,
          commentId,
          claimedAt: new Date().toISOString()
        }),
        'utf8'
      );
    } finally {
      await handle.close();
    }

    // Re-evaluate the actual provider comment and current settings
    // after obtaining the exclusive execution claim.
    // Live execution will require stronger transactional coordination.
    const latest = await this.verifiedReplies.preview(
      ownerId,
      accountId,
      mediaId,
      commentId
    );

    let receipt: AutoCommentExecutionResult;

    if (
      latest.mode !== 'auto' ||
      !latest.suggestedReply ||
      latest.providerAccountId !== first.providerAccountId
    ) {
      receipt = {
        accountId,
        providerAccountId: first.providerAccountId,
        commentId,
        status: 'blocked',
        simulated: true,
        resultId: null,
        reason: 'Automatic reply was disabled or changed.',
        executedAt: null
      };
    } else {
      const result = await this.provider.replyToComment({
        accountId: first.providerAccountId,
        commentId,
        text: latest.suggestedReply,
        idempotencyKey: this.hash(
          `${first.providerAccountId}:${commentId}`
        )
      });

      if (
        !result.ok ||
        result.source !== 'mock' ||
        result.data.simulated !== true
      ) {
        throw new Error(
          'Mock execution failed; reconciliation required.'
        );
      }

      receipt = {
        accountId,
        providerAccountId: first.providerAccountId,
        commentId,
        status: 'completed',
        simulated: true,
        resultId: result.data.actionId,
        reason: 'Approved template executed in MOCK mode.',
        executedAt: new Date().toISOString()
      };
    }

    const temp = join(folder, `${randomUUID()}.tmp`);

    await writeFile(
      temp,
      JSON.stringify(receipt, null, 2),
      { mode: 0o600 }
    );

    await rename(temp, file);

    return receipt;
  }
}
