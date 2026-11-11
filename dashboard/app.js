const pages = {
  overview: 'Overview',
  inbox: 'Smart Inbox',
  comments: 'Comments',
  activity: 'Agent Activity'
};

function showPage(name) {
  if (!pages[name]) return;

  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${name}`);
  });

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === name);
  });

  document.querySelector('#breadcrumb').textContent = pages[name];
}

document.querySelectorAll('[data-page]').forEach(button => {
  button.addEventListener('click', () => {
    showPage(button.dataset.page);
  });
});

document.querySelector('#explore-inbox')
  .addEventListener('click', () => showPage('inbox'));

const labels = {
  compliment: 'Compliment',
  pricing: 'Pricing',
  product_question: 'Product Question',
  order_support: 'Order Support',
  complaint: 'Complaint',
  spam: 'Spam',
  general: 'Needs Review'
};

const modes = {
  auto: 'Auto eligible',
  manual: 'Human review',
  skip: 'Skip'
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadInbox() {
  const panel = document.querySelector('#page-inbox .empty-panel');
  panel.replaceChildren(
    element('p', '', 'Loading verified MOCK conversations…')
  );

  try {
    const response = await fetch('/api/demo/inbox');
    if (!response.ok) throw new Error('Inbox unavailable');

    const data = await response.json();

    if (!Array.isArray(data.items) || data.source !== 'mock') {
      throw new Error('Invalid inbox response');
    }

    panel.className = 'inbox-layout';
    panel.replaceChildren();

    const list = element('div', 'conversation-list');
    const detail = element('div', 'conversation-detail');

    const heading = element('div', 'inbox-list-title');
    heading.append(
      element('h3', '', 'Conversations'),
      element('span', 'mode-badge', `${data.items.length} MOCK`)
    );
    list.append(heading);

    function selectMessage(message, selectedButton) {
      list.querySelectorAll('.conversation-card').forEach(card => {
        card.classList.toggle('selected', card === selectedButton);
      });

      detail.replaceChildren();

      const top = element('div', 'detail-top');
      top.append(
        element('span', 'eyebrow', 'VERIFIED MOCK MESSAGE'),
        element('h2', '', message.senderId)
      );

      const category = element(
        'span',
        'category-chip',
        labels[message.category] || 'Unknown'
      );

      const bubble = element('div', 'message-bubble', message.text);
      bubble.dir = 'auto';

      const decision = element('div', 'decision-box');
      decision.append(
        element('span', 'eyebrow', 'HERMES ANALYSIS'),
        element('h3', '', modes[message.mode] || 'Review required'),
        category,
        element('p', 'decision-reason', message.reason)
      );

      if (message.suggestedReply) {
        const reply = element(
          'div',
          'suggested-reply',
          message.suggestedReply
        );
        reply.dir = 'auto';

        decision.append(
          element('div', 'reply-label', 'Suggested reply'),
          reply
        );
      }


      if (message.id === 'demo-message-pricing-1') {
        const button = element(
          'button', 'primary-btn demo-execute-btn',
          'Execute Mock Reply'
        );
        const feedback = element(
          'p', 'decision-reason',
          'Local MOCK execution only.'
        );

        button.addEventListener('click', async () => {
          if (!confirm('Execute a simulated pricing reply?')) return;
          button.disabled = true;
          feedback.textContent = 'Executing…';

          try {
            const response = await fetch('/api/demo/execute-pricing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                confirm: true,
                messageId: message.id
              })
            });
            const data = await response.json();

            if (!response.ok ||
                data.source !== 'mock' ||
                data.receipt?.status !== 'completed' ||
                data.receipt?.simulated !== true) {
              throw new Error(data.error || 'Mock execution failed.');
            }

            feedback.textContent =
              'Completed in MOCK mode. Receipt: ' +
              data.receipt.resultId;
            const viewButton = element(
              'button',
              'primary-btn demo-execute-btn',
              'View Agent Activity'
            );

            viewButton.addEventListener('click', () => {
              showPage('activity');
              loadAgentActivity();
            });

            button.replaceWith(viewButton);
            await loadAgentActivity();
          } catch (error) {
            feedback.textContent = error.message;
            button.disabled = false;
          }
        });

        decision.append(button, feedback);
      }

      detail.append(
        top,
        bubble,
        decision,
        element(
          'p',
          'mock-disclaimer',
          'Simulation only. No Instagram DM has been sent.'
        )
      );
    }

    for (const [index, message] of data.items.entries()) {
      const button = element('button', 'conversation-card');
      const row = element('div', 'conversation-topline');

      row.append(
        element('strong', '', message.senderId),
        element(
          'span',
          'conversation-category',
          labels[message.category] || 'Unknown'
        )
      );

      const snippet = element('p', '', message.text);
      snippet.dir = 'auto';

      button.append(row, snippet);
      button.addEventListener('click', () => {
        selectMessage(message, button);
      });

      list.append(button);

      if (index === 0) {
        queueMicrotask(() => selectMessage(message, button));
      }
    }

    if (data.items.length === 0) {
      detail.append(element('p', '', 'No mock messages found.'));
    }

    panel.append(list, detail);

    const dmCount = document.querySelectorAll('.stat-value')[1];
    if (dmCount) dmCount.textContent = String(data.items.length);
  } catch (error) {
    panel.className = 'empty-panel';
    panel.replaceChildren(
      element('h2', '', 'Unable to load Smart Inbox'),
      element('p', '', error.message)
    );
  }
}

fetch('/api/health')
  .then(response => response.json())
  .then(data => {
    document.querySelector('#server-status').textContent =
      data.ok ? 'Online · Local' : 'Unavailable';
  })
  .catch(() => {
    document.querySelector('#server-status').textContent =
      'Connection error';
  });

loadInbox();

async function loadComments() {
  const panel = document.querySelector('#page-comments .empty-panel');

  if (!panel) return;

  panel.replaceChildren(
    element('p', '', 'Loading verified MOCK comments…')
  );

  try {
    const response = await fetch('/api/demo/comments');

    if (!response.ok) {
      throw new Error('Comments API unavailable');
    }

    const data = await response.json();

    if (
      data.source !== 'mock' ||
      !Array.isArray(data.items)
    ) {
      throw new Error('Invalid comments response');
    }

    panel.className = 'inbox-layout';
    panel.replaceChildren();

    const list = element('div', 'conversation-list');
    const detail = element('div', 'conversation-detail');

    const heading = element('div', 'inbox-list-title');

    heading.append(
      element('h3', '', 'Post Comments'),
      element(
        'span',
        'mode-badge',
        `${data.items.length} MOCK`
      )
    );

    list.append(heading);

    function selectComment(comment, selectedButton) {
      list.querySelectorAll('.conversation-card').forEach(card => {
        card.classList.toggle(
          'selected',
          card === selectedButton
        );
      });

      detail.replaceChildren();

      const top = element('div', 'detail-top');

      top.append(
        element('span', 'eyebrow', 'VERIFIED MOCK COMMENT'),
        element('h2', '', comment.mediaId)
      );

      const bubble = element(
        'div',
        'message-bubble',
        comment.text
      );

      bubble.dir = 'auto';

      const decision = element('div', 'decision-box');

      decision.append(
        element('span', 'eyebrow', 'HERMES ANALYSIS'),
        element(
          'h3',
          '',
          modes[comment.mode] || 'Human review'
        ),
        element(
          'span',
          'category-chip',
          labels[comment.category] || 'Unknown'
        ),
        element(
          'p',
          'decision-reason',
          comment.reason
        )
      );

      if (comment.suggestedReply) {
        const reply = element(
          'div',
          'suggested-reply',
          comment.suggestedReply
        );

        reply.dir = 'auto';

        decision.append(
          element('div', 'reply-label', 'Suggested reply'),
          reply
        );
      }

      detail.append(
        top,
        bubble,
        decision,
        element(
          'p',
          'mock-disclaimer',
          'Rule-based MOCK analysis. No comment reply was sent.'
        )
      );
    }

    for (const [index, comment] of data.items.entries()) {
      const button = element(
        'button',
        'conversation-card'
      );

      const row = element('div', 'conversation-topline');

      row.append(
        element('strong', '', comment.mediaId),
        element(
          'span',
          'conversation-category',
          labels[comment.category] || 'Unknown'
        )
      );

      const snippet = element('p', '', comment.text);
      snippet.dir = 'auto';

      button.append(row, snippet);

      button.addEventListener('click', () => {
        selectComment(comment, button);
      });

      list.append(button);

      if (index === 0) {
        queueMicrotask(() => selectComment(comment, button));
      }
    }

    if (!data.items.length) {
      detail.append(
        element('p', '', 'No mock comments available.')
      );
    }

    panel.append(list, detail);

    const commentCount = document.querySelectorAll('.stat-value')[2];

    if (commentCount) {
      commentCount.textContent = String(data.items.length);
    }

  } catch (error) {
    panel.className = 'empty-panel';

    panel.replaceChildren(
      element('h2', '', 'Unable to load Comments'),
      element('p', '', error.message)
    );
  }
}

loadComments();

/* Agent Activity — verified MOCK decision previews */

async function loadAgentActivity() {
  const panel = document.querySelector('#page-activity .empty-panel, #page-activity .activity-workspace');
  if (!panel) return;

  panel.replaceChildren(
    element('p', '', 'Loading agent decision previews…')
  );

  try {
    const [inboxResponse, commentsResponse, receiptsResponse] = await Promise.all([
      fetch('/api/demo/inbox'),
      fetch('/api/demo/comments'),
      fetch('/api/demo/executions')
    ]);

    if (!inboxResponse.ok || !commentsResponse.ok) {
      throw new Error('Mock decision APIs unavailable.');
    }

    const [inbox, comments] = await Promise.all([
      inboxResponse.json(),
      commentsResponse.json()
    ]);

    if (
      inbox.source !== 'mock' ||
      comments.source !== 'mock' ||
      !Array.isArray(inbox.items) ||
      !Array.isArray(comments.items)
    ) {
      throw new Error('Invalid verified MOCK data.');
    }

    const receipts = await receiptsResponse.json();

    if (
      !receiptsResponse.ok ||
      receipts.source !== 'mock' ||
      !Array.isArray(receipts.items)
    ) {
      throw new Error('Mock receipts unavailable');
    }

    const events = [
      ...inbox.items.map(item => ({
        type: 'Direct Message',
        identifier: item.id,
        category: item.category,
        mode: item.mode,
        reason: item.reason,
        text: item.text,
        simulated: item.simulated
      })),
      ...comments.items.map(item => ({
        type: 'Comment',
        identifier: item.id,
        category: item.category,
        mode: item.mode,
        reason: item.reason,
        text: item.text,
        simulated: item.simulated
      }))
    ];

    panel.className = 'activity-workspace';
    panel.replaceChildren();

    const summary = element('div', 'activity-summary');

    const metrics = [
      ['Analyzed Items', events.length],
      ['Direct Messages', inbox.items.length],
      ['Comments', comments.items.length],
      ['Executed Actions', receipts.items.length]
    ];

    for (const [name, count] of metrics) {
      const metric = element('div', 'activity-metric');
      metric.append(
        element('span', '', name),
        element('strong', '', String(count))
      );
      summary.append(metric);
    }

    const header = element('div', 'activity-heading');
    header.append(
      element('h2', '', 'Decision Insights'),
      element(
        'span',
        'mode-badge',
        'VERIFIED MOCK PREVIEWS'
      )
    );

    const description = element(
      'p',
      'activity-description',
      'Rule-based decisions derived from verified mock data. ' +
      'This view is not a chronological execution log.'
    );

    const timeline = element('div', 'activity-timeline');

    for (const event of events) {
      const card = element('article', 'activity-event');

      const marker = element('div', 'activity-marker');
      marker.textContent =
        event.type === 'Direct Message' ? '✉' : '♡';

      const content = element('div', 'activity-event-content');

      const top = element('div', 'activity-event-top');

      top.append(
        element('strong', '', event.type),
        element(
          'span',
          'activity-status',
          modes[event.mode] || 'Review'
        )
      );

      const message = element(
        'p',
        'activity-message',
        event.text || 'No message text available.'
      );
      message.dir = 'auto';

      const classification = element('div', 'activity-tags');

      classification.append(
        element(
          'span',
          'category-chip',
          labels[event.category] || 'Unknown'
        ),
        element('span', 'activity-preview', 'PREVIEW ONLY')
      );

      const explanation = element(
        'p',
        'activity-explanation',
        event.reason || 'No explanation available.'
      );

      const reference = element(
        'small',
        'activity-reference',
        `Reference: ${event.identifier}`
      );

      content.append(
        top,
        message,
        classification,
        explanation,
        reference
      );

      card.append(marker, content);
      timeline.append(card);
    }

    // Verified execution receipts
    for (const receipt of receipts.items) {
      const card = element('article', 'activity-event');

      const marker = element('div', 'activity-marker', '✓');
      const content = element('div', 'activity-event-content');

      content.append(
        element('strong', '', 'Verified Mock Execution'),
        element('span', 'activity-status', receipt.status.toUpperCase()),
        element('p', 'activity-message', receipt.reason),
        element('p', 'activity-explanation',
          'Execution receipt: ' + (receipt.resultId || 'Unavailable')),
        element('small', 'activity-reference',
          'Message: ' + receipt.messageId),
        element('small', 'activity-reference',
          'Executed at: ' + (receipt.executedAt || 'Not executed'))
      );

      card.append(marker, content);
      timeline.prepend(card);
    }

    if (events.length === 0 && receipts.items.length === 0) {
      timeline.append(
        element('p', '', 'No verified mock decisions available.')
      );
    }

    const footer = element(
      'p',
      'activity-footer',
      'No live Instagram messages or comments were sent. ' +
      'Verified execution receipts are shown only for this local demo session.'
    );

    panel.append(
      summary,
      header,
      description,
      timeline,
      footer
    );

    // All current events are previews, not executed actions.
    const actionCount = document.querySelectorAll('.stat-value')[3];
    if (actionCount) actionCount.textContent = String(receipts.items.length);

  } catch (error) {
    panel.className = 'empty-panel';
    panel.replaceChildren(
      element('h2', '', 'Activity unavailable'),
      element('p', '', error.message)
    );
  }
}

loadAgentActivity();
