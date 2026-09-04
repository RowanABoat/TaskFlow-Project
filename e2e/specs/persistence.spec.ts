import { test, expect } from '../fixtures/taskflow.js';
import { SEED_TICKETS, buildTicket } from '../data/tickets.js';

test.describe('Persistence across reloads', () => {
  test('a created ticket is still there after a reload', async ({ board, ticketDialog, page }) => {
    await board.goto();
    await board.openCreateDialog();
    await ticketDialog.submit({
      title: 'Survives a reload',
      status: 'review',
      priority: 'critical',
      assignee: 'Rowan',
    });

    await page.reload();

    await expect(board.cardTitle('TASK-6')).toHaveText('Survives a reload');
    await expect(board.cardPriority('TASK-6')).toHaveText('Critical');
    expect(await board.keysIn('review')).toContain('TASK-6');
  });

  test('a move is still there after a reload', async ({ board, page }) => {
    await board.goto();
    await board.moveTicket('TASK-2', 'done');

    await page.reload();

    expect(await board.statusOf('TASK-2')).toBe('done');
  });

  test('a deletion is still there after a reload', async ({ board, page }) => {
    await board.goto();
    await board.deleteTicket('TASK-4');

    await page.reload();

    await expect(board.card('TASK-4')).toHaveCount(0);
    await expect(board.cards).toHaveCount(4);
  });

  test('an edit is still there after a reload', async ({ board, ticketDialog, page }) => {
    await board.goto();
    await board.openEditDialog('TASK-1');
    await ticketDialog.submit({ title: 'Renamed before the reload' });

    await page.reload();

    await expect(board.cardTitle('TASK-1')).toHaveText('Renamed before the reload');
  });

  test('filters are session state and reset on reload', async ({ board, page }) => {
    await board.goto();
    await board.search('auth');
    await expect(board.cards).toHaveCount(1);

    await page.reload();

    await expect(board.searchInput).toHaveValue('');
    await expect(board.cards).toHaveCount(5);
  });
});

test.describe('What gets written to storage', () => {
  test('the board is persisted field for field', async ({ board, ticketDialog }) => {
    await board.gotoWith([]);
    await board.openCreateDialog();
    await ticketDialog.submit({
      title: 'Written to storage',
      description: 'Every field round-trips.',
      status: 'in_progress',
      priority: 'low',
      assignee: 'Rowan',
    });

    expect(await board.storedTickets()).toEqual([
      {
        key: 'TASK-1',
        title: 'Written to storage',
        description: 'Every field round-trips.',
        status: 'in_progress',
        priority: 'low',
        assignee: 'Rowan',
      },
    ]);
  });

  test('a deleted ticket is dropped from storage', async ({ board }) => {
    await board.goto();

    await board.deleteTicket('TASK-3');

    const stored = await board.storedTickets();
    expect(stored.map((ticket) => ticket.key)).toEqual(['TASK-1', 'TASK-2', 'TASK-4', 'TASK-5']);
  });
});

test.describe('Recovering from bad stored state', () => {
  test('falls back to the seed board when storage is not JSON', async ({ board }) => {
    await board.gotoWithRawStorage('{ this is not json');

    await expect(board.cards).toHaveCount(SEED_TICKETS.length);
    await expect(board.card('TASK-1')).toBeVisible();
  });

  test('falls back to the seed board when storage is not a list', async ({ board }) => {
    await board.gotoWithRawStorage(JSON.stringify({ tickets: [] }));

    await expect(board.cards).toHaveCount(SEED_TICKETS.length);
  });

  test('drops individual tickets with an unknown status or priority', async ({ board }) => {
    await board.gotoWithRawStorage(
      JSON.stringify([
        buildTicket({ key: 'TASK-1', title: 'Perfectly valid ticket' }),
        { ...buildTicket({ key: 'TASK-2' }), status: 'archived' },
        { ...buildTicket({ key: 'TASK-3' }), priority: 'blocker' },
        null,
      ]),
    );

    await expect(board.cards).toHaveCount(1);
    await expect(board.cardTitle('TASK-1')).toHaveText('Perfectly valid ticket');
  });
});
