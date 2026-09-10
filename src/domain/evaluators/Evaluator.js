/**
 * Evaluator — Strategy interface.
 *
 * Every evaluator (deterministic, AI, future rule-engine, future human
 * review) implements the same contract: given a Problem + Submission,
 * return an array of CriterionResult plus an overall summary string.
 *
 * This is the seam the assignment's "Change Test B" asks about:
 *   "Today feedback comes from one evaluator. Later you add a rule-based
 *    evaluator or human review. Can you add it without rewriting the
 *    practice flow?"
 * -> Yes: add a new class implementing `.evaluate()`, register it in
 *    EvaluatorFactory, and nothing in EvaluationService/routes changes.
 */
class Evaluator {
  /** @returns {Promise<{criteria: import('../entities').CriterionResult[], overallSummary: string}>} */
  // eslint-disable-next-line no-unused-vars
  async evaluate(problem, submission) {
    throw new Error('Evaluator.evaluate() must be implemented by subclass');
  }

  get type() {
    throw new Error('Evaluator.type must be implemented by subclass');
  }
}

module.exports = { Evaluator };
