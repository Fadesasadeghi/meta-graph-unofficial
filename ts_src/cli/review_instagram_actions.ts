import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { AccountStore } from '../accounts/account_store.js';
import { getLocalOwnerId } from '../accounts/local_owner.js';
import { ActionQueue } from '../actions/action_queue.js';
import { ActionApprovalStore } from '../actions/action_approval_store.js';

async function main(): Promise<void> {
  const ownerId = getLocalOwnerId();

  const accounts = new AccountStore();
  const queue = new ActionQueue(accounts);
  const approvals = new ActionApprovalStore(accounts, queue);

  const ownedAccounts = await accounts.list(ownerId);

  if (ownedAccounts.length === 0) {
    console.log('No local Instagram accounts registered.');
    return;
  }

  const rl = createInterface({
    input: stdin,
    output: stdout
  });

  try {
    for (const account of ownedAccounts) {
      const actions = await queue.list(ownerId, account.id);

      for (const action of actions) {
        const existing = await approvals.get(
          ownerId,
          account.id,
          action.id
        );

        if (existing) continue;

        console.log('\n================================');
        console.log(`Account: @${account.username}`);
        console.log(`Action ID: ${action.id}`);
        console.log(`Kind: ${action.action.kind}`);
        console.log(JSON.stringify(action.action, null, 2));
        console.log('================================');

        const answer = (
          await rl.question(
            'Approve this action? Type YES or NO: '
          )
        ).trim();

        let decision: 'approved' | 'rejected';

        if (answer === 'YES') {
          decision = 'approved';
        } else {
          decision = 'rejected';
        }

        await approvals.decide(
          ownerId,
          account.id,
          action.id,
          decision
        );

        console.log(`Decision saved: ${decision}`);
      }
    }
  } finally {
    rl.close();
  }
}

main().catch(error => {
  console.error('Action review failed:', error.message);
  process.exitCode = 1;
});
