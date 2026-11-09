import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TimezoneStore } from '../dist/settings/timezone_store.js';

test('Instagram timezone: manual configuration and persistence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'instagram-tz-test-'));

  try {
    const file = join(directory, 'timezone.json');
    const store = new TimezoneStore(file);

    assert.equal(await store.get(), null);

    const saved = await store.set('Europe/Berlin');
    assert.equal(saved.timezone, 'Europe/Berlin');
    assert.equal(saved.confirmed, true);

    const reloaded = await new TimezoneStore(file).get();
    assert.equal(reloaded?.timezone, 'Europe/Berlin');
    assert.equal(reloaded?.confirmed, true);

    await assert.rejects(
      store.set('Invalid/Timezone'),
      /Invalid timezone/
    );

    const unchanged = await store.get();
    assert.equal(unchanged?.timezone, 'Europe/Berlin');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
