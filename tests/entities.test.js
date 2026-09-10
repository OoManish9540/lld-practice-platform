const { Attempt, Submission, Evaluation, DomainError } = require('../src/domain/entities');

describe('Attempt', () => {
  test('starts InProgress and transitions to Submitted', () => {
    const attempt = new Attempt({ id: 'a1', problemId: 'p1', learnerId: 'l1' });
    expect(attempt.status).toBe('InProgress');
    attempt.markSubmitted();
    expect(attempt.status).toBe('Submitted');
    expect(attempt.submittedAt).not.toBeNull();
  });

  test('cannot be submitted twice', () => {
    const attempt = new Attempt({ id: 'a1', problemId: 'p1', learnerId: 'l1' });
    attempt.markSubmitted();
    expect(() => attempt.markSubmitted()).toThrow(DomainError);
  });
});

describe('Submission', () => {
  test('rejects unsupported format', () => {
    expect(() => new Submission({ id: 's1', attemptId: 'a1', format: 'video', content: 'x' })).toThrow(DomainError);
  });

  test('rejects empty content', () => {
    expect(() => new Submission({ id: 's1', attemptId: 'a1', format: 'text', content: '   ' })).toThrow(DomainError);
  });

  test('accepts valid text submission', () => {
    const sub = new Submission({ id: 's1', attemptId: 'a1', format: 'text', content: 'my design' });
    expect(sub.format).toBe('text');
  });
});

describe('Evaluation state machine', () => {
  test('happy path Pending -> Evaluating -> Completed', () => {
    const evaluation = new Evaluation({ id: 'e1', submissionId: 's1', evaluatorType: 'composite' });
    expect(evaluation.status).toBe('Pending');
    evaluation.start();
    expect(evaluation.status).toBe('Evaluating');
    evaluation.complete({ criteria: [{ score: 4 }, { score: 2 }], overallSummary: 'ok' });
    expect(evaluation.status).toBe('Completed');
    expect(evaluation.overallScore).toBe(3);
    expect(evaluation.completedAt).not.toBeNull();
  });

  test('Evaluating -> Failed is allowed, and Failed -> Evaluating allows retry', () => {
    const evaluation = new Evaluation({ id: 'e2', submissionId: 's1', evaluatorType: 'composite' });
    evaluation.start();
    evaluation.fail(new Error('provider timeout'));
    expect(evaluation.status).toBe('Failed');
    expect(evaluation.error).toMatch(/timeout/);

    // retry: Failed -> Evaluating is explicitly allowed
    evaluation.start();
    expect(evaluation.status).toBe('Evaluating');
  });

  test('illegal transition: cannot complete a Pending evaluation directly', () => {
    const evaluation = new Evaluation({ id: 'e3', submissionId: 's1', evaluatorType: 'composite' });
    expect(() => evaluation.complete({ criteria: [], overallSummary: 'x' })).toThrow(DomainError);
  });

  test('illegal transition: cannot re-complete an already Completed evaluation', () => {
    const evaluation = new Evaluation({ id: 'e4', submissionId: 's1', evaluatorType: 'composite' });
    evaluation.start();
    evaluation.complete({ criteria: [{ score: 5 }], overallSummary: 'ok' });
    expect(() => evaluation.complete({ criteria: [{ score: 1 }], overallSummary: 'again' })).toThrow(DomainError);
  });
});
