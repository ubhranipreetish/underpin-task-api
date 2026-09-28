const request = require('supertest');
const app = require('../src/app');
const service = require('../src/services/taskService');

const createTask = async (fields = {}) => {
  const response = await request(app)
    .post('/tasks')
    .send({ title: 'Write tests', ...fields })
    .expect(201);
  return response.body;
};

beforeEach(() => service._reset());
afterEach(() => jest.restoreAllMocks());

describe('POST /tasks', () => {
  test('creates a task and persists the returned representation', async () => {
    const task = await createTask({
      description: 'Cover edge cases',
      priority: 'high',
    });
    expect(task).toMatchObject({
      title: 'Write tests',
      description: 'Cover edge cases',
      status: 'todo',
      priority: 'high',
      assignee: null,
      dueDate: null,
      completedAt: null,
    });
    expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    const list = await request(app).get('/tasks').expect(200);
    expect(list.body).toEqual([task]);
  });

  test.each([
    {},
    { title: '' },
    { title: '  ' },
    { title: 123 },
    { title: 'Task', status: null },
    { title: 'Task', priority: false },
    { title: 'Task', description: {} },
    { title: 'Task', dueDate: '2026-02-30T10:00:00Z' },
    { title: 'Task', id: 'client-id' },
  ])('rejects invalid body %j without storing a task', async (body) => {
    const response = await request(app).post('/tasks').send(body).expect(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect((await request(app).get('/tasks')).body).toEqual([]);
  });

  test('invalid status cannot poison later filtered requests', async () => {
    await request(app)
      .post('/tasks')
      .send({ title: 'Invalid', status: null })
      .expect(400);
    await createTask();
    const response = await request(app).get('/tasks?status=todo').expect(200);
    expect(response.body).toHaveLength(1);
  });
});

describe('GET /tasks', () => {
  test('returns an empty array for an empty store', async () => {
    expect((await request(app).get('/tasks').expect(200)).body).toEqual([]);
  });

  test('lists tasks in insertion order', async () => {
    const first = await createTask({ title: 'First' });
    const second = await createTask({ title: 'Second' });
    expect((await request(app).get('/tasks').expect(200)).body).toEqual([
      first,
      second,
    ]);
  });

  test('filters by exact status and returns an empty array for no matches', async () => {
    const todo = await createTask();
    await createTask({ status: 'done' });
    expect(
      (await request(app).get('/tasks?status=todo').expect(200)).body,
    ).toEqual([todo]);
    expect(
      (await request(app).get('/tasks?status=in_progress').expect(200)).body,
    ).toEqual([]);
  });

  test('uses one-based pages with a short last page and an empty out-of-range page', async () => {
    const tasks = [];
    for (const title of ['A', 'B', 'C'])
      tasks.push(await createTask({ title }));
    expect((await request(app).get('/tasks?page=1&limit=2')).body).toEqual(
      tasks.slice(0, 2),
    );
    expect((await request(app).get('/tasks?page=2&limit=2')).body).toEqual(
      tasks.slice(2),
    );
    expect((await request(app).get('/tasks?page=3&limit=2')).body).toEqual([]);
    expect((await request(app).get('/tasks?limit=1')).body).toEqual(
      tasks.slice(0, 1),
    );
    expect((await request(app).get('/tasks?page=1')).body).toEqual(tasks);
  });

  test('filters before paginating', async () => {
    await createTask({ title: 'Todo A' });
    await createTask({ title: 'Done', status: 'done' });
    const secondTodo = await createTask({ title: 'Todo B' });
    expect(
      (await request(app).get('/tasks?status=todo&page=2&limit=1').expect(200))
        .body,
    ).toEqual([secondTodo]);
  });

  test.each([
    'status=do',
    'status=',
    'status=todo&status=done',
    'page=0',
    'page=-1',
    'page=1abc',
    'page=1.5',
    'page=1&page=2',
    'page[nested]=1',
    'limit=0',
    'limit=101',
    'limit=',
    'unknown=true',
  ])('rejects invalid query %s', async (query) => {
    expect(
      (await request(app).get(`/tasks?${query}`).expect(400)).body.error,
    ).toEqual(expect.any(String));
  });
});

describe('PUT /tasks/:id', () => {
  test('updates supplied fields, preserves assignment, and treats an empty object as a no-op', async () => {
    const task = await createTask({ priority: 'high' });
    const assigned = (
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Preeti' })
    ).body;
    const response = await request(app)
      .put(`/tasks/${task.id}`)
      .send({ title: 'Updated', dueDate: null })
      .expect(200);
    expect(response.body).toEqual({ ...assigned, title: 'Updated' });
    expect(
      (await request(app).put(`/tasks/${task.id}`).send({}).expect(200)).body,
    ).toEqual(response.body);
    expect((await request(app).get('/tasks')).body).toEqual([response.body]);
  });

  test('returns 404 for a missing task', async () => {
    expect(
      (
        await request(app)
          .put('/tasks/missing')
          .send({ title: 'Updated' })
          .expect(404)
      ).body,
    ).toEqual({ error: 'Task not found' });
  });

  test.each([
    { title: '' },
    { status: false },
    { priority: null },
    { dueDate: 0 },
    { id: 'changed' },
    { createdAt: 'changed' },
    { completedAt: 'changed' },
    { assignee: 'Other' },
  ])('rejects %j without changing the task', async (body) => {
    const task = await createTask();
    await request(app).put(`/tasks/${task.id}`).send(body).expect(400);
    expect((await request(app).get('/tasks')).body).toEqual([task]);
  });

  test('maintains completion timestamps when a task is completed and reopened through PUT', async () => {
    const task = await createTask();
    const done = await request(app)
      .put(`/tasks/${task.id}`)
      .send({ status: 'done' })
      .expect(200);
    expect(new Date(done.body.completedAt).toISOString()).toBe(
      done.body.completedAt,
    );
    const reopened = await request(app)
      .put(`/tasks/${task.id}`)
      .send({ status: 'todo' })
      .expect(200);
    expect(reopened.body.completedAt).toBeNull();
  });
});

describe('DELETE /tasks/:id', () => {
  test('returns an empty 204 response and removes only the selected task', async () => {
    const first = await createTask({ title: 'First' });
    const second = await createTask({ title: 'Second' });
    const response = await request(app)
      .delete(`/tasks/${first.id}`)
      .expect(204);
    expect(response.text).toBe('');
    expect((await request(app).get('/tasks')).body).toEqual([second]);
  });

  test('returns 404 for an unknown task', async () => {
    await request(app).delete('/tasks/missing').expect(404);
  });

  test('returns 404 for repeated deletion and cannot complete a deleted task', async () => {
    const task = await createTask();
    await request(app).delete(`/tasks/${task.id}`).expect(204);
    await request(app).delete(`/tasks/${task.id}`).expect(404);
    await request(app).patch(`/tasks/${task.id}/complete`).expect(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('preserves priority and assignment when completing, including repeated requests', async () => {
    const task = await createTask({ priority: 'high' });
    const assigned = (
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Preeti' })
        .expect(200)
    ).body;
    const completed = (
      await request(app).patch(`/tasks/${task.id}/complete`).expect(200)
    ).body;
    expect(completed).toEqual({
      ...assigned,
      status: 'done',
      completedAt: expect.any(String),
    });
    expect(new Date(completed.completedAt).toISOString()).toBe(
      completed.completedAt,
    );
    expect(
      (await request(app).patch(`/tasks/${task.id}/complete`).expect(200)).body,
    ).toEqual(completed);
    expect((await request(app).get('/tasks')).body).toEqual([completed]);
  });

  test('returns 404 for a missing task', async () => {
    await request(app).patch('/tasks/missing/complete').expect(404);
  });

  test('removes a completed task from the overdue count', async () => {
    const task = await createTask({ dueDate: '2000-01-01T00:00:00Z' });
    expect((await request(app).get('/tasks/stats')).body.overdue).toBe(1);
    await request(app).patch(`/tasks/${task.id}/complete`).expect(200);
    expect((await request(app).get('/tasks/stats')).body).toEqual({
      todo: 0,
      in_progress: 0,
      done: 1,
      overdue: 0,
    });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('trims a name, stores it, and preserves unrelated fields', async () => {
    const task = await createTask({ priority: 'high' });
    const response = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: '  Preeti  ' })
      .expect(200);
    expect(response.body).toEqual({ ...task, assignee: 'Preeti' });
    expect((await request(app).get('/tasks')).body).toEqual([response.body]);
  });

  test('allows reassignment and repeated assignment, including completed tasks', async () => {
    const task = await createTask({ status: 'done' });
    await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: 'Alex' })
      .expect(200);
    const reassigned = await request(app)
      .patch(`/tasks/${task.id}/assign`)
      .send({ assignee: '李 明' })
      .expect(200);
    expect(reassigned.body).toEqual({ ...task, assignee: '李 明' });
    expect(
      (
        await request(app)
          .patch(`/tasks/${task.id}/assign`)
          .send({ assignee: '李 明' })
          .expect(200)
      ).body,
    ).toEqual(reassigned.body);
  });

  test.each([
    {},
    { assignee: '' },
    { assignee: '  ' },
    { assignee: null },
    { assignee: 123 },
    { assignee: false },
    { assignee: [] },
    { assignee: {} },
    { assignee: 'Alex', priority: 'low' },
  ])('rejects %j without changing an existing assignment', async (body) => {
    const task = await createTask();
    const assigned = (
      await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Original' })
    ).body;
    await request(app).patch(`/tasks/${task.id}/assign`).send(body).expect(400);
    expect((await request(app).get('/tasks')).body).toEqual([assigned]);
  });

  test('returns 404 for a missing task with valid input', async () => {
    expect(
      (
        await request(app)
          .patch('/tasks/missing/assign')
          .send({ assignee: 'Alex' })
          .expect(404)
      ).body,
    ).toEqual({ error: 'Task not found' });
  });

  test('validates input before checking whether the task exists', async () => {
    await request(app)
      .patch('/tasks/missing/assign')
      .send({ assignee: '' })
      .expect(400);
  });
});

describe('GET /tasks/stats', () => {
  test('returns all counters for an empty store', async () => {
    expect((await request(app).get('/tasks/stats').expect(200)).body).toEqual({
      todo: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    });
  });

  test('counts mixed statuses and only overdue unfinished tasks', async () => {
    await createTask({ dueDate: '2000-01-01T00:00:00Z' });
    await createTask({
      status: 'in_progress',
      dueDate: '2000-01-01T00:00:00Z',
    });
    await createTask({ status: 'done', dueDate: '2000-01-01T00:00:00Z' });
    await createTask({ dueDate: '2099-01-01T00:00:00Z' });
    await createTask();
    expect((await request(app).get('/tasks/stats').expect(200)).body).toEqual({
      todo: 3,
      in_progress: 1,
      done: 1,
      overdue: 2,
    });
  });

  test('reflects deletion in the counts', async () => {
    const task = await createTask({ status: 'done' });
    await request(app).delete(`/tasks/${task.id}`).expect(204);
    expect((await request(app).get('/tasks/stats')).body.done).toBe(0);
  });
});

describe('application responses', () => {
  test('exposes service information and a health endpoint for hosting', async () => {
    expect((await request(app).get('/').expect(200)).body).toMatchObject({
      name: 'Task Manager API',
      storage: 'in-memory',
    });
    expect((await request(app).get('/health').expect(200)).body).toEqual({
      status: 'ok',
    });
  });

  test.each(['[]', 'null', '"text"', '42'])(
    'rejects JSON body %s',
    async (body) => {
      await request(app)
        .post('/tasks')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(400);
    },
  );

  test('returns JSON 400 for malformed JSON', async () => {
    const response = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title":')
      .expect(400);
    expect(response.body).toEqual({
      error: 'Request body must contain valid JSON',
    });
  });

  test('returns JSON 413 for an oversized body', async () => {
    const response = await request(app)
      .post('/tasks')
      .send({ title: 'x'.repeat(110 * 1024) })
      .expect(413);
    expect(response.body).toEqual({ error: 'Request body is too large' });
  });

  test('preserves the client-error status for an unsupported charset', async () => {
    const response = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send('{"title":"Task"}')
      .expect(415);
    expect(response.body).toEqual({ error: 'Invalid request' });
  });

  test('returns JSON 404 for an unknown route', async () => {
    expect((await request(app).get('/missing').expect(404)).body).toEqual({
      error: 'Route not found',
    });
  });

  test('does not expose internals when an unexpected error occurs', async () => {
    jest.spyOn(service, 'getAll').mockImplementation(() => {
      throw new Error('private implementation detail');
    });
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect((await request(app).get('/tasks').expect(500)).body).toEqual({
      error: 'Internal server error',
    });
    expect(log).toHaveBeenCalled();
  });
});
