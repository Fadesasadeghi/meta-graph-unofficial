import { evaluateExperiment } from '../experiments/experiment_evaluator.js';
export class AdaptiveGrowthAdvisor {
    adapt(advice, history) {
        const warnings = [...advice.warnings];
        if (advice.source === 'mock') {
            warnings.push('Adaptive conclusions use simulated data and do not demonstrate real-world growth.');
        }
        const recommendations = advice.experiments.map(experiment => {
            const matching = history.filter(record => record.accountId === advice.accountId &&
                record.adviceExperimentId === experiment.id &&
                record.status === 'completed' &&
                record.baseline?.source === advice.source &&
                record.outcome?.source === advice.source &&
                record.metric === 'engagement_rate');
            const evaluations = matching
                .map(evaluateExperiment)
                .filter(result => ['improved', 'declined', 'unchanged'].includes(result.conclusion));
            const improvedTrials = evaluations.filter(result => result.conclusion === 'improved').length;
            const declinedTrials = evaluations.filter(result => result.conclusion === 'declined').length;
            const unchangedTrials = evaluations.filter(result => result.conclusion === 'unchanged').length;
            const completedTrials = evaluations.length;
            let priority = 'needs_testing';
            if (completedTrials >= 3) {
                if (improvedTrials > declinedTrials + unchangedTrials) {
                    priority = 'promising';
                }
                else if (declinedTrials > improvedTrials + unchangedTrials) {
                    priority = 'reconsider';
                }
            }
            const reasoning = [
                `Comparable completed trials: ${completedTrials}`,
                `Improved: ${improvedTrials}`,
                `Declined: ${declinedTrials}`,
                `Unchanged: ${unchangedTrials}`
            ];
            if (completedTrials < 3) {
                reasoning.push('Too few comparable trials to adjust recommendation priority.');
            }
            else {
                reasoning.push('Priority is a heuristic based on observed outcomes, not proof of causality.');
            }
            return {
                experiment,
                completedTrials,
                improvedTrials,
                declinedTrials,
                unchangedTrials,
                priority,
                reasoning
            };
        });
        return {
            accountId: advice.accountId,
            source: advice.source,
            generatedAt: new Date().toISOString(),
            recommendations,
            warnings
        };
    }
}
