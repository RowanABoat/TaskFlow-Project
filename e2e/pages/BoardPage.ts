import { expect, type Locator, type Page } from '@playwright/test';
import {
  STATUS_LABELS,
  STORAGE_KEY,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
} from '../data/tickets.js';

/**
 * Page object for the TaskFlow board: navigation, filtering and everything you
 * can do to a card without opening the dialog.
 *
 * Locators lean on accessible roles and names where the app exposes them, and
 * fall back to `data-testid` for structural nodes (columns, cards) that have no
 * meaningful role of their own.
 */
export class BoardPage {
  readonly page: Page;

  readonly searchInput: Locator;
  readonly priorityFilter: Locator;
  readonly assigneeFilter: Locator;
  readonly clearFiltersButton: Locator;
  readonly newTicketButton: Locator;
  readonly summary: Locator;
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByRole('searchbox', { name: 'Search tickets' });
    this.priorityFilter = page.getByRole('combobox', { name: 'Filter by priority' });
    this.assigneeFilter = page.getByRole('combobox', { name: 'Filter by assignee' });
    this.clearFiltersButton = page.getByRole('button', { name: 'Clear filters' });
    this.newTicketButton = page.getByRole('button', { name: 'New ticket' });
    this.summary = page.getByTestId('result-summary');
    this.toast = page.getByTestId('toast');
  }

  /** Opens the board with the app's default seed data. */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForBoard();
  }

  /**
   * Opens the board with an exact set of tickets, seeded into localStorage
   * before any app code runs. Pass `[]` for an empty board.
   */
  async gotoWith(tickets: Ticket[]): Promise<void> {
    await this.page.addInitScript(
      ([key, payload]) => window.localStorage.setItem(key as string, payload as string),
      [STORAGE_KEY, JSON.stringify(tickets)] as const,
    );
    await this.page.goto('/');
    await this.waitForBoard();
  }

  /** Opens the board with an arbitrary raw value already in localStorage. */
  async gotoWithRawStorage(raw: string): Promise<void> {
    await this.page.addInitScript(
      ([key, payload]) => window.localStorage.setItem(key as string, payload as string),
      [STORAGE_KEY, raw] as const,
    );
    await this.page.goto('/');
    await this.waitForBoard();
  }

  private async waitForBoard(): Promise<void> {
    await expect(this.page.getByRole('main', { name: 'Ticket board' })).toBeVisible();
    // The summary only renders after the first store subscription fires.
    await expect(this.summary).not.toBeEmpty();
  }

  // -- Columns -------------------------------------------------------------

  column(status: TicketStatus): Locator {
    return this.page.getByRole('region', { name: STATUS_LABELS[status], exact: true });
  }

  columnCount(status: TicketStatus): Locator {
    return this.column(status).getByTestId('column-count');
  }

  cardsIn(status: TicketStatus): Locator {
    return this.column(status).getByTestId('ticket-card');
  }

  /** Card titles in a column, top to bottom. */
  async titlesIn(status: TicketStatus): Promise<string[]> {
    return this.cardsIn(status).getByTestId('ticket-title').allTextContents();
  }

  /** Ticket keys in a column, top to bottom. */
  async keysIn(status: TicketStatus): Promise<string[]> {
    return this.cardsIn(status).getByTestId('ticket-key').allTextContents();
  }

  // -- Cards ---------------------------------------------------------------

  get cards(): Locator {
    return this.page.getByTestId('ticket-card');
  }

  /** A card addressed by its ticket key, which is the ticket's identity. */
  card(key: string): Locator {
    return this.page.locator(`[data-testid="ticket-card"][data-key="${key}"]`);
  }

  cardTitle(key: string): Locator {
    return this.card(key).getByTestId('ticket-title');
  }

  cardPriority(key: string): Locator {
    return this.card(key).getByTestId('ticket-priority');
  }

  cardAssignee(key: string): Locator {
    return this.card(key).getByTestId('ticket-assignee');
  }

  /** The column a ticket currently sits in, read from the DOM. */
  async statusOf(key: string): Promise<TicketStatus> {
    return (await this.card(key).getAttribute('data-status')) as TicketStatus;
  }

  // -- Actions -------------------------------------------------------------

  async openCreateDialog(): Promise<void> {
    await this.newTicketButton.click();
  }

  async openEditDialog(key: string): Promise<void> {
    await this.page.getByRole('button', { name: `Edit ${key}` }).click();
  }

  /** Moves a ticket with the card's status dropdown. */
  async moveTicket(key: string, status: TicketStatus): Promise<void> {
    await this.page
      .getByRole('combobox', { name: `Move ${key} to another column` })
      .selectOption(status);
    await expect(this.card(key)).toHaveAttribute('data-status', status);
  }

  /** Drags a card into another column with real pointer movement. */
  async dragTicket(key: string, status: TicketStatus): Promise<void> {
    const card = this.card(key);
    const target = this.column(status);
    await card.scrollIntoViewIfNeeded();

    const from = await card.boundingBox();
    const to = await target.boundingBox();
    if (!from || !to) throw new Error(`Cannot drag ${key}: card or column is not visible`);

    await this.page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await this.page.mouse.down();
    // Several intermediate moves so the app's drag threshold and drop-target
    // highlighting behave exactly as they do for a human.
    await this.page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    await this.page.mouse.up();

    await expect(card).toHaveAttribute('data-status', status);
  }

  /**
   * Deletes a ticket, answering the native confirm. Pass `confirm: false` to
   * dismiss it instead.
   */
  async deleteTicket(key: string, { confirm = true }: { confirm?: boolean } = {}): Promise<string> {
    let message = '';
    this.page.once('dialog', async (dialog) => {
      message = dialog.message();
      await (confirm ? dialog.accept() : dialog.dismiss());
    });

    await this.page.getByRole('button', { name: `Delete ${key}` }).click();
    await expect(this.card(key)).toHaveCount(confirm ? 0 : 1);
    return message;
  }

  // -- Filtering -----------------------------------------------------------

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  async filterByPriority(priority: TicketPriority | ''): Promise<void> {
    await this.priorityFilter.selectOption(priority);
  }

  async filterByAssignee(assignee: string): Promise<void> {
    await this.assigneeFilter.selectOption(assignee);
  }

  async clearFilters(): Promise<void> {
    await this.clearFiltersButton.click();
  }

  // -- Persistence ---------------------------------------------------------

  /** The tickets currently persisted in localStorage. */
  async storedTickets(): Promise<Ticket[]> {
    const raw = await this.page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Ticket[]) : [];
  }
}
