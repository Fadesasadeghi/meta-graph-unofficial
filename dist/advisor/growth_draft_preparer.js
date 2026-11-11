export class GrowthDraftPreparer {
    prepare(report, experimentId, type) {
        if (!['post', 'story', 'reel'].includes(type)) {
            throw new Error('Invalid draft type.');
        }
        const experiment = report.experiments.find(item => item.id === experimentId);
        if (!experiment) {
            throw new Error('Experiment not found in the advice report.');
        }
        if (!report.accountId || !report.username) {
            throw new Error('A valid advice report is required.');
        }
        const caption = [
            '[Draft — review before posting]',
            '',
            'موضوع محتوا: ' + experiment.title,
            '',
            'ایده اصلی:',
            experiment.action,
            '',
            'متن نهایی کپشن را متناسب با محتوای واقعی خودتان بنویسید.',
            '',
            '[Caption requires editing]'
        ].join('\n');
        if (caption.length > 2200) {
            throw new Error('Generated caption exceeds draft limit.');
        }
        return {
            sourceAccountId: report.accountId,
            source: report.source,
            experimentId,
            experimentTitle: experiment.title,
            draft: {
                type,
                caption,
                hashtags: []
            },
            guidance: {
                hypothesis: experiment.hypothesis,
                action: experiment.action,
                successMetrics: [...experiment.successMetrics],
                limitations: [...experiment.limitations]
            },
            requiresApproval: true,
            saved: false
        };
    }
}
