/**
 * Domain model for TaskFlow tickets: statuses, priorities and the seed board
 * that a first-time visitor sees.
 */

export const STATUSES = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'review', label: 'In Review' },
  { id: 'done', label: 'Done' },
];

export const PRIORITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
  { id: 'critical', label: 'Critical' },
];

export const statusLabel = (id) =>
  STATUSES.find((s) => s.id === id)?.label ?? id;

export const priorityLabel = (id) =>
  PRIORITIES.find((p) => p.id === id)?.label ?? id;

export const isStatus = (id) => STATUSES.some((s) => s.id === id);
export const isPriority = (id) => PRIORITIES.some((p) => p.id === id);

export const SEED_TICKETS = [
  {
    key: 'TASK-1',
    title: 'Set up authentication service',
    description: 'Wire up OAuth so the board can be shared across a team.',
    status: 'in_progress',
    priority: 'high',
    assignee: 'Rowan',
  },
  {
    key: 'TASK-2',
    title: 'Design ticket detail layout',
    description: 'Comments, attachments and the activity log need a home.',
    status: 'backlog',
    priority: 'medium',
    assignee: 'Priya',
  },
  {
    key: 'TASK-3',
    title: 'Fix column count badge off-by-one',
    description: 'Counts include archived tickets when a filter is active.',
    status: 'review',
    priority: 'critical',
    assignee: 'Rowan',
  },
  {
    key: 'TASK-4',
    title: 'Add keyboard shortcuts',
    description: 'At minimum: c to create, / to focus search.',
    status: 'backlog',
    priority: 'low',
    assignee: 'Sam',
  },
  {
    key: 'TASK-5',
    title: 'Publish the v0 changelog',
    description: 'Summarise everything shipped in the first milestone.',
    status: 'done',
    priority: 'medium',
    assignee: 'Priya',
  },
];

/**
 * Validates a ticket draft coming out of the create/edit dialog.
 * Returns a map of field name -> message; empty means valid.
 */
export function validateTicket(draft) {
  const errors = {};
  const title = (draft.title ?? '').trim();
  const assignee = (draft.assignee ?? '').trim();

  if (!title) {
    errors.title = 'Title is required';
  } else if (title.length < 4) {
    errors.title = 'Title must be at least 4 characters';
  } else if (title.length > 120) {
    errors.title = 'Title must be 120 characters or fewer';
  }

  if (!assignee) {
    errors.assignee = 'Assignee is required';
  }

  return errors;
}
