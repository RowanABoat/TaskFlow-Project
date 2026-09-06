/**
 * Ticket store. Owns the ticket list, the active filters and persistence to
 * localStorage. Subscribers are notified after every mutation so the UI layer
 * can stay a pure render of this state.
 */

import { SEED_TICKETS, isPriority, isStatus } from './model.js';

/** Node < 17 and some older browsers lack structuredClone; tickets are plain JSON. */
const cloneTickets = (tickets) => JSON.parse(JSON.stringify(tickets));

const STORAGE_KEY = 'taskflow.tickets.v1';

export class TicketStore {
  #tickets = [];
  #filters = { search: '', priority: '', assignee: '' };
  #listeners = new Set();

  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.#tickets = this.#load();
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    this.#pruneFilters();
    this.#persist();
    for (const listener of this.#listeners) listener();
  }

  /** Drops an assignee filter whose last ticket has just left the board. */
  #pruneFilters() {
    const { assignee } = this.#filters;
    if (assignee && !this.#tickets.some((ticket) => ticket.assignee === assignee)) {
      this.#filters.assignee = '';
    }
  }

  #load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return cloneTickets(SEED_TICKETS);
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return cloneTickets(SEED_TICKETS);
      return parsed.filter(
        (t) => t && typeof t.key === 'string' && isStatus(t.status) && isPriority(t.priority),
      );
    } catch {
      // A corrupt or unavailable store should never break the board.
      return cloneTickets(SEED_TICKETS);
    }
  }

  #persist() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.#tickets));
    } catch {
      // Storage may be full or blocked; the in-memory board still works.
    }
  }

  /** Every ticket, newest key last, regardless of filters. */
  get tickets() {
    return [...this.#tickets];
  }

  get filters() {
    return { ...this.#filters };
  }

  get assignees() {
    return [...new Set(this.#tickets.map((t) => t.assignee))].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  get hasActiveFilters() {
    const { search, priority, assignee } = this.#filters;
    return Boolean(search || priority || assignee);
  }

  setFilter(name, value) {
    if (!(name in this.#filters)) throw new Error(`Unknown filter: ${name}`);
    this.#filters[name] = value;
    this.#emit();
  }

  clearFilters() {
    this.#filters = { search: '', priority: '', assignee: '' };
    this.#emit();
  }

  /** Tickets matching the active filters, in board order. */
  get visibleTickets() {
    const { search, priority, assignee } = this.#filters;
    const needle = search.trim().toLowerCase();

    return this.#tickets.filter((ticket) => {
      if (priority && ticket.priority !== priority) return false;
      if (assignee && ticket.assignee !== assignee) return false;
      if (!needle) return true;
      return [ticket.key, ticket.title, ticket.description]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }

  ticketsByStatus(status) {
    return this.visibleTickets.filter((ticket) => ticket.status === status);
  }

  find(key) {
    return this.#tickets.find((ticket) => ticket.key === key);
  }

  #nextKey() {
    const highest = this.#tickets.reduce((max, ticket) => {
      const n = Number.parseInt(ticket.key.replace(/^TASK-/, ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    return `TASK-${highest + 1}`;
  }

  create(draft) {
    const ticket = {
      key: this.#nextKey(),
      title: draft.title.trim(),
      description: (draft.description ?? '').trim(),
      status: isStatus(draft.status) ? draft.status : 'backlog',
      priority: isPriority(draft.priority) ? draft.priority : 'medium',
      assignee: draft.assignee.trim(),
    };
    this.#tickets.push(ticket);
    this.#emit();
    return ticket;
  }

  update(key, changes) {
    const ticket = this.find(key);
    if (!ticket) return undefined;

    if (changes.title !== undefined) ticket.title = changes.title.trim();
    if (changes.description !== undefined) ticket.description = changes.description.trim();
    if (changes.assignee !== undefined) ticket.assignee = changes.assignee.trim();
    if (changes.status !== undefined && isStatus(changes.status)) ticket.status = changes.status;
    if (changes.priority !== undefined && isPriority(changes.priority)) {
      ticket.priority = changes.priority;
    }

    this.#emit();
    return ticket;
  }

  /** Moves a ticket to another column. Returns true when the status changed. */
  move(key, status) {
    const ticket = this.find(key);
    if (!ticket || !isStatus(status) || ticket.status === status) return false;
    ticket.status = status;
    this.#emit();
    return true;
  }

  remove(key) {
    const index = this.#tickets.findIndex((ticket) => ticket.key === key);
    if (index === -1) return undefined;
    const [removed] = this.#tickets.splice(index, 1);
    this.#emit();
    return removed;
  }

  /** Test/demo helper: wipe persisted state and start from the seed board. */
  reset() {
    this.#tickets = cloneTickets(SEED_TICKETS);
    this.#filters = { search: '', priority: '', assignee: '' };
    this.#emit();
  }
}
