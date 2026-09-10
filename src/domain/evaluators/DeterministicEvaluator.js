const { Evaluator } = require('./Evaluator');
const { CriterionResult } = require('../entities');
const { RUBRIC_CRITERIA } = require('../rubric');

const EDGE_CASE_SIGNALS = [
  'edge case', 'null', 'empty', 'concurrent', 'concurrency', 'thread',
  'invalid', 'duplicate', 'retry', 'failure', 'timeout', 'race condition',
  'boundary', 'overflow', 'test(', 'describe(', 'it(', 'assert',
];

function label(key) {
  return RUBRIC_CRITERIA.find((c) => c.key === key).label;
}

/**
 * Rule-based checks. Deliberately limited to things that DON'T require
 * judgement:
 *  - requirement coverage (keyword overlap against the problem's stated
 *    requirements — objective, not "is this good design")
 *  - presence of edge-case / testability signals
 *  - basic structural sanity (code parses, if format is `code`)
 *
 * This is fast, free, and reproducible (same input -> same output), and it
 * still runs even if the AI provider is down or unconfigured — see
 * CompositeEvaluator.
 */
class DeterministicEvaluator extends Evaluator {
  get type() {
    return 'deterministic';
  }

  async evaluate(problem, submission) {
    const criteria = [];
    const contentLower = submission.content.toLowerCase();

    // --- requirement_understanding ---
    const requirements = problem.requirements || [];
    const matched = requirements.filter((req) => keywordsOf(req).some((kw) => contentLower.includes(kw)));
    const coverage = requirements.length ? matched.length / requirements.length : 1;
    criteria.push(
      new CriterionResult({
        criterion: label('requirement_understanding'),
        score: Math.round(coverage * 5),
        evidence: matched.length
          ? `Addresses ${matched.length}/${requirements.length} stated requirements: ${matched.join('; ')}`
          : 'No stated requirements were clearly referenced in the submission.',
        concern: coverage < 1 ? `Missing coverage for: ${requirements.filter((r) => !matched.includes(r)).join('; ') || 'n/a'}` : null,
        suggestion: coverage < 1 ? 'Explicitly address every listed requirement, even briefly.' : null,
        confidence: 'high', // deterministic keyword match -> certain about *what we measured*
      })
    );

    // --- edge_cases_testability ---
    const signalsFound = EDGE_CASE_SIGNALS.filter((s) => contentLower.includes(s));
    let syntaxNote = null;
    if (submission.format === 'code') {
      syntaxNote = checkBasicSyntax(submission.content);
    }
    const edgeScore = Math.min(5, signalsFound.length) + (syntaxNote && syntaxNote.ok === false ? -2 : 0);
    criteria.push(
      new CriterionResult({
        criterion: label('edge_cases_testability'),
        score: Math.max(0, Math.min(5, edgeScore)),
        evidence: signalsFound.length
          ? `Found edge-case/testability signals: ${signalsFound.slice(0, 6).join(', ')}`
          : 'No edge-case handling or test scaffolding detected via keyword scan.',
        concern: signalsFound.length === 0 ? 'No visible handling of invalid input, duplicates, or failure paths.' : (syntaxNote && !syntaxNote.ok ? syntaxNote.message : null),
        suggestion: signalsFound.length === 0 ? 'Add at least one explicit edge case (e.g. invalid input, empty state, duplicate submission).' : null,
        confidence: 'high',
      })
    );

    const overallSummary = `Deterministic check: requirement coverage ${(coverage * 100).toFixed(0)}%, ${signalsFound.length} edge-case signal(s) found.`;

    return { criteria, overallSummary };
  }
}

function keywordsOf(requirementText) {
  return requirementText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 5);
}

/** Best-effort syntax sanity check for JS-like code submissions. Never throws. */
function checkBasicSyntax(code) {
  try {
    // eslint-disable-next-line no-new-func
    new Function(code);
    return { ok: true };
  } catch (e) {
    // Many valid submissions use TS/Java/Python syntax that `new Function`
    // can't parse — so a failure here is a SIGNAL, not proof of broken code.
    return { ok: false, message: `Note: content did not parse as plain JS (may be a different language) — ${e.message}` };
  }
}

module.exports = { DeterministicEvaluator };
