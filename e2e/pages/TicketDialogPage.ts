import { expect, type Locator, type Page } from '@playwright/test';
import type { TicketDraft } from '../data/tickets.js';

/**
 * Page object for the create/edit ticket dialog.
 *
 * Every locator is scoped to the dialog so a field never accidentally resolves
 * to the identically-named filter controls in the page header.
 */
export class TicketDialogPage {
  readonly page: Page;
  readonly root: Locator;

  readonly heading: Locator;
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly statusSelect: Locator;
  readonly prioritySelect: Locator;
  readonly assigneeInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly titleError: Locator;
  readonly assigneeError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.getByRole('dialog');

    this.heading = this.root.getByRole('heading');
    this.titleInput = this.root.getByLabel('Title');
    this.descriptionInput = this.root.getByLabel('Description');
    this.statusSelect = this.root.getByLabel('Status');
    this.prioritySelect = this.root.getByLabel('Priority');
    this.assigneeInput = this.root.getByLabel('Assignee');
    this.saveButton = this.root.getByRole('button', { name: 'Save ticket' });
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel' });
    this.titleError = this.root.getByTestId('title-error');
    this.assigneeError = this.root.getByTestId('assignee-error');
  }

  async expectOpen(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.root).toBeHidden();
  }

  /** Fills only the fields present on the draft, leaving the rest untouched. */
  async fill(draft: Partial<TicketDraft>): Promise<void> {
    if (draft.title !== undefined) await this.titleInput.fill(draft.title);
    if (draft.description !== undefined) await this.descriptionInput.fill(draft.description);
    if (draft.status !== undefined) await this.statusSelect.selectOption(draft.status);
    if (draft.priority !== undefined) await this.prioritySelect.selectOption(draft.priority);
    if (draft.assignee !== undefined) await this.assigneeInput.fill(draft.assignee);
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
    await this.expectClosed();
  }

  /** Fills the dialog and saves, expecting it to close. */
  async submit(draft: Partial<TicketDraft>): Promise<void> {
    await this.fill(draft);
    await this.save();
    await this.expectClosed();
  }

  /** Fills the dialog and saves, expecting validation to keep it open. */
  async submitExpectingErrors(draft: Partial<TicketDraft>): Promise<void> {
    await this.fill(draft);
    await this.save();
    await this.expectOpen();
  }
}
