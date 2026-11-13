#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { diffPrompts } from './diff.js';
import { lintPrompt } from './lint.js';
import { renderDiff, renderLint } from './report.js';
import { ALL_RULES, LINT_RULES, SEVERITY_LABEL, STRUCTURE_RULES } from './rules.js';
import { startServer } from './server.js';
import type { CliOptions, DiffReport, LintReport, OutputFormat } from './types.js';

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

function readVersion(): string {
  try {
    const raw = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === 'string' ? parsed.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const VERSION = readVersion();

const COMMANDS = new Set(['lint', 'diff', 'serve', 'rules', 'sample', 'help', 'version']);

const HELP = `NoxaPlus PromptLens ${VERSION} — lint prompts before they reach a model.

Usage
  promptlens <file> [options]
  promptlens lint <file|-> [options]
  promptlens diff <before> <after> [options]
  promptlens serve [--port 4020] [--host 127.0.0.1]
  promptlens sample [v1|v2]
  promptlens rules
  promptlens --help
  promptlens --version

Options
  --format <text|json>   Report format (default: text)
  --out <path>           Write the report to a file instead of stdout
  --fail-under <0..100>  Exit 1 when the score is below this number
  --fail-on-regression   Exit 1 when the new version scores lower than the old one
  --no-color             Disable ANSI colors
  --quiet                Suppress the "report written" status line
  --port <number>        Port for the dashboard (default: 4020)
  --host <address>       Bind address for the dashboard (default: 127.0.0.1)

What it checks
  Structure, vague wording, hedges, open-ended subjects, placeholders,
  duplicated instructions, missing delimiters, long sentences, and token weight.

Exit codes
  0  The prompt was analyzed and passed the requested checks
  1  The score is below --fail-under, or the score regressed with --fail-on-regression
  2  Invalid usage, unreadable input, or a server error

Examples
  promptlens examples/support-reply.v1.md
  promptlens lint prompt.md --fail-under 80
  promptlens diff prompt.v1.md prompt.v2.md --fail-on-regression
  promptlens lint - --format json < prompt.md
  promptlens serve
`;

export interface CliIo {
  out: (text: string) => void;
  err: (text: string) => void;
  isTTY: boolean;
  readStdin: () => Promise<string>;
}

const defaultIo: CliIo = {
  out: (text: string) => process.stdout.write(text),
  err: (text: string) => process.stderr.write(text),
  isTTY: process.stdout.isTTY === true,
  readStdin: async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
  }
};

function valueFor(argv: string[], index: number, flag: string, inline: string | undefined): { value: string; next: number } {
  if (inline !== undefined) {
    if (inline.length === 0) throw new UsageError(`${flag} requires a value.`);
    return { value: inline, next: index };
  }
  const value = argv[index + 1];
  if (value === undefined || (value.startsWith('-') && value !== '-')) throw new UsageError(`${flag} requires a value.`);
  return { value, next: index + 1 };
}

function numberWithin(raw: string, flag: string, minimum: number, maximum: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new UsageError(`${flag} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: 'help',
    input: undefined,
    before: undefined,
    after: undefined,
    format: 'text',
    out: undefined,
    port: 4020,
    host: '127.0.0.1',
    noColor: false,
    quiet: false,
    failUnder: undefined,
    failOnRegression: false,
    sample: undefined
  };

  const positionals: string[] = [];
  let index = 0;
  let explicitHelp = false;
  let explicitVersion = false;

  if (argv.length === 0) {
    return options;
  }

  const first = argv[0];
  if (first === '--help' || first === '-h') return { ...options, command: 'help' };
  if (first === '--version' || first === '-v') return { ...options, command: 'version' };
  if (first !== undefined && COMMANDS.has(first)) {
    options.command = first as CliOptions['command'];
    index = 1;
  } else {
    options.command = 'lint';
  }

  for (; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) continue;
    if (argument === '--') {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (argument === '-' || !argument.startsWith('-')) {
      positionals.push(argument);
      continue;
    }

    const equals = argument.indexOf('=');
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inline = equals === -1 ? undefined : argument.slice(equals + 1);

    if (flag === '--help' || flag === '-h') {
      explicitHelp = true;
    } else if (flag === '--version' || flag === '-v') {
      explicitVersion = true;
    } else if (flag === '--format') {
      const parsed = valueFor(argv, index, flag, inline);
      if (parsed.value !== 'text' && parsed.value !== 'json') {
        throw new UsageError('--format must be text or json.');
      }
      options.format = parsed.value as OutputFormat;
      index = parsed.next;
    } else if (flag === '--out') {
      const parsed = valueFor(argv, index, flag, inline);
      options.out = parsed.value;
      index = parsed.next;
    } else if (flag === '--fail-under') {
      const parsed = valueFor(argv, index, flag, inline);
      const value = Number(parsed.value);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new UsageError('--fail-under must be a number between 0 and 100.');
      }
      options.failUnder = value;
      index = parsed.next;
    } else if (flag === '--port') {
      const parsed = valueFor(argv, index, flag, inline);
      options.port = numberWithin(parsed.value, '--port', 1, 65535);
      index = parsed.next;
    } else if (flag === '--host') {
      const parsed = valueFor(argv, index, flag, inline);
      options.host = parsed.value;
      index = parsed.next;
    } else if (flag === '--fail-on-regression') {
      options.failOnRegression = true;
    } else if (flag === '--no-color') {
      options.noColor = true;
    } else if (flag === '--quiet') {
      options.quiet = true;
    } else {
      throw new UsageError(`Unknown option "${flag}".`);
    }
  }

  if (explicitHelp) return { ...options, command: 'help' };
  if (explicitVersion) return { ...options, command: 'version' };

  if (options.command === 'lint') {
    const input = positionals[0];
    if (input === undefined) throw new UsageError('lint needs a file path, or - to read stdin.');
    if (positionals.length > 1) throw new UsageError('lint accepts one input path.');
    options.input = input;
  } else if (options.command === 'diff') {
    const before = positionals[0];
    const after = positionals[1];
    if (before === undefined || after === undefined) throw new UsageError('diff needs two file paths.');
    if (positionals.length > 2) throw new UsageError('diff accepts exactly two file paths.');
    options.before = before;
    options.after = after;
  } else if (options.command === 'sample') {
    const sample = positionals[0] ?? 'v1';
    if (sample !== 'v1' && sample !== 'v2') throw new UsageError('sample accepts v1 or v2.');
    if (positionals.length > 1) throw new UsageError('sample accepts one version.');
    options.sample = sample;
  } else if (options.command === 'serve' || options.command === 'rules') {
    if (positionals.length > 0) throw new UsageError(`${options.command} does not accept a path.`);
  }

  return options;
}

async function readInput(input: string, io: CliIo): Promise<string> {
  if (input === '-') return io.readStdin();
  try {
    return await readFile(resolve(input), 'utf8');
  } catch {
    throw new UsageError(`Could not read "${input}".`);
  }
}

async function emit(text: string, options: CliOptions, io: CliIo): Promise<void> {
  if (options.out === undefined) {
    io.out(text);
    return;
  }
  const target = resolve(options.out);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, text, 'utf8');
  if (!options.quiet) io.out(`Wrote ${options.out}.\n`);
}

function colorEnabled(options: CliOptions, io: CliIo): boolean {
  return !options.noColor && options.out === undefined && io.isTTY;
}

function renderRules(): string {
  const lines: string[] = [`NoxaPlus PromptLens ${VERSION} · ${ALL_RULES.length} rules`, ''];
  lines.push(`${'ID'.padEnd(24)} ${'SEVERITY'.padEnd(9)} ${'KIND'.padEnd(10)} TITLE`);
  for (const rule of LINT_RULES) {
    lines.push(`${rule.id.padEnd(24)} ${SEVERITY_LABEL[rule.severity].toLowerCase().padEnd(9)} ${rule.category.padEnd(10)} ${rule.title}`);
  }
  for (const rule of STRUCTURE_RULES) {
    lines.push(`${rule.id.padEnd(24)} ${SEVERITY_LABEL[rule.severity].toLowerCase().padEnd(9)} ${'structure'.padEnd(10)} ${rule.title}`);
  }
  return lines.join('\n');
}

function scoreNote(report: LintReport): string {
  return `Score ${report.score.total}/100 (${report.score.grade}) · ${report.stats.tokens} est. tokens`;
}

async function readSampleFile(sample: 'v1' | 'v2'): Promise<string> {
  const name = sample === 'v1' ? 'support-reply.v1.md' : 'support-reply.v2.md';
  try {
    return await readFile(new URL(`../examples/${name}`, import.meta.url), 'utf8');
  } catch {
    throw new UsageError(`Could not read the bundled ${sample} sample.`);
  }
}

export async function runCli(argv: string[], io: CliIo = defaultIo): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArgs(argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid usage.';
    io.err(`promptlens: ${message}\n\nRun "promptlens --help" for usage.\n`);
    return 2;
  }

  if (options.command === 'help') {
    io.out(HELP);
    return 0;
  }
  if (options.command === 'version') {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (options.command === 'rules') {
    if (options.format === 'json') {
      await emit(`${JSON.stringify({ tool: 'promptlens', version: VERSION, rules: ALL_RULES }, null, 2)}\n`, options, io);
    } else {
      await emit(`${renderRules()}\n`, options, io);
    }
    return 0;
  }
  if (options.command === 'sample') {
    const sample = options.sample ?? 'v1';
    const text = await readSampleFile(sample);
    if (options.format === 'json') {
      await emit(`${JSON.stringify({ tool: 'promptlens', version: VERSION, sample, prompt: text }, null, 2)}\n`, options, io);
    } else {
      await emit(text, options, io);
    }
    return 0;
  }
  if (options.command === 'serve') {
    const { server, url } = await startServer({
      port: options.port,
      host: options.host,
      version: VERSION,
      quiet: options.quiet
    });
    io.out(`NoxaPlus PromptLens ${VERSION}\n`);
    io.out(`dashboard ${url}\n`);
    io.out('api       POST /api/lint · POST /api/diff · GET /api/rules\n');
    io.out('Press Ctrl+C to stop.\n');
    await new Promise<void>(resolveStop => {
      const stop = (): void => {
        io.out('\nStopping.\n');
        server.close(() => resolveStop());
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
    return 0;
  }

  if (options.command === 'lint') {
    const input = options.input;
    if (input === undefined) return 2;
    const text = await readInput(input, io);
    const report = lintPrompt(text, { version: VERSION });
    const color = colorEnabled(options, io);
    if (options.format === 'json') {
      await emit(`${JSON.stringify(report, null, 2)}\n`, options, io);
    } else {
      await emit(renderLint(report, { color }), options, io);
    }
    if (options.out !== undefined && !options.quiet) io.out(`${scoreNote(report)}\n`);

    if (options.failUnder !== undefined && report.score.total < options.failUnder) {
      io.err(`\nScore ${report.score.total} is below --fail-under ${options.failUnder}.\n`);
      return 1;
    }
    return 0;
  }

  const beforePath = options.before;
  const afterPath = options.after;
  if (beforePath === undefined || afterPath === undefined) return 2;
  const [beforeText, afterText] = await Promise.all([readInput(beforePath, io), readInput(afterPath, io)]);
  const diff: DiffReport = diffPrompts(beforeText, afterText, { version: VERSION });
  if (options.format === 'json') {
    await emit(`${JSON.stringify(diff, null, 2)}\n`, options, io);
  } else {
    await emit(renderDiff(diff, { color: colorEnabled(options, io) }), options, io);
  }
  if (options.out !== undefined && !options.quiet) {
    io.out(`before ${diff.before.score.total} · after ${diff.after.score.total} · ${diff.verdict}\n`);
  }

  if (options.failUnder !== undefined && diff.after.score.total < options.failUnder) {
    io.err(`\nScore ${diff.after.score.total} is below --fail-under ${options.failUnder}.\n`);
    return 1;
  }
  if (options.failOnRegression && diff.after.score.total < diff.before.score.total) {
    io.err(`\nScore regressed from ${diff.before.score.total} to ${diff.after.score.total}.\n`);
    return 1;
  }
  return 0;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  runCli(process.argv.slice(2))
    .then(code => {
      if (code !== 0) process.exitCode = code;
    })
    .catch(error => {
      process.stderr.write(`promptlens: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 2;
    });
}
