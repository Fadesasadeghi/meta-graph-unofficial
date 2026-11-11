export class InstagramGrowthAdvisor {
    generate(report) {
        const experiments = [];
        const warnings = [];
        const complete = report.rankedPosts.filter(post => post.engagementRatePct !== null);
        if (report.source === 'mock') {
            warnings.push('All recommendations use simulated data, not real Instagram performance.');
        }
        if (!report.dataQuality.completeMediaHistory) {
            warnings.push('Media history is incomplete; conclusions apply only to retrieved posts.');
        }
        if (report.dataQuality.postsWithMissingEngagement > 0) {
            warnings.push('Some posts lack complete engagement metrics.');
        }
        if (complete.length < 5) {
            warnings.push('Fewer than five posts have complete engagement data. Treat patterns as hypotheses.');
        }
        if (complete.length > 0) {
            const best = complete[0];
            const confidence = complete.length >= 10 &&
                report.dataQuality.completeMediaHistory
                ? 'medium'
                : 'low';
            experiments.push({
                id: 'repeat-top-content-pattern',
                title: 'Test a variation of the strongest content',
                hypothesis: `A new ${best.type} inspired by the strongest sampled post may attract similar engagement.`,
                evidence: [
                    `Top sampled post: ${best.id}`,
                    `Follower-based engagement rate: ${best.engagementRatePct}%`,
                    `Comparable posts with complete metrics: ${complete.length}`
                ],
                action: 'Create a new post using one identifiable element of the top post, changing only one major creative variable.',
                successMetrics: [
                    'Follower-based engagement rate',
                    'Comments per post'
                ],
                confidence,
                limitations: [
                    'Historical correlation does not establish causation.',
                    'Current follower count may differ from the count at publication.',
                    'A single high-performing post does not establish a reliable pattern.'
                ]
            });
        }
        if (report.contentMix.reel > 0) {
            experiments.push({
                id: 'reel-format-experiment',
                title: 'Test a reel format variation',
                hypothesis: 'A different reel opening or structure may influence engagement.',
                evidence: [
                    `Reels in analyzed sample: ${report.contentMix.reel}`
                ],
                action: 'Prepare two comparable reel concepts with different openings, then compare results over similar observation windows.',
                successMetrics: [
                    'Follower-based engagement rate',
                    'Plays and reach when available',
                    'Shares and saves when available'
                ],
                confidence: 'low',
                limitations: [
                    'The current report does not establish which reel opening performs best.',
                    'Plays, reach, shares and saves require additional provider data.'
                ]
            });
        }
        if (experiments.length === 0) {
            warnings.push('Not enough usable content data to propose a specific experiment.');
        }
        return {
            accountId: report.accountId,
            username: report.username,
            source: report.source,
            generatedAt: new Date().toISOString(),
            experiments,
            warnings
        };
    }
}
