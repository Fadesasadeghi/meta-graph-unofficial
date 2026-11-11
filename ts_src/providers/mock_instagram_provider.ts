import type {
  InstagramDataProvider,
  InstagramProfileData,
  InstagramMediaData,
  InstagramMediaInsights,
  InstagramCommentData,
  InstagramListOptions,
  InstagramPage,
  ProviderResult,
  InstagramProviderErrorCode
} from './instagram_provider.js';

type MockAccount = {
  profile: InstagramProfileData;
  media: InstagramMediaData[];
  insights: Record<string, InstagramMediaInsights>;
  comments: Record<string, InstagramCommentData[]>;
};

const MOCK_ACCOUNTS: Record<string, MockAccount> = {
  'demo-account-1': {
    profile: {
      id: 'demo-account-1',
      username: 'demo.creator',
      fullName: 'Demo Creator',
      biography: 'Demo data for Instagram analytics testing',
      followersCount: 12500,
      followingCount: 530,
      mediaCount: 3,
      isVerified: false
    },
    media: [
      {
        id: 'demo-post-1',
        accountId: 'demo-account-1',
        type: 'reel',
        caption: 'Behind the scenes of our latest project',
        publishedAt: '2026-11-01T12:00:00.000Z',
        permalink: null,
        likeCount: 1250,
        commentCount: 85
      },
      {
        id: 'demo-post-2',
        accountId: 'demo-account-1',
        type: 'image',
        caption: 'A new creative idea',
        publishedAt: '2026-11-03T15:00:00.000Z',
        permalink: null,
        likeCount: 680,
        commentCount: 42
      },
      {
        id: 'demo-post-3',
        accountId: 'demo-account-1',
        type: 'carousel',
        caption: 'Five useful tips',
        publishedAt: '2026-11-05T18:00:00.000Z',
        permalink: null,
        likeCount: null,
        commentCount: 30
      }
    ],
    insights: {
      'demo-post-1': {
        mediaId: 'demo-post-1',
        reach: 18200,
        impressions: 22400,
        plays: 25100,
        saves: 410,
        shares: 265
      },
      'demo-post-2': {
        mediaId: 'demo-post-2',
        reach: 9100,
        impressions: 11500,
        plays: null,
        saves: 130,
        shares: 72
      },
      'demo-post-3': {
        mediaId: 'demo-post-3',
        reach: null,
        impressions: null,
        plays: null,
        saves: 95,
        shares: 38
      }
    },
    comments: {
      'demo-post-1': [
        {
          id: 'demo-comment-1',
          mediaId: 'demo-post-1',
          text: 'Great content!',
          createdAt: '2026-11-02T09:00:00.000Z',
          username: 'sample.viewer'
        }
      ],
      'demo-post-2': [],
      'demo-post-3': []
    }
  }
};

export class MockInstagramProvider implements InstagramDataProvider {
  readonly source = 'mock' as const;

  private success<T>(data: T): ProviderResult<T> {
    return {
      ok: true,
      data,
      source: this.source,
      fetchedAt: new Date().toISOString()
    };
  }

  private failure<T>(
    code: InstagramProviderErrorCode,
    message: string
  ): ProviderResult<T> {
    return {
      ok: false,
      source: this.source,
      error: { code, message, retryable: false }
    };
  }

  private account(accountId: string): MockAccount | undefined {
    return MOCK_ACCOUNTS[accountId];
  }

  private paginate<T>(
    items: T[],
    options: InstagramListOptions = {}
  ): ProviderResult<InstagramPage<T>> {
    const limit = options.limit ?? 25;
    const start = options.cursor === undefined
      ? 0
      : Number(options.cursor);

    if (
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(start) || start < 0
    ) {
      return this.failure('INVALID_REQUEST', 'Invalid pagination parameters.');
    }

    const page = items.slice(start, start + limit);
    const next = start + limit;

    return this.success({
      items: page,
      nextCursor: next < items.length ? String(next) : null
    });
  }

  async getProfile(
    accountId: string
  ): Promise<ProviderResult<InstagramProfileData>> {
    const account = this.account(accountId);

    if (!account) {
      return this.failure('NOT_FOUND', 'Mock account not found.');
    }

    return this.success({ ...account.profile });
  }

  async listMedia(
    accountId: string,
    options?: InstagramListOptions
  ): Promise<ProviderResult<InstagramPage<InstagramMediaData>>> {
    const account = this.account(accountId);

    if (!account) {
      return this.failure('NOT_FOUND', 'Mock account not found.');
    }

    return this.paginate(
      account.media.map(item => ({ ...item })),
      options
    );
  }

  async getMediaInsights(
    accountId: string,
    mediaId: string
  ): Promise<ProviderResult<InstagramMediaInsights>> {
    const account = this.account(accountId);

    if (!account) {
      return this.failure('NOT_FOUND', 'Mock account not found.');
    }

    const insights = account.insights[mediaId];

    if (!insights) {
      return this.failure('NOT_FOUND', 'Mock media not found.');
    }

    return this.success({ ...insights });
  }

  async listComments(
    accountId: string,
    mediaId: string,
    options?: InstagramListOptions
  ): Promise<ProviderResult<InstagramPage<InstagramCommentData>>> {
    const account = this.account(accountId);

    if (!account) {
      return this.failure('NOT_FOUND', 'Mock account not found.');
    }

    if (!account.media.some(item => item.id === mediaId)) {
      return this.failure('NOT_FOUND', 'Mock media not found.');
    }

    return this.paginate(
      (account.comments[mediaId] ?? []).map(item => ({ ...item })),
      options
    );
  }
}
