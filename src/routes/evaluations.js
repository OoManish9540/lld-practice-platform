const express = require('express');
const { EvaluationService } = require('../services/EvaluationService');

const router = express.Router();
const evaluationService = new EvaluationService();

router.get('/:id', (req, res, next) => {
  try {
    res.json(evaluationService.getEvaluation(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/retry', async (req, res, next) => {
  try {
    const evaluation = await evaluationService.retry(req.params.id);
    res.json(evaluation);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
