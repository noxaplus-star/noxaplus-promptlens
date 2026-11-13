import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { renderDashboard } from './dashboard.js';
import { diffPrompts } from './diff.js';
import { lintPrompt } from './lint.js';
import { ALL_RULES } from './rules.js';

const MAX_BODY_BYTES = 1_000_000;

export interface ServerOptions {
  port: number;
  host: string;
  version: string;
  quiet?: boolean;
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

function sendText(response: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8'): void {
  response.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readSample(name: string): Promise<string> {
  return readFile(new URL(`../examples/${name}`, import.meta.url), 'utf8');
}

function parsePromptField(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`"${field}" must be a string.`);
  return value;
}

export function createAppServer(options: ServerOptions): Server {
  const started = Date.now();

  return createServer(async (request, response) => {
    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', 'http://localhost');
    const pathname = url.pathname;
    const startedAt = Date.now();
    response.on('finish', () => {
      if (options.quiet === true) return;
      console.log(`${method} ${pathname} ${response.statusCode} ${Date.now() - startedAt}ms`);
    });

    try {
      if (method === 'GET' && pathname === '/') {
        sendText(response, 200, renderDashboard(options.version), 'text/html; charset=utf-8');
        return;
      }

      if (method === 'GET' && pathname === '/api/health') {
        sendJson(response, 200, { ok: true, name: 'NoxaPlus PromptLens', version: options.version, uptimeMs: Date.now() - started });
        return;
      }

      if (method === 'GET' && pathname === '/api/rules') {
        sendJson(response, 200, { rules: ALL_RULES });
        return;
      }

      if (method === 'GET' && pathname === '/api/samples') {
        const [before, after] = await Promise.all([readSample('support-reply.v1.md'), readSample('support-reply.v2.md')]);
        sendJson(response, 200, { before, after });
        return;
      }

      if (method === 'POST' && pathname === '/api/lint') {
        const raw = await readBody(request);
        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          sendJson(response, 400, { error: { message: 'Request body must be valid JSON.' } });
          return;
        }
        if (payload === null || typeof payload !== 'object') {
          sendJson(response, 400, { error: { message: 'Request body must be a JSON object.' } });
          return;
        }
        const prompt = parsePromptField((payload as { prompt?: unknown }).prompt, 'prompt');
        sendJson(response, 200, lintPrompt(prompt, { version: options.version }));
        return;
      }

      if (method === 'POST' && pathname === '/api/diff') {
        const raw = await readBody(request);
        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          sendJson(response, 400, { error: { message: 'Request body must be valid JSON.' } });
          return;
        }
        if (payload === null || typeof payload !== 'object') {
          sendJson(response, 400, { error: { message: 'Request body must be a JSON object.' } });
          return;
        }
        const body = payload as { before?: unknown; after?: unknown };
        const before = parsePromptField(body.before, 'before');
        const after = parsePromptField(body.after, 'after');
        sendJson(response, 200, diffPrompts(before, after, { version: options.version }));
        return;
      }

      sendJson(response, 404, { error: { message: `No route for ${method} ${pathname}.` } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      sendJson(response, 400, { error: { message } });
    }
  });
}

export async function startServer(options: ServerOptions): Promise<{ server: Server; url: string }> {
  const server = createAppServer(options);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : options.port;
  const host = options.host === '0.0.0.0' ? '127.0.0.1' : options.host;
  return { server, url: `http://${host}:${port}` };
}
