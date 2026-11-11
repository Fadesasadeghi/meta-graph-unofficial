export function evaluateExperiment(experiment) {
    const result = {
        experimentId: experiment.id,
        metric: experiment.metric,
        baselineValue: experiment.baseline?.value ?? null,
        outcomeValue: experiment.outcome?.value ?? null,
        absoluteChange: null,
        relativeChangePct: null,
        conclusion: 'insufficient_data'
    };
    if (experiment.status !== 'completed' ||
        !experiment.baseline ||
        !experiment.outcome) {
        return result;
    }
    if (experiment.baseline.source !== experiment.outcome.source) {
        return {
            ...result,
            conclusion: 'incomparable_sources'
        };
    }
    const baseline = experiment.baseline.value;
    const outcome = experiment.outcome.value;
    if (!Number.isFinite(baseline) ||
        !Number.isFinite(outcome) ||
        baseline < 0 ||
        outcome < 0) {
        return result;
    }
    const absoluteChange = outcome - baseline;
    const relativeChangePct = baseline === 0
        ? null
        : Number(((absoluteChange / baseline) * 100).toFixed(2));
    const conclusion = absoluteChange > 0
        ? 'improved'
        : absoluteChange < 0
            ? 'declined'
            : 'unchanged';
    return {
        ...result,
        absoluteChange,
        relativeChangePct,
        conclusion
    };
}
