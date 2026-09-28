const service = require('../src/services/taskService');

const NOW = '2026-06-15T12:00:00.000Z';

beforeEach(() => {
  service._reset();
  jest.useFakeTimers().setSystemTime(new Date(NOW));
});

afterEach(() => jest.useRealTimers());

describe('create and read', () => {
  test('creates a task with defaults and server-owned fields', () => {
    const task = service.create({ title: 'Write tests' });
    expect(task).toEqual({
      id: expect.stringMatching(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,
      ),
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      assignee: null,
      completedAt: null,
      createdAt: NOW,
    });
    expect(service.findById(task.id)).toEqual(task);
  });

  test('keeps supplied editable fields and generates distinct IDs', () => {
    const fields = {
      title: 'Review',
      description: 'API contract',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-06-16T09:00:00Z',
    };
    const first = service.create(fields);
    const second = service.create(fields);
    expect(first).toMatchObject(fields);
    expect(first.id).not.toBe(second.id);
    expect(service.getAll()).toHaveLength(2);
  });

  test('returns an empty list and undefined for a missing task', () => {
    expect(service.getAll()).toEqual([]);
    expect(service.findById('missing')).toBeUndefined();
  });

  test('timestamps tasks created as done', () => {
    expect(
      service.create({ title: 'Finished', status: 'done' }).completedAt,
    ).toBe(NOW);
  });

  test('read and write results cannot mutate the stored task', () => {
    const task = service.create({ title: 'Original' });
    task.title = 'Changed through create';
    service.getAll()[0].title = 'Changed through list';
    service.findById(task.id).title = 'Changed through lookup';
    service.getByStatus('todo')[0].title = 'Changed through filter';
    service.getPaginated(1, 1)[0].title = 'Changed through pagination';
    service.getAll().pop();
    expect(service.getAll()).toHaveLength(1);
    expect(service.findById(task.id).title).toBe('Original');
  });
});

describe('filtering and pagination', () => {
  beforeEach(() => {
    ['A', 'B', 'C', 'D', 'E'].forEach((title, index) =>
      service.create({ title, status: index % 2 ? 'done' : 'todo' }),
    );
  });

  test('matches the entire status, never a substring', () => {
    expect(service.getByStatus('todo').map((task) => task.title)).toEqual([
      'A',
      'C',
      'E',
    ]);
    expect(service.getByStatus('do')).toEqual([]);
    expect(service.getByStatus('in_progress')).toEqual([]);
  });

  test.each([
    [1, 2, ['A', 'B']],
    [2, 2, ['C', 'D']],
    [3, 2, ['E']],
    [4, 2, []],
    [1, 10, ['A', 'B', 'C', 'D', 'E']],
  ])('page %i with limit %i returns %j', (page, limit, titles) => {
    expect(service.getPaginated(page, limit).map((task) => task.title)).toEqual(
      titles,
    );
  });

  test('paginates the filtered set', () => {
    expect(
      service.getPaginated(2, 2, 'todo').map((task) => task.title),
    ).toEqual(['E']);
  });
});

