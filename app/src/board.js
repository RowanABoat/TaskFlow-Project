/**
 * Renders the board from store state and wires up card interactions:
 * edit, delete, and pointer-based drag between columns.
 */

import { PRIORITIES, STATUSES, priorityLabel, statusLabel } from './model.js';

const DRAG_THRESHOLD_PX = 4;

export class Board {
  #root;
  #store;
  #onEdit;
  #onNotify;
  #drag = null;

  constructor({ root, store, onEdit, onNotify }) {
    this.#root = root;
    this.#store = store;
    this.#onEdit = onEdit;
    this.#onNotify = onNotify;

    this.#root.addEventListener('click', (event) => this.#handleClick(event));
    this.#root.addEventListener('change', (event) => this.#handleChange(event));
    this.#root.addEventListener('mousedown', (event) => this.#startDrag(event));
    document.addEventListener('mousemove', (event) => this.#moveDrag(event));
    document.addEventListener('mouseup', (event) => this.#endDrag(event));
  }

  render() {
    const scrollTops = new Map();
    for (const body of this.#root.querySelectorAll('[data-testid="column-body"]')) {
      scrollTops.set(body.dataset.status, body.scrollTop);
    }

    this.#root.replaceChildren(
      ...STATUSES.map((status) => this.#renderColumn(status, scrollTops.get(status.id))),
    );
  }

  #renderColumn(status, scrollTop) {
    const tickets = this.#store.ticketsByStatus(status.id);

    const column = el('section', {
      class: 'column',
      'data-testid': 'column',
      'data-status': status.id,
      'aria-label': status.label,
    });

    const header = el('header', { class: 'column-header' });
    header.append(
      el('h2', { class: 'column-title' }, status.label),
      el(
        'span',
        { class: 'column-count', 'data-testid': 'column-count' },
        String(tickets.length),
      ),
    );

    const body = el('div', {
      class: 'column-body',
      'data-testid': 'column-body',
      'data-status': status.id,
    });

    if (tickets.length === 0) {
      body.append(
        el(
          'p',
          { class: 'empty', 'data-testid': 'column-empty' },
          this.#store.hasActiveFilters ? 'No matching tickets' : 'Nothing here yet',
        ),
      );
    } else {
      body.append(...tickets.map((ticket) => this.#renderCard(ticket)));
    }

    column.append(header, body);
    if (scrollTop) body.scrollTop = scrollTop;
    return column;
  }

  #renderCard(ticket) {
    const card = el('article', {
      class: 'card',
      'data-testid': 'ticket-card',
      'data-key': ticket.key,
      'data-status': ticket.status,
      'aria-label': `${ticket.key}: ${ticket.title}`,
    });

    const top = el('div', { class: 'card-top' });
    top.append(
      el('span', { class: 'card-key', 'data-testid': 'ticket-key' }, ticket.key),
      el(
        'span',
        {
          class: `badge badge-${ticket.priority}`,
          'data-testid': 'ticket-priority',
          'data-priority': ticket.priority,
        },
        priorityLabel(ticket.priority),
      ),
    );

    const title = el('h3', { class: 'card-title', 'data-testid': 'ticket-title' }, ticket.title);

    const bottom = el('div', { class: 'card-bottom' });
    const assignee = el('span', {
      class: 'assignee',
      'data-testid': 'ticket-assignee',
    });
    assignee.append(
      el('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(ticket.assignee)),
      el('span', {}, ticket.assignee),
    );

    const move = el('select', {
      class: 'move-select',
      'aria-label': `Move ${ticket.key} to another column`,
      'data-action': 'move',
    });
    move.append(
      ...STATUSES.map((status) =>
        el(
          'option',
          status.id === ticket.status ? { value: status.id, selected: 'selected' } : { value: status.id },
          status.label,
        ),
      ),
    );

    const actions = el('div', { class: 'card-actions' });
    actions.append(
      move,
      el(
        'button',
        { type: 'button', class: 'btn btn-icon', 'data-action': 'edit', 'aria-label': `Edit ${ticket.key}` },
        'Edit',
      ),
      el(
        'button',
        { type: 'button', class: 'btn btn-icon btn-danger', 'data-action': 'delete', 'aria-label': `Delete ${ticket.key}` },
        'Delete',
      ),
    );

    bottom.append(assignee, actions);
    card.append(top, title);
    if (ticket.description) {
      card.append(
        el('p', { class: 'card-description', 'data-testid': 'ticket-description' }, ticket.description),
      );
    }
    card.append(bottom);
    return card;
  }

  #handleClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const key = button.closest('[data-key]')?.dataset.key;
    if (!key) return;

    if (button.dataset.action === 'edit') {
      this.#onEdit(this.#store.find(key));
      return;
    }

    if (button.dataset.action === 'delete') {
      const ticket = this.#store.find(key);
      if (!ticket) return;
      if (!window.confirm(`Delete ${ticket.key}? This cannot be undone.`)) return;
      this.#store.remove(key);
      this.#onNotify(`${key} deleted`);
    }
  }

  #handleChange(event) {
    const select = event.target.closest('select[data-action="move"]');
    if (!select) return;
    const key = select.closest('[data-key]')?.dataset.key;
    if (!key) return;
    if (this.#store.move(key, select.value)) {
      this.#onNotify(`${key} moved to ${statusLabel(select.value)}`);
    }
  }

  #startDrag(event) {
    if (event.button !== 0) return;
    if (event.target.closest('button, select, input, textarea, a')) return;
    const card = event.target.closest('[data-testid="ticket-card"]');
    if (!card) return;

    this.#drag = {
      key: card.dataset.key,
      originX: event.clientX,
      originY: event.clientY,
      active: false,
    };
  }

  #moveDrag(event) {
    if (!this.#drag) return;

    if (!this.#drag.active) {
      const travelled =
        Math.abs(event.clientX - this.#drag.originX) +
        Math.abs(event.clientY - this.#drag.originY);
      if (travelled < DRAG_THRESHOLD_PX) return;
      this.#drag.active = true;
      this.#cardFor(this.#drag.key)?.classList.add('is-dragging');
      document.body.classList.add('is-dragging-ticket');
    }

    event.preventDefault();
    const column = this.#columnAt(event.clientX, event.clientY);
    for (const candidate of this.#root.querySelectorAll('.column')) {
      candidate.classList.toggle('is-drop-target', candidate === column);
    }
  }

  #endDrag(event) {
    const drag = this.#drag;
    this.#drag = null;
    if (!drag) return;

    document.body.classList.remove('is-dragging-ticket');
    this.#cardFor(drag.key)?.classList.remove('is-dragging');
    const column = this.#columnAt(event.clientX, event.clientY);
    for (const candidate of this.#root.querySelectorAll('.column')) {
      candidate.classList.remove('is-drop-target');
    }

    if (!drag.active || !column) return;
    const status = column.dataset.status;
    if (this.#store.move(drag.key, status)) {
      this.#onNotify(`${drag.key} moved to ${statusLabel(status)}`);
    }
  }

  #cardFor(key) {
    return this.#root.querySelector(`[data-testid="ticket-card"][data-key="${key}"]`);
  }

  #columnAt(x, y) {
    return document.elementFromPoint(x, y)?.closest('.column') ?? null;
  }
}

export function el(tag, attrs = {}, text) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export { PRIORITIES, STATUSES };
