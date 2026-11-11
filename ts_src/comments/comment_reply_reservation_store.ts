import { createHash } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { AccountStore } from '../accounts/account_store.js';

export interface CommentReplyReservation {
  accountId: string;
  commentId: string;
  status: 'reserved' | 'duplicate';
  simulated: true;
}

export class CommentReplyReservationStore {
  constructor(
    private readonly accounts: AccountStore,
    private readonly directory =
      process.env.INSTAGRAM_COMMENT_RESERVATIONS_DIR ||
      join(process.cwd(), 'data', 'instagram_comment_reservations')
  ) {}

  async reserve(
    ownerId: string,
    accountId: string,
    commentId: string
  ): Promise<CommentReplyReservation> {
    if (
      typeof ownerId !== 'string' ||
      !ownerId.trim() ||
      typeof accountId !== 'string' ||
      !accountId.trim() ||
      typeof commentId !== 'string' ||
      !commentId.trim() ||
      commentId.length > 256
    ) {
      throw new Error('Valid owner, account and comment IDs required.');
    }

    const ownedAccounts = await this.accounts.list(ownerId);

    if (!ownedAccounts.some(account => account.id === accountId)) {
      throw new Error('Account not found for this owner.');
    }

    const hash = (value: string) =>
      createHash('sha256')
        .update(value)
        .digest('hex');

    const folder = join(
      resolve(this.directory),
      hash(ownerId),
      hash(accountId)
    );

    await mkdir(folder, {
      recursive: true,
      mode: 0o700
    });

    const file = join(folder, `${hash(commentId)}.json`);

    let handle;

    try {
      handle = await open(file, 'wx', 0o600);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'EEXIST'
      ) {
        return {
          accountId,
          commentId,
          status: 'duplicate',
          simulated: true
        };
      }

      throw error;
    }

    try {
      await handle.writeFile(
        JSON.stringify({
          ownerId,
          accountId,
          commentId,
          status: 'reserved',
          createdAt: new Date().toISOString()
        }, null, 2),
        'utf8'
      );
    } finally {
      await handle.close();
    }

    return {
      accountId,
      commentId,
      status: 'reserved',
      simulated: true
    };
  }
}
