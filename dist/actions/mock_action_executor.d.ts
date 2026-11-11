import { ActionQueue } from './action_queue.js';
import { ActionApprovalStore } from './action_approval_store.js';
export interface MockExecutionReceipt {
    actionId: string;
    accountId: string;
    status: 'completed';
    simulated: true;
    resultId: string | null;
    executedAt: string;
}
export declare class MockActionExecutor {
    private readonly queue;
    private readonly approvals;
    private readonly directory;
    private readonly provider;
    constructor(queue: ActionQueue, approvals: ActionApprovalStore, directory?: string);
    execute(ownerId: string, accountId: string, actionId: string): Promise<MockExecutionReceipt>;
}
