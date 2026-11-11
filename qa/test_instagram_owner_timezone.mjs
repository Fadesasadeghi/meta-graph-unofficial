import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { OwnerTimezoneStore } from '../dist/settings/owner_timezone_store.js';

test('Instagram owner timezones: isolation and persistence', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'instagram-owner-timezone-')
  );

  try {
    const store = new OwnerTimezoneStore(directory);

    const userA = store.forOwner('user-a');
    const userB = store.forOwner('user-b');

    assert.equal(await userA.get(), null);
    assert.equal(await userB.get(), null);

    await userA.set('Asia/Tehran');
    await userB.set('Europe/Berlin');

    assert.deepEqual(await userA.get(), {
      timezone: 'Asia/Tehran',
      confirmed: true
    });

    assert.deepEqual(await userB.get(), {
      timezone: 'Europe/Berlin',
      confirmed: true
    });

    await userA.set('Australia/Sydney');

    assert.equal(
      (await userA.get()).timezone,
      'Australia/Sydney'
    );

    assert.equal(
      (await userB.get()).timezone,
      'Europe/Berlin'
    );

    const reloaded = new OwnerTimezoneStore(directory);

    assert.equal(
      (await reloaded.forOwner('user-a').get()).timezone,
      'Australia/Sydney'
    );

    assert.equal(
      (await reloaded.forOwner('user-b').get()).timezone,
      'Europe/Berlin'
    );

    assert.throws(
      () => store.forOwner(''),
      /Valid ownerId/
    );

    console.log('PASS: Owner timezone isolation.');
    console.log('PASS: Timezone updates stay independent.');
    console.log('PASS: Timezones persist after reload.');
    console.log('PASS: Empty owner IDs are rejected.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
