const { randomUUID } = require('node:crypto');

let tasks = [];

const EDITABLE_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'dueDate',
];

const getAll = () => tasks.map((task) => ({ ...task }));

const findById = (id) => {
  const task = tasks.find((task) => task.id === id);
  return task ? { ...task } : undefined;
};

const getByStatus = (status) =>
  tasks.filter((task) => task.status === status).map((task) => ({ ...task }));

const getPaginated = (page, limit, status) => {
  const matching = status === undefined ? getAll() : getByStatus(status);
  const offset = (page - 1) * limit;
  return matching.slice(offset, offset + limit);
};

const getStats = () => {
  const now = new Date();
  const counts = { todo: 0, in_progress: 0, done: 0 };
  let overdue = 0;

  tasks.forEach((t) => {
    counts[t.status]++;
    if (t.dueDate && t.status !== 'done' && new Date(t.dueDate) < now) {
      overdue++;
    }
  });

  return { ...counts, overdue };
};

const create = ({
  title,
  description = '',
  status = 'todo',
  priority = 'medium',
  dueDate = null,
}) => {
  const now = new Date().toISOString();
  const task = {
    id: randomUUID(),
    title,
    description,
    status,
    priority,
    dueDate,
    assignee: null,
    completedAt: status === 'done' ? now : null,
    createdAt: now,
  };
  tasks.push(task);
  return { ...task };
};

const update = (id, fields) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const editable = Object.fromEntries(
    Object.entries(fields).filter(([field]) => EDITABLE_FIELDS.includes(field)),
  );
  const updated = { ...tasks[index], ...editable };
  // Reopening clears completion time; repeated completion preserves the first timestamp.
  updated.completedAt =
    updated.status === 'done'
      ? tasks[index].completedAt || new Date().toISOString()
      : null;
  tasks[index] = updated;
  return { ...updated };
};

const remove = (id) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;

  tasks.splice(index, 1);
  return true;
};

const completeTask = (id) => update(id, { status: 'done' });

const assignTask = (id, assignee) => {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const updated = { ...tasks[index], assignee: assignee.trim() };
  tasks[index] = updated;
  return { ...updated };
};

const _reset = () => {
  tasks = [];
};

module.exports = {
  getAll,
  findById,
  getByStatus,
  getPaginated,
  getStats,
  create,
  update,
  remove,
  completeTask,
  assignTask,
  _reset,
};
