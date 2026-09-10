const express = require('express');
const { AttemptService } = require('../services/AttemptService');
const { SubmissionService } = require('../services/SubmissionService');

const router = express.Router();
const attemptService = new AttemptService();
const submissionService = new SubmissionService();

router.post('/', (req, res, next) => {
  try {
    const { problemId, learnerId } = req.body;
    if (!problemId || !learnerId) {
      return res.status(400).json({ error: 'problemId and learnerId are required' });
    }
    res.status(201).json(attemptService.startAttempt({ problemId, learnerId }));
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res, next) => {
  try {
    const { learnerId } = req.query;
    if (!learnerId) return res.status(400).json({ error: 'learnerId query param is required' });
    res.json(attemptService.listHistory(learnerId));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    res.json(attemptService.getAttempt(req.params.id));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submissions', (req, res, next) => {
  try {
    const { format, content, requestId } = req.body;
    if (!format || !content) return res.status(400).json({ error: 'format and content are required' });
    const result = submissionService.submit({ attemptId: req.params.id, format, content, requestId });
    res.status(result.replay ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
