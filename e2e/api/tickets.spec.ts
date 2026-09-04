import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  SEED_TICKETS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type Ticket,
} from '../data/tickets.js';

/**
 * API tests for the ticket service.
 *
 * These never open a browser: `request` is Playwright's HTTP client, and it
 * picks up `baseURL` from the config, so paths here are relative.
 *
 * Isolation works differently from the UI suite. A browser test gets a fresh
 * context and therefore fresh `localStorage`, so those specs run fully in
 * parallel. The API is one process with one shared board, so every test here
 * resets it first and the whole `api` project runs with `fullyParallel: false`.
 * Keeping all of these in a single file matters: Playwright hands one file to
 * one worker, so nothing else can be mutating the board mid-test.
 *
 * A production service would isolate differently — a database transaction
 * rolled back per test, a schema or tenant per worker — but the shape of the
 * problem is the same, and so is the rule: a test must control the state it
 * asserts on.
 */

const NEW_TICKET = {
  title: 'Wire up the reporting endpoint',
  description: 'Return per-assignee throughput for the last 14 days.',
  status: 'in_progress',
  priority: 'high',
  assignee: 'Devi',
} as const;

/** POSTs a ticket and returns it, failing the test if creation did not work. */
async function createTicket(
  request: APIRequestContext,
  body: Record<string, unknown>,
): Promise<Ticket> {
  const response = await request.post('/api/tickets', { data: body });
  expect(response.status(), await response.text()).toBe(201);
  return response.json() as Promise<Ticket>;
}

test.beforeEach(async ({ request }) => {
  const response = await request.post('/api/tickets/reset');
  expect(response.ok()).toBeTruthy();
});

test.describe('GET /api/health', () => {
  test('reports the service and how many tickets it holds', async ({ request }) => {
    const response = await request.get('/api/health');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({ status: 'ok', tickets: SEED_TICKETS.length });
  });
});

test.describe('GET /api/tickets', () => {
  test('returns the seed board', async ({ request }) => {
    const response = await request.get('/api/tickets');

    expect(response.status()).toBe(200);
    const { tickets } = await response.json();
    expect(tickets).toHaveLength(SEED_TICKETS.length);
    expect(tickets.map((ticket: Ticket) => ticket.key)).toEqual([
      'TASK-1',
      'TASK-2',
      'TASK-3',
      'TASK-4',
      'TASK-5',
    ]);
  });

  test('every ticket carries the full contract', async ({ request }) => {
    const { tickets } = await (await request.get('/api/tickets')).json();

    for (const ticket of tickets as Ticket[]) {
      expect(ticket).toEqual({
        key: expect.stringMatching(/^TASK-\d+$/),
        title: expect.any(String),
        description: expect.any(String),
        status: expect.stringMatching(new RegExp(`^(${TICKET_STATUSES.join('|')})$`)),
        priority: expect.stringMatching(new RegExp(`^(${TICKET_PRIORITIES.join('|')})$`)),
        assignee: expect.any(String),
      });
    }
  });

  test('filters by status', async ({ request }) => {
    const { tickets } = await (await request.get('/api/tickets?status=backlog')).json();

    expect(tickets.map((t: Ticket) => t.key)).toEqual(['TASK-2', 'TASK-4']);
  });

  test('filters by priority', async ({ request }) => {
    const { tickets } = await (await request.get('/api/tickets?priority=critical')).json();

    expect(tickets).toHaveLength(1);
    expect(tickets[0].key).toBe('TASK-3');
  });

  test('filters by assignee', async ({ request }) => {
    const { tickets } = await (await request.get('/api/tickets?assignee=Rowan')).json();

    expect(tickets.map((t: Ticket) => t.key)).toEqual(['TASK-1', 'TASK-3']);
  });

  test('searches key, title and description, ignoring case', async ({ request }) => {
    const byTitle = await (await request.get('/api/tickets?q=KEYBOARD')).json();
    const byDescription = await (await request.get('/api/tickets?q=oauth')).json();
    const byKey = await (await request.get('/api/tickets?q=TASK-5')).json();

    expect(byTitle.tickets.map((t: Ticket) => t.key)).toEqual(['TASK-4']);
    expect(byDescription.tickets.map((t: Ticket) => t.key)).toEqual(['TASK-1']);
    expect(byKey.tickets.map((t: Ticket) => t.key)).toEqual(['TASK-5']);
  });

  test('combines filters', async ({ request }) => {
    const { tickets } = await (
      await request.get('/api/tickets?assignee=Rowan&priority=critical')
    ).json();

    expect(tickets.map((t: Ticket) => t.key)).toEqual(['TASK-3']);
  });

  test('returns an empty list rather than an error when nothing matches', async ({ request }) => {
    const response = await request.get('/api/tickets?assignee=Nobody');

    expect(response.status()).toBe(200);
    expect((await response.json()).tickets).toEqual([]);
  });

  test('ignores an unknown query parameter', async ({ request }) => {
    const { tickets } = await (await request.get('/api/tickets?sortBy=nonsense')).json();

    expect(tickets).toHaveLength(SEED_TICKETS.length);
  });
});

