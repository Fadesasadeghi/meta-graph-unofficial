import { AccountStore } from '../accounts/account_store.js';
import { ActionQueue } from './action_queue.js';
export type ApprovalDecision = 'approved' | 'rejected';
export interface ActionApprovalRecord {
    actionId: string;
    accountId: string;
    decision: ApprovalDecision;
    actionHash: string;
    decidedAt: string;
}
export declare class ActionApprovalStore {
    private readonly accounts;
    private readonly queue;
    private readonly directory;
    constructor(accounts: AccountStore, queue: ActionQueue, directory?: string);
    private fingerprint;
    private locate;
    decide(ownerId: string, accountId: string, actionId: string, decision: ApprovalDecision): Promise<ActionApprovalRecord>;
    get(ownerId: string, accountId: string, actionId: string): Promise<ActionApprovalRecord | null>;
}
