import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  InstagramAccount,
  InstagramAccountType,
  getLocalCapabilities
} from './types.js';

export interface CreateAccountInput {
  ownerId: string;
  username: string;
  accountType: InstagramAccountType;
}

export class AccountStore {
  private readonly directory: string;

  constructor(
    directory = process.env.INSTAGRAM_ACCOUNTS_DIR ||
      join(process.cwd(), 'data', 'instagram_accounts')
  ) {
    this.directory = resolve(directory);
  }

  private ownerDirectory(ownerId: string): string {
    if (typeof ownerId !== 'string' || !ownerId.trim()) {
      throw new Error('Valid ownerId is required.');
    }

    const key = createHash('sha256')
      .update(ownerId)
      .digest('hex');

    return join(this.directory, key);
  }

  async create(input: CreateAccountInput): Promise<InstagramAccount> {
    const directory = this.ownerDirectory(input.ownerId);

    if (
      typeof input.username !== 'string' ||
      !/^[a-zA-Z0-9._]{1,30}$/.test(input.username)
    ) {
      throw new Error('Invalid Instagram username.');
    }

    if (
      !['personal', 'creator', 'business', 'unknown']
        .includes(input.accountType)
    ) {
      throw new Error('Invalid account type.');
    }

    const now = new Date().toISOString();

    const account: InstagramAccount = {
      id: randomUUID(),
      ownerId: input.ownerId,
      username: input.username,
      accountType: input.accountType,
      connectionStatus: 'local',
      capabilities: getLocalCapabilities(),
      createdAt: now,
      updatedAt: now
    };

    await mkdir(directory, { recursive: true, mode: 0o700 });

    const file = join(directory, `${account.id}.json`);
    const handle = await open(file, 'wx', 0o600);

    try {
      await handle.writeFile(
        JSON.stringify(account, null, 2),
        'utf8'
      );
    } finally {
      await handle.close();
    }

    return account;
  }

  async list(ownerId: string): Promise<InstagramAccount[]> {
    const directory = this.ownerDirectory(ownerId);

    let files: string[];

    try {
      files = await readdir(directory);
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }

    const accounts: InstagramAccount[] = [];

    for (const file of files) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(file)) continue;

      const raw = await readFile(join(directory, file), 'utf8');
      const account = JSON.parse(raw) as InstagramAccount;

      if (account.ownerId !== ownerId) {
        throw new Error('Account owner mismatch.');
      }

      accounts.push(account);
    }

    return accounts.sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }
}
