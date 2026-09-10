const repos = require('../repositories');
const { Evaluation } = require('../domain/entities');
const { EvaluatorFactory } = require('../domain/evaluators/CompositeEvaluator');

/**
 * EvaluationService — orchestrates running an Evaluator against a
 * Submission and persisting the Evaluation's state-machine transitions.
 *
 * State flow: Pending -> Evaluating -> Completed | Failed
 * (enforced by Evaluation itself in entities.js; this service just calls
 * the right method at the right time and persists the result.)
 */
class EvaluationService {
  async run(evaluationId, { strategy } = {}) {
    const raw = repos.evaluations.findById(evaluationId);
    if (!raw) throw new Error(`Evaluation ${evaluationId} not found`);
    const evaluation = hydrate(raw);

    evaluation.start();
    repos.evaluations.update(evaluationId, () => evaluation);

    const submission = repos.submissions.findById(evaluation.submissionId);
    const attempt = repos.attempts.findById(submission.attemptId);
    const problem = repos.problems.findById(attempt.problemId);

    try {
      const evaluator = EvaluatorFactory.create(strategy || evaluation.evaluatorType);
      const { criteria, overallSummary } = await evaluator.evaluate(problem, submission);
      evaluation.complete({ criteria, overallSummary });
    } catch (err) {
      evaluation.fail(err.message || err);
    }

    repos.evaluations.update(evaluationId, () => evaluation);
    return evaluation;
  }

  /** Re-run a Failed evaluation. Does nothing to Completed/Pending ones — explicit, no silent overwrite. */
  async retry(evaluationId) {
    const raw = repos.evaluations.findById(evaluationId);
    if (!raw) throw Object.assign(new Error(`Evaluation ${evaluationId} not found`), { statusCode: 404 });
    if (raw.status !== 'Failed') {
      throw Object.assign(new Error(`Only Failed evaluations can be retried (current status: ${raw.status})`), { statusCode: 409 });
    }
    return this.run(evaluationId);
  }

  getEvaluation(id) {
    const evaluation = repos.evaluations.findById(id);
    if (!evaluation) throw Object.assign(new Error(`Evaluation ${id} not found`), { statusCode: 404 });
    return evaluation;
  }
}

function hydrate(raw) {
  return Object.assign(new Evaluation(raw), raw);
}

module.exports = { EvaluationService };
