/**
 * Create/edit ticket dialog. Owns its own validation display and hands a
 * validated draft back to the caller on submit.
 */

import { STATUSES, validateTicket } from './model.js';
import { el } from './board.js';

export class TicketDialog {
  #dialog;
  #form;
  #title;
  #store;
  #onSubmit;
  #editingKey = null;

  constructor({ dialog, store, onSubmit }) {
    this.#dialog = dialog;
    this.#form = dialog.querySelector('#ticket-form');
    this.#title = dialog.querySelector('#dialog-title');
    this.#store = store;
    this.#onSubmit = onSubmit;

    this.#form.querySelector('#status').append(
      ...STATUSES.map((status) => el('option', { value: status.id }, status.label)),
    );

    this.#form.addEventListener('submit', (event) => this.#handleSubmit(event));
    dialog.querySelector('#cancel-ticket').addEventListener('click', () => this.close());
    dialog.addEventListener('close', () => this.#clearErrors());
  }

  /** Refreshes the assignee autocomplete from the tickets currently on the board. */
  syncAssigneeOptions() {
    this.#form
      .querySelector('#assignee-options')
      .replaceChildren(
        ...this.#store.assignees.map((name) => el('option', { value: name })),
      );
  }

  openForCreate({ status = 'backlog' } = {}) {
    this.#editingKey = null;
    this.#title.textContent = 'New ticket';
    this.#form.reset();
    this.#form.querySelector('#status').value = status;
    this.#form.querySelector('#priority').value = 'medium';
    this.#clearErrors();
    this.syncAssigneeOptions();
    this.#dialog.showModal();
    this.#form.querySelector('#title').focus();
  }

  openForEdit(ticket) {
    if (!ticket) return;
    this.#editingKey = ticket.key;
    this.#title.textContent = `Edit ${ticket.key}`;
    this.#form.querySelector('#title').value = ticket.title;
    this.#form.querySelector('#description').value = ticket.description ?? '';
    this.#form.querySelector('#status').value = ticket.status;
    this.#form.querySelector('#priority').value = ticket.priority;
    this.#form.querySelector('#assignee').value = ticket.assignee;
    this.#clearErrors();
    this.syncAssigneeOptions();
    this.#dialog.showModal();
    this.#form.querySelector('#title').focus();
  }

  close() {
    this.#dialog.close();
  }

  #draft() {
    const data = new FormData(this.#form);
    return {
      title: String(data.get('title') ?? ''),
      description: String(data.get('description') ?? ''),
      status: String(data.get('status') ?? 'backlog'),
      priority: String(data.get('priority') ?? 'medium'),
      assignee: String(data.get('assignee') ?? ''),
    };
  }

  #handleSubmit(event) {
    event.preventDefault();
    const draft = this.#draft();
    const errors = validateTicket(draft);
    this.#showErrors(errors);
    if (Object.keys(errors).length > 0) return;

    this.#onSubmit(draft, this.#editingKey);
    this.#dialog.close();
  }

  #showErrors(errors) {
    for (const field of ['title', 'assignee']) {
      const message = errors[field];
      const node = this.#form.querySelector(`#${field}-error`);
      const input = this.#form.querySelector(`#${field}`);
      node.textContent = message ?? '';
      node.hidden = !message;
      input.classList.toggle('is-invalid', Boolean(message));
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  }

  #clearErrors() {
    this.#showErrors({});
  }
}
