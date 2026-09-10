const { JsonRepository } = require('./db');

// One JsonRepository per collection. This module is the only place that
// constructs them, so services never talk to db.js directly.
module.exports = {
  problems: new JsonRepository('problems'),
  attempts: new JsonRepository('attempts'),
  submissions: new JsonRepository('submissions'),
  evaluations: new JsonRepository('evaluations'),
};
