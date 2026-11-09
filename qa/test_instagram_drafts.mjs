import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DraftStore } from '../dist/content/draft_store.js';

test('Instagram drafts: create, list, update and persist', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'instagram-drafts-'));

  try {
    const store = new DraftStore(directory);

    const original = await store.create({
      type: 'post',
      caption: 'متن اولیه',
      hashtags: ['قدیمی']
    });

    const listed = await store.list();

    assert.equal(listed.length, 1);
    assert.equal(listed[0].id, original.id);

    const updated = await store.update(original.id, {
      caption: 'هوش مصنوعی در زندگی روزمره',
      hashtags: ['هوش_مصنوعی', 'فناوری']
    });

    assert.equal(updated.id, original.id);
    assert.equal(updated.createdAt, original.createdAt);

    const saved = await store.get(original.id);

    assert.equal(saved.caption, 'هوش مصنوعی در زندگی روزمره');
    assert.deepEqual(saved.hashtags, ['هوش_مصنوعی', 'فناوری']);

    await assert.rejects(
      () => store.update(original.id, {
        caption: 'x'.repeat(2201)
      }),
      /Caption/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
