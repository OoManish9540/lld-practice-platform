const { v4: uuidv4 } = require('uuid');
const repos = require('../repositories');
const { Attempt } = require('../domain/entities');
const { ProblemService } = require('./ProblemService');

const problemService = new ProblemService();

class AttemptService {
  startAttempt({ problemId, learnerId }) {
    problemService.getProblem(problemId); // throws 404 if unknown problem
    const attempt = new Attempt({ id: uuidv4(), problemId, learnerId });
    repos.attempts.insert(attempt);
    return attempt;
  }

  getAttempt(id) {
    const attempt = repos.attempts.findById(id);
    if (!attempt) throw Object.assign(new Error(`Attempt ${id} not found`), { statusCode: 404 });
    return attempt;
  }

  markSubmitted(attemptId) {
    return repos.attempts.update(attemptId, (raw) => {
      const attempt = Object.assign(new Attempt(raw), raw);
      attempt.markSubmitted();
      return attempt;
    });
  }

  /** History for a learner: every attempt + its latest submission/evaluation, newest first. */
  listHistory(learnerId) {
    return repos.attempts
      .findWhere((a) => a.learnerId === learnerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((attempt) => this._hydrate(attempt));
  }

  _hydrate(attempt) {
    const submission = repos.submissions
      .findWhere((s) => s.attemptId === attempt.id)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;
    const evaluation = submission
      ? repos.evaluations.findWhere((e) => e.submissionId === submission.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
      : null;
    const problem = repos.problems.findById(attempt.problemId);
    return {
      attempt,
      problem: problem ? { id: problem.id, title: problem.title } : null,
      submission,
      evaluation,
    };
  }
}

module.exports = { AttemptService };
