/**
 * Shared ticket types, board vocabulary and builders used to seed tests.
 *
 * Keeping this beside the specs (rather than importing from the app) keeps the
 * suite honest: if the app renames a status the tests should fail, not silently
 * follow along.
 */

export const STORAGE_KEY = 'taskflow.tickets.v1';

export const TICKET_STATUSES = ['backlog', 'in_progress', 'review', 'done'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export interface Ticket {
  key: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string;
}

/** Human-readable column headings, as rendered by the app. */
export const STATUS_LABELS: Record<TicketStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/** The board a first-time visitor sees, mirroring the app's seed data. */
export const SEED_TICKETS: Ticket[] = [
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

let sequence = 0;

/** Builds a ticket with unique-per-call defaults, overridable field by field. */
export function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  sequence += 1;
  return {
    key: `TASK-${900 + sequence}`,
    title: `Generated ticket ${sequence}`,
    description: `Seeded by the test suite (#${sequence}).`,
    status: 'backlog',
    priority: 'medium',
    assignee: 'Test Bot',
    ...overrides,
  };
}

/** A draft as typed into the create/edit dialog (no key: the app assigns it). */
export type TicketDraft = Omit<Partial<Ticket>, 'key'> & { title: string; assignee: string };
