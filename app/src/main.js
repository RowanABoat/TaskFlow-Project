/**
 * App entry point: builds the store, wires the header controls to it and keeps
 * the board and dialog in sync with store state.
 */

import { Board, el } from './board.js';
import { TicketDialog } from './dialog.js';
import { TicketStore } from './store.js';

const store = new TicketStore();

const searchInput = document.querySelector('#search');
const priorityFilter = document.querySelector('#filter-priority');
const assigneeFilter = document.querySelector('#filter-assignee');
const clearFiltersButton = document.querySelector('#clear-filters');
const newTicketButton = document.querySelector('#new-ticket');
const summary = document.querySelector('#result-summary');
const toast = document.querySelector('#toast');

let toastTimer;
function notify(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
    toast.textContent = '';
  }, 4000);
}

const dialog = new TicketDialog({
  dialog: document.querySelector('#ticket-dialog'),
  store,
  onSubmit(draft, editingKey) {
    if (editingKey) {
      store.update(editingKey, draft);
      notify(`${editingKey} updated`);
    } else {
      const ticket = store.create(draft);
      notify(`${ticket.key} created`);
    }
  },
});

const board = new Board({
  root: document.querySelector('#board'),
  store,
  onEdit: (ticket) => dialog.openForEdit(ticket),
  onNotify: notify,
});

function renderFilterControls() {
  const { search, priority, assignee } = store.filters;

  assigneeFilter.replaceChildren(
    el('option', { value: '' }, 'All assignees'),
    ...store.assignees.map((name) => el('option', { value: name }, name)),
  );

  // The store prunes filters that no longer match any ticket, so the controls
  // are always a straight read of store state.
  if (searchInput.value !== search) searchInput.value = search;
  if (priorityFilter.value !== priority) priorityFilter.value = priority;
  assigneeFilter.value = assignee;
}

function renderSummary() {
  const visible = store.visibleTickets.length;
  const total = store.tickets.length;
  summary.textContent = store.hasActiveFilters
    ? `Showing ${visible} of ${total} tickets`
    : `${total} ${total === 1 ? 'ticket' : 'tickets'}`;
  clearFiltersButton.disabled = !store.hasActiveFilters;
}

function render() {
  board.render();
  renderFilterControls();
  renderSummary();
  dialog.syncAssigneeOptions();
}

searchInput.addEventListener('input', () => store.setFilter('search', searchInput.value));
priorityFilter.addEventListener('change', () => store.setFilter('priority', priorityFilter.value));
assigneeFilter.addEventListener('change', () => store.setFilter('assignee', assigneeFilter.value));

clearFiltersButton.addEventListener('click', () => store.clearFilters());

newTicketButton.addEventListener('click', () => dialog.openForCreate());

document.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

  if (event.key === 'c') {
    event.preventDefault();
    dialog.openForCreate();
  } else if (event.key === '/') {
    event.preventDefault();
    searchInput.focus();
  }
});

store.subscribe(render);
render();

// Exposed so end-to-end tests can seed or reset the board deterministically.
globalThis.taskflow = { store, reset: () => store.reset() };
