/**
 * In-memory ticket store behind the REST API.
 *
 * Validation and the status/priority vocabulary are imported from the app's
 * model rather than restated here, so the API and the browser UI can never
 * disagree about what a valid ticket is.
 *
 * State lives in this process and nowhere else: restarting the server (or
 * calling reset) returns the board to its seed. That is deliberate for a demo,
 * and it is why the API tests run serially — see the note in e2e/api.
 */

import { SEED_TICKETS, isPriority, isStatus, validateTicket } from '../app/src/model.js';

/** Node < 17 lacks structuredClone; tickets are plain JSON. */
const cloneTickets = (tickets) => JSON.parse(JSON.stringify(tickets));

export class ValidationError extends Error {
  /** @param {Record<string, string>} fields field name -> message */
  constructor(fields) {
    super('Ticket is not valid');
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

export class TicketRepository {
  #tickets = [];
  #seed;

  constructor(seed = SEED_TICKETS) {
    this.#seed = seed;
    this.reset();
  }

  /** Restores the seed board. Exposed over HTTP so tests can isolate runs. */
  reset() {
    this.#tickets = cloneTickets(this.#seed);
    return this.list();
  }

  /**
   * @param {{ status?: string, priority?: string, assignee?: string, q?: string }} filters
   */
  list(filters = {}) {
    const { status, priority, assignee, q } = filters;
    const needle = q?.trim().toLowerCase();

    return this.#tickets.filter((ticket) => {
      if (status && ticket.status !== status) return false;
      if (priority && ticket.priority !== priority) return false;
      if (assignee && ticket.assignee !== assignee) return false;
      if (!needle) return true;
      return [ticket.key, ticket.title, ticket.description]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }

  get(key) {
    return this.#tickets.find((ticket) => ticket.key === key);
  }

  #nextKey() {
    const highest = this.#tickets.reduce((max, ticket) => {
      const n = Number.parseInt(ticket.key.replace(/^TASK-/, ''), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    return `TASK-${highest + 1}`;
  }

  /**
   * Builds the ticket a write would produce and validates it as a whole, so a
   * partial update is judged on the record it results in rather than on the
   * handful of fields the caller happened to send.
   *
   * @throws {ValidationError}
   */
  #validated(body, existing) {
    const next = {
      key: existing?.key ?? '',
      title: String(body.title ?? existing?.title ?? ''),
      description: String(body.description ?? existing?.description ?? ''),
      status: String(body.status ?? existing?.status ?? 'backlog'),
      priority: String(body.priority ?? existing?.priority ?? 'medium'),
      assignee: String(body.assignee ?? existing?.assignee ?? ''),
    };

    const errors = validateTicket(next);
    if (!isStatus(next.status)) errors.status = `Unknown status: ${next.status}`;
    if (!isPriority(next.priority)) errors.priority = `Unknown priority: ${next.priority}`;
    if (Object.keys(errors).length > 0) throw new ValidationError(errors);

    next.title = next.title.trim();
    next.description = next.description.trim();
    next.assignee = next.assignee.trim();
    return next;
  }

  /** @throws {ValidationError} */
  create(body) {
    const ticket = { ...this.#validated(body, null), key: this.#nextKey() };
    this.#tickets.push(ticket);
    return ticket;
  }

  /** Returns undefined when the ticket does not exist. @throws {ValidationError} */
  update(key, body) {
    const existing = this.get(key);
    if (!existing) return undefined;
    Object.assign(existing, this.#validated(body, existing), { key: existing.key });
    return existing;
  }

  /** Returns the removed ticket, or undefined when it did not exist. */
  remove(key) {
    const index = this.#tickets.findIndex((ticket) => ticket.key === key);
    if (index === -1) return undefined;
    return this.#tickets.splice(index, 1)[0];
  }

  get size() {
    return this.#tickets.length;
  }
}
