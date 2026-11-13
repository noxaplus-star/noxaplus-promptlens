import type { DiffReport, LintReport, Severity } from './types.js';
import { SEVERITY_ORDER } from './types.js';

const COLORS: Record<Severity, string> = {
  high: '\u001b[1;31m',
  medium: '\u001b[1;35m',
  low: '\u001b[1;33m',
  info: '\u001b[1;36m'
};

const RESET = '\u001b[0m';
const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';
const GREEN = '\u001b[1;32m';
const RED = '\u001b[1;31m';
const CYAN = '\u001b[1;36m';

function tone(color: boolean, code: string, text: string): string {
  return color ? `${code}${text}${RESET}` : text;
}

function scoreColor(score: number, color: boolean): string {
  if (!color) return `${score}`;
  if (score >= 80) return `${GREEN}${score}${RESET}`;
  if (score >= 60) return `${'\u001b[1;33m'}${score}${RESET}`;
  return `${RED}${score}${RESET}`;
}

function truncate(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}

export interface TextReportOptions {
  color: boolean;
}

export function renderLint(report: LintReport, options: TextReportOptions): string {
  const lines: string[] = [];
  lines.push(`NoxaPlus PromptLens ${report.version}`);
  lines.push(
    `${report.stats.words} words · ${report.stats.tokens.toLocaleString('en-US')} est. tokens · ${report.stats.lines} lines · ${report.stats.sentences} sentences`
  );
  lines.push('');
  lines.push(
    `Score ${scoreColor(report.score.total, options.color)} / 100  ${tone(options.color, BOLD, `(${report.score.grade})`)}`
  );
  lines.push(`  Structure    ${report.score.structure} / 50`);
  lines.push(`  Clarity      ${report.score.clarity} / 25`);
  lines.push(`  Specificity  ${report.score.specificity} / 15`);
  lines.push(`  Brevity      ${report.score.brevity} / 10`);
  lines.push('');

  lines.push('Structure');
  for (const section of report.structure) {
    const mark = section.present ? tone(options.color, GREEN, '[x]') : tone(options.color, DIM, '[ ]');
    const detail = section.evidence ? `  ${tone(options.color, DIM, truncate(section.evidence, 64))}` : '';
    lines.push(`  ${mark} ${section.label.padEnd(17)} ${String(section.weight).padStart(2)} pts${detail}`);
  }
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('No findings. Nothing needed a second look.');
    return `${lines.join('\n')}\n`;
  }

  const parts = (Object.keys(report.counts) as Severity[])
    .filter(severity => report.counts[severity] > 0)
    .sort((left, right) => SEVERITY_ORDER[right] - SEVERITY_ORDER[left])
    .map(severity => `${report.counts[severity]} ${severity}`);
  lines.push(`Findings (${report.findings.length}: ${parts.join(' · ')})`);

  for (const finding of report.findings) {
    const label = tone(options.color, COLORS[finding.severity], finding.severity.toUpperCase().padEnd(6));
    const count = finding.count > 1 ? ` ×${finding.count}` : '';
    lines.push(`  ${label} line ${String(finding.line).padEnd(3)} ${finding.title}${count} ${tone(options.color, DIM, `(${finding.ruleId})`)}`);
    lines.push(`         ${finding.message}`);
    if (finding.excerpt.length > 0) lines.push(`         ${tone(options.color, DIM, `“${truncate(finding.excerpt, 100)}”`)}`);
    lines.push(`         ${tone(options.color, CYAN, '→')} ${finding.suggestion}`);
  }

  lines.push('');
  lines.push('Context windows');
  lines.push(
    `  ${report.contextUsage
      .map(usage => `${usage.window / 1000}k ${usage.percent}%`)
      .join(' · ')}`
  );

  return `${lines.join('\n')}\n`;
}

export function renderDiff(report: DiffReport, options: TextReportOptions): string {
  const lines: string[] = [];
  lines.push(`NoxaPlus PromptLens ${report.after.version} · compare`);
  lines.push(
    `before  ${report.before.stats.words} words · ${report.before.stats.tokens} tokens · score ${report.before.score.total} (${report.before.score.grade})`
  );
  lines.push(
    `after   ${report.after.stats.words} words · ${report.after.stats.tokens} tokens · score ${report.after.score.total} (${report.after.score.grade})`
  );
  lines.push('');
  lines.push(report.verdict);
  if (report.sectionsGained.length > 0) lines.push(`Sections gained: ${report.sectionsGained.join(', ')}`);
  if (report.sectionsLost.length > 0) lines.push(`Sections lost: ${report.sectionsLost.join(', ')}`);
  if (report.resolved.length > 0) lines.push(`Resolved: ${report.resolved.join(', ')}`);
  if (report.introduced.length > 0) lines.push(`Introduced: ${report.introduced.join(', ')}`);
  lines.push('');

  for (const line of report.lines) {
    if (line.type === 'same') {
      lines.push(`${tone(options.color, DIM, ' ')} ${line.text}`);
    } else if (line.type === 'remove') {
      lines.push(`${tone(options.color, RED, '-')} ${line.text}`);
    } else {
      lines.push(`${tone(options.color, GREEN, '+')} ${line.text}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
