export type InstagramDataSource = 'mock' | 'live';

export type InstagramMediaType =
  | 'image'
  | 'video'
  | 'carousel'
  | 'reel';

export type InstagramProviderErrorCode =
  | 'NOT_CONNECTED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'UNSUPPORTED'
  | 'INVALID_REQUEST';

export interface InstagramProviderError {
  code: InstagramProviderErrorCode;
  message: string;
  retryable: boolean;
}

export type ProviderResult<T> =
  | {
      ok: true;
      data: T;
      source: InstagramDataSource;
      fetchedAt: string;
    }
  | {
      ok: false;
      error: InstagramProviderError;
      source: InstagramDataSource;
    };

export interface InstagramProfileData {
  id: string;
  username: string;
  fullName: string | null;
  biography: string | null;
  followersCount: number | null;
  followingCount: number | null;
  mediaCount: number | null;
  isVerified: boolean | null;
}

export interface InstagramMediaData {
  id: string;
  accountId: string;
  type: InstagramMediaType;
  caption: string | null;
  publishedAt: string;
  permalink: string | null;
  likeCount: number | null;
  commentCount: number | null;
}

export interface InstagramMediaInsights {
  mediaId: string;
  reach: number | null;
  impressions: number | null;
  plays: number | null;
  saves: number | null;
  shares: number | null;
}

export interface InstagramCommentData {
  id: string;
  mediaId: string;
  text: string;
  createdAt: string;
  username: string | null;
}

export interface InstagramPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface InstagramListOptions {
  limit?: number;
  cursor?: string;
}

export interface InstagramDataProvider {
  readonly source: InstagramDataSource;

  getProfile(
    accountId: string
  ): Promise<ProviderResult<InstagramProfileData>>;

  listMedia(
    accountId: string,
    options?: InstagramListOptions
  ): Promise<ProviderResult<InstagramPage<InstagramMediaData>>>;

  getMediaInsights(
    accountId: string,
    mediaId: string
  ): Promise<ProviderResult<InstagramMediaInsights>>;

  listComments(
    accountId: string,
    mediaId: string,
    options?: InstagramListOptions
  ): Promise<ProviderResult<InstagramPage<InstagramCommentData>>>;
}
