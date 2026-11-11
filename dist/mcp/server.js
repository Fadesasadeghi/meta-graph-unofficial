#!/usr/bin/env node
import { MockInstagramProvider as AutoCommentDataProvider } from '../providers/mock_instagram_provider.js';
import { CommentAccountBindingStore as AutoCommentBindings } from '../comments/comment_account_binding_store.js';
import { VerifiedCommentLookup as AutoCommentLookup } from '../comments/verified_comment_lookup.js';
import { CommentReplySettingsStore as AutoCommentSettings } from '../comments/comment_reply_settings_store.js';
import { CommentReplyService as AutoCommentReplyService } from '../comments/comment_reply_service.js';
import { VerifiedCommentReplyService as AutoCommentVerifiedService } from '../comments/verified_comment_reply_service.js';
import { MockAutoCommentExecutor as AutoCommentExecutor } from '../comments/mock_auto_comment_executor.js';
import { AccountStore as CommentPreviewAccountStore } from '../accounts/account_store.js';
import { CommentReplySettingsStore as CommentPreviewSettingsStore } from '../comments/comment_reply_settings_store.js';
import { CommentReplyService as CommentPreviewService } from '../comments/comment_reply_service.js';
/**
 * Meta Graph Unofficial - Ghost Mode MCP Server
 *
 * Standards-compliant Model Context Protocol (MCP) tool provider.
 * Exposes 100% anonymous, read-only Instagram intelligence tools to AI agents.
 *
 * Complies with Meta Graph API v21.0 specs, Xiaomi Redmi Note 13 4G telemetry,
 * and zero-footprint Ghost Mode constraints.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { GhostService } from './ghost_service.js';
import { MockInstagramProvider } from '../providers/mock_instagram_provider.js';
import { InstagramAnalyticsService } from '../analytics/instagram_analytics_service.js';
import { InstagramGrowthAdvisor } from '../advisor/instagram_growth_advisor.js';
import { GrowthDraftPreparer } from '../advisor/growth_draft_preparer.js';
import { adaptGrowthAdviceForAccount } from '../advisor/adaptive_account_advisor.js';
import { DraftStore } from '../content/draft_store.js';
import { TimezoneStore } from '../settings/timezone_store.js';
import { AccountStore } from '../accounts/account_store.js';
import { AccountDraftStore } from '../accounts/account_draft_store.js';
import { ExperimentStore } from '../experiments/experiment_store.js';
import { evaluateExperiment } from '../experiments/experiment_evaluator.js';
import { ActionQueue } from '../actions/action_queue.js';
import { ActionApprovalStore } from '../actions/action_approval_store.js';
import { getLocalOwnerId } from '../accounts/local_owner.js';
import { OwnerTimezoneStore } from '../settings/owner_timezone_store.js';
// Initialize the Ghost Service (wraps TwinGraph & Mobile/Web Twins)
const ghost = new GhostService();
const drafts = new DraftStore();
const timezones = new TimezoneStore();
const accounts = new AccountStore();
const actionQueue = new ActionQueue(accounts);
const actionApprovals = new ActionApprovalStore(accounts, actionQueue);
const accountDrafts = new AccountDraftStore(accounts);
const experiments = new ExperimentStore(accounts);
const ownerTimezones = new OwnerTimezoneStore();
const SERVER_NAME = 'meta-graph-ghost-mcp';
const SERVER_VERSION = '1.0.0';
const server = new Server({
    name: SERVER_NAME,
    version: SERVER_VERSION
}, {
    capabilities: {
        tools: {}
    }
});
// 1. Tool Definitions
const GHOST_TOOLS = [
    {
        name: 'instagram_execute_mock_auto_comment_reply',
        description: 'Execute a previously authorized comment reply in MOCK simulation only. Never contacts Instagram.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                mediaId: { type: 'string' },
                commentId: { type: 'string' }
            },
            required: ['accountId', 'mediaId', 'commentId'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_preview_comment_reply',
        description: 'Preview a rule-based Instagram comment reply using per-account settings. Never sends a reply.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                commentId: { type: 'string' },
                text: { type: 'string', maxLength: 2000 }
            },
            required: ['accountId', 'commentId', 'text'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_list_mock_comments',
        description: 'List MOCK comments for a demo Instagram post. Read-only. Does not access real Instagram comments.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: {
                    type: 'string',
                    enum: ['demo-account-1']
                },
                mediaId: { type: 'string' },
                limit: {
                    type: 'number',
                    minimum: 1,
                    maximum: 50
                },
                cursor: { type: 'string' }
            },
            required: ['accountId', 'mediaId'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_queue_action',
        description: 'Queue an Instagram action for independent user approval. Does not execute, publish or send anything.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                idempotencyKey: { type: 'string' },
                action: {
                    oneOf: [
                        {
                            type: 'object',
                            properties: {
                                kind: { type: 'string', enum: ['publish'] },
                                type: {
                                    type: 'string',
                                    enum: ['post', 'story', 'reel']
                                },
                                mediaUrl: { type: 'string' },
                                caption: { type: 'string' }
                            },
                            required: ['kind', 'type', 'mediaUrl'],
                            additionalProperties: false
                        },
                        {
                            type: 'object',
                            properties: {
                                kind: {
                                    type: 'string',
                                    enum: ['comment_reply']
                                },
                                commentId: { type: 'string' },
                                text: { type: 'string' }
                            },
                            required: ['kind', 'commentId', 'text'],
                            additionalProperties: false
                        },
                        {
                            type: 'object',
                            properties: {
                                kind: {
                                    type: 'string',
                                    enum: ['direct_message']
                                },
                                conversationId: { type: 'string' },
                                text: { type: 'string' }
                            },
                            required: ['kind', 'conversationId', 'text'],
                            additionalProperties: false
                        }
                    ]
                }
            },
            required: ['accountId', 'idempotencyKey', 'action'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_list_pending_actions',
        description: 'Read queued actions and their approval decisions for an owned Instagram account. Read-only.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' }
            },
            required: ['accountId'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_get_action_status',
        description: 'Read the queue and approval status of an Instagram action. This tool does not confirm execution.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                actionId: { type: 'string' }
            },
            required: ['accountId', 'actionId'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_adaptive_growth_advice',
        description: 'Generate adaptive growth advice for an owned local account using explicitly labeled MOCK recommendations and the account\'s stored experiment history. Read-only; does not publish.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' }
            },
            required: ['accountId'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_create_growth_experiment',
        description: 'Create a local growth experiment for an owned Instagram account. No publishing.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                adviceExperimentId: { type: 'string' },
                title: { type: 'string' },
                hypothesis: { type: 'string' },
                metric: {
                    type: 'string',
                    enum: ['engagement_rate', 'reach', 'plays', 'saves', 'shares', 'comments']
                },
                baseline: {
                    type: 'object',
                    properties: {
                        value: { type: 'number', minimum: 0 },
                        measuredAt: { type: 'string' },
                        source: { type: 'string', enum: ['mock', 'live'] },
                        mediaId: { type: 'string' }
                    },
                    required: ['value', 'measuredAt', 'source'],
                    additionalProperties: false
                },
                notes: { type: 'string' }
            },
            required: ['accountId', 'adviceExperimentId', 'title', 'hypothesis', 'metric'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_list_growth_experiments',
        description: 'List stored experiments and their evaluations for an owned account.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' }
            },
            required: ['accountId'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_update_growth_experiment',
        description: 'Change experiment status and optionally save its outcome. No publishing.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                experimentId: { type: 'string' },
                status: {
                    type: 'string',
                    enum: ['running', 'completed', 'cancelled']
                },
                outcome: {
                    type: 'object',
                    properties: {
                        value: { type: 'number', minimum: 0 },
                        measuredAt: { type: 'string' },
                        source: { type: 'string', enum: ['mock', 'live'] },
                        mediaId: { type: 'string' }
                    },
                    required: ['value', 'measuredAt', 'source'],
                    additionalProperties: false
                }
            },
            required: ['accountId', 'experimentId', 'status'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_update_account_draft',
        description: 'Update a local draft for a specified registered account. Does not publish anything.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                id: { type: 'string' },
                caption: { type: 'string' },
                mediaUrl: { type: 'string' },
                hashtags: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['accountId', 'id'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_get_owner_timezone',
        description: 'Get the confirmed timezone for the configured local owner. No Instagram connection.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: 'instagram_set_owner_timezone',
        description: 'Save a timezone explicitly confirmed by the local user. Do not change without user confirmation.',
        inputSchema: {
            type: 'object',
            properties: {
                timezone: { type: 'string' }
            },
            required: ['timezone'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_schedule_account_draft',
        description: 'Schedule a draft locally for the specified account using the confirmed owner timezone. Does not publish.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                id: { type: 'string' },
                localDateTime: { type: 'string' }
            },
            required: ['accountId', 'id', 'localDateTime'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_cancel_account_schedule',
        description: 'Cancel local scheduling of a draft belonging to the specified account. Does not publish.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                id: { type: 'string' }
            },
            required: ['accountId', 'id'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_create_account_draft',
        description: 'Create a local draft for a specified registered Instagram account. Does not publish or connect to Instagram.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' },
                type: {
                    type: 'string',
                    enum: ['post', 'story', 'reel']
                },
                caption: { type: 'string' },
                mediaUrl: { type: 'string' },
                hashtags: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['accountId', 'type', 'caption'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_list_account_drafts',
        description: 'List local drafts belonging to one registered Instagram account. Does not publish anything.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: { type: 'string' }
            },
            required: ['accountId'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_add_local_account',
        description: 'Register an Instagram account label locally for the configured owner. Does not connect to Instagram, verify ownership or grant publishing access. Ask for explicit user confirmation before registering.',
        inputSchema: {
            type: 'object',
            properties: {
                username: { type: 'string' },
                accountType: {
                    type: 'string',
                    enum: ['personal', 'creator', 'business', 'unknown']
                }
            },
            required: ['username', 'accountType'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_list_local_accounts',
        description: 'List locally registered Instagram account labels for the configured owner. These are not authenticated Instagram connections.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: 'instagram_schedule_draft',
        description: 'Schedule an existing Instagram draft locally using the user-confirmed timezone. Never publishes content. If timezone is not confirmed, ask the user to set it first.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'ID of the existing draft.'
                },
                localDateTime: {
                    type: 'string',
                    description: 'Future local date and time in YYYY-MM-DDTHH:mm format, using the confirmed user timezone.'
                }
            },
            required: ['id', 'localDateTime'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_cancel_schedule',
        description: 'Cancel local scheduling for an existing Instagram draft. Does not publish or delete anything.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'ID of the draft whose schedule should be cancelled.'
                }
            },
            required: ['id'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_get_timezone',
        description: 'Get the confirmed local timezone setting and detect a suggested system timezone. If not confirmed, ask the user to confirm or manually enter an IANA timezone before scheduling.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: 'instagram_set_timezone',
        description: 'Save or change the local timezone explicitly chosen or confirmed by the user. Never call this tool without user confirmation. Accepts IANA timezones such as Asia/Tehran or Europe/Berlin.',
        inputSchema: {
            type: 'object',
            properties: {
                timezone: {
                    type: 'string',
                    description: 'User-confirmed IANA timezone, e.g. Asia/Tehran.'
                }
            },
            required: ['timezone'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_update_draft',
        description: 'Update an existing local Instagram draft. Does not publish anything.',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'ID of the existing draft.'
                },
                caption: {
                    type: 'string',
                    description: 'New caption, maximum 2200 characters.'
                },
                mediaUrl: {
                    type: 'string',
                    description: 'New HTTP or HTTPS media URL.'
                },
                hashtags: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['id']
        }
    },
    {
        name: 'instagram_list_drafts',
        description: 'List locally saved Instagram drafts. Does not publish anything.',
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: 'instagram_create_draft',
        description: 'Save a local Instagram post, story, or reel draft. Does not publish anything.',
        inputSchema: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['post', 'story', 'reel']
                },
                caption: {
                    type: 'string',
                    description: 'Caption text, maximum 2200 characters.'
                },
                mediaUrl: {
                    type: 'string',
                    description: 'Optional HTTP or HTTPS media URL.'
                },
                hashtags: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['type', 'caption']
        }
    },
    {
        name: 'instagram_preview_growth_draft',
        description: 'Prepare an editable content draft preview from MOCK Growth Advisor evidence. Does not save, schedule or publish.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: {
                    type: 'string',
                    enum: ['demo-account-1']
                },
                experimentId: {
                    type: 'string',
                    enum: [
                        'repeat-top-content-pattern',
                        'reel-format-experiment'
                    ]
                },
                type: {
                    type: 'string',
                    enum: ['post', 'story', 'reel']
                }
            },
            required: ['accountId', 'experimentId', 'type'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_growth_advice',
        description: 'Generate evidence-based content growth experiments for a MOCK demo account only. No real Instagram connection and no publishing.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: {
                    type: 'string',
                    enum: ['demo-account-1'],
                    description: 'Mock account ID'
                }
            },
            required: ['accountId'],
            additionalProperties: false
        }
    },
    {
        name: 'instagram_analyze_account',
        description: 'Analyze a DEMO Instagram account using MOCK data only. No real Instagram connection. Returns engagement metrics, content mix, ranked posts, data quality, and recommendations.',
        inputSchema: {
            type: 'object',
            properties: {
                accountId: {
                    type: 'string',
                    description: 'Mock account ID. Currently only demo-account-1 is supported.',
                    enum: ['demo-account-1']
                }
            },
            required: ['accountId'],
            additionalProperties: false
        }
    },
    {
        name: 'ghost_get_profile',
        description: 'Inspect any Instagram account anonymously in Ghost Mode. Returns username, full name, bio, follower count, following count, total post count, verified status, and HD profile picture without leaving any footprint.',
        inputSchema: {
            type: 'object',
            properties: {
                username: {
                    type: 'string',
                    description: 'Instagram handle/username to inspect (e.g. "cristiano", "instagram")'
                }
            },
            required: ['username']
        }
    },
    {
        name: 'ghost_get_posts',
        description: 'Extract feed posts, reels, and carousels of an account with full pagination in Ghost Mode. Includes media type, captions, timestamps, likes, comments, video play counts, and pagination cursor for deep scrolling.',
        inputSchema: {
            type: 'object',
            properties: {
                username: {
                    type: 'string',
                    description: 'Instagram username to inspect'
                },
                userId: {
                    type: 'string',
                    description: 'Numerical user ID (optional if username is provided)'
                },
                limit: {
                    type: 'number',
                    description: 'Number of posts to retrieve (1-50, default 20)'
                },
                cursor: {
                    type: 'string',
                    description: 'Pagination token (after/max_id cursor) for fetching the next page of posts'
                },
                feedType: {
                    type: 'string',
                    enum: ['all', 'reels', 'posts'],
                    description: 'Filter posts by content type: "all", "reels", or "posts"'
                }
            }
        }
    },
    {
        name: 'ghost_get_media_metrics',
        description: 'Get granular metrics and view counts for a specific reel or post anonymously. Returns video plays, views, likes, comments, shares, saves, retention drop-off estimates, and calculated engagement rate.',
        inputSchema: {
            type: 'object',
            properties: {
                mediaId: {
                    type: 'string',
                    description: 'Instagram media shortcode (e.g. "Deyg1mxiobv") or numerical media ID'
                }
            },
            required: ['mediaId']
        }
    },
    {
        name: 'ghost_get_comments',
        description: 'Harvest public comments on any Instagram post or reel anonymously. Returns comment text, author usernames, timestamps, and like counts.',
        inputSchema: {
            type: 'object',
            properties: {
                mediaId: {
                    type: 'string',
                    description: 'Instagram media shortcode or numerical ID'
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of comments to harvest (default 25)'
                }
            },
            required: ['mediaId']
        }
    },
    {
        name: 'ghost_search',
        description: 'Search Instagram users and hashtags in Ghost Mode without recording the search query into your account search history.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Keyword, username prefix, or hashtag to search'
                },
                type: {
                    type: 'string',
                    enum: ['users', 'hashtags', 'all'],
                    description: 'Search filter: "users", "hashtags", or "all"'
                }
            },
            required: ['query']
        }
    },
    {
        name: 'ghost_explore_viral',
        description: 'Scan Instagram Explore feed anonymously for viral and high-controversy debate posts, ranked by discussion intensity and comment-to-like ratio.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    description: 'Number of viral posts to fetch (default 10)'
                },
                minCommentRatio: {
                    type: 'number',
                    description: 'Filter for high-controversy discussions (e.g. 0.05 = at least 5 comments per 100 likes)'
                }
            }
        }
    },
    {
        name: 'ghost_audit_account',
        description: 'Run an automated, end-to-end analytical audit of any Instagram page in Ghost Mode. Returns total sampled plays, average views per reel, overall engagement rate, top 3 viral reels, discussion driver posts, and content mix ratios.',
        inputSchema: {
            type: 'object',
            properties: {
                username: {
                    type: 'string',
                    description: 'Target Instagram username to audit'
                },
                sampleCount: {
                    type: 'number',
                    description: 'Number of recent posts to sample for the audit (default 15)'
                }
            },
            required: ['username']
        }
    }
];
// 2. List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: GHOST_TOOLS };
});
// 3. Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
        switch (name) {
            case 'instagram_execute_mock_auto_comment_reply': {
                if (typeof args.accountId !== 'string' ||
                    !args.accountId.trim() ||
                    typeof args.mediaId !== 'string' ||
                    !args.mediaId.trim() ||
                    typeof args.commentId !== 'string' ||
                    !args.commentId.trim()) {
                    throw new Error('Valid account, media and comment IDs required.');
                }
                const ownerId = process.env.INSTAGRAM_LOCAL_OWNER_ID;
                if (!ownerId || !ownerId.trim()) {
                    throw new Error('INSTAGRAM_LOCAL_OWNER_ID is required.');
                }
                // Hard-coded MOCK implementations: no live provider or sender.
                const accounts = new CommentPreviewAccountStore();
                const verified = new AutoCommentVerifiedService(new AutoCommentBindings(accounts), new AutoCommentLookup(new AutoCommentDataProvider()), new AutoCommentReplyService(new AutoCommentSettings(accounts)));
                const executor = new AutoCommentExecutor(verified);
                const receipt = await executor.execute(ownerId, args.accountId, args.mediaId, args.commentId);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                ...receipt,
                                simulated: true,
                                message: 'MOCK execution only. No real Instagram reply was sent.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_preview_comment_reply': {
                if (typeof args.accountId !== 'string' ||
                    !args.accountId.trim() ||
                    typeof args.commentId !== 'string' ||
                    !args.commentId.trim() ||
                    typeof args.text !== 'string' ||
                    !args.text.trim() ||
                    args.text.length > 2000) {
                    throw new Error('Valid account, comment ID and text required.');
                }
                const accounts = new CommentPreviewAccountStore();
                const settingsStore = new CommentPreviewSettingsStore(accounts);
                const service = new CommentPreviewService(settingsStore);
                const ownerId = process.env.INSTAGRAM_LOCAL_OWNER_ID;
                if (!ownerId || !ownerId.trim()) {
                    throw new Error('INSTAGRAM_LOCAL_OWNER_ID is required.');
                }
                const preview = await service.preview(ownerId, args.accountId, {
                    commentId: args.commentId,
                    text: args.text
                });
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                ...preview,
                                simulated: true,
                                message: 'Preview only. No Instagram reply was sent.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_list_mock_comments': {
                if (args.accountId !== 'demo-account-1' ||
                    typeof args.mediaId !== 'string' ||
                    !args.mediaId.trim()) {
                    throw new Error('Valid demo account and media ID required.');
                }
                const limit = args.limit === undefined ? 20 : args.limit;
                if (typeof limit !== 'number' ||
                    !Number.isInteger(limit) ||
                    limit < 1 ||
                    limit > 50 ||
                    (args.cursor !== undefined &&
                        typeof args.cursor !== 'string')) {
                    throw new Error('Invalid comment pagination options.');
                }
                const provider = new MockInstagramProvider();
                const result = await provider.listComments(args.accountId, args.mediaId, {
                    limit,
                    cursor: args.cursor
                });
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                ...result,
                                simulated: true,
                                message: 'Comments are from MOCK data.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_queue_action': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string' ||
                    typeof args.idempotencyKey !== 'string' ||
                    !args.action ||
                    typeof args.action !== 'object' ||
                    Array.isArray(args.action)) {
                    throw new Error('Invalid action queue request.');
                }
                const result = await actionQueue.enqueue(ownerId, args.accountId, args.idempotencyKey, args.action);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                ...result,
                                executed: false,
                                message: 'Queued for independent user approval.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_list_pending_actions': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string') {
                    throw new Error('Valid accountId is required.');
                }
                const actions = await actionQueue.list(ownerId, args.accountId);
                const result = [];
                for (const action of actions) {
                    const approval = await actionApprovals.get(ownerId, args.accountId, action.id);
                    if (!approval) {
                        result.push({
                            ...action,
                            approvalStatus: 'pending'
                        });
                    }
                }
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                accountId: args.accountId,
                                actions: result,
                                executed: false
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_get_action_status': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string' ||
                    typeof args.actionId !== 'string') {
                    throw new Error('Invalid action status request.');
                }
                const actions = await actionQueue.list(ownerId, args.accountId);
                const action = actions.find(item => item.id === args.actionId);
                if (!action) {
                    throw new Error('Action not found for this account.');
                }
                const approval = await actionApprovals.get(ownerId, args.accountId, args.actionId);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                action,
                                approvalStatus: approval?.decision ?? 'pending',
                                executionStatus: 'not_checked'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_adaptive_growth_advice': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string' ||
                    !args.accountId.trim()) {
                    throw new Error('Valid accountId is required.');
                }
                // The store enforces ownership before returning history.
                const history = await experiments.list(ownerId, args.accountId);
                const analytics = new InstagramAnalyticsService(new MockInstagramProvider());
                const result = await analytics.analyzeAccount('demo-account-1');
                if (!result.ok) {
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }],
                        isError: true
                    };
                }
                const template = new InstagramGrowthAdvisor().generate(result.data);
                const advice = adaptGrowthAdviceForAccount(template, args.accountId, history);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(advice, null, 2)
                        }]
                };
            }
            case 'instagram_create_growth_experiment': {
                const ownerId = getLocalOwnerId();
                const record = await experiments.create(ownerId, {
                    accountId: args.accountId,
                    adviceExperimentId: args.adviceExperimentId,
                    title: args.title,
                    hypothesis: args.hypothesis,
                    metric: args.metric,
                    ...(args.baseline !== undefined
                        ? { baseline: args.baseline }
                        : {}),
                    ...(args.notes !== undefined
                        ? { notes: args.notes }
                        : {})
                });
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(record, null, 2)
                        }]
                };
            }
            case 'instagram_list_growth_experiments': {
                const ownerId = getLocalOwnerId();
                const records = await experiments.list(ownerId, args.accountId);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(records.map(record => ({
                                ...record,
                                evaluation: evaluateExperiment(record)
                            })), null, 2)
                        }]
                };
            }
            case 'instagram_update_growth_experiment': {
                const ownerId = getLocalOwnerId();
                const record = await experiments.updateStatus(ownerId, args.accountId, args.experimentId, args.status, args.outcome);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                record,
                                evaluation: evaluateExperiment(record)
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_update_account_draft': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string' ||
                    typeof args.id !== 'string') {
                    throw new Error('accountId and id are required.');
                }
                const store = await accountDrafts.forAccount(ownerId, args.accountId);
                const changes = {};
                if (args.caption !== undefined) {
                    changes.caption = args.caption;
                }
                if (args.mediaUrl !== undefined) {
                    changes.mediaUrl = args.mediaUrl;
                }
                if (args.hashtags !== undefined) {
                    changes.hashtags = args.hashtags;
                }
                const draft = await store.update(args.id, changes);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                accountId: args.accountId,
                                draft,
                                message: 'Account draft updated locally. Nothing was published.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_get_owner_timezone': {
                const ownerId = getLocalOwnerId();
                const settings = await ownerTimezones.forOwner(ownerId).get();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                settings,
                                suggestedTimezone: TimezoneStore.detect(),
                                requiresConfirmation: settings?.confirmed !== true
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_set_owner_timezone': {
                const ownerId = getLocalOwnerId();
                if (typeof args.timezone !== 'string') {
                    throw new Error('A confirmed timezone is required.');
                }
                const settings = await ownerTimezones
                    .forOwner(ownerId)
                    .set(args.timezone);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                settings,
                                message: 'Owner timezone saved locally.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_schedule_account_draft': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string' ||
                    typeof args.id !== 'string' ||
                    typeof args.localDateTime !== 'string') {
                    throw new Error('accountId, id and localDateTime are required.');
                }
                const store = await accountDrafts.forAccount(ownerId, args.accountId);
                const settings = await ownerTimezones
                    .forOwner(ownerId)
                    .get();
                if (!settings?.confirmed) {
                    throw new Error('Owner timezone is not confirmed. Ask the user to confirm a timezone.');
                }
                const draft = await store.schedule(args.id, args.localDateTime, settings.timezone);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                accountId: args.accountId,
                                draft,
                                message: 'Draft scheduled locally. Automatic publishing is not enabled.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_cancel_account_schedule': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string' ||
                    typeof args.id !== 'string') {
                    throw new Error('accountId and id are required.');
                }
                const store = await accountDrafts.forAccount(ownerId, args.accountId);
                const draft = await store.cancelSchedule(args.id);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                accountId: args.accountId,
                                draft,
                                message: 'Account draft schedule cancelled locally.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_create_account_draft': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string') {
                    throw new Error('accountId is required.');
                }
                const store = await accountDrafts.forAccount(ownerId, args.accountId);
                const draft = await store.create({
                    type: args.type,
                    caption: args.caption,
                    ...(args.mediaUrl !== undefined
                        ? { mediaUrl: args.mediaUrl }
                        : {}),
                    ...(args.hashtags !== undefined
                        ? { hashtags: args.hashtags }
                        : {})
                });
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                accountId: args.accountId,
                                draft,
                                message: 'Draft saved locally for this account. Nothing was published.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_list_account_drafts': {
                const ownerId = getLocalOwnerId();
                if (typeof args.accountId !== 'string') {
                    throw new Error('accountId is required.');
                }
                const store = await accountDrafts.forAccount(ownerId, args.accountId);
                const savedDrafts = await store.list();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                accountId: args.accountId,
                                total: savedDrafts.length,
                                drafts: savedDrafts,
                                message: 'Account-specific local drafts only.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_add_local_account': {
                const ownerId = getLocalOwnerId();
                if (typeof args.username !== 'string' ||
                    typeof args.accountType !== 'string') {
                    throw new Error('username and accountType are required.');
                }
                const account = await accounts.create({
                    ownerId,
                    username: args.username,
                    accountType: args.accountType
                });
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                message: 'Account label saved locally. No Instagram connection or authorization was created.',
                                account
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_list_local_accounts': {
                const ownerId = getLocalOwnerId();
                const savedAccounts = await accounts.list(ownerId);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                total: savedAccounts.length,
                                accounts: savedAccounts,
                                message: 'Local labels only. No Instagram connection is implied.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_schedule_draft': {
                const settings = await timezones.get();
                if (!settings?.confirmed) {
                    throw new Error('Timezone is not confirmed. Ask the user to manually set or confirm their timezone first.');
                }
                if (typeof args.id !== 'string' ||
                    typeof args.localDateTime !== 'string') {
                    throw new Error('Draft ID and localDateTime are required.');
                }
                const scheduled = await drafts.schedule(args.id, args.localDateTime, settings.timezone);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                message: 'Draft scheduled locally. Automatic publishing is not enabled.',
                                draft: scheduled
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_cancel_schedule': {
                if (typeof args.id !== 'string') {
                    throw new Error('Draft ID is required.');
                }
                const cancelled = await drafts.cancelSchedule(args.id);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                message: 'Local schedule cancelled. Nothing was published.',
                                draft: cancelled
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_get_timezone': {
                const settings = await timezones.get();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                settings,
                                suggestedTimezone: TimezoneStore.detect(),
                                requiresConfirmation: settings?.confirmed !== true,
                                message: settings?.confirmed
                                    ? 'Timezone is confirmed. The user can change it manually.'
                                    : 'No confirmed timezone. Ask the user to confirm the suggestion or enter a timezone manually.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_set_timezone': {
                if (typeof args.timezone !== 'string') {
                    throw new Error('A manually selected or confirmed timezone is required.');
                }
                const settings = await timezones.set(args.timezone);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                message: 'Timezone saved locally. Nothing was published.',
                                settings
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_update_draft': {
                const id = String(args.id || '');
                const changes = {};
                if (args.caption !== undefined) {
                    changes.caption = args.caption;
                }
                if (args.mediaUrl !== undefined) {
                    changes.mediaUrl = args.mediaUrl;
                }
                if (args.hashtags !== undefined) {
                    changes.hashtags = args.hashtags;
                }
                const updated = await drafts.update(id, changes);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                message: 'Draft updated locally. Nothing was published.',
                                draft: updated
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_list_drafts': {
                const savedDrafts = await drafts.list();
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                total: savedDrafts.length,
                                drafts: savedDrafts,
                                message: 'Local drafts only. Nothing was published.'
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_create_draft': {
                const draft = await drafts.create({
                    type: args.type,
                    caption: args.caption,
                    ...(args.mediaUrl !== undefined
                        ? { mediaUrl: args.mediaUrl }
                        : {}),
                    ...(args.hashtags !== undefined
                        ? { hashtags: args.hashtags }
                        : {})
                });
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify({
                                message: 'Draft saved locally. Nothing was published.',
                                draft
                            }, null, 2)
                        }]
                };
            }
            case 'instagram_preview_growth_draft': {
                if (args.accountId !== 'demo-account-1') {
                    throw new Error('Only demo-account-1 is supported.');
                }
                if (typeof args.experimentId !== 'string' ||
                    !['post', 'story', 'reel'].includes(args.type)) {
                    throw new Error('Valid experimentId and type are required.');
                }
                const analytics = new InstagramAnalyticsService(new MockInstagramProvider());
                const result = await analytics.analyzeAccount(args.accountId);
                if (!result.ok) {
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }],
                        isError: true
                    };
                }
                const advice = new InstagramGrowthAdvisor().generate(result.data);
                const preview = new GrowthDraftPreparer().prepare(advice, args.experimentId, args.type);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(preview, null, 2)
                        }]
                };
            }
            case 'instagram_growth_advice': {
                if (args.accountId !== 'demo-account-1') {
                    throw new Error('Only demo-account-1 is supported.');
                }
                const analytics = new InstagramAnalyticsService(new MockInstagramProvider());
                const analyzed = await analytics.analyzeAccount(args.accountId);
                if (!analyzed.ok) {
                    return {
                        content: [{
                                type: 'text',
                                text: JSON.stringify(analyzed, null, 2)
                            }],
                        isError: true
                    };
                }
                const advisor = new InstagramGrowthAdvisor();
                const advice = advisor.generate(analyzed.data);
                return {
                    content: [{
                            type: 'text',
                            text: JSON.stringify(advice, null, 2)
                        }]
                };
            }
            case 'instagram_analyze_account': {
                if (args.accountId !== 'demo-account-1') {
                    throw new Error('Only demo-account-1 is supported by the mock analytics tool.');
                }
                const analytics = new InstagramAnalyticsService(new MockInstagramProvider());
                const result = await analytics.analyzeAccount(args.accountId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ],
                    isError: !result.ok
                };
            }
            case 'ghost_get_profile': {
                const username = String(args.username || '');
                if (!username) {
                    throw new Error('Argument "username" is required.');
                }
                const profile = await ghost.getProfile(username);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(profile, null, 2)
                        }
                    ]
                };
            }
            case 'ghost_get_posts': {
                const result = await ghost.getTimelinePosts({
                    username: args.username ? String(args.username) : undefined,
                    userId: args.userId ? String(args.userId) : undefined,
                    limit: args.limit ? Number(args.limit) : 20,
                    cursor: args.cursor ? String(args.cursor) : undefined,
                    feedType: args.feedType
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
            case 'ghost_get_media_metrics': {
                const mediaId = String(args.mediaId || '');
                if (!mediaId) {
                    throw new Error('Argument "mediaId" is required.');
                }
                const metrics = await ghost.getMediaMetrics(mediaId);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(metrics, null, 2)
                        }
                    ]
                };
            }
            case 'ghost_get_comments': {
                const mediaId = String(args.mediaId || '');
                if (!mediaId) {
                    throw new Error('Argument "mediaId" is required.');
                }
                const comments = await ghost.getComments(mediaId, args.limit ? Number(args.limit) : 25);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(comments, null, 2)
                        }
                    ]
                };
            }
            case 'ghost_search': {
                const query = String(args.query || '');
                if (!query) {
                    throw new Error('Argument "query" is required.');
                }
                const searchRes = await ghost.search(query, args.type || 'all');
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(searchRes, null, 2)
                        }
                    ]
                };
            }
            case 'ghost_explore_viral': {
                const viral = await ghost.getViralExplore(args.limit ? Number(args.limit) : 10, args.minCommentRatio ? Number(args.minCommentRatio) : undefined);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(viral, null, 2)
                        }
                    ]
                };
            }
            case 'ghost_audit_account': {
                const username = String(args.username || '');
                if (!username) {
                    throw new Error('Argument "username" is required.');
                }
                const report = await ghost.auditAccount(username, args.sampleCount ? Number(args.sampleCount) : 15);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(report, null, 2)
                        }
                    ]
                };
            }
            default:
                throw new Error(`Unknown Ghost Mode MCP Tool: "${name}"`);
        }
    }
    catch (err) {
        return {
            isError: true,
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        error: {
                            message: err?.message || 'Ghost Mode Tool Execution Error',
                            code: 'GHOST_TOOL_ERROR',
                            type: 'MCPToolException'
                        }
                    }, null, 2)
                }
            ]
        };
    }
});
// 4. Start Server via Stdio Transport
async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write(`[MetaGraph MCP] Ghost Mode Server running on stdio (v${SERVER_VERSION})\n`);
}
run().catch((error) => {
    process.stderr.write(`[MetaGraph MCP] Fatal Error: ${error}\n`);
    process.exit(1);
});