describe('updates and completion', () => {
  test('updates allowed fields while retaining omitted fields', () => {
    const task = service.create({ title: 'Before', priority: 'high' });
    const updated = service.update(task.id, {
      title: 'After',
      description: 'Reviewed',
    });
    expect(updated).toEqual({
      ...task,
      title: 'After',
      description: 'Reviewed',
    });
    updated.title = 'External mutation';
    expect(service.findById(task.id).title).toBe('After');
  });

  test('does not accept identity, timestamps, assignment, or arbitrary fields through update', () => {
    const task = service.create({ title: 'Protected' });
    expect(
      service.update(task.id, {
        id: 'changed',
        createdAt: 'changed',
        completedAt: 'changed',
        assignee: 'Other',
        extra: true,
      }),
    ).toEqual(task);
  });

  test('missing updates and completions do not change the store', () => {
    expect(service.update('missing', { title: 'Changed' })).toBeNull();
    expect(service.completeTask('missing')).toBeNull();
    expect(service.getAll()).toEqual([]);
  });

  test.each(['low', 'medium', 'high'])(
    'completion preserves %s priority and all unrelated fields',
    (priority) => {
      const task = service.create({
        title: 'Complete me',
        priority,
        dueDate: '2026-06-14T00:00:00Z',
      });
      const completed = service.completeTask(task.id);
      expect(completed).toEqual({ ...task, status: 'done', completedAt: NOW });
      completed.title = 'External mutation';
      expect(service.findById(task.id).title).toBe('Complete me');
      expect(service.getStats().overdue).toBe(0);
    },
  );

  test('repeated completion preserves the original timestamp', () => {
    const task = service.create({ title: 'Once' });
    const completed = service.completeTask(task.id);
    jest.setSystemTime(new Date('2026-06-16T12:00:00Z'));
    expect(service.completeTask(task.id)).toEqual(completed);
  });

  test('status updates set, preserve, clear, and renew completion timestamps', () => {
    const task = service.create({ title: 'Lifecycle' });
    expect(service.update(task.id, { status: 'done' }).completedAt).toBe(NOW);
    jest.setSystemTime(new Date('2026-06-16T12:00:00Z'));
    expect(
      service.update(task.id, { title: 'Still done', status: 'done' })
        .completedAt,
    ).toBe(NOW);
    expect(
      service.update(task.id, { status: 'in_progress' }).completedAt,
    ).toBeNull();
    expect(service.update(task.id, { status: 'done' }).completedAt).toBe(
      '2026-06-16T12:00:00.000Z',
    );
  });
});

describe('assignment and deletion', () => {
  test('assigns, reassigns, and leaves identical assignments unchanged', () => {
    const task = service.create({ title: 'Assign me' });
    expect(service.assignTask(task.id, 'Preeti')).toEqual({
      ...task,
      assignee: 'Preeti',
    });
    const reassigned = service.assignTask(task.id, 'Alex');
    expect(reassigned.assignee).toBe('Alex');
    expect(service.assignTask(task.id, 'Alex')).toEqual(reassigned);
    reassigned.assignee = 'External mutation';
    expect(service.findById(task.id).assignee).toBe('Alex');
  });

  test('returns null when assigning a missing task', () => {
    expect(service.assignTask('missing', 'Preeti')).toBeNull();
    expect(service.getAll()).toEqual([]);
  });

  test('deletes only the requested task', () => {
    const first = service.create({ title: 'First' });
    const second = service.create({ title: 'Second' });
    expect(service.remove(first.id)).toBe(true);
    expect(service.findById(first.id)).toBeUndefined();
    expect(service.getAll()).toEqual([second]);
    expect(service.remove(first.id)).toBe(false);
  });

  test('missing deletion leaves existing tasks unchanged', () => {
    const task = service.create({ title: 'Keep' });
    expect(service.remove('missing')).toBe(false);
    expect(service.getAll()).toEqual([task]);
  });
});

describe('statistics', () => {
  test('returns zero counts for an empty store', () => {
    expect(service.getStats()).toEqual({
      todo: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    });
  });

  test('counts statuses and excludes completed, future, and undated tasks from overdue', () => {
    const past = '2026-06-15T11:59:59.999Z';
    service.create({ title: 'Late todo', dueDate: past });
    service.create({
      title: 'Late active',
      status: 'in_progress',
      dueDate: past,
    });
    service.create({ title: 'Finished', status: 'done', dueDate: past });
    service.create({ title: 'Future', dueDate: '2026-06-16T12:00:00Z' });
    service.create({ title: 'No deadline' });
    service.create({ title: 'Exactly now', dueDate: NOW });
    expect(service.getStats()).toEqual({
      todo: 4,
      in_progress: 1,
      done: 1,
      overdue: 2,
    });
  });

  test('compares equivalent instants across time zones', () => {
    service.create({ title: 'Due now', dueDate: '2026-06-15T17:30:00+05:30' });
    service.create({ title: 'Late', dueDate: '2026-06-15T17:29:59+05:30' });
    expect(service.getStats().overdue).toBe(1);
  });
});
