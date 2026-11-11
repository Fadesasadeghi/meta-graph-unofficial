import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLocalOwnerId,
  LocalOwnerNotConfiguredError
} from '../dist/accounts/local_owner.js';

test('Instagram local owner: requires server configuration', () => {
  assert.throws(
    () => getLocalOwnerId({}),
    LocalOwnerNotConfiguredError
  );

  assert.throws(
    () => getLocalOwnerId({
      INSTAGRAM_LOCAL_OWNER_ID: '   '
    }),
    LocalOwnerNotConfiguredError
  );

  assert.equal(
    getLocalOwnerId({
      INSTAGRAM_LOCAL_OWNER_ID: 'user-a'
    }),
    'user-a'
  );

  assert.equal(
    getLocalOwnerId({
      INSTAGRAM_LOCAL_OWNER_ID: '  user-b  '
    }),
    'user-b'
  );
});
