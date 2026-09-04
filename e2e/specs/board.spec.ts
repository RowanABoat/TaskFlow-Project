import { test, expect } from '../fixtures/taskflow.js';
import { SEED_TICKETS, STATUS_LABELS, TICKET_STATUSES, buildTicket } from '../data/tickets.js';

test.describe('Board layout', () => {
  test('renders every workflow column in order', async ({ board, page }) => {
    await board.goto();

    const headings = page.getByRole('region').getByRole('heading', { level: 2 });
    await expect(headings).toHaveText(TICKET_STATUSES.map((status) => STATUS_LABELS[status]));
  });

  test('places each seeded ticket in its own column', async ({ board }) => {
    await board.goto();

    expect(await board.keysIn('backlog')).toEqual(['TASK-2', 'TASK-4']);
    expect(await board.keysIn('in_progress')).toEqual(['TASK-1']);
    expect(await board.keysIn('review')).toEqual(['TASK-3']);
    expect(await board.keysIn('done')).toEqual(['TASK-5']);
    await expect(board.cards).toHaveCount(SEED_TICKETS.length);
  });

  test('column badges count the cards below them', async ({ board }) => {
    await board.goto();

    for (const status of TICKET_STATUSES) {
      const cards = await board.cardsIn(status).count();
      await expect(board.columnCount(status)).toHaveText(String(cards));
    }
  });

  test('summarises the board when no filter is active', async ({ board }) => {
    await board.goto();
    await expect(board.summary).toHaveText('5 tickets');
    await expect(board.clearFiltersButton).toBeDisabled();
  });

  test('a card shows its key, title, priority and assignee', async ({ board }) => {
    await board.goto();

    await expect(board.cardTitle('TASK-3')).toHaveText('Fix column count badge off-by-one');
    await expect(board.cardPriority('TASK-3')).toHaveText('Critical');
    await expect(board.cardPriority('TASK-3')).toHaveAttribute('data-priority', 'critical');
    await expect(board.cardAssignee('TASK-3')).toContainText('Rowan');
  });

  test('an empty board invites the first ticket', async ({ board }) => {
    await board.gotoWith([]);

    await expect(board.cards).toHaveCount(0);
    await expect(board.summary).toHaveText('0 tickets');
    await expect(board.column('backlog').getByTestId('column-empty')).toHaveText('Nothing here yet');
  });

  test('uses the singular form for a board of one', async ({ board }) => {
    await board.gotoWith([buildTicket({ title: 'The only ticket' })]);
    await expect(board.summary).toHaveText('1 ticket');
  });
});

test.describe('Keyboard shortcuts', () => {
  test('"c" opens the create dialog', async ({ board, ticketDialog, page }) => {
    await board.goto();

    await page.keyboard.press('c');

    await ticketDialog.expectOpen();
    await expect(ticketDialog.heading).toHaveText('New ticket');
  });

  test('"/" focuses the search box', async ({ board, page }) => {
    await board.goto();

    await page.keyboard.press('/');

    await expect(board.searchInput).toBeFocused();
  });

  test('shortcuts stay out of the way while typing', async ({ board, ticketDialog }) => {
    await board.goto();
    await board.searchInput.click();

    await board.searchInput.pressSequentially('cc');

    await expect(board.searchInput).toHaveValue('cc');
    await ticketDialog.expectClosed();
  });
});
