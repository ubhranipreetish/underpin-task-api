const {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
  validateTaskQuery,
} = require('../src/utils/validators');

describe.each([
  ['create', (body) => validateCreateTask({ title: 'Task', ...body })],
  ['update', validateUpdateTask],
])('%s validation', (_, validate) => {
  test.each(['todo', 'in_progress', 'done'].map((value) => [value]))(
    'accepts status %s',
    (status) => {
      expect(validate({ status })).toBeNull();
    },
  );

  test.each(['low', 'medium', 'high'].map((value) => [value]))(
    'accepts priority %s',
    (priority) => {
      expect(validate({ priority })).toBeNull();
    },
  );

  test.each([null, '', false, 0, [], {}, 'pending'].map((value) => [value]))(
    'rejects invalid status %j',
    (status) => {
      expect(validate({ status })).toMatch(/status/);
    },
  );

  test.each([null, '', false, 0, [], {}, 'urgent'].map((value) => [value]))(
    'rejects invalid priority %j',
    (priority) => {
      expect(validate({ priority })).toMatch(/priority/);
    },
  );

  test.each([null, '', '   ', 0, false, [], {}].map((value) => [value]))(
    'rejects invalid title %j',
    (title) => {
      expect(validate({ title })).toMatch(/title/);
    },
  );

  test.each([null, 0, false, [], {}].map((value) => [value]))(
    'rejects non-string description %j',
    (description) => {
      expect(validate({ description })).toMatch(/description/);
    },
  );

  test.each(
    [
      null,
      '2026-06-15T12:00:00Z',
      '2024-02-29T12:00:00.123Z',
      '2000-02-29T12:00:00Z',
      '2026-06-15T17:30:00+05:30',
      '2026-06-15T07:00:00-05:00',
    ].map((value) => [value]),
  )('accepts dueDate %j', (dueDate) => {
    expect(validate({ dueDate })).toBeNull();
  });

  test.each(
    [
      '',
      false,
      0,
      123,
      [],
      {},
      'not-a-date',
      '06/15/2026',
      '2026-06-15',
      '2026-02-29T12:00:00Z',
      '1900-02-29T12:00:00Z',
      '2026-04-31T12:00:00Z',
      '2026-13-01T12:00:00Z',
      '2026-00-01T12:00:00Z',
      '2026-06-00T12:00:00Z',
      '2026-06-15T24:00:00Z',
      '2026-06-15T12:60:00Z',
      '2026-06-15T12:00:60Z',
      '2026-06-15T12:00:00',
      '2026-06-15T12:00:00+24:00',
    ].map((value) => [value]),
  )('rejects invalid dueDate %j', (dueDate) => {
    expect(validate({ dueDate })).toMatch(/dueDate/);
  });

  test.each(
    ['id', 'createdAt', 'completedAt', 'assignee', 'unexpected', ''].map(
      (value) => [value],
    ),
  )('rejects unsupported field %s', (field) => {
    expect(validate({ [field]: 'value' })).toMatch(/Unknown field/);
  });

  test('accepts an empty description', () => {
    expect(validate({ description: '' })).toBeNull();
  });
});

test.each([null, undefined, [], 'string', 42, true].map((value) => [value]))(
  'all body validators reject non-object %j',
  (body) => {
    for (const validate of [
      validateCreateTask,
      validateUpdateTask,
      validateAssignTask,
    ]) {
      expect(validate(body)).toMatch(/JSON object/);
    }
  },
);

test('creation requires a title while an empty update is a no-op', () => {
  expect(validateCreateTask({})).toMatch(/title/);
  expect(validateUpdateTask({})).toBeNull();
});

describe('assignment validation', () => {
  test.each(
    ['Preeti', '  Alex  ', '李 明', 'Anne-Marie O’Neill'].map((value) => [
      value,
    ]),
  )('accepts name %j', (assignee) => {
    expect(validateAssignTask({ assignee })).toBeNull();
  });

  test.each(
    [undefined, null, '', ' \t\n ', 0, false, [], {}].map((value) => [value]),
  )('rejects assignee %j', (assignee) => {
    expect(validateAssignTask({ assignee })).toMatch(/assignee/);
  });

  test('rejects extra fields', () => {
    expect(validateAssignTask({ assignee: 'Alex', status: 'done' })).toMatch(
      /Unknown field/,
    );
  });
});

describe('list query validation', () => {
  test.each(
    [
      {},
      { status: 'todo' },
      { page: '1' },
      { limit: '100' },
      { status: 'done', page: '2', limit: '10' },
    ].map((value) => [value]),
  )('accepts %j', (query) => {
    expect(validateTaskQuery(query)).toBeNull();
  });

  test.each(
    [
      '',
      '0',
      '-1',
      '1.5',
      '1abc',
      'Infinity',
      '9007199254740992',
      ['1', '2'],
      { nested: '1' },
    ].map((value) => [value]),
  )('rejects invalid page %j', (page) => {
    expect(validateTaskQuery({ page })).toMatch(/page/);
  });

  test.each(
    ['', '0', '-1', '1.5', '1abc', '101', ['1', '2']].map((value) => [value]),
  )('rejects invalid limit %j', (limit) => {
    expect(validateTaskQuery({ limit })).toMatch(/limit/);
  });

  test.each(
    ['', 'do', 'pending', ['todo', 'done'], { value: 'todo' }].map((value) => [
      value,
    ]),
  )('rejects invalid status %j', (status) => {
    expect(validateTaskQuery({ status })).toMatch(/status/);
  });

  test('rejects unknown query parameters', () => {
    expect(validateTaskQuery({ stats: 'true' })).toMatch(
      /Unknown query parameter/,
    );
    expect(validateTaskQuery({ '': 'true' })).toMatch(
      /Unknown query parameter/,
    );
  });
});
