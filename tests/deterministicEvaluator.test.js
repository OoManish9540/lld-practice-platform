const { DeterministicEvaluator } = require('../src/domain/evaluators/DeterministicEvaluator');
const { Problem, Submission } = require('../src/domain/entities');

const problem = new Problem({
  id: 'p1',
  title: 'Vending Machine',
  description: 'desc',
  requirements: [
    'Model the machine states explicitly',
    'Handle insufficient funds as an explicit case',
    'Support returning change',
  ],
});

describe('DeterministicEvaluator', () => {
  const evaluator = new DeterministicEvaluator();

  test('scores full requirement coverage highly', async () => {
    const submission = new Submission({
      id: 's1',
      attemptId: 'a1',
      format: 'text',
      content: 'The machine states are Idle/HasMoney/Dispensing. Insufficient funds is handled explicitly. Change is returned via a Change calculator. Edge case: duplicate coin insert is ignored.',
    });
    const { criteria } = await evaluator.evaluate(problem, submission);
    const reqScore = criteria.find((c) => c.criterion === 'Requirement understanding');
    expect(reqScore.score).toBe(5);
  });

  test('flags missing requirement coverage with a concern', async () => {
    const submission = new Submission({ id: 's2', attemptId: 'a1', format: 'text', content: 'It dispenses snacks.' });
    const { criteria } = await evaluator.evaluate(problem, submission);
    const reqScore = criteria.find((c) => c.criterion === 'Requirement understanding');
    expect(reqScore.score).toBeLessThan(5);
    expect(reqScore.concern).not.toBeNull();
  });

  test('detects edge-case signals', async () => {
    const submission = new Submission({
      id: 's3',
      attemptId: 'a1',
      format: 'code',
      content: 'function dispense(code) { if (!code) throw new Error("invalid"); } test("handles empty input", () => {});',
    });
    const { criteria } = await evaluator.evaluate(problem, submission);
    const edgeScore = criteria.find((c) => c.criterion === 'Edge cases & testability');
    expect(edgeScore.score).toBeGreaterThan(0);
  });

  test('never throws on malformed code content', async () => {
    const submission = new Submission({ id: 's4', attemptId: 'a1', format: 'code', content: 'this is not valid JS syntax {{{' });
    await expect(evaluator.evaluate(problem, submission)).resolves.toBeDefined();
  });
});