test.describe('GET /api/tickets/:key', () => {
  test('returns one ticket', async ({ request }) => {
    const response = await request.get('/api/tickets/TASK-3');

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      key: 'TASK-3',
      title: 'Fix column count badge off-by-one',
      description: 'Counts include archived tickets when a filter is active.',
      status: 'review',
      priority: 'critical',
      assignee: 'Rowan',
    });
  });

  test('404s on an unknown key', async ({ request }) => {
    const response = await request.get('/api/tickets/TASK-9999');

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Ticket TASK-9999 not found' });
  });
});

test.describe('POST /api/tickets', () => {
  test('creates a ticket and points at it with Location', async ({ request }) => {
    const response = await request.post('/api/tickets', { data: NEW_TICKET });

    expect(response.status()).toBe(201);
    expect(response.headers().location).toBe('/api/tickets/TASK-6');
    expect(await response.json()).toEqual({ key: 'TASK-6', ...NEW_TICKET });
  });

  test('the created ticket is readable afterwards', async ({ request }) => {
    const created = await createTicket(request, NEW_TICKET);

    const response = await request.get(`/api/tickets/${created.key}`);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(created);
    expect((await (await request.get('/api/tickets')).json()).tickets).toHaveLength(
      SEED_TICKETS.length + 1,
    );
  });

  test('defaults status and priority when they are omitted', async ({ request }) => {
    const created = await createTicket(request, { title: 'Bare minimum body', assignee: 'Sam' });

    expect(created).toMatchObject({ status: 'backlog', priority: 'medium', description: '' });
  });

  test('trims whitespace off the fields it stores', async ({ request }) => {
    const created = await createTicket(request, {
      title: '   Padded on both sides   ',
      assignee: '  Rowan  ',
    });

    expect(created.title).toBe('Padded on both sides');
    expect(created.assignee).toBe('Rowan');
  });

  test('assigns keys above the highest one already on the board', async ({ request }) => {
    const first = await createTicket(request, { title: 'The first new one', assignee: 'Sam' });
    const second = await createTicket(request, { title: 'The second new one', assignee: 'Sam' });

    expect(first.key).toBe('TASK-6');
    expect(second.key).toBe('TASK-7');
  });

  test('ignores a client-supplied key', async ({ request }) => {
    const created = await createTicket(request, {
      key: 'TASK-500',
      title: 'Tries to pick its own key',
      assignee: 'Sam',
    });

    expect(created.key).toBe('TASK-6');
  });
});

test.describe('POST /api/tickets validation', () => {
  test('rejects a body with no title and no assignee', async ({ request }) => {
    const response = await request.post('/api/tickets', { data: {} });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Ticket is not valid',
      fields: { title: 'Title is required', assignee: 'Assignee is required' },
    });
  });

  test('rejects a title that is too short', async ({ request }) => {
    const response = await request.post('/api/tickets', {
      data: { title: 'abc', assignee: 'Sam' },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).fields).toEqual({
      title: 'Title must be at least 4 characters',
    });
  });

  test('rejects a title that is too long', async ({ request }) => {
    const response = await request.post('/api/tickets', {
      data: { title: 'x'.repeat(121), assignee: 'Sam' },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).fields.title).toBe('Title must be 120 characters or fewer');
  });

  test('rejects an unknown status and an unknown priority', async ({ request }) => {
    const response = await request.post('/api/tickets', {
      data: { title: 'Valid enough title', assignee: 'Sam', status: 'archived', priority: 'blocker' },
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).fields).toEqual({
      status: 'Unknown status: archived',
      priority: 'Unknown priority: blocker',
    });
  });

  test('rejects a malformed JSON body', async ({ request }) => {
    const response = await request.post('/api/tickets', {
      headers: { 'content-type': 'application/json' },
      // A Buffer goes over the wire untouched; a string would be JSON-encoded
      // by Playwright and arrive as a perfectly valid JSON string.
      data: Buffer.from('{ not json at all'),
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Request body is not valid JSON' });
  });

  test('rejects a JSON body that is not an object', async ({ request }) => {
    const response = await request.post('/api/tickets', {
      headers: { 'content-type': 'application/json' },
      data: Buffer.from('["not", "an", "object"]'),
    });

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Request body must be a JSON object' });
  });

  test('a rejected create leaves the board untouched', async ({ request }) => {
    await request.post('/api/tickets', { data: { title: 'no' } });

    const { tickets } = await (await request.get('/api/tickets')).json();
    expect(tickets).toHaveLength(SEED_TICKETS.length);
  });
});

