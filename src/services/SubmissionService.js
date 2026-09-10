const { v4: uuidv4 } = require('uuid');
const repos = require('../repositories');
const { Submission, Evaluation } = require('../domain/entities');
const { AttemptService } = require('./AttemptService');
const { EvaluationService } = require('./EvaluationService');

const attemptService = new AttemptService();

class SubmissionService {
  constructor(evaluationService = new EvaluationService()) {
    this.evaluationService = evaluationService;
  }

  /**
   * Submit a solution for an attempt.
   *
   * Idempotency: the caller may pass a `requestId` (e.g. a client-generated
   * UUID stored before the network call). If the same requestId is replayed
   * — a real risk on a flaky connection or an impatient double-click — we
   * return the ORIGINAL submission + evaluation instead of erroring or
   * creating a duplicate. This answers the assignment's question about
   * avoiding duplicate processing on retry, without needing a distributed
   * lock or queue for a 2-day prototype.
   */
  submit({ attemptId, format, content, requestId = uuidv4() }) {
    const attempt = attemptService.getAttempt(attemptId);

    if (attempt.status === 'Submitted') {
      const existing = repos.submissions.findWhere((s) => s.attemptId === attemptId && s.requestId === requestId)[0];
      if (existing) {
        const evaluation = repos.evaluations.findWhere((e) => e.submissionId === existing.id)[0];
        return { submission: existing, evaluation, replay: true };
      }
      throw Object.assign(new Error(`Attempt ${attemptId} already has a submission`), { statusCode: 409 });
    }

    const submission = new Submission({ id: uuidv4(), attemptId, format, content });
    submission.requestId = requestId; // tag for idempotent replay lookups above
    repos.submissions.insert(submission);
    attemptService.markSubmitted(attemptId);

    const evaluation = new Evaluation({ id: uuidv4(), submissionId: submission.id, evaluatorType: 'composite', requestId });
    repos.evaluations.insert(evaluation);

    // Fire-and-forget: do NOT make the learner wait on the AI call. The
    // submission is already durably stored, so a slow/failed evaluator run
    // never loses the learner's work — it just leaves the Evaluation in
    // Failed state, which the UI can show with a "Retry evaluation" action.
    setImmediate(() => {
      this.evaluationService.run(evaluation.id).catch(() => {
        /* run() already persists the Failed state; nothing further to do */
      });
    });

    return { submission, evaluation, replay: false };
  }

  getSubmission(id) {
    const submission = repos.submissions.findById(id);
    if (!submission) throw Object.assign(new Error(`Submission ${id} not found`), { statusCode: 404 });
    return submission;
  }
}

module.exports = { SubmissionService };
