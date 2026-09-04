#!/usr/bin/env node
/**
 * Server for the TaskFlow demo: the static site plus the ticket REST API.
 *
 * Both live on one port so the browser app and the API share an origin and
 * there is a single process to start. Deliberately dependency free, so
 * `npm ci` only ever installs test tooling. Playwright's `webServer` starts
 * this and waits for the port to answer.
 *
 *   node server/static-server.js [--port 4173] [--root app]
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { API_PREFIX, createTicketApi } from './api.js';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function readArgs(argv) {
  const args = { port: Number(process.env.PORT ?? 4173), root: 'app' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') args.port = Number(argv[i + 1]);
    if (argv[i] === '--root') args.root = argv[i + 1];
  }
  return args;
}

/** Resolves a URL path to a file inside root, or null if it escapes root. */
async function resolveFile(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = resolve(join(root, normalize(decoded)));
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;

  try {
    const stats = await stat(candidate);
    if (stats.isDirectory()) return resolveFile(root, join(decoded, 'index.html'));
    return candidate;
  } catch {
    return null;
  }
}

export function createStaticServer(root) {
  const rootDir = resolve(root);
  const api = createTicketApi();

  return createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
      await api.handle(req, res);
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' }).end('Method Not Allowed');
      return;
    }

    const file = await resolveFile(rootDir, req.url ?? '/');
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not Found');
      return;
    }

    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      // The demo app is edited constantly; never let a test see a stale asset.
      'cache-control': 'no-store',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    createReadStream(file).pipe(res);
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { port, root } = readArgs(process.argv.slice(2));
  createStaticServer(root).listen(port, () => {
    console.log(`TaskFlow running at http://localhost:${port}`);
    console.log(`API at            http://localhost:${port}${API_PREFIX}/tickets`);
  });
}
