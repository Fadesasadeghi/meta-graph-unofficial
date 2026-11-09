import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DraftStore } from '../dist/content/draft_store.js';
import { resolveScheduleTime } from '../dist/content/schedule_time.js';

test('Instagram scheduling: conversion, persistence and cancellation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'instagram-scheduling-test-'));

  try {
    const store = new DraftStore(directory);

    const draft = await store.create({
      type: 'post',
      caption: 'Scheduling test'
    });

    const scheduled = await store.schedule(
      draft.id,
      '2027-11-10T20:00',
      'Asia/Tehran'
    );

    assert.equal(scheduled.status, 'scheduled');
    assert.equal(scheduled.scheduledAt, '2027-11-10T16:30:00.000Z');
    assert.equal(scheduled.timezone, 'Asia/Tehran');

    const edited = await store.update(draft.id, {
      caption: 'Updated caption'
    });

    assert.equal(edited.status, 'scheduled');
    assert.equal(edited.scheduledAt, scheduled.scheduledAt);

    const reloaded = await new DraftStore(directory).get(draft.id);
    assert.equal(reloaded.status, 'scheduled');

    const cancelled = await store.cancelSchedule(draft.id);
    assert.equal(cancelled.status, 'draft');
    assert.equal(cancelled.scheduledAt, undefined);
    assert.equal(cancelled.timezone, undefined);
    assert.equal(cancelled.localDateTime, undefined);

    const now = new Date('2026-11-09T00:00:00Z');

    assert.throws(
      () => resolveScheduleTime('2026-11-08T20:00', 'Asia/Tehran', now),
      /future/
    );

    assert.throws(
      () => resolveScheduleTime('2027-03-28T02:30', 'Europe/Berlin', now),
      /ambiguous/
    );

    assert.throws(
      () => resolveScheduleTime('2027-10-31T02:30', 'Europe/Berlin', now),
      /ambiguous/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
