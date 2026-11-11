import type {
  InstagramDataProvider,
  InstagramCommentData
} from '../providers/instagram_provider.js';

export class VerifiedCommentLookup {
  constructor(
    private readonly provider: InstagramDataProvider
  ) {}

  async find(
    providerAccountId: string,
    mediaId: string,
    commentId: string
  ): Promise<InstagramCommentData> {
    if (
      typeof providerAccountId !== 'string' ||
      !providerAccountId.trim() ||
      typeof mediaId !== 'string' ||
      !mediaId.trim() ||
      typeof commentId !== 'string' ||
      !commentId.trim()
    ) {
      throw new Error('Valid account, media and comment IDs required.');
    }

    if (this.provider.source !== 'mock') {
      throw new Error('Only MOCK verification is supported.');
    }

    const profile = await this.provider.getProfile(providerAccountId);

    if (
      !profile.ok ||
      profile.source !== 'mock' ||
      profile.data.id !== providerAccountId
    ) {
      throw new Error('Provider account could not be verified.');
    }

    let cursor: string | undefined;
    const visited = new Set<string>();

    for (let page = 0; page < 100; page++) {
      const result = await this.provider.listComments(
        providerAccountId,
        mediaId,
        { limit: 100, cursor }
      );

      if (!result.ok || result.source !== 'mock') {
        throw new Error('Comment lookup could not be verified.');
      }

      const match = result.data.items.find(
        item => item.id === commentId
      );

      if (match) {
        if (match.mediaId !== mediaId) {
          throw new Error('Comment media ownership mismatch.');
        }

        return { ...match };
      }

      const next = result.data.nextCursor;

      if (next === null) {
        throw new Error('Comment not found.');
      }

      if (
        typeof next !== 'string' ||
        visited.has(next)
      ) {
        throw new Error('Invalid comment pagination.');
      }

      visited.add(next);
      cursor = next;
    }

    throw new Error('Comment verification incomplete.');
  }
}
