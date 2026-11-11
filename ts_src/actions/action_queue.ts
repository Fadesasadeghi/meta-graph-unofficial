import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { AccountStore } from '../accounts/account_store.js';

export type QueuedAction =
  | {
      kind: 'publish';
      type: 'post' | 'story' | 'reel';
      mediaUrl: string;
      caption?: string;
    }
  | {
      kind: 'comment_reply';
      commentId: string;
      text: string;
    }
  | {
      kind: 'direct_message';
      conversationId: string;
      text: string;
    };

export interface ActionQueueRecord {
  id: string;
  accountId: string;
  ownerId: string;
  idempotencyKey: string;
  action: QueuedAction;
  status: 'pending_approval';
  createdAt: string;
}

export class ActionQueue {
  constructor(
    private readonly accounts: AccountStore,
    private readonly directory =
      process.env.INSTAGRAM_ACTION_QUEUE_DIR ||
      join(process.cwd(), 'data', 'instagram_action_queue')
  ) {}

  private async accountDirectory(
    ownerId: string,
    accountId: string
  ): Promise<string> {
    if (typeof ownerId !== 'string' || !ownerId.trim()) {
      throw new Error('Valid ownerId is required.');
    }

    const owned = await this.accounts.list(ownerId);

    if (!owned.some(account => account.id === accountId)) {
      throw new Error('Account not found for this owner.');
    }

    const ownerHash = createHash('sha256')
      .update(ownerId)
      .digest('hex');

    return join(resolve(this.directory), ownerHash, accountId);
  }

  private validate(action: QueuedAction): void {
    if (!action || typeof action !== 'object') {
      throw new Error('Invalid action.');
    }

    if (action.kind === 'publish') {
      if (!['post', 'story', 'reel'].includes(action.type)) {
        throw new Error('Invalid publish type.');
      }

      if (
        typeof action.mediaUrl !== 'string' ||
        !/^https?:\/\/[^/]+/i.test(action.mediaUrl)
      ) {
        throw new Error('Valid media URL is required.');
      }

      if (
        action.caption !== undefined &&
        (typeof action.caption !== 'string' ||
          action.caption.length > 2200)
      ) {
        throw new Error('Invalid caption.');
      }

      return;
    }

    if (action.kind === 'comment_reply') {
      if (
        typeof action.commentId !== 'string' ||
        !action.commentId.trim() ||
        typeof action.text !== 'string' ||
        !action.text.trim()
      ) {
        throw new Error('Invalid comment reply.');
      }

      return;
    }

    if (action.kind === 'direct_message') {
      if (
        typeof action.conversationId !== 'string' ||
        !action.conversationId.trim() ||
        typeof action.text !== 'string' ||
        !action.text.trim()
      ) {
        throw new Error('Invalid direct message.');
      }

      return;
    }

    throw new Error('Unsupported action kind.');
  }

  async enqueue(
    ownerId: string,
    accountId: string,
    idempotencyKey: string,
    action: QueuedAction
  ): Promise<ActionQueueRecord> {
    const directory = await this.accountDirectory(
      ownerId,
      accountId
    );

    if (
      typeof idempotencyKey !== 'string' ||
      !idempotencyKey.trim()
    ) {
      throw new Error('Valid idempotencyKey is required.');
    }

    this.validate(action);

    await mkdir(directory, {
      recursive: true,
      mode: 0o700
    });

    const keyHash = createHash('sha256')
      .update(idempotencyKey)
      .digest('hex');

    const file = join(directory, `${keyHash}.json`);

    const record: ActionQueueRecord = {
      id: randomUUID(),
      ownerId,
      accountId,
      idempotencyKey,
      action,
      status: 'pending_approval',
      createdAt: new Date().toISOString()
    };

    let handle;

    try {
      handle = await open(file, 'wx', 0o600);
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error;

      const existing = JSON.parse(
        await readFile(file, 'utf8')
      ) as ActionQueueRecord;

      if (
        existing.ownerId !== ownerId ||
        existing.accountId !== accountId ||
        existing.idempotencyKey !== idempotencyKey ||
        JSON.stringify(existing.action) !== JSON.stringify(action)
      ) {
        throw new Error(
          'Idempotency key already belongs to a different action.'
        );
      }

      return existing;
    }

    try {
      await handle.writeFile(
        JSON.stringify(record, null, 2),
        'utf8'
      );
    } finally {
      await handle.close();
    }

    return record;
  }

  async list(
    ownerId: string,
    accountId: string
  ): Promise<ActionQueueRecord[]> {
    const directory = await this.accountDirectory(
      ownerId,
      accountId
    );

    let files: string[];

    try {
      files = await readdir(directory);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }

    const records: ActionQueueRecord[] = [];

    for (const file of files) {
      if (!/^[0-9a-f]{64}\.json$/.test(file)) continue;

      const record = JSON.parse(
        await readFile(join(directory, file), 'utf8')
      ) as ActionQueueRecord;

      if (
        record.ownerId !== ownerId ||
        record.accountId !== accountId
      ) {
        throw new Error('Action ownership mismatch.');
      }

      records.push(record);
    }

    return records.sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }
}
