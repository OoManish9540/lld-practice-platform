/**
 * rubric.js
 *
 * A single fixed rubric used by every Evaluator implementation, so scores
 * are comparable across deterministic and AI evaluation, and across
 * problems. This directly answers the assignment's question:
 *   "What makes feedback useful when there can be more than one valid
 *    LLD solution?"
 * -> We don't compare against ONE reference solution. We score independent
 *    dimensions of design quality and require EVIDENCE per dimension, so
 *    two very different valid designs can both score well, and a
 *    plausible-looking but shallow design can be called out with specifics.
 */

const RUBRIC_CRITERIA = Object.freeze([
  { key: 'requirement_understanding', label: 'Requirement understanding', description: 'Does the solution address the stated requirements and constraints?' },
  { key: 'responsibilities', label: 'Class responsibilities', description: 'Is each class/interface given a single, clear responsibility?' },
  { key: 'coupling_cohesion', label: 'Coupling & cohesion', description: 'Are related behaviours grouped together, and unrelated ones kept apart?' },
  { key: 'encapsulation_interfaces', label: 'Encapsulation & interfaces', description: 'Is internal state protected, and are interfaces used to hide implementation detail?' },
  { key: 'abstraction_patterns', label: 'Abstraction / pattern use', description: 'Are abstractions and patterns used where they earn their complexity (not decoration)?' },
  { key: 'extensibility', label: 'Extensibility', description: 'Could a plausible new requirement be added without rewriting the core model?' },
  { key: 'edge_cases_testability', label: 'Edge cases & testability', description: 'Are edge cases considered, and is the design easy to unit test?' },
  { key: 'explanation_quality', label: 'Quality of explanation', description: 'Are trade-offs and reasoning clearly explained, not just code dropped?' },
]);

const DETERMINISTIC_CRITERIA_KEYS = Object.freeze(['requirement_understanding', 'edge_cases_testability']);

const AI_CRITERIA_KEYS = Object.freeze(
  RUBRIC_CRITERIA.map((c) => c.key).filter((k) => !DETERMINISTIC_CRITERIA_KEYS.includes(k))
);

module.exports = { RUBRIC_CRITERIA, DETERMINISTIC_CRITERIA_KEYS, AI_CRITERIA_KEYS };
