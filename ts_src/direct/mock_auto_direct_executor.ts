import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { MockInstagramActionProvider } from '../providers/mock_instagram_action_provider.js';
import { VerifiedDirectReplyService } from './verified_direct_reply_service.js';

export interface AutoDirectExecutionResult {
  accountId: string;
  providerAccountId: string;
  conversationId: string;
  messageId: string;
  status: 'completed' | 'blocked';
  simulated: true;
  resultId: string | null;
  reason: string;
  executedAt: string | null;
}

export class MockAutoDirectExecutor {
  private readonly provider = new MockInstagramActionProvider();

  constructor(
    private readonly verified: VerifiedDirectReplyService,
    private readonly directory =
      process.env.INSTAGRAM_AUTO_DIRECT_EXECUTIONS_DIR ||
      join(process.cwd(), 'data', 'instagram_auto_direct_executions')
  ) {}

  private hash(value: string): string {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }

  private validReceipt(
    value: unknown,
    providerAccountId: string,
    conversationId: string,
    messageId: string
  ): value is AutoDirectExecutionResult {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const item = value as Partial<AutoDirectExecutionResult>;

    const validCompleted =
      item.status === 'completed' &&
      typeof item.resultId === 'string' &&
      item.resultId.startsWith('mock-') &&
      typeof item.executedAt === 'string' &&
      Number.isFinite(Date.parse(item.executedAt));

    const validBlocked =
      item.status === 'blocked' &&
      item.resultId === null &&
      item.executedAt === null;

    return (
      typeof item.accountId === 'string' &&
      !!item.accountId.trim() &&
      item.providerAccountId === providerAccountId &&
      item.conversationId === conversationId &&
      item.messageId === messageId &&
      item.simulated === true &&
      typeof item.reason === 'string' &&
      !!item.reason.trim() &&
      (validCompleted || validBlocked)
    );
  }

  async execute(
    ownerId: string,
    accountId: string,
    conversationId: string,
    messageId: string
  ): Promise<AutoDirectExecutionResult> {
    const first = await this.verified.preview(
      ownerId,
      accountId,
      conversationId,
      messageId
    );

    if (
      first.providerSource !== 'mock' ||
      first.mode !== 'auto' ||
      !first.reply
    ) {
      throw new Error(
        'Direct message is not eligible for automatic reply.'
      );
    }

    // One shared claim per provider account, conversation, and message.
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
      `${this.hash(
        JSON.stringify([conversationId, messageId])
      )}.json`
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

      let existing: unknown;

      try {
        existing = JSON.parse(
          await readFile(file, 'utf8')
        );
      } catch {
        throw new Error(
          'Direct execution status uncertain; reconciliation required.'
        );
      }

      if (
        !this.validReceipt(
          existing,
          first.providerAccountId,
          conversationId,
          messageId
        )
      ) {
        throw new Error(
          'Direct execution status uncertain; reconciliation required.'
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
          conversationId,
          messageId,
          claimedAt: new Date().toISOString()
        }),
        'utf8'
      );
    } finally {
      await handle.close();
    }

    // Recheck after taking the exclusive claim.
    // Real Instagram sending needs stronger transactional controls.
    const latest = await this.verified.preview(
      ownerId,
      accountId,
      conversationId,
      messageId
    );

    let receipt: AutoDirectExecutionResult;

    if (
      latest.mode !== 'auto' ||
      !latest.reply ||
      latest.providerAccountId !== first.providerAccountId ||
      latest.messageText !== first.messageText ||
      latest.senderId !== first.senderId
    ) {
      receipt = {
        accountId,
        providerAccountId: first.providerAccountId,
        conversationId,
        messageId,
        status: 'blocked',
        simulated: true,
        resultId: null,
        reason: 'Permission or verified message changed.',
        executedAt: null
      };
    } else {
      const result = await this.provider.sendDirectMessage({
        accountId: first.providerAccountId,
        conversationId,
        text: latest.reply,
        idempotencyKey: this.hash(
          JSON.stringify([
            first.providerAccountId,
            conversationId,
            messageId
          ])
        )
      });

      if (
        !result.ok ||
        result.source !== 'mock' ||
        result.data.simulated !== true ||
        typeof result.data.actionId !== 'string'
      ) {
        throw new Error(
          'Mock direct execution failed; reconciliation required.'
        );
      }

      receipt = {
        accountId,
        providerAccountId: first.providerAccountId,
        conversationId,
        messageId,
        status: 'completed',
        simulated: true,
        resultId: result.data.actionId,
        reason: 'Approved direct template executed in MOCK mode.',
        executedAt: new Date().toISOString()
      };
    }

    const temp = join(folder, `${randomUUID()}.tmp`);

    try {
      await writeFile(
        temp,
        JSON.stringify(receipt, null, 2),
        { mode: 0o600 }
      );

      await rename(temp, file);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => {});
      throw error;
    }

    return receipt;
  }
}
