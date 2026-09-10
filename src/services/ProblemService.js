const repos = require('../repositories');

class ProblemService {
  listProblems() {
    return repos.problems.all();
  }

  getProblem(id) {
    const problem = repos.problems.findById(id);
    if (!problem) throw Object.assign(new Error(`Problem ${id} not found`), { statusCode: 404 });
    return problem;
  }
}

module.exports = { ProblemService };
