import { lintPrompt } from './lint.js';
import type { DiffLine, DiffReport, Finding } from './types.js';

const MAX_DIFF_LINES = 1200;

function byRule(findings: Finding[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const finding of findings) {
    map.set(finding.ruleId, (map.get(finding.ruleId) ?? 0) + finding.count);
  }
  return map;
}

function buildDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.replace(/\r\n?/g, '\n').split('\n');
  const afterLines = after.replace(/\r\n?/g, '\n').split('\n');

  if (beforeLines.length > MAX_DIFF_LINES || afterLines.length > MAX_DIFF_LINES) {
    const lines: DiffLine[] = [];
    const length = Math.max(beforeLines.length, afterLines.length);
    for (let index = 0; index < length; index += 1) {
      const oldLine = beforeLines[index];
      const newLine = afterLines[index];
      if (oldLine === newLine && oldLine !== undefined) {
        lines.push({ type: 'same', text: oldLine, beforeLine: index + 1, afterLine: index + 1 });
      } else {
        if (oldLine !== undefined) lines.push({ type: 'remove', text: oldLine, beforeLine: index + 1 });
        if (newLine !== undefined) lines.push({ type: 'add', text: newLine, afterLine: index + 1 });
      }
    }
    return lines;
  }

  const rows = beforeLines.length;
  const columns = afterLines.length;
  const stride = columns + 1;
  const table = new Uint32Array((rows + 1) * stride);

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const index = row * stride + column;
      if (beforeLines[row] === afterLines[column]) {
        table[index] = (table[(row + 1) * stride + column + 1] ?? 0) + 1;
      } else {
        const down = table[(row + 1) * stride + column] ?? 0;
        const right = table[row * stride + column + 1] ?? 0;
        table[index] = down >= right ? down : right;
      }
    }
  }

  const lines: DiffLine[] = [];
  let row = 0;
  let column = 0;
  while (row < rows && column < columns) {
    if (beforeLines[row] === afterLines[column]) {
      lines.push({
        type: 'same',
        text: beforeLines[row] ?? '',
        beforeLine: row + 1,
        afterLine: column + 1
      });
      row += 1;
      column += 1;
      continue;
    }
    const down = table[(row + 1) * stride + column] ?? 0;
    const right = table[row * stride + column + 1] ?? 0;
    if (down >= right) {
      lines.push({ type: 'remove', text: beforeLines[row] ?? '', beforeLine: row + 1 });
      row += 1;
    } else {
      lines.push({ type: 'add', text: afterLines[column] ?? '', afterLine: column + 1 });
      column += 1;
    }
  }
  while (row < rows) {
    lines.push({ type: 'remove', text: beforeLines[row] ?? '', beforeLine: row + 1 });
    row += 1;
  }
  while (column < columns) {
    lines.push({ type: 'add', text: afterLines[column] ?? '', afterLine: column + 1 });
    column += 1;
  }
  return lines;
}

function signed(value: number): string {
  if (value === 0) return '±0';
  return value > 0 ? `+${value}` : `${value}`;
}

export interface DiffOptions {
  version?: string;
}

export function diffPrompts(before: string, after: string, options: DiffOptions = {}): DiffReport {
  const beforeReport = lintPrompt(before, options);
  const afterReport = lintPrompt(after, options);
  const lines = buildDiff(before, after);

  const added = lines.filter(line => line.type === 'add').length;
  const removed = lines.filter(line => line.type === 'remove').length;
  const unchanged = lines.filter(line => line.type === 'same').length;

  const beforeRules = byRule(beforeReport.findings);
  const afterRules = byRule(afterReport.findings);
  const resolved = [...beforeRules.keys()].filter(rule => !afterRules.has(rule)).sort();
  const introduced = [...afterRules.keys()].filter(rule => !beforeRules.has(rule)).sort();

  const beforeSections = new Set(beforeReport.structure.filter(section => section.present).map(section => section.id));
  const afterSections = new Set(afterReport.structure.filter(section => section.present).map(section => section.id));
  const sectionsGained = [...afterSections].filter(section => !beforeSections.has(section)).sort();
  const sectionsLost = [...beforeSections].filter(section => !afterSections.has(section)).sort();

  const scoreDelta = afterReport.score.total - beforeReport.score.total;
  const tokenDelta = afterReport.stats.tokens - beforeReport.stats.tokens;

  const verdictParts: string[] = [];
  if (scoreDelta > 0) verdictParts.push(`score improved by ${scoreDelta} point${scoreDelta === 1 ? '' : 's'}`);
  else if (scoreDelta < 0) verdictParts.push(`score dropped by ${Math.abs(scoreDelta)} point${scoreDelta === -1 ? '' : 's'}`);
  else verdictParts.push('score is unchanged');
  verdictParts.push(`tokens ${signed(tokenDelta)}`);
  if (introduced.length > 0) verdictParts.push(`${introduced.length} new issue${introduced.length === 1 ? '' : 's'}`);
  if (resolved.length > 0) verdictParts.push(`${resolved.length} issue${resolved.length === 1 ? '' : 's'} resolved`);

  return {
    before: beforeReport,
    after: afterReport,
    delta: {
      tokens: tokenDelta,
      words: afterReport.stats.words - beforeReport.stats.words,
      characters: afterReport.stats.characters - beforeReport.stats.characters,
      lines: afterReport.stats.lines - beforeReport.stats.lines,
      score: scoreDelta,
      added,
      removed,
      unchanged
    },
    resolved,
    introduced,
    sectionsGained,
    sectionsLost,
    lines,
    verdict: verdictParts.join(' · ')
  };
}
