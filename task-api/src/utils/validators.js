const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const TASK_FIELDS = ['title', 'description', 'status', 'priority', 'dueDate'];

const validateObject = (body, allowedFields) => {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return 'Request body must be a JSON object';
  }
  const unknown = Object.keys(body).find(
    (field) => !allowedFields.includes(field),
  );
  return unknown !== undefined ? `Unknown field: ${unknown}` : null;
};

const isValidDueDate = (value) => {
  if (typeof value !== 'string') return false;
  const match =
    /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      value,
    );
  if (!match) return false;

  // Date.parse normalizes impossible dates such as February 30 instead of rejecting them.
  const [year, month, day] = match.slice(1).map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
};

const validateTask = (body, requireTitle) => {
  const error = validateObject(body, TASK_FIELDS);
  if (error) return error;

  if (requireTitle || Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return 'title must be a non-empty string';
    }
  }
  if (
    Object.hasOwn(body, 'description') &&
    typeof body.description !== 'string'
  ) {
    return 'description must be a string';
  }
  if (Object.hasOwn(body, 'status') && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (
    Object.hasOwn(body, 'priority') &&
    !VALID_PRIORITIES.includes(body.priority)
  ) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (
    Object.hasOwn(body, 'dueDate') &&
    body.dueDate !== null &&
    !isValidDueDate(body.dueDate)
  ) {
    return 'dueDate must be null or an ISO date-time with seconds and a timezone';
  }
  return null;
};

const validateCreateTask = (body) => validateTask(body, true);
const validateUpdateTask = (body) => validateTask(body, false);

const validateAssignTask = (body) => {
  const error = validateObject(body, ['assignee']);
  if (error) return error;
  if (typeof body.assignee !== 'string' || body.assignee.trim() === '') {
    return 'assignee must be a non-empty string';
  }
  return null;
};

const isPositiveInteger = (value) =>
  typeof value === 'string' &&
  /^[1-9]\d*$/.test(value) &&
  Number.isSafeInteger(Number(value));

const validateTaskQuery = (query) => {
  const unknown = Object.keys(query).find(
    (field) => !['status', 'page', 'limit'].includes(field),
  );
  if (unknown !== undefined) return `Unknown query parameter: ${unknown}`;
  if (query.status !== undefined && !VALID_STATUSES.includes(query.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (query.page !== undefined && !isPositiveInteger(query.page)) {
    return 'page must be a positive integer';
  }
  if (
    query.limit !== undefined &&
    (!isPositiveInteger(query.limit) || Number(query.limit) > 100)
  ) {
    return 'limit must be a positive integer no greater than 100';
  }
  return null;
};

module.exports = {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
  validateTaskQuery,
};
