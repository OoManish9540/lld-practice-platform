const { Evaluator } = require('./Evaluator');
const { DeterministicEvaluator } = require('./DeterministicEvaluator');
const { AIEvaluator } = require('./AIEvaluator');

/**
 * CompositeEvaluator — runs deterministic + AI evaluators and merges their
 * criteria into one Evaluation.
 *
 * Why composite instead of "just use AI for everything"?
 *  - Deterministic checks are free, instant, and 100% reproducible — good
 *    for the dimensions that don't need judgement (requirement coverage,
 *    edge-case signals). No point spending an LLM call on those.
 *  - If the AI provider is slow or down, the deterministic half still
 *    completes, so the learner isn't left with nothing.
 *  - Adding a third evaluator (e.g. a future rule-engine or human-review
 *    queue) means adding it to the `evaluators` array below — nothing
 *    about how Evaluation/Attempt/Submission work has to change. This is
 *    the assignment's "Change Test B".
 */
class CompositeEvaluator extends Evaluator {
  constructor(evaluators = [new DeterministicEvaluator(), new AIEvaluator()]) {
    super();
    this.evaluators = evaluators;
  }

  get type() {
    return 'composite';
  }

  async evaluate(problem, submission) {
    const results = await Promise.allSettled(this.evaluators.map((e) => e.evaluate(problem, submission)));

    const criteria = [];
    const summaries = [];
    const failures = [];

    results.forEach((result, idx) => {
      const evaluatorName = this.evaluators[idx].type;
      if (result.status === 'fulfilled') {
        criteria.push(...result.value.criteria);
        summaries.push(`[${evaluatorName}] ${result.value.overallSummary}`);
      } else {
        failures.push(`[${evaluatorName}] ${result.reason.message || result.reason}`);
      }
    });

    if (criteria.length === 0) {
      // Every evaluator failed — a genuine hard failure. Propagate it so
      // EvaluationService can mark the Evaluation as Failed.
      throw new Error(`All evaluators failed: ${failures.join(' | ')}`);
    }

    const overallSummary = [...summaries, ...failures.map((f) => `(degraded) ${f}`)].join(' ');
    return { criteria, overallSummary };
  }
}

/**
 * EvaluatorFactory — the ONLY place that knows which concrete Evaluator
 * class corresponds to a strategy name. Services depend on this factory,
 * never on concrete evaluator classes directly — this is what makes
 * "swap in a new evaluator" a one-file change.
 */
class EvaluatorFactory {
  static create(strategy = 'composite') {
    switch (strategy) {
      case 'deterministic':
        return new DeterministicEvaluator();
      case 'ai':
        return new AIEvaluator();
      case 'composite':
        return new CompositeEvaluator();
      default:
        throw new Error(`Unknown evaluator strategy: ${strategy}`);
    }
  }
}

module.exports = { CompositeEvaluator, EvaluatorFactory };
