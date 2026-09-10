/**
 * entities.js — Core domain model.
 *
 * Design intent (full rationale in DESIGN_NOTE.md):
 *   Problem      — an LLD prompt the learner attempts. Immutable content.
 *   Attempt      — one learner's "session" against a Problem. Owns the
 *                  practice-loop lifecycle (InProgress -> Submitted).
 *   Submission   — the actual artifact the learner produced (text/code/
 *                  diagram). Attached to exactly one Attempt.
 *   Evaluation   — the result of running Evaluator(s) against a Submission.
 *                  Owns its OWN state machine (Pending -> Evaluating ->
 *                  Completed/Failed) independent of Attempt/Submission, so
 *                  evaluation can be slow, retried, or fail without
 *                  corrupting the practice flow.
 *   CriterionResult — one rubric dimension's score + evidence, inside an
 *                  Evaluation.
 *
 * Every state transition is a METHOD on the entity, not something callers
 * do by mutating a field directly. This is the main LLD decision this
 * project makes: illegal transitions become impossible to express, not
 * just "discouraged by convention".
 */

const VALID_ATTEMPT_STATUSES = Object.freeze(['InProgress', 'Submitted']);
const VALID_EVALUATION_STATUSES = Object.freeze([
  'Pending',
  'Evaluating',
  'Completed',
  'Failed',
]);
const VALID_SUBMISSION_FORMATS = Object.freeze(['text', 'code']);

class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DomainError';
  }
}

class Problem {
  constructor({ id, title, description, requirements, constraints = [], difficulty = 'Medium', tags = [] }) {
    if (!title || !description) {
      throw new DomainError('Problem requires a title and description');
    }
    this.id = id;
    this.title = title;
    this.description = description;
    this.requirements = requirements; // strings — what a valid solution must address
    this.constraints = constraints;
    this.difficulty = difficulty;
    this.tags = tags;
  }
}

class Attempt {
  constructor({ id, problemId, learnerId, status = 'InProgress', createdAt = new Date().toISOString(), submittedAt = null }) {
    this.id = id;
    this.problemId = problemId;
    this.learnerId = learnerId;
    this.status = status;
    this.createdAt = createdAt;
    this.submittedAt = submittedAt;
  }

  /** Transition InProgress -> Submitted. Throws if already submitted (no silent re-submits). */
  markSubmitted() {
    if (this.status === 'Submitted') {
      throw new DomainError(`Attempt ${this.id} is already submitted`);
    }
    this.status = 'Submitted';
    this.submittedAt = new Date().toISOString();
  }
}

class Submission {
  constructor({ id, attemptId, format, content, submittedAt = new Date().toISOString() }) {
    if (!VALID_SUBMISSION_FORMATS.includes(format)) {
      throw new DomainError(`Unsupported submission format: ${format}`);
    }
    if (!content || !content.trim()) {
      throw new DomainError('Submission content cannot be empty');
    }
    this.id = id;
    this.attemptId = attemptId;
    this.format = format;
    this.content = content;
    this.submittedAt = submittedAt;
  }
}

/** One rubric dimension's outcome. Plain value object — no behaviour. */
class CriterionResult {
  constructor({ criterion, score, evidence, concern = null, suggestion = null, confidence }) {
    this.criterion = criterion;
    this.score = score; // 0-5
    this.evidence = evidence; // reference to the submission that justifies the score
    this.concern = concern;
    this.suggestion = suggestion;
    this.confidence = confidence; // 'low' | 'medium' | 'high' — lets AI hedge instead of faking certainty
  }
}

class Evaluation {
  constructor({ id, submissionId, evaluatorType, requestId = null, status = 'Pending', criteria = [], overallSummary = null, overallScore = null, error = null, createdAt = new Date().toISOString(), completedAt = null }) {
    this.id = id;
    this.submissionId = submissionId;
    this.evaluatorType = evaluatorType; // 'deterministic' | 'ai' | 'composite'
    this.status = status;
    this.criteria = criteria;
    this.overallSummary = overallSummary;
    this.overallScore = overallScore;
    this.error = error;
    this.createdAt = createdAt;
    this.completedAt = completedAt;
    // requestId lets a caller retry the same submission without creating a
    // duplicate Evaluation record (idempotency — see EvaluationService).
    this.requestId = requestId;
  }

  start() {
    this._assertTransition('Evaluating', ['Pending', 'Failed']);
    this.status = 'Evaluating';
  }

  complete({ criteria, overallSummary }) {
    this._assertTransition('Completed', ['Evaluating']);
    this.criteria = criteria;
    this.overallSummary = overallSummary;
    this.overallScore = criteria.length
      ? Number((criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length).toFixed(2))
      : null;
    this.status = 'Completed';
    this.completedAt = new Date().toISOString();
  }

  fail(error) {
    this._assertTransition('Failed', ['Evaluating', 'Pending']);
    this.status = 'Failed';
    this.error = String(error);
    this.completedAt = new Date().toISOString();
  }

  _assertTransition(to, allowedFrom) {
    if (!allowedFrom.includes(this.status)) {
      throw new DomainError(`Illegal Evaluation transition: ${this.status} -> ${to}`);
    }
  }
}

module.exports = {
  Problem,
  Attempt,
  Submission,
  Evaluation,
  CriterionResult,
  DomainError,
  VALID_ATTEMPT_STATUSES,
  VALID_EVALUATION_STATUSES,
  VALID_SUBMISSION_FORMATS,
};
