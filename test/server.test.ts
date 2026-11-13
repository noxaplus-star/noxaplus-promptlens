import type { Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startServer } from '../src/server.js';

let server: Server | undefined;
let url = '';
let v1 = '';
let v2 = '';

beforeEach(async () => {
  const started = await startServer({ port: 0, host: '127.0.0.1', version: '1.0.0', quiet: true });
  server = started.server;
  url = started.url;
  [v1, v2] = await Promise.all([
    readFile(new URL('../examples/support-reply.v1.md', import.meta.url), 'utf8'),
    readFile(new URL('../examples/support-reply.v2.md', import.meta.url), 'utf8')
  ]);
});

afterEach(async () => {
  if (!server) return;
  await new Promise<void>(resolve => server?.close(() => resolve()));
  server = undefined;
});

describe('dashboard server', () => {
  it('serves the dashboard', async () => {
    const response = await fetch(`${url}/`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    expect(html).toContain('PromptLens');
    expect(html).toContain('by NoxaPlus');
  });

  it('reports health and version', async () => {
    const response = await fetch(`${url}/api/health`);
    const payload = (await response.json()) as { ok: boolean; version: string };
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.version).toBe('1.0.0');
  });

  it('returns the samples', async () => {
    const response = await fetch(`${url}/api/samples`);
    const payload = (await response.json()) as { before: string; after: string };
    expect(response.status).toBe(200);
    expect(payload.before).toContain('Write a reply to this customer');
    expect(payload.after).toContain('# Role');
  });

  it('lints a prompt', async () => {
    const response = await fetch(`${url}/api/lint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: v1 })
    });
    const report = (await response.json()) as { tool: string; score: { total: number }; findings: unknown[] };
    expect(response.status).toBe(200);
    expect(report.tool).toBe('promptlens');
    expect(report.score.total).toBeGreaterThan(0);
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it('compares two prompts', async () => {
    const response = await fetch(`${url}/api/diff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ before: v1, after: v2 })
    });
    const diff = (await response.json()) as { delta: { score: number }; verdict: string };
    expect(response.status).toBe(200);
    expect(diff.delta.score).toBeGreaterThan(0);
    expect(diff.verdict).toContain('score improved');
  });

  it('lists rules', async () => {
    const response = await fetch(`${url}/api/rules`);
    const payload = (await response.json()) as { rules: Array<{ id: string }> };
    expect(response.status).toBe(200);
    expect(payload.rules).toHaveLength(22);
  });

  it('rejects malformed JSON', async () => {
    const response = await fetch(`${url}/api/lint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{'
    });
    expect(response.status).toBe(400);
  });

  it('rejects a non-string prompt', async () => {
    const response = await fetch(`${url}/api/lint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 42 })
    });
    expect(response.status).toBe(400);
  });

  it('returns JSON for unknown routes', async () => {
    const response = await fetch(`${url}/nope`);
    expect(response.status).toBe(404);
    const payload = (await response.json()) as { error: { message: string } };
    expect(payload.error.message).toContain('No route');
  });
});
