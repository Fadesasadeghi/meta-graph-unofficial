import { createHash } from 'node:crypto';
import { mkdir, open, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { AccountStore } from '../accounts/account_store.js';
import { MockInstagramProvider } from '../providers/mock_instagram_provider.js';

export interface CommentAccountBinding {
  accountId: string;
  providerAccountId: string;
  providerSource: 'mock';
  createdAt: string;
}

export class CommentAccountBindingStore {
  constructor(
    private readonly accounts: AccountStore,
    private readonly directory =
      process.env.INSTAGRAM_COMMENT_BINDINGS_DIR ||
      join(process.cwd(), 'data', 'instagram_comment_bindings')
  ) {}

  private hash(value: string): string {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }

  private async pathFor(
    ownerId: string,
    accountId: string
  ): Promise<string> {
    if (
      typeof ownerId !== 'string' ||
      !ownerId.trim() ||
      typeof accountId !== 'string' ||
      !accountId.trim()
    ) {
      throw new Error('Valid owner and account IDs required.');
    }

    const accounts = await this.accounts.list(ownerId);

    if (!accounts.some(item => item.id === accountId)) {
      throw new Error('Account not found for this owner.');
    }

    return join(
      resolve(this.directory),
      this.hash(ownerId),
      `${this.hash(accountId)}.json`
    );
  }

  async get(
    ownerId: string,
    accountId: string
  ): Promise<CommentAccountBinding | null> {
    const file = await this.pathFor(ownerId, accountId);

    let binding: CommentAccountBinding;

    try {
      binding = JSON.parse(
        await readFile(file, 'utf8')
      ) as CommentAccountBinding;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return null;
      }

      throw error;
    }

    if (
      binding.accountId !== accountId ||
      binding.providerSource !== 'mock' ||
      binding.providerAccountId !== 'demo-account-1'
    ) {
      throw new Error('Invalid account binding.');
    }

    return binding;
  }

  // Trusted setup only: do not expose this method as an MCP agent tool.
  async bindMock(
    ownerId: string,
    accountId: string,
    providerAccountId: string
  ): Promise<CommentAccountBinding> {
    const file = await this.pathFor(ownerId, accountId);

    if (providerAccountId !== 'demo-account-1') {
      throw new Error('Only the demo mock account is supported.');
    }

    const provider = new MockInstagramProvider();
    const profile = await provider.getProfile(providerAccountId);

    if (
      !profile.ok ||
      profile.source !== 'mock' ||
      profile.data.id !== providerAccountId
    ) {
      throw new Error('Mock provider account verification failed.');
    }

    const binding: CommentAccountBinding = {
      accountId,
      providerAccountId,
      providerSource: 'mock',
      createdAt: new Date().toISOString()
    };

    await mkdir(join(file, '..'), {
      recursive: true,
      mode: 0o700
    });

    let handle;

    try {
      handle = await open(file, 'wx', 0o600);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'EEXIST'
      ) {
        const existing = await this.get(ownerId, accountId);

        if (
          existing &&
          existing.providerAccountId === providerAccountId
        ) {
          return existing;
        }

        throw new Error('Account already has a different binding.');
      }

      throw error;
    }

    try {
      await handle.writeFile(
        JSON.stringify(binding, null, 2),
        'utf8'
      );
    } finally {
      await handle.close();
    }

    return binding;
  }
}
