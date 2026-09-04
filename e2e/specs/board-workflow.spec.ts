import { test, expect } from '../fixtures/taskflow.js';
import { STATUS_LABELS, TICKET_STATUSES, buildTicket } from '../data/tickets.js';

test.describe('Moving tickets with the status dropdown', () => {
  test('moves a card into the chosen column', async ({ board }) => {
    await board.goto();

    await board.moveTicket('TASK-2', 'in_progress');

    expect(await board.keysIn('in_progress')).toEqual(['TASK-1', 'TASK-2']);
    expect(await board.keysIn('backlog')).toEqual(['TASK-4']);
    await expect(board.toast).toHaveText('TASK-2 moved to In Progress');
  });

  test('keeps both column badges in step with the move', async ({ board }) => {
    await board.goto();
    await expect(board.columnCount('backlog')).toHaveText('2');
    await expect(board.columnCount('done')).toHaveText('1');

    await board.moveTicket('TASK-4', 'done');

    await expect(board.columnCount('backlog')).toHaveText('1');
    await expect(board.columnCount('done')).toHaveText('2');
  });

  test('walks a ticket through the whole workflow', async ({ board }) => {
    await board.gotoWith([buildTicket({ key: 'TASK-1', title: 'Walks the board' })]);

    for (const status of TICKET_STATUSES.slice(1)) {
      await board.moveTicket('TASK-1', status);
      expect(await board.keysIn(status)).toEqual(['TASK-1']);
      await expect(board.toast).toHaveText(`TASK-1 moved to ${STATUS_LABELS[status]}`);
    }
  });

  test('re-selecting the current column is a no-op', async ({ board }) => {
    await board.goto();

    await board.moveTicket('TASK-1', 'in_progress');

    expect(await board.keysIn('in_progress')).toEqual(['TASK-1']);
    await expect(board.toast).toBeHidden();
  });

  test('the dropdown reflects the column the card sits in', async ({ board, page }) => {
    await board.goto();

    await expect(
      page.getByRole('combobox', { name: 'Move TASK-3 to another column' }),
    ).toHaveValue('review');
  });
});

test.describe('Dragging tickets between columns', () => {
  test.skip(({ isMobile }) => Boolean(isMobile), 'Dragging is a pointer-only interaction');

  test('drops a card into the column it was dragged to', async ({ board }) => {
    await board.goto();

    await board.dragTicket('TASK-2', 'done');

    // Column order follows creation order, so TASK-2 lands above TASK-5.
    expect(await board.keysIn('done')).toEqual(['TASK-2', 'TASK-5']);
    expect(await board.keysIn('backlog')).toEqual(['TASK-4']);
    await expect(board.toast).toHaveText('TASK-2 moved to Done');
  });

  test('drags into an empty column', async ({ board }) => {
    await board.gotoWith([buildTicket({ key: 'TASK-1', status: 'backlog' })]);

    await board.dragTicket('TASK-1', 'review');

    await expect(board.columnCount('review')).toHaveText('1');
    await expect(board.column('backlog').getByTestId('column-empty')).toBeVisible();
  });

  test('a plain click on a card changes nothing', async ({ board }) => {
    await board.goto();

    await board.cardTitle('TASK-2').click();

    expect(await board.statusOf('TASK-2')).toBe('backlog');
    await expect(board.toast).toBeHidden();
  });

  test('dropping outside every column leaves the ticket where it was', async ({ board, page }) => {
    await board.goto();
    const card = board.card('TASK-2');
    const from = await card.boundingBox();
    if (!from) throw new Error('TASK-2 is not visible');

    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, 4, { steps: 10 }); // over the header
    await page.mouse.up();

    expect(await board.statusOf('TASK-2')).toBe('backlog');
    await expect(board.toast).toBeHidden();
  });
});
