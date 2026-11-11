import type { InstagramDataSource } from '../providers/instagram_provider.js';
export type ExperimentStatus = 'planned' | 'running' | 'completed' | 'cancelled';
export type ExperimentMetric = 'engagement_rate' | 'reach' | 'plays' | 'saves' | 'shares' | 'comments';
export interface ExperimentMeasurement {
    value: number;
    measuredAt: string;
    source: InstagramDataSource;
    mediaId?: string;
}
export interface GrowthExperimentRecord {
    id: string;
    ownerId: string;
    accountId: string;
    adviceExperimentId: string;
    title: string;
    hypothesis: string;
    status: ExperimentStatus;
    metric: ExperimentMetric;
    baseline: ExperimentMeasurement | null;
    outcome: ExperimentMeasurement | null;
    notes: string;
    createdAt: string;
    updatedAt: string;
}
export interface ExperimentEvaluation {
    experimentId: string;
    metric: ExperimentMetric;
    baselineValue: number | null;
    outcomeValue: number | null;
    absoluteChange: number | null;
    relativeChangePct: number | null;
    conclusion: 'improved' | 'declined' | 'unchanged' | 'insufficient_data' | 'incomparable_sources';
}
