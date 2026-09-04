import { test as base, expect } from '@playwright/test';
import { BoardPage } from '../pages/BoardPage.js';
import { TicketDialogPage } from '../pages/TicketDialogPage.js';

/**
 * The suite's entry point. Import `test` and `expect` from here rather than
 * from `@playwright/test` so every spec gets the page objects and the shared
 * console-error guard.
 */

interface TaskFlowFixtures {
  board: BoardPage;
  ticketDialog: TicketDialogPage;
}

export const test = base.extend<TaskFlowFixtures>({
  board: async ({ page }, use) => {
    await use(new BoardPage(page));
  },

  ticketDialog: async ({ page }, use) => {
    await use(new TicketDialogPage(page));
  },

  // Auto-fixture: a test that trips a page error or a console error is a bug,
  // even when its assertions happen to pass.
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
    });

    await use(page);

    expect(problems, 'the page logged errors during this test').toEqual([]);
  },
});

export { expect };
export { BoardPage, TicketDialogPage };