test.describe('PATCH /api/tickets/:key', () => {
  test('updates only the fields it is given', async ({ request }) => {
    const response = await request.patch('/api/tickets/TASK-2', { data: { status: 'done' } });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
      key: 'TASK-2',
      title: 'Design ticket detail layout',
      description: 'Comments, attachments and the activity log need a home.',
      status: 'done',
      priority: 'medium',
      assignee: 'Priya',
    });
  });

  test('the change survives a subsequent read', async ({ request }) => {
    await request.patch('/api/tickets/TASK-1', { data: { priority: 'low', assignee: 'Sam' } });

    const ticket = await (await request.get('/api/tickets/TASK-1')).json();
    expect(ticket).toMatchObject({ priority: 'low', assignee: 'Sam' });
  });

  test('an empty patch is a no-op rather than an error', async ({ request }) => {
    const before = await (await request.get('/api/tickets/TASK-5')).json();

    const response = await request.patch('/api/tickets/TASK-5', { data: {} });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(before);
  });

  test('cannot renumber a ticket', async ({ request }) => {
    const response = await request.patch('/api/tickets/TASK-5', { data: { key: 'TASK-777' } });

    expect((await response.json()).key).toBe('TASK-5');
    expect((await request.get('/api/tickets/TASK-777')).status()).toBe(404);
  });

  test('validates the record the patch would produce', async ({ request }) => {
    const response = await request.patch('/api/tickets/TASK-1', { data: { title: 'no' } });

    expect(response.status()).toBe(400);
    expect((await response.json()).fields).toEqual({
      title: 'Title must be at least 4 characters',
    });
  });

  test('a rejected patch leaves the ticket untouched', async ({ request }) => {
    await request.patch('/api/tickets/TASK-1', { data: { status: 'archived' } });

    const ticket = await (await request.get('/api/tickets/TASK-1')).json();
    expect(ticket.status).toBe('in_progress');
  });

  test('404s on an unknown key', async ({ request }) => {
    const response = await request.patch('/api/tickets/TASK-9999', { data: { status: 'done' } });

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Ticket TASK-9999 not found' });
  });
});

test.describe('DELETE /api/tickets/:key', () => {
  test('removes the ticket and answers 204 with no body', async ({ request }) => {
    const response = await request.delete('/api/tickets/TASK-4');

    expect(response.status()).toBe(204);
    expect(await response.text()).toBe('');
    expect((await request.get('/api/tickets/TASK-4')).status()).toBe(404);
  });

  test('shrinks the collection by exactly one', async ({ request }) => {
    await request.delete('/api/tickets/TASK-4');

    const { tickets } = await (await request.get('/api/tickets')).json();
    expect(tickets.map((t: Ticket) => t.key)).toEqual(['TASK-1', 'TASK-2', 'TASK-3', 'TASK-5']);
  });

  test('is not idempotent: deleting twice 404s the second time', async ({ request }) => {
    expect((await request.delete('/api/tickets/TASK-4')).status()).toBe(204);

    const second = await request.delete('/api/tickets/TASK-4');

    expect(second.status()).toBe(404);
    expect(await second.json()).toEqual({ error: 'Ticket TASK-4 not found' });
  });
});

test.describe('Routing and method handling', () => {
  test('405s an unsupported method on the collection, naming what is allowed', async ({
    request,
  }) => {
    const response = await request.fetch('/api/tickets', { method: 'PUT', data: {} });

    expect(response.status()).toBe(405);
    expect(response.headers().allow).toBe('GET, POST');
    expect((await response.json()).error).toContain('Method not allowed');
  });

  test('405s an unsupported method on a single ticket', async ({ request }) => {
    const response = await request.fetch('/api/tickets/TASK-1', { method: 'PUT', data: {} });

    expect(response.status()).toBe(405);
    expect(response.headers().allow).toBe('GET, PATCH, DELETE');
  });

  test('404s an unknown API route', async ({ request }) => {
    const response = await request.get('/api/widgets');

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'No API route for /api/widgets' });
  });

  test('marks API responses as uncacheable', async ({ request }) => {
    const response = await request.get('/api/tickets');

    expect(response.headers()['cache-control']).toBe('no-store');
  });
});

test.describe('POST /api/tickets/reset', () => {
  test('restores the seed board after edits', async ({ request }) => {
    await request.delete('/api/tickets/TASK-1');
    await createTicket(request, { title: 'Should not survive', assignee: 'Sam' });

    const response = await request.post('/api/tickets/reset');

    expect(response.status()).toBe(200);
    expect((await response.json()).tickets).toEqual(SEED_TICKETS);
  });

  test('the same server also still serves the browser app', async ({ request }) => {
    const response = await request.get('/');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
    expect(await response.text()).toContain('<title>TaskFlow</title>');
  });
});
