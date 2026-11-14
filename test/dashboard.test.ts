import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderDashboard } from '../src/dashboard.js';
import { diffPrompts } from '../src/diff.js';
import { lintPrompt } from '../src/lint.js';

const samples = {
  before: readFileSync(new URL('../examples/support-reply.v1.md', import.meta.url), 'utf8'),
  after: readFileSync(new URL('../examples/support-reply.v2.md', import.meta.url), 'utf8')
};
const reports = {
  before: lintPrompt(samples.before),
  after: lintPrompt(samples.after)
};

// Only the DOM surface used by the inline script; no browser dependency required.
class Element {
  value = '';
  innerHTML = '';
  scrollTop = 0;
  private text = '';
  private classes = new Set<string>();
  private listeners = new Map<string, Array<() => void>>();
  style = { width: '', setProperty: vi.fn() };
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, enabled: boolean) => enabled ? this.classes.add(name) : this.classes.delete(name)
  };
  constructor(private tab = '') {}
  get textContent() { return this.text; }
  set textContent(value: string | number) { this.text = String(value); }
  getAttribute() { return this.tab; }
  addEventListener(event: string, listener: () => void) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }
  dispatch(event: string) { this.listeners.get(event)?.forEach(listener => listener()); }
}

async function dashboard() {
  const html = renderDashboard('test');
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element()]));
  const get = (id: string) => {
    const element = elements.get(id);
    if (!element) throw new Error(`Missing dashboard element: ${id}`);
    return element;
  };
  // These containers end at this indentation in the static dashboard template.
  const initial = Object.fromEntries(['structure-grid', 'findings-list'].map(id => {
    const contents = html.match(new RegExp(`id="${id}">([\\s\\S]*?)\\n            </div>`))?.[1];
    if (!contents) throw new Error(`Missing initial markup: ${id}`);
    get(id).innerHTML = contents;
    return [id, contents];
  }));
  const tabs = [new Element('lint'), new Element('compare')];
  const requests: Array<{ signal: AbortSignal; respond: (payload: unknown, ok?: boolean) => void }> = [];
  const copy = vi.fn().mockResolvedValue(undefined);
  const fetch = vi.fn((url: string, options?: { body: string; signal: AbortSignal }) => {
    if (url === '/api/samples') return Promise.resolve({ json: async () => samples });
    if (url === '/api/diff') {
      const { before, after } = JSON.parse(options!.body);
      return Promise.resolve({ ok: true, json: async () => diffPrompts(before, after) });
    }
    if (url !== '/api/lint' || !options) throw new Error(`Unexpected request: ${url}`);
    // Intentionally allow completion after abort, as with an already-resolved fetch/body.
    return new Promise(resolve => requests.push({
      signal: options.signal,
      respond: (payload, ok = true) => resolve({ ok, json: async () => payload })
    }));
  });
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error('Missing dashboard script');
  runInNewContext(script, {
    document: { getElementById: get, querySelectorAll: () => tabs },
    navigator: { clipboard: { writeText: copy } },
    AbortController, fetch, setTimeout, clearTimeout
  });
  await setImmediate();
  expect(requests).toHaveLength(1); // Automatic Sample v1 load.
  requests[0]!.respond(reports.before);
  await setImmediate();
  return { get, initial, tabs, requests, copy, fetch };
}

type Dashboard = Awaited<ReturnType<typeof dashboard>>;

