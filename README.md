# TaskFlow-Project

Demo site for a Jira-like taskflow web app, keeping track of tickets — plus the
end-to-end suite that keeps it honest.

**Testing framework: [Playwright](https://playwright.dev). Selenium is not used
anywhere in this repo.**

![The TaskFlow board](docs/board.png)

## What's here

```
app/                  the demo site (no build step, no runtime dependencies)
  index.html
  styles.css
  src/                model, store, board rendering and the ticket dialog
server/               dependency-free static file server used by dev + tests
e2e/
  data/               ticket types, board vocabulary and seed/builder helpers
  fixtures/           the `test` object every spec imports
  pages/              page objects (BoardPage, TicketDialogPage)
  specs/              the tests themselves
playwright.config.ts  projects, reporters, retries and the webServer wiring
```

## Running it

```bash
npm install
npm run dev          # http://localhost:4173
```

The app persists tickets to `localStorage`, so a reload keeps your board. Clear
the `taskflow.tickets.v1` key to get the seed board back.

### Features

- A four-column board: Backlog → In Progress → In Review → Done
- Create, edit and delete tickets, with validation on title and assignee
- Move a ticket by dragging its card, or with the dropdown on the card
- Search across key, title and description; filter by priority and assignee
- Keyboard shortcuts: `c` to create a ticket, `/` to focus search

## Running the tests

```bash
npm test                 # every project
npm test -- --project=chromium
npm run test:ui          # Playwright's watch-mode UI
npm run test:headed
npm run test:debug
npm run report           # open the HTML report from the last run
```

`playwright.config.ts` starts the static server itself, so there is nothing to
launch first. `reuseExistingServer` is on outside CI, so a `npm run dev` you
already have running is picked up instead of a second one being spawned.

If this is a fresh checkout you'll need the browsers once:

```bash
npx playwright install --with-deps
```

### Browser projects

By default the suite runs the two Chromium-backed projects, `chromium` and
`mobile-chrome`, which is what most machines have installed. Set
`PW_ALL_BROWSERS=1` to add Firefox and WebKit — that's what CI does:

```bash
PW_ALL_BROWSERS=1 npm test
```

Tests that only make sense with a pointer (drag and drop) skip themselves on the
mobile project via `test.skip(({ isMobile }) => ...)`.

### Playwright version

`@playwright/test` is pinned to an exact version rather than a range. Each
Playwright release bundles a specific browser build, so a floating range means
the browsers on disk silently drift out of step with the library. Bump the pin
and re-run `npx playwright install` together.

## How the suite is put together

**Import `test` from the fixtures, not from `@playwright/test`.**

```ts
import { test, expect } from '../fixtures/taskflow.js';

test('moves a card into the chosen column', async ({ board }) => {
  await board.goto();
  await board.moveTicket('TASK-2', 'in_progress');
  expect(await board.keysIn('in_progress')).toEqual(['TASK-1', 'TASK-2']);
});
```

`e2e/fixtures/taskflow.ts` supplies the `board` and `ticketDialog` page objects
and wraps `page` in a guard that fails any test which logged a console error or
threw on the page — assertions passing is not the same as the app being happy.

**Seed the board instead of clicking it into shape.** `BoardPage.gotoWith()`
writes tickets into `localStorage` via `addInitScript` before app code runs, so
a test that cares about one edge case doesn't spend ten actions building up to
it:

```ts
await board.gotoWith([buildTicket({ key: 'TASK-42', status: 'review' })]);
```

Each test gets its own browser context, so storage starts clean every time and
`fullyParallel` is safe.

**Locators favour what a user can see.** Columns are found by their accessible
region name, buttons and fields by role and label. `data-testid` is reserved for
structural nodes with no meaningful role — cards, columns, the toast — and for
addressing a ticket by its key, which is its identity.

**Assertions are web-first.** `expect(locator).toHaveText(...)` and friends
retry, so there are no `waitForTimeout` calls in the suite.

## Continuous integration

`.github/workflows/e2e.yml` type-checks the suite, then runs it across Chromium,
Firefox and WebKit on every push and pull request. Browser downloads are cached
against the pinned Playwright version. The HTML report is uploaded on every run
and traces are uploaded on failure — download the report artifact and run
`npx playwright show-report path/to/extracted-report` to step through it.

On CI the suite also runs with `forbidOnly` and two retries; `trace` is captured
on the first retry so a flaky failure arrives with a full timeline attached.
