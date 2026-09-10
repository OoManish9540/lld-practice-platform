const fs = require('fs');
const path = require('path');
const repos = require('../src/repositories');
const { Problem } = require('../src/domain/entities');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'problems.json'), 'utf-8'));
const problems = raw.map((p) => new Problem(p));

repos.problems.reset(problems);
repos.attempts.reset([]);
repos.submissions.reset([]);
repos.evaluations.reset([]);

console.log(`Seeded ${problems.length} problems and cleared attempts/submissions/evaluations.`);