function expectEmpty(ui: Dashboard) {
  expect(ui.get('score-num').textContent).toBe('—');
  expect(ui.get('grade').textContent).toBe('No score yet');
  expect(ui.get('score-title').textContent).toBe('Waiting for a prompt');
  expect(ui.get('score-panel').classList.contains('loading')).toBe(false);
  expect(ui.get('ring').style.setProperty).toHaveBeenCalledWith('--p', 0);
  for (const [name, maximum] of Object.entries({ structure: 50, clarity: 25, specificity: 15, brevity: 10 })) {
    expect(ui.get(`bar-${name}`).style.width).toBe('0%');
    expect(ui.get(`val-${name}`).textContent).toBe(`0/${maximum}`);
  }
  for (const name of ['words', 'tokens', 'lines', 'sentences']) {
    expect(ui.get(`stat-${name}`).textContent).toBe('0');
  }
  expect(ui.get('context-chips').innerHTML).toBe('');
  expect(ui.get('structure-hint').textContent).toBe('0 of 7 sections');
  expect(ui.get('findings-hint').textContent).toBe('Nothing analyzed yet');
  for (const [id, contents] of Object.entries(ui.initial)) expect(ui.get(id).innerHTML).toBe(contents);
  ui.get('copy-report').dispatch('click');
  expect(ui.copy).not.toHaveBeenCalled();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('dashboard empty report', () => {
  it('restores the static neutral markup after Sample v1 and cancels pending debounce', async () => {
    const ui = await dashboard();
    expect(ui.get('structure-grid').innerHTML).toContain('present');
    expect(ui.get('findings-list').innerHTML).toContain('finding sev-');
    ui.get('prompt').value += '\nAn edit waiting to be linted';
    ui.get('prompt').dispatch('input');
    expect(vi.getTimerCount()).toBe(1);
    ui.get('clear-prompt').dispatch('click');
    expect(ui.get('prompt').value).toBe('');
    expectEmpty(ui);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ui.requests).toHaveLength(1);
    expectEmpty(ui);
  });

  it.each(['', ' \t\n  '])('resets manually entered empty text %j without linting it', async text => {
    const ui = await dashboard();
    ui.get('prompt').value = text;
    ui.get('prompt').dispatch('input');
    await vi.advanceTimersByTimeAsync(320);
    expectEmpty(ui);
    expect(ui.requests).toHaveLength(1);
  });

  it.each(['success', 'error'])('ignores a delayed %s response after Clear and removes loading immediately', async result => {
    const ui = await dashboard();
    ui.get('load-v1').dispatch('click');
    await setImmediate();
    const pending = ui.requests[1]!;
    expect(ui.get('score-panel').classList.contains('loading')).toBe(true);
    ui.get('clear-prompt').dispatch('click');
    expect(pending.signal.aborted).toBe(true);
    expectEmpty(ui);
    pending.respond(result === 'success' ? reports.before : { error: { message: 'Stale failure' } }, result === 'success');
    await setImmediate();
    expectEmpty(ui);
    await vi.advanceTimersByTimeAsync(1000);
    expectEmpty(ui);
  });

  it('loads Sample v2, copies its report and compares samples after Clear', async () => {
    const ui = await dashboard();
    ui.get('clear-prompt').dispatch('click');
    expectEmpty(ui);
    ui.get('load-v2').dispatch('click');
    await setImmediate();
    expect(ui.get('prompt').value).toBe(samples.after);
    ui.requests[1]!.respond(reports.after);
    await setImmediate();
    expect(ui.get('score-num').textContent).toBe(String(reports.after.score.total));
    expect(ui.get('findings-list').innerHTML).toContain('success-card');
    ui.get('copy-report').dispatch('click');
    expect(ui.copy).toHaveBeenCalledWith(JSON.stringify(reports.after, null, 2));
    ui.copy.mockClear();
    ui.get('clear-prompt').dispatch('click');
    expectEmpty(ui); // Also resets a clean report, not just findings.
    ui.tabs[1]!.dispatch('click');
    await setImmediate();
    expect(ui.get('compare-view').classList.contains('active')).toBe(true);
    expect(ui.get('before').value).toBe(samples.before);
    expect(ui.get('after').value).toBe(samples.after);
    expect(ui.get('diff-verdict').innerHTML).toContain('improves');
    expect(ui.get('diff-lines').innerHTML).toContain('diff-row add');
    ui.get('after').dispatch('input');
    await vi.advanceTimersByTimeAsync(420);
    ui.get('run-diff').dispatch('click');
    ui.get('load-pair').dispatch('click');
    await setImmediate();
    expect(ui.fetch.mock.calls.filter(([url]) => url === '/api/diff')).toHaveLength(4);
  });
});
