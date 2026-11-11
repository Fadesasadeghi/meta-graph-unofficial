import { AdaptiveGrowthAdvisor } from './adaptive_growth_advisor.js';
export function adaptGrowthAdviceForAccount(template, targetAccountId, history) {
    if (template.source !== 'mock') {
        throw new Error('This adapter only supports explicitly labeled mock templates.');
    }
    if (typeof targetAccountId !== 'string' ||
        !targetAccountId.trim()) {
        throw new Error('Valid target account ID is required.');
    }
    const scopedHistory = history.filter(record => record.accountId === targetAccountId);
    const scopedTemplate = {
        ...template,
        accountId: targetAccountId
    };
    const adapted = new AdaptiveGrowthAdvisor().adapt(scopedTemplate, scopedHistory);
    return {
        ...adapted,
        templateAccountId: template.accountId,
        templateSource: 'mock',
        basedOnDemoTemplate: true,
        warnings: [
            ...adapted.warnings,
            'Recommendations originate from a demo template, not from analytics of the selected account.',
            'Historical results are considered only for the selected account.'
        ]
    };
}
