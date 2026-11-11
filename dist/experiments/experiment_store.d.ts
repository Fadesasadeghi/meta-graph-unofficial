import { AccountStore } from '../accounts/account_store.js';
import type { ExperimentMetric, ExperimentMeasurement, ExperimentStatus, GrowthExperimentRecord } from './types.js';
export interface CreateExperimentInput {
    accountId: string;
    adviceExperimentId: string;
    title: string;
    hypothesis: string;
    metric: ExperimentMetric;
    baseline?: ExperimentMeasurement | null;
    notes?: string;
}
export declare class ExperimentStore {
    private readonly accounts;
    private readonly directory;
    constructor(accounts: AccountStore, directory?: string);
    private accountDirectory;
    private validateMeasurement;
    create(ownerId: string, input: CreateExperimentInput): Promise<GrowthExperimentRecord>;
    list(ownerId: string, accountId: string): Promise<GrowthExperimentRecord[]>;
    updateStatus(ownerId: string, accountId: string, experimentId: string, status: ExperimentStatus, outcome?: ExperimentMeasurement): Promise<GrowthExperimentRecord>;
}
