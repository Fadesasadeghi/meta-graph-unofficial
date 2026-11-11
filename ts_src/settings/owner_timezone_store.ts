import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { TimezoneStore } from './timezone_store.js';

export class OwnerTimezoneStore {
  private readonly directory: string;

  constructor(
    directory = process.env.INSTAGRAM_OWNER_SETTINGS_DIR ||
      join(process.cwd(), 'data', 'instagram_owner_settings')
  ) {
    this.directory = resolve(directory);
  }

  forOwner(ownerId: string): TimezoneStore {
    if (typeof ownerId !== 'string' || !ownerId.trim()) {
      throw new Error('Valid ownerId is required.');
    }

    const ownerHash = createHash('sha256')
      .update(ownerId)
      .digest('hex');

    return new TimezoneStore(
      join(this.directory, ownerHash, 'timezone.json')
    );
  }
}
