import { InstagramGrowthAdvisor } from './instagram_growth_advisor.js';
import { TrendDecisionEngine } from './trend_decision_engine.js';
export class OnDemandGrowthService {
    history;
    growth;
    engine;
    constructor(history, growth = new InstagramGrowthAdvisor(), engine = new TrendDecisionEngine()) {
        this.history = history;
        this.growth = growth;
        this.engine = engine;
    }
    async analyze(ownerId, accountId) {
        const result = await this.history.analyzeAndRecord(ownerId, accountId);
        if (!result.ok) {
            return result;
        }
        if (result.data.report.accountId !== accountId ||
            result.data.report.source !== result.source) {
            throw new Error('On-demand analytics identity mismatch.');
        }
        const advice = this.growth.generate(result.data.report);
        const decisions = this.engine.evaluate(advice, result.data.trend);
        return {
            ok: true,
            source: result.source,
            fetchedAt: result.fetchedAt,
            data: {
                analytics: result.data,
                advice,
                decisions
            }
        };
    }
}
