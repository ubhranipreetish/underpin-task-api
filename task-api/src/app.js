const express = require('express');
const taskRoutes = require('./routes/tasks');

const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.get('/', (req, res) => {
  res.json({
    name: 'Task Manager API',
    storage: 'in-memory',
    note: 'Demo data is shared and resets when the service restarts.',
    endpoints: [
      'GET /health',
      'GET /tasks',
      'GET /tasks/stats',
      'POST /tasks',
      'PUT /tasks/:id',
      'DELETE /tasks/:id',
      'PATCH /tasks/:id/complete',
      'PATCH /tasks/:id/assign',
    ],
  });
});
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/tasks', taskRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: 'Request body must contain valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large' });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Invalid request' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Task API running on port ${PORT}`);
  });
}

module.exports = app;
