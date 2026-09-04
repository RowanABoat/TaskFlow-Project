import { test, expect } from '../fixtures/taskflow.js';
import { buildTicket } from '../data/tickets.js';

test.describe('Creating tickets', () => {
  test('adds a ticket to the column chosen in the dialog', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openCreateDialog();
    await ticketDialog.expectOpen();
    await expect(ticketDialog.heading).toHaveText('New ticket');

    await ticketDialog.submit({
      title: 'Add audit logging',
      description: 'Record every status change with the actor and timestamp.',
      status: 'review',
      priority: 'high',
      assignee: 'Devi',
    });

    const card = board.card('TASK-6');
    await expect(card).toBeVisible();
    await expect(board.cardTitle('TASK-6')).toHaveText('Add audit logging');
    await expect(board.cardPriority('TASK-6')).toHaveText('High');
    await expect(board.cardAssignee('TASK-6')).toContainText('Devi');
    expect(await board.keysIn('review')).toContain('TASK-6');
    await expect(board.toast).toHaveText('TASK-6 created');
    await expect(board.summary).toHaveText('6 tickets');
  });

  test('defaults a new ticket to the backlog at medium priority', async ({ board, ticketDialog }) => {
    await board.gotoWith([]);
    await board.openCreateDialog();

    await expect(ticketDialog.statusSelect).toHaveValue('backlog');
    await expect(ticketDialog.prioritySelect).toHaveValue('medium');

    await ticketDialog.submit({ title: 'First ticket ever', assignee: 'Rowan' });

    expect(await board.keysIn('backlog')).toEqual(['TASK-1']);
    await expect(board.cardPriority('TASK-1')).toHaveText('Medium');
  });

  test('numbers new tickets above the highest key on the board', async ({ board, ticketDialog }) => {
    await board.gotoWith([buildTicket({ key: 'TASK-42' })]);
    await board.openCreateDialog();

    await ticketDialog.submit({ title: 'Follows the highest key', assignee: 'Rowan' });

    await expect(board.card('TASK-43')).toBeVisible();
  });

  test('cancelling leaves the board untouched', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openCreateDialog();
    await ticketDialog.fill({ title: 'Never saved', assignee: 'Nobody' });

    await ticketDialog.cancel();

    await expect(board.cards).toHaveCount(5);
    await expect(board.page.getByText('Never saved')).toHaveCount(0);
  });

  test('trims surrounding whitespace off what you type', async ({ board, ticketDialog }) => {
    await board.gotoWith([]);
    await board.openCreateDialog();

    await ticketDialog.submit({ title: '   Padded title   ', assignee: '  Rowan  ' });

    await expect(board.cardTitle('TASK-1')).toHaveText('Padded title');
    await expect(board.cardAssignee('TASK-1')).toContainText('Rowan');
  });
});

test.describe('Validating the ticket dialog', () => {
  test('refuses an empty title and an empty assignee', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openCreateDialog();

    await ticketDialog.submitExpectingErrors({});

    await expect(ticketDialog.titleError).toHaveText('Title is required');
    await expect(ticketDialog.assigneeError).toHaveText('Assignee is required');
    await expect(ticketDialog.titleInput).toHaveAttribute('aria-invalid', 'true');
    await expect(board.cards).toHaveCount(5);
  });

  test('refuses a title shorter than four characters', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openCreateDialog();

    await ticketDialog.submitExpectingErrors({ title: 'Hi', assignee: 'Rowan' });

    await expect(ticketDialog.titleError).toHaveText('Title must be at least 4 characters');
    await expect(ticketDialog.assigneeError).toBeHidden();
  });

  test('refuses a title longer than 120 characters', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openCreateDialog();

    await ticketDialog.submitExpectingErrors({ title: 'x'.repeat(121), assignee: 'Rowan' });

    await expect(ticketDialog.titleError).toHaveText('Title must be 120 characters or fewer');
  });

  test('clears the error once the field is fixed', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openCreateDialog();
    await ticketDialog.submitExpectingErrors({ title: '', assignee: '' });

    await ticketDialog.submit({ title: 'Now a real title', assignee: 'Rowan' });

    await expect(board.cardTitle('TASK-6')).toHaveText('Now a real title');
  });

  test('starts each dialog session with a clean slate', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openCreateDialog();
    await ticketDialog.submitExpectingErrors({ title: 'No' });
    await ticketDialog.cancel();

    await board.openCreateDialog();

    await expect(ticketDialog.titleInput).toHaveValue('');
    await expect(ticketDialog.titleError).toBeHidden();
  });
});

test.describe('Editing tickets', () => {
  test('saves every changed field back to the card', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openEditDialog('TASK-2');

    await expect(ticketDialog.heading).toHaveText('Edit TASK-2');
    await expect(ticketDialog.titleInput).toHaveValue('Design ticket detail layout');
    await expect(ticketDialog.statusSelect).toHaveValue('backlog');
    await expect(ticketDialog.assigneeInput).toHaveValue('Priya');

    await ticketDialog.submit({
      title: 'Design the ticket detail page',
      priority: 'critical',
      status: 'in_progress',
      assignee: 'Rowan',
    });

    await expect(board.cardTitle('TASK-2')).toHaveText('Design the ticket detail page');
    await expect(board.cardPriority('TASK-2')).toHaveText('Critical');
    await expect(board.cardAssignee('TASK-2')).toContainText('Rowan');
    expect(await board.statusOf('TASK-2')).toBe('in_progress');
    await expect(board.toast).toHaveText('TASK-2 updated');
  });

  test('editing does not renumber the ticket or change the board size', async ({
    board,
    ticketDialog,
  }) => {
    await board.goto();
    await board.openEditDialog('TASK-1');

    await ticketDialog.submit({ title: 'Set up the authentication service' });

    await expect(board.card('TASK-1')).toBeVisible();
    await expect(board.cards).toHaveCount(5);
  });

  test('cancelling an edit discards the changes', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openEditDialog('TASK-4');
    await ticketDialog.fill({ title: 'Discarded rename' });

    await ticketDialog.cancel();

    await expect(board.cardTitle('TASK-4')).toHaveText('Add keyboard shortcuts');
  });
});

test.describe('Deleting tickets', () => {
  test('removes the card once the confirmation is accepted', async ({ board }) => {
    await board.goto();

    const message = await board.deleteTicket('TASK-4');

    expect(message).toBe('Delete TASK-4? This cannot be undone.');
    await expect(board.cards).toHaveCount(4);
    expect(await board.keysIn('backlog')).toEqual(['TASK-2']);
    await expect(board.columnCount('backlog')).toHaveText('1');
    await expect(board.toast).toHaveText('TASK-4 deleted');
  });

  test('keeps the card when the confirmation is dismissed', async ({ board }) => {
    await board.goto();

    await board.deleteTicket('TASK-4', { confirm: false });

    await expect(board.cards).toHaveCount(5);
    await expect(board.toast).toBeHidden();
  });

  test('emptying a column shows its empty state', async ({ board }) => {
    await board.goto();

    await board.deleteTicket('TASK-5');

    await expect(board.column('done').getByTestId('column-empty')).toBeVisible();
    await expect(board.columnCount('done')).toHaveText('0');
  });
});
