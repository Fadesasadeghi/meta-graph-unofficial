import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export type DraftType = 'post' | 'story' | 'reel';

export interface InstagramDraft {
  id: string;
  type: DraftType;
  caption: string;
  mediaUrl?: string;
  hashtags: string[];
  status: 'draft';
  createdAt: string;
}

export interface CreateDraftInput {
  type: DraftType;
  caption: string;
  mediaUrl?: string;
  hashtags?: string[];
}

export class DraftStore {
  private readonly directory: string;

  constructor(directory = process.env.INSTAGRAM_DRAFT_DIR
    || join(process.cwd(), 'data', 'instagram_drafts')) {
    this.directory = resolve(directory);
  }

  async create(input: CreateDraftInput): Promise<InstagramDraft> {
    if (!['post', 'story', 'reel'].includes(input.type)) {
      throw new Error('Invalid draft type.');
    }

    if (typeof input.caption !== 'string' || input.caption.length > 2200) {
      throw new Error('Caption must be a string of at most 2200 characters.');
    }

    if (input.mediaUrl !== undefined &&
        (typeof input.mediaUrl !== 'string' ||
         !/^https?:\/\//i.test(input.mediaUrl))) {
      throw new Error('mediaUrl must be an HTTP or HTTPS URL.');
    }

    if (input.hashtags !== undefined &&
        (!Array.isArray(input.hashtags) ||
         input.hashtags.some(tag => typeof tag !== 'string'))) {
      throw new Error('hashtags must be an array of strings.');
    }

    const draft: InstagramDraft = {
      id: randomUUID(),
      type: input.type,
      caption: input.caption,
      ...(input.mediaUrl ? { mediaUrl: input.mediaUrl } : {}),
      hashtags: input.hashtags ?? [],
      status: 'draft',
      createdAt: new Date().toISOString()
    };

    const file = join(this.directory, `${draft.id}.json`);

    await mkdir(dirname(file), { recursive: true, mode: 0o700 });

    const handle = await open(file, 'wx', 0o600);

    try {
      await handle.writeFile(JSON.stringify(draft, null, 2), 'utf8');
    } finally {
      await handle.close();
    }

    return draft;
  }

  async list(): Promise<InstagramDraft[]> {
    let files: string[];

    try {
      files = await readdir(this.directory);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const drafts: InstagramDraft[] = [];

    for (const file of files) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(file)) {
        continue;
      }

      const content = await readFile(
        join(this.directory, file),
        'utf8'
      );

      drafts.push(JSON.parse(content) as InstagramDraft);
    }

    return drafts.sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }

  async update(
    id: string,
    changes: Partial<Pick<InstagramDraft, 'caption' | 'mediaUrl' | 'hashtags'>>
  ): Promise<InstagramDraft> {
    const current = await this.get(id);

    if (changes.caption !== undefined &&
        (typeof changes.caption !== 'string' ||
         changes.caption.length > 2200)) {
      throw new Error('Caption must be a string of at most 2200 characters.');
    }

    if (changes.mediaUrl !== undefined &&
        (typeof changes.mediaUrl !== 'string' ||
         !/^https?:\/\//i.test(changes.mediaUrl))) {
      throw new Error('mediaUrl must be an HTTP or HTTPS URL.');
    }

    if (changes.hashtags !== undefined &&
        (!Array.isArray(changes.hashtags) ||
         changes.hashtags.some(tag => typeof tag !== 'string'))) {
      throw new Error('hashtags must be an array of strings.');
    }

    const updated: InstagramDraft = {
      ...current,
      ...changes,
      id: current.id,
      type: current.type,
      status: 'draft',
      createdAt: current.createdAt
    };

    const file = join(this.directory, `${id}.json`);
    const temporary = join(this.directory, `${id}.${randomUUID()}.tmp`);

    const handle = await open(temporary, 'wx', 0o600);

    try {
      await handle.writeFile(JSON.stringify(updated, null, 2), 'utf8');
    } finally {
      await handle.close();
    }

    try {
      await rename(temporary, file);
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }

    return updated;
  }

  async get(id: string): Promise<InstagramDraft> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      throw new Error('Invalid draft ID.');
    }

    const file = join(this.directory, `${id}.json`);
    return JSON.parse(await readFile(file, 'utf8')) as InstagramDraft;
  }
}
