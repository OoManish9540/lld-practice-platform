const { CriterionResult } = require('../entities');
const { Evaluator } = require('./Evaluator');
const { RUBRIC_CRITERIA, AI_CRITERIA_KEYS } = require('../rubric');

const AI_CRITERIA = RUBRIC_CRITERIA.filter((c) => AI_CRITERIA_KEYS.includes(c.key));

/**
 * AIEvaluator — handles the judgement-heavy rubric dimensions
 * (responsibilities, coupling/cohesion, abstraction, extensibility,
 * explanation quality) that a keyword scan cannot meaningfully score.
 *
 * Design choices (see AI_USAGE.md for the AI-assisted decision record):
 *  - The model is given a FIXED rubric and told to return ONLY structured
 *    JSON: {criterion_key, score, evidence, concern, suggestion, confidence}.
 *    We deliberately do NOT ask "is this a good design?" (the anti-pattern
 *    the assignment's own guide calls out) — an unconstrained question
 *    produces an unconstrained, unverifiable answer.
 *  - `evidence` is required per criterion, so feedback points at specific
 *    parts of the submission instead of a bare score.
 *  - If no API key is configured, this evaluator degrades to a clearly
 *    labelled heuristic stand-in rather than failing the whole pipeline —
 *    useful for local demos without a key (documented as a limitation in
 *    README.md).
 */
class AIEvaluator extends Evaluator {
  constructor({ apiKey = process.env.ANTHROPIC_API_KEY, model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5' } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  get type() {
    return 'ai';
  }

  async evaluate(problem, submission) {
    if (!this.apiKey) {
      return this._heuristicFallback(submission);
    }

    const prompt = buildPrompt(problem, submission);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`AI provider error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock) throw new Error('AI provider returned no text content');

    const parsed = parseStructuredJson(textBlock.text);
    return toCriteriaResult(parsed);
  }

  /**
   * Heuristic stand-in used only when ANTHROPIC_API_KEY is not set.
   * Clearly marked with confidence: 'low' so downstream consumers can tell
   * this is not a real model judgement.
   */
  _heuristicFallback(submission) {
    const contentLower = submission.content.toLowerCase();
    const hasClasses = /class\s+\w+/i.test(submission.content) || /interface\s+\w+/i.test(submission.content);
    const hasMultipleClasses = (submission.content.match(/class\s+\w+/gi) || []).length > 1;
    const mentionsPattern = /(factory|strategy|observer|singleton|decorator|adapter|state pattern)/i.test(contentLower);
    const hasExplanation = /because|so that|trade-?off|reason/i.test(contentLower);

    const criteria = AI_CRITERIA.map((c) => {
      let score = 2;
      let evidence = 'No AI provider configured — heuristic estimate only.';
      if (c.key === 'responsibilities') {
        score = hasMultipleClasses ? 3 : hasClasses ? 2 : 1;
        evidence = hasClasses ? 'Detected class/interface declarations in the submission.' : 'No class/interface declarations detected.';
      } else if (c.key === 'abstraction_patterns') {
        score = mentionsPattern ? 3 : 1;
        evidence = mentionsPattern ? 'Submission references a named design pattern.' : 'No named design pattern referenced.';
      } else if (c.key === 'explanation_quality') {
        score = hasExplanation ? 3 : 1;
        evidence = hasExplanation ? 'Submission includes reasoning language (e.g. "because", "trade-off").' : 'Little explicit reasoning found.';
      }
      return new CriterionResult({
        criterion: c.label,
        score,
        evidence,
        concern: 'This score came from a local heuristic, not a real model call. Set ANTHROPIC_API_KEY for real AI feedback.',
        confidence: 'low',
      });
    });

    return {
      criteria,
      overallSummary: 'AI evaluation ran in heuristic fallback mode (no ANTHROPIC_API_KEY set). Scores are a rough local estimate, not model judgement.',
    };
  }
}

function buildPrompt(problem, submission) {
  const rubricList = AI_CRITERIA.map((c) => `- ${c.key}: ${c.label} — ${c.description}`).join('\n');
  return `You are evaluating a learner's Low-Level Design (LLD) submission for a practice platform.

PROBLEM: ${problem.title}
DESCRIPTION: ${problem.description}
REQUIREMENTS:
${(problem.requirements || []).map((r) => `- ${r}`).join('\n')}

LEARNER SUBMISSION (format: ${submission.format}):
"""
${submission.content}
"""

Score ONLY the following rubric dimensions. There may be more than one valid
design — do not penalize a design just for differing from a "typical"
reference solution. Judge internal consistency, clarity of responsibility,
and justification instead.

${rubricList}

Respond with ONLY a JSON array (no markdown fences, no prose before or
after) of exactly ${AI_CRITERIA.length} objects, one per dimension above, in
this shape:
[{"criterion_key": "...", "score": 0-5, "evidence": "specific reference to the submission", "concern": "string or null", "suggestion": "string or null", "confidence": "low"|"medium"|"high"}]`;
}

function parseStructuredJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array from AI provider');
  return parsed;
}

function toCriteriaResult(parsedArray) {
  const criteria = parsedArray.map((item) => {
    const meta = AI_CRITERIA.find((c) => c.key === item.criterion_key) || { label: item.criterion_key };
    return new CriterionResult({
      criterion: meta.label,
      score: clampScore(item.score),
      evidence: item.evidence || 'No evidence provided.',
      concern: item.concern || null,
      suggestion: item.suggestion || null,
      confidence: ['low', 'medium', 'high'].includes(item.confidence) ? item.confidence : 'medium',
    });
  });
  const avg = criteria.length ? criteria.reduce((s, c) => s + c.score, 0) / criteria.length : 0;
  return { criteria, overallSummary: `AI evaluation across ${criteria.length} design dimensions (avg ${avg.toFixed(1)}/5).` };
}

function clampScore(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

module.exports = { AIEvaluator, AI_CRITERIA };
