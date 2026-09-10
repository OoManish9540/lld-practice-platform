# LLD Practice Platform

A small end-to-end prototype: pick an LLD problem, submit a text/code design, get rubric-based
feedback from a deterministic + AI evaluator, and track attempt history.

See **RESEARCH_NOTE.md** (problem/market research) and **DESIGN_NOTE.md** (architecture,
domain model, evaluation approach, trade-offs) for the full write-up. This file is just
run instructions + a quick orientation.

## Requirements

- Node.js 18+ (uses the built-in `fetch` and `crypto.randomUUID`)

## Setup & run

```bash
npm install
npm run seed     # loads the 5 seed problems into data/*.json
npm start        # starts the server on http://localhost:3000
```

Open **http://localhost:3000** in a browser. Enter any learner id (e.g. `manish`), pick a
problem, write a design, submit, and watch feedback stream in.

### Enabling real AI feedback (optional)

Without an API key, the AI half of evaluation runs in a clearly-labelled heuristic fallback mode
(see `AIEvaluator._heuristicFallback`) so the whole app works out of the box. To get real model
feedback:

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm start
```

## Running tests

```bash
npm test
```

27 tests across three files:
- `tests/entities.test.js` — domain state machine (Attempt, Evaluation transitions, illegal
  transitions rejected)
- `tests/deterministicEvaluator.test.js` — rule-based evaluator scoring and edge cases
  (malformed code never throws)
- `tests/api.test.js` — full HTTP flow: happy path, 404s, validation, idempotent submission
  retries, duplicate-submission conflict, evaluation retry rules

## Project structure

```
src/
  domain/
    entities.js              Problem, Attempt, Submission, Evaluation, CriterionResult
    rubric.js                 fixed 8-dimension rubric, split into deterministic/AI keys
    evaluators/
      Evaluator.js             strategy interface
      DeterministicEvaluator.js
      AIEvaluator.js           calls Claude; heuristic fallback if no API key
      CompositeEvaluator.js    runs both, + EvaluatorFactory
  services/                   ProblemService, AttemptService, SubmissionService, EvaluationService
  routes/                     Express routes (problems, attempts, evaluations)
  db.js, repositories.js      JSON-file persistence (no native DB deps)
  server.js                   Express app + error handler
public/                       vanilla HTML/CSS/JS frontend (no build step)
scripts/seed.js                loads src/data/problems.json into the store
tests/                        Jest + Supertest
```

## API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/problems` | list problems |
| GET | `/api/problems/:id` | get one problem |
| POST | `/api/attempts` | `{problemId, learnerId}` → start an attempt |
| GET | `/api/attempts?learnerId=` | attempt history for a learner |
| GET | `/api/attempts/:id` | get one attempt |
| POST | `/api/attempts/:id/submissions` | `{format, content, requestId?}` → submit, kicks off async evaluation |
| GET | `/api/evaluations/:id` | poll evaluation status/result |
| POST | `/api/evaluations/:id/retry` | re-run a `Failed` evaluation |

## Known limitations (honest, not hidden)

- **No auth** — `learnerId` is a free-text field, not a real account system.
- **JSON-file storage** — fine for a demo/single learner, not for concurrent multi-user writes.
  See `src/db.js` — swapping to a real DB only touches that one file.
- **Fire-and-forget evaluation**, not a real job queue. Acceptable per the assignment's explicit
  scope boundary (avoid turning this into a distributed-systems project); the design note names
  the job queue as the first component to split out if this grew.
- **One submission per attempt** — resubmitting means starting a new attempt. This was a
  deliberate scope cut to keep the state machine and history model simple (see DESIGN_NOTE.md §7).
- **Deterministic requirement-coverage check is keyword-based**, not semantic — a learner who
  addresses a requirement using entirely different wording may be under-scored on that one
  dimension. The AI evaluator's dimensions don't have this limitation.
- **No diagram submission format** in this MVP, though the domain model is built so adding one
  is additive, not a rewrite (see DESIGN_NOTE.md's "Change test A").

## AI usage

See **AI_USAGE.md** for the meaningful AI-assisted decisions made while building this.
