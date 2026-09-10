const express = require('express');
const { ProblemService } = require('../services/ProblemService');

const router = express.Router();
const problemService = new ProblemService();

router.get('/', (req, res, next) => {
  try {
    res.json(problemService.listProblems());
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    res.json(problemService.getProblem(req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
