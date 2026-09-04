import { test, expect } from '../fixtures/taskflow.js';
import { buildTicket } from '../data/tickets.js';

test.describe('Searching', () => {
  test('matches on title', async ({ board }) => {
    await board.goto();

    await board.search('keyboard');

    await expect(board.cards).toHaveCount(1);
    await expect(board.card('TASK-4')).toBeVisible();
    await expect(board.summary).toHaveText('Showing 1 of 5 tickets');
  });

  test('matches on description', async ({ board }) => {
    await board.goto();

    await board.search('OAuth');

    await expect(board.cards).toHaveCount(1);
    await expect(board.card('TASK-1')).toBeVisible();
  });

  test('matches on ticket key', async ({ board }) => {
    await board.goto();

    await board.search('TASK-3');

    await expect(board.cards).toHaveCount(1);
    await expect(board.card('TASK-3')).toBeVisible();
  });

  test('ignores case', async ({ board }) => {
    await board.goto();

    await board.search('CHANGELOG');

    await expect(board.card('TASK-5')).toBeVisible();
  });

  test('reports an empty result without hiding the columns', async ({ board }) => {
    await board.goto();

    await board.search('nothing matches this');

    await expect(board.cards).toHaveCount(0);
    await expect(board.summary).toHaveText('Showing 0 of 5 tickets');
    await expect(board.column('backlog').getByTestId('column-empty')).toHaveText(
      'No matching tickets',
    );
  });
});

test.describe('Filtering', () => {
  test('narrows the board by priority', async ({ board }) => {
    await board.goto();

    await board.filterByPriority('medium');

    await expect(board.cards).toHaveCount(2);
    await expect(board.card('TASK-2')).toBeVisible();
    await expect(board.card('TASK-5')).toBeVisible();
    await expect(board.summary).toHaveText('Showing 2 of 5 tickets');
  });

  test('narrows the board by assignee', async ({ board }) => {
    await board.goto();

    await board.filterByAssignee('Rowan');

    await expect(board.cards).toHaveCount(2);
    expect(await board.keysIn('in_progress')).toEqual(['TASK-1']);
    expect(await board.keysIn('review')).toEqual(['TASK-3']);
  });

  test('offers every assignee on the board, sorted', async ({ board }) => {
    await board.goto();

    await expect(board.assigneeFilter.getByRole('option')).toHaveText([
      'All assignees',
      'Priya',
      'Rowan',
      'Sam',
    ]);
  });

  test('picks up an assignee added after load', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.openCreateDialog();
    await ticketDialog.submit({ title: 'Brand new work', assignee: 'Ada' });

    await expect(board.assigneeFilter.getByRole('option')).toHaveText([
      'All assignees',
      'Ada',
      'Priya',
      'Rowan',
      'Sam',
    ]);
  });

  test('combines search, priority and assignee', async ({ board }) => {
    await board.goto();

    await board.filterByAssignee('Rowan');
    await board.filterByPriority('critical');

    await expect(board.cards).toHaveCount(1);
    await expect(board.card('TASK-3')).toBeVisible();

    await board.search('authentication');

    await expect(board.cards).toHaveCount(0);
    await expect(board.summary).toHaveText('Showing 0 of 5 tickets');
  });

  test('column badges count only what the filter leaves visible', async ({ board }) => {
    await board.goto();

    await board.filterByAssignee('Priya');

    await expect(board.columnCount('backlog')).toHaveText('1');
    await expect(board.columnCount('in_progress')).toHaveText('0');
    await expect(board.columnCount('done')).toHaveText('1');
  });
});

test.describe('Clearing filters', () => {
  test('the clear button is only offered when a filter is active', async ({ board }) => {
    await board.goto();
    await expect(board.clearFiltersButton).toBeDisabled();

    await board.search('auth');

    await expect(board.clearFiltersButton).toBeEnabled();
  });

  test('resets every control and restores the whole board', async ({ board }) => {
    await board.goto();
    await board.search('auth');
    await board.filterByPriority('high');
    await board.filterByAssignee('Rowan');
    await expect(board.cards).toHaveCount(1);

    await board.clearFilters();

    await expect(board.cards).toHaveCount(5);
    await expect(board.searchInput).toHaveValue('');
    await expect(board.priorityFilter).toHaveValue('');
    await expect(board.assigneeFilter).toHaveValue('');
    await expect(board.summary).toHaveText('5 tickets');
    await expect(board.clearFiltersButton).toBeDisabled();
  });

  test('drops an assignee filter when their last ticket is deleted', async ({ board }) => {
    await board.gotoWith([
      buildTicket({ key: 'TASK-1', assignee: 'Solo', title: 'The only ticket Solo owns' }),
      buildTicket({ key: 'TASK-2', assignee: 'Rowan', title: 'Something else entirely' }),
    ]);
    await board.filterByAssignee('Solo');
    await expect(board.cards).toHaveCount(1);

    await board.deleteTicket('TASK-1');

    await expect(board.assigneeFilter).toHaveValue('');
    await expect(board.cards).toHaveCount(1);
    await expect(board.card('TASK-2')).toBeVisible();
    await expect(board.summary).toHaveText('1 ticket');
  });
});
