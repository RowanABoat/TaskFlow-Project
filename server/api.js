/**
 * JSON REST API for tickets, mounted under /api by the app server.
 *
 * Routes:
 *   GET    /api/health              service heartbeat
 *   GET    /api/tickets             list; ?status= &priority= &assignee= &q=
 *   POST   /api/tickets             create                          201
 *   GET    /api/tickets/:key        fetch one                       404 if unknown
 *   PATCH  /api/tickets/:key        partial update                  404 if unknown
 *   DELETE /api/tickets/:key        remove                          204 / 404
 *   POST   /api/tickets/reset       restore the seed board (demo + test helper)
 *
 * Errors come back as { error: string } and validation failures add
 * { fields: { title: "...", ... } }, so a client never has to parse prose.
 */

import { TicketRepository, ValidationError } from './ticket-repository.js';

const MAX_BODY_BYTES = 1_000_000;

export const API_PREFIX = '/api';

function sendJson(res, status, payload, headers = {}) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(body);
}

const sendError = (res, status, error, extra = {}) =>
  sendJson(res, status, { error, ...extra });

/** Reads and parses a JSON request body. Rejects oversized or malformed input. */
async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new PayloadError('Request body is too large', 413);
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PayloadError('Request body is not valid JSON', 400);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PayloadError('Request body must be a JSON object', 400);
  }
  return parsed;
}

class PayloadError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Builds the /api request handler.
 *
 * @returns {{ handle: (req, res) => Promise<void>, repository: TicketRepository }}
 */
export function createTicketApi(repository = new TicketRepository()) {
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const segments = url.pathname.split('/').filter(Boolean); // ['api', 'tickets', key?]
    const [, resource, id] = segments;

    if (segments.length === 2 && resource === 'health') {
      return req.method === 'GET'
        ? sendJson(res, 200, { status: 'ok', tickets: repository.size })
        : methodNotAllowed(res, ['GET']);
    }

    if (resource !== 'tickets') {
      return sendError(res, 404, `No API route for ${url.pathname}`);
    }

    // Collection: /api/tickets
    if (segments.length === 2) {
      if (req.method === 'GET') {
        return sendJson(res, 200, {
          tickets: repository.list({
            status: url.searchParams.get('status') ?? undefined,
            priority: url.searchParams.get('priority') ?? undefined,
            assignee: url.searchParams.get('assignee') ?? undefined,
            q: url.searchParams.get('q') ?? undefined,
          }),
        });
      }

      if (req.method === 'POST') {
        const ticket = repository.create(await readJsonBody(req));
        return sendJson(res, 201, ticket, { location: `${API_PREFIX}/tickets/${ticket.key}` });
      }

      return methodNotAllowed(res, ['GET', 'POST']);
    }

    if (segments.length !== 3) {
      return sendError(res, 404, `No API route for ${url.pathname}`);
    }

    // Checked before the :key routes so a ticket can never shadow it.
    if (id === 'reset') {
      return req.method === 'POST'
        ? sendJson(res, 200, { tickets: repository.reset() })
        : methodNotAllowed(res, ['POST']);
    }

    // Item: /api/tickets/:key
    const key = decodeURIComponent(id);

    if (req.method === 'GET') {
      const ticket = repository.get(key);
      return ticket ? sendJson(res, 200, ticket) : notFound(res, key);
    }

    if (req.method === 'PATCH') {
      const ticket = repository.update(key, await readJsonBody(req));
      return ticket ? sendJson(res, 200, ticket) : notFound(res, key);
    }

    if (req.method === 'DELETE') {
      const removed = repository.remove(key);
      if (!removed) return notFound(res, key);
      res.writeHead(204).end();
      return undefined;
    }

    return methodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
  }

  return {
    repository,
    async handle(req, res) {
      try {
        await handle(req, res);
      } catch (error) {
        if (error instanceof ValidationError) {
          sendError(res, 400, error.message, { fields: error.fields });
        } else if (error instanceof PayloadError) {
          sendError(res, error.status, error.message);
        } else {
          console.error('Unhandled API error:', error);
          sendError(res, 500, 'Internal server error');
        }
      }
    },
  };
}

const notFound = (res, key) => sendError(res, 404, `Ticket ${key} not found`);

const methodNotAllowed = (res, allowed) =>
  sendJson(
    res,
    405,
    { error: `Method not allowed; try ${allowed.join(', ')}` },
    { allow: allowed.join(', ') },
  );
