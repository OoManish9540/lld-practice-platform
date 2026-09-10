require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const problemsRouter = require('./routes/problems');
const attemptsRouter = require('./routes/attempts');
const evaluationsRouter = require('./routes/evaluations');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/problems', problemsRouter);
  app.use('/api/attempts', attemptsRouter);
  app.use('/api/evaluations', evaluationsRouter);

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Centralized error handler — every route calls next(err) on failure,
  // so status codes and error shape stay consistent in ONE place.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    if (statusCode === 500) console.error(err);
    res.status(statusCode).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`LLD Practice Platform listening on http://localhost:${PORT}`));
}

module.exports = { createApp };
