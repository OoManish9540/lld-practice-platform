const request = require('supertest');
const { createApp } = require('../src/server');
const repos = require('../src/repositories');
const { Problem } = require('../src/domain/entities');

const app = createApp();

beforeEach(() => {
  repos.problems.reset([
    new Problem({
      id: 'test-problem',
      title: 'Test Problem',
      description: 'A problem for testing.',
      requirements: ['Requirement A', 'Requirement B'],
    }),
  ]);
  repos.attempts.reset([]);
  repos.submissions.reset([]);
  repos.evaluations.reset([]);
});

async function startAttempt(learnerId = 'test-learner') {
  const res = await request(app).post('/api/attempts').send({ problemId: 'test-problem', learnerId });
  return res.body;
}

describe('Problems API', () => {
  test('lists seeded problems', async () => {
    const res = await request(app).get('/api/problems');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  test('404 for unknown problem id', async () => {
    const res = await request(app).get('/api/problems/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('Attempts API', () => {
  test('starting an attempt for an unknown problem returns 404', async () => {
    const res = await request(app).post('/api/attempts').send({ problemId: 'nope', learnerId: 'l1' });
    expect(res.status).toBe(404);
  });

  test('missing fields return 400', async () => {
    const res = await request(app).post('/api/attempts').send({ problemId: 'test-problem' });
    expect(res.status).toBe(400);
  });

  test('starts an attempt in InProgress state', async () => {
    const attempt = await startAttempt();
    expect(attempt.status).toBe('InProgress');
  });
});

describe('Submission + evaluation flow', () => {
  test('rejects empty submission content', async () => {
    const attempt = await startAttempt();
    const res = await request(app)
      .post(`/api/attempts/${attempt.id}/submissions`)
      .send({ format: 'text', content: '' });
    expect(res.status).toBe(400);
  });

  test('full happy path: submit -> evaluation eventually completes', async () => {
    const attempt = await startAttempt();
    const submitRes = await request(app)
      .post(`/api/attempts/${attempt.id}/submissions`)
      .send({ format: 'text', content: 'Requirement A and Requirement B are both addressed. Edge case: invalid input test().' });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.evaluation.status).toBe('Pending');

    // poll until settled (fallback heuristic AI resolves near-instantly)
    let evaluation;
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      const evalRes = await request(app).get(`/api/evaluations/${submitRes.body.evaluation.id}`);
      evaluation = evalRes.body;
      if (evaluation.status === 'Completed' || evaluation.status === 'Failed') break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(evaluation.status).toBe('Completed');
    expect(evaluation.criteria.length).toBeGreaterThan(0);
    expect(evaluation.overallScore).not.toBeNull();
  });

  test('submitting twice for the same attempt (different requestId) returns 409', async () => {
    const attempt = await startAttempt();
    await request(app).post(`/api/attempts/${attempt.id}/submissions`).send({ format: 'text', content: 'first solution', requestId: 'r1' });
    const res = await request(app).post(`/api/attempts/${attempt.id}/submissions`).send({ format: 'text', content: 'second solution', requestId: 'r2' });
    expect(res.status).toBe(409);
  });

  test('replaying the same requestId returns the original submission (idempotent retry)', async () => {
    const attempt = await startAttempt();
    const first = await request(app).post(`/api/attempts/${attempt.id}/submissions`).send({ format: 'text', content: 'first solution', requestId: 'same-key' });
    const replay = await request(app).post(`/api/attempts/${attempt.id}/submissions`).send({ format: 'text', content: 'first solution', requestId: 'same-key' });
    expect(replay.status).toBe(200);
    expect(replay.body.submission.id).toBe(first.body.submission.id);
  });

  test('submitting to a non-existent attempt returns 404', async () => {
    const res = await request(app).post('/api/attempts/does-not-exist/submissions').send({ format: 'text', content: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('History API', () => {
  test('requires learnerId query param', async () => {
    const res = await request(app).get('/api/attempts');
    expect(res.status).toBe(400);
  });

  test('returns attempts for a learner, newest first', async () => {
    await startAttempt('history-learner');
    await new Promise((r) => setTimeout(r, 5));
    await startAttempt('history-learner');
    const res = await request(app).get('/api/attempts?learnerId=history-learner');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });
});

describe('Evaluation retry', () => {
  test('retrying a non-Failed evaluation returns 409', async () => {
    const attempt = await startAttempt();
    const submitRes = await request(app)
      .post(`/api/attempts/${attempt.id}/submissions`)
      .send({ format: 'text', content: 'Requirement A. Requirement B.' });
    // Immediately Pending — not Failed yet
    const res = await request(app).post(`/api/evaluations/${submitRes.body.evaluation.id}/retry`);
    expect(res.status).toBe(409);
  });

  test('retrying an unknown evaluation returns 404', async () => {
    const res = await request(app).post('/api/evaluations/does-not-exist/retry');
    expect(res.status).toBe(404);
  });
});
