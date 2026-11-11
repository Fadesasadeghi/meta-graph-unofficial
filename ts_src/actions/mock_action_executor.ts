import { createHash } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  rename,
  writeFile
} from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { ActionQueue } from './action_queue.js';
import { ActionApprovalStore } from './action_approval_store.js';
import { MockInstagramActionProvider } from '../providers/mock_instagram_action_provider.js';

export interface MockExecutionReceipt {
  actionId: string;
  accountId: string;
  status: 'completed';
  simulated: true;
  resultId: string | null;
  executedAt: string;
}

export class MockActionExecutor {
  private readonly provider = new MockInstagramActionProvider();

  constructor(
    private readonly queue: ActionQueue,
    private readonly approvals: ActionApprovalStore,
    private readonly directory =
      process.env.INSTAGRAM_ACTION_EXECUTIONS_DIR ||
      join(process.cwd(), 'data', 'instagram_action_executions')
  ) {}

  async execute(
    ownerId: string,
    accountId: string,
    actionId: string
  ): Promise<MockExecutionReceipt> {
    const actions = await this.queue.list(ownerId, accountId);
    const action = actions.find(item => item.id === actionId);

    if (!action) {
      throw new Error('Action not found for this account.');
    }

    const approval = await this.approvals.get(
      ownerId,
      accountId,
      actionId
    );

    if (!approval || approval.decision !== 'approved') {
      throw new Error('Action is not approved.');
    }

    const ownerHash = createHash('sha256')
      .update(ownerId)
      .digest('hex');

    const accountHash = createHash('sha256')
      .update(accountId)
      .digest('hex');

    const folder = join(
      resolve(this.directory),
      ownerHash,
      accountHash
    );

    await mkdir(folder, {
      recursive: true,
      mode: 0o700
    });

    const file = join(folder, `${actionId}.json`);

    // Exclusive claim: a second execution cannot start.
    let handle;

    try {
      handle = await open(file, 'wx', 0o600);
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;

      let existing: MockExecutionReceipt;

      try {
        existing = JSON.parse(
          await readFile(file, 'utf8')
        );
      } catch {
        throw new Error(
          'Execution is in progress or requires reconciliation.'
        );
      }

      if (
        existing.status !== 'completed' ||
        existing.actionId !== actionId ||
        existing.accountId !== accountId ||
        existing.simulated !== true
      ) {
        throw new Error(
          'Execution is in progress or requires reconciliation.'
        );
      }

      return existing;
    }

    try {
      await handle.writeFile(
        JSON.stringify({
          actionId,
          accountId,
          status: 'claimed',
          claimedAt: new Date().toISOString()
        }),
        'utf8'
      );
    } finally {
      await handle.close();
    }

    const idempotencyKey = action.idempotencyKey;

    let result;

    if (action.action.kind === 'publish') {
      result = await this.provider.publishContent({
        accountId,
        type: action.action.type,
        mediaUrl: action.action.mediaUrl,
        caption: action.action.caption,
        idempotencyKey
      });
    } else if (action.action.kind === 'comment_reply') {
      result = await this.provider.replyToComment({
        accountId,
        commentId: action.action.commentId,
        text: action.action.text,
        idempotencyKey
      });
    } else if (action.action.kind === 'direct_message') {
      result = await this.provider.sendDirectMessage({
        accountId,
        conversationId: action.action.conversationId,
        text: action.action.text,
        idempotencyKey
      });
    } else {
      throw new Error('Unsupported action.');
    }

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    if (result.source !== 'mock' || !result.data.simulated) {
      throw new Error('Executor accepts simulated results only.');
    }

    const resultId =
      'mediaId' in result.data
        ? result.data.mediaId
        : result.data.actionId;

    const receipt: MockExecutionReceipt = {
      actionId,
      accountId,
      status: 'completed',
      simulated: true,
      resultId,
      executedAt: new Date().toISOString()
    };

    const tempFile = join(
      folder,
      `${actionId}.${process.pid}.tmp`
    );

    await writeFile(
      tempFile,
      JSON.stringify(receipt, null, 2),
      { mode: 0o600 }
    );

    await rename(tempFile, file);

    return receipt;
  }
}
