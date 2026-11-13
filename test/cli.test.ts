import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseArgs, runCli, VERSION, type CliIo } from '../src/cli.js';

interface Capture {
  io: CliIo;
  output: () => string;
  errors: () => string;
}

function capture(stdin = ''): Capture {
  let out = '';
  let err = '';
  return {
    io: {
      out: (text: string) => {
        out += text;
      },
      err: (text: string) => {
        err += text;
      },
      isTTY: false,
      readStdin: async () => stdin
    },
    output: () => out,
    errors: () => err
  };
}

let workspace = '';
let v1 = '';
let v2 = '';

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'promptlens-cli-'));
  v1 = join(workspace, 'v1.md');
  v2 = join(workspace, 'v2.md');
  await writeFile(v1, 'Write a reply. Be nice and short.', 'utf8');
  await writeFile(
    v2,
    '# Role\nYou are a support agent.\n\n# Objective\nWrite one reply.\n\n# Context\nCustomer: Maya.\n\n# Constraints\nKeep it under 100 words.\n\n# Output format\nReturn plain text.\n\n# Tone\nDirect.',
    'utf8'
  );
});

afterEach(async () => {
  workspace = '';
});

describe('parseArgs', () => {
  it('defaults to help with no arguments', () => {
    expect(parseArgs([]).command).toBe('help');
  });

  it('treats a bare path as a lint command', () => {
    const options = parseArgs(['prompt.md']);
    expect(options.command).toBe('lint');
    expect(options.input).toBe('prompt.md');
  });

  it('parses lint flags and inline values', () => {
    const options = parseArgs(['lint', 'prompt.md', '--format=json', '--fail-under', '80', '--quiet']);
    expect(options.format).toBe('json');
    expect(options.failUnder).toBe(80);
    expect(options.quiet).toBe(true);
  });

  it('parses diff flags', () => {
    const options = parseArgs(['diff', 'a.md', 'b.md', '--fail-on-regression', '--no-color']);
    expect(options.before).toBe('a.md');
    expect(options.after).toBe('b.md');
    expect(options.failOnRegression).toBe(true);
    expect(options.noColor).toBe(true);
  });

  it('parses serve options', () => {
    const options = parseArgs(['serve', '--port', '4050', '--host', '0.0.0.0']);
    expect(options.port).toBe(4050);
    expect(options.host).toBe('0.0.0.0');
  });

  it('rejects unknown options', () => {
    expect(() => parseArgs(['lint', 'a.md', '--wat'])).toThrow('Unknown option');
  });

  it('rejects a diff with one path', () => {
    expect(() => parseArgs(['diff', 'a.md'])).toThrow('two file paths');
  });

  it('rejects an invalid sample name', () => {
    expect(() => parseArgs(['sample', 'v3'])).toThrow('v1 or v2');
  });
});

describe('runCli', () => {
  it('prints help', async () => {
    const run = capture();
    expect(await runCli(['--help'], run.io)).toBe(0);
    expect(run.output()).toContain('Usage');
  });

  it('prints the version', async () => {
    const run = capture();
    expect(await runCli(['--version'], run.io)).toBe(0);
    expect(run.output().trim()).toBe(VERSION);
  });

  it('lints a file as text', async () => {
    const run = capture();
    expect(await runCli(['lint', v1], run.io)).toBe(0);
    expect(run.output()).toContain('NoxaPlus PromptLens');
    expect(run.output()).toContain('Score');
  });

  it('lints a file as JSON', async () => {
    const run = capture();
    expect(await runCli(['lint', v1, '--format', 'json'], run.io)).toBe(0);
    const report = JSON.parse(run.output()) as { tool: string; score: { total: number }; findings: unknown[] };
    expect(report.tool).toBe('promptlens');
    expect(report.score.total).toBeGreaterThan(0);
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it('writes a report to a file', async () => {
    const target = join(workspace, 'reports', 'lint.json');
    const run = capture();
    expect(await runCli(['lint', v1, '--format', 'json', '--out', target], run.io)).toBe(0);
    const written = JSON.parse(await readFile(target, 'utf8')) as { tool: string };
    expect(written.tool).toBe('promptlens');
    expect(run.output()).toContain('Wrote');
  });

  it('fails under the requested score', async () => {
    const run = capture();
    expect(await runCli(['lint', v1, '--fail-under', '100'], run.io)).toBe(1);
    expect(run.errors()).toContain('below --fail-under 100');
  });

  it('compares two files as JSON', async () => {
    const run = capture();
    expect(await runCli(['diff', v1, v2, '--format', 'json'], run.io)).toBe(0);
    const diff = JSON.parse(run.output()) as { delta: { score: number }; sectionsGained: string[] };
    expect(diff.delta.score).toBeGreaterThan(0);
    expect(diff.sectionsGained).toContain('output');
  });

  it('fails when the score regresses', async () => {
    const run = capture();
    expect(await runCli(['diff', v2, v1, '--fail-on-regression'], run.io)).toBe(1);
    expect(run.errors()).toContain('regressed');
  });

  it('prints a sample', async () => {
    const run = capture();
    expect(await runCli(['sample', 'v2'], run.io)).toBe(0);
    expect(run.output()).toContain('# Role');
  });

  it('lists rules', async () => {
    const run = capture();
    expect(await runCli(['rules'], run.io)).toBe(0);
    expect(run.output()).toContain('placeholder');
    expect(run.output()).toContain('22 rules');
  });

  it('reads stdin with a dash', async () => {
    const run = capture('Write a concise summary.');
    expect(await runCli(['lint', '-'], run.io)).toBe(0);
    expect(run.output()).toContain('Score');
  });

  it('reports a missing file', async () => {
    await expect(runCli(['lint', join(workspace, 'missing.md')], capture().io)).rejects.toThrow('Could not read');
  });

  it('returns 2 for invalid usage', async () => {
    const run = capture();
    expect(await runCli(['lint'], run.io)).toBe(2);
    expect(run.errors()).toContain('needs a file path');
  });
});
