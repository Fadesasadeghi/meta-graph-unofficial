#!/usr/bin/env node
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
import { getLocalOwnerId } from '../accounts/local_owner.js';
import { OwnerTimezoneStore } from '../settings/owner_timezone_store.js';
// Initialize the Ghost Service (wraps TwinGraph & Mobile/Web Twins)
const ghost = new GhostService();
const drafts = new DraftStore();
const timezones = new TimezoneStore();
const accounts = new AccountStore();
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
