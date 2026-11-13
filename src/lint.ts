import { detectStructure } from './structure.js';
import { countWords, analyzeStats } from './tokenizer.js';
import { LINT_RULES, STRUCTURE_RULES } from './rules.js';
import type { RuleCategory } from './rules.js';
import type { Finding, LintReport, ScoreBreakdown, SectionState, Severity } from './types.js';
import { SEVERITY_ORDER } from './types.js';

export interface LintOptions {
  version?: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let cursor = 0; cursor < index && cursor < text.length; cursor += 1) {
    if (text[cursor] === '\n') line += 1;
  }
  return line;
}

function excerptAt(text: string, index: number, length = 120): string {
  const start = text.lastIndexOf('\n', index) + 1;
  const end = text.indexOf('\n', index);
  const line = text
    .slice(start, end === -1 ? text.length : end)
    .trim()
    .replace(/\s+/g, ' ');
  return line.length <= length ? line : `${line.slice(0, length - 1)}…`;
}

function severityPenalty(severity: Severity, category: RuleCategory): number {
  if (category === 'structure') return 0;
  if (category === 'clarity') {
    if (severity === 'high') return 6;
    if (severity === 'medium') return 4;
    if (severity === 'low') return 1;
    return 0;
  }
  if (severity === 'high') return 5;
  if (severity === 'medium') return 3;
  if (severity === 'low') return 1;
  return 0;
}

function gradeFor(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function patternFindings(text: string): Array<Finding & { category: RuleCategory }> {
  const findings: Array<Finding & { category: RuleCategory }> = [];
  for (const rule of LINT_RULES) {
    rule.pattern.lastIndex = 0;
    let count = 0;
    let firstIndex = -1;
    for (const match of text.matchAll(rule.pattern)) {
      count += 1;
      if (firstIndex === -1) firstIndex = match.index ?? 0;
    }
    if (count === 0) continue;
    findings.push({
      ruleId: rule.id,
      title: rule.title,
      severity: rule.severity,
      message: rule.message,
      suggestion: rule.suggestion,
      line: lineAt(text, firstIndex),
      excerpt: excerptAt(text, firstIndex),
      count,
      category: rule.category
    });
  }
  return findings;
}

function repeatedLines(text: string): Array<Finding & { category: RuleCategory }> {
  const seen = new Map<string, number>();
  let firstIndex = -1;
  let duplicates = 0;
  let cursor = 0;
  for (const line of text.split('\n')) {
    const key = line.trim().toLowerCase();
    if (key.length >= 24 && !key.startsWith('#') && !key.startsWith('```')) {
      if (seen.has(key)) {
        duplicates += 1;
        if (firstIndex === -1) firstIndex = cursor;
      } else {
        seen.set(key, cursor);
      }
    }
    cursor += line.length + 1;
  }
  if (duplicates === 0 || firstIndex === -1) return [];
  return [
    {
      ruleId: 'duplicate-instruction',
      title: 'Repeated line',
      severity: 'medium',
      message: `${duplicates} ${duplicates === 1 ? 'line repeats' : 'lines repeat'} another line verbatim, which adds length without adding information.`,
      suggestion: 'Keep one copy and delete the rest, or merge the two statements.',
      line: lineAt(text, firstIndex),
      excerpt: excerptAt(text, firstIndex),
      count: duplicates,
      category: 'clarity'
    }
  ];
}

function longSentences(text: string): Array<Finding & { category: RuleCategory }> {
  const sentences: Array<{ text: string; index: number; words: number }> = [];
  for (const match of text.matchAll(/[^.!?\n]+[.!?]*/g)) {
    const candidate = match[0];
    if (candidate.trim().length === 0) continue;
    const words = countWords(candidate);
    if (words >= 35) {
      sentences.push({ text: candidate, index: match.index ?? 0, words });
    }
  }
  if (sentences.length === 0) return [];
  const longest = [...sentences].sort((left, right) => right.words - left.words)[0];
  if (!longest) return [];
  return [
    {
      ruleId: 'long-sentence',
      title: 'Very long sentence',
      severity: 'medium',
      message: `${sentences.length} ${sentences.length === 1 ? 'sentence runs' : 'sentences run'} past 35 words; the longest is ${longest.words} words.`,
      suggestion: 'Split it into one instruction per sentence so each requirement can be checked separately.',
      line: lineAt(text, longest.index),
      excerpt: excerptAt(text, longest.index),
      count: sentences.length,
      category: 'clarity'
    }
  ];
}

function shouting(text: string): Array<Finding & { category: RuleCategory }> {
  let cursor = 0;
  let inFence = false;
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      cursor += line.length + 1;
      continue;
    }
    if (!inFence) {
      const uppercase = line.match(/\b[A-Z]{3,}\b/g) ?? [];
      if (uppercase.length >= 4) {
        return [
          {
            ruleId: 'shouting',
            title: 'Shouted line',
            severity: 'low',
            message: 'Four or more all-caps words in one line read as shouting and reduce legibility.',
            suggestion: 'Use normal case and let the wording carry the emphasis.',
            line: lineAt(text, cursor),
            excerpt: excerptAt(text, cursor),
            count: 1,
            category: 'clarity'
          }
        ];
      }
    }
    cursor += line.length + 1;
  }
  return [];
}

function unclosedFence(text: string): Array<Finding & { category: RuleCategory }> {
  let count = 0;
  let firstIndex = -1;
  let cursor = 0;
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('```')) {
      count += 1;
      if (firstIndex === -1) firstIndex = cursor;
    }
    cursor += line.length + 1;
  }
  if (count === 0 || count % 2 === 0) return [];
  return [
    {
      ruleId: 'unclosed-code-fence',
      title: 'Unclosed code fence',
      severity: 'high',
      message: 'A code fence is opened and never closed, so the rest of the prompt may be treated as code.',
      suggestion: 'Add the closing triple backticks, or remove the opening fence.',
      line: lineAt(text, firstIndex),
      excerpt: excerptAt(text, firstIndex),
      count: 1,
      category: 'format'
    }
  ];
}

function followingWithoutDelimiter(text: string): Array<Finding & { category: RuleCategory }> {
  const match = /\b(the following|below)\b/i.exec(text);
  if (!match) return [];
  if (text.includes('```') || /<[a-z][a-z0-9_-]*>[\s\S]*<\/[a-z][a-z0-9_-]*>/i.test(text)) return [];
  return [
    {
      ruleId: 'undelimited-input',
      title: 'Input is not delimited',
      severity: 'low',
      message: 'The prompt refers to material "below" without a fence or tag, which makes the boundary between instruction and input ambiguous.',
      suggestion: 'Wrap pasted material in triple backticks or XML-style tags and refer to it by that name.',
      line: lineAt(text, match.index),
      excerpt: excerptAt(text, match.index),
      count: 1,
      category: 'format'
    }
  ];
}

function oversizedPrompt(text: string, tokens: number): Array<Finding & { category: RuleCategory }> {
  if (tokens <= 6000) return [];
  return [
    {
      ruleId: 'oversized-prompt',
      title: 'Large prompt',
      severity: 'info',
      message: `The prompt estimates ${tokens.toLocaleString('en-US')} tokens. Long prompts are harder to review and leave less room for input.`,
      suggestion: 'Move reference material into a separately labeled context block, or split the task.',
      line: 1,
      excerpt: excerptAt(text, 0),
      count: 1,
      category: 'format'
    }
  ];
}

function missingSectionFindings(sections: SectionState[]): Array<Finding & { category: RuleCategory }> {
  const findings: Array<Finding & { category: RuleCategory }> = [];
  for (const rule of STRUCTURE_RULES) {
    const section = sections.find(candidate => candidate.id === rule.section);
    if (!section || section.present) continue;
    const article = /^[aeiou]/i.test(section.label) ? 'an' : 'a';
    findings.push({
      ruleId: rule.id,
      title: rule.title,
      severity: rule.severity,
      message: rule.description,
      suggestion: `Add ${article} "${section.label}" section with one or two concrete lines.`,
      line: 1,
      excerpt: '',
      count: 1,
      category: 'structure'
    });
  }
  return findings;
}

function computeScore(
  sections: SectionState[],
  findings: Array<Finding & { category: RuleCategory }>,
  words: number,
  tokens: number,
  longLines: number
): ScoreBreakdown {
  if (words === 0) {
    return { structure: 0, clarity: 0, specificity: 0, brevity: 0, total: 0, grade: 'F' };
  }

  const structure = sections.reduce((sum, section) => (section.present ? sum + section.weight : sum), 0);

  let clarity = 25;
  let specificity = 15;
  for (const finding of findings) {
    const penalty = severityPenalty(finding.severity, finding.category);
    if (finding.category === 'clarity') clarity -= penalty;
    if (finding.category === 'specificity' || finding.category === 'format') specificity -= penalty;  }

  let brevity = 10;
  if (words < 12) brevity = 3;
  else if (words < 25) brevity = 6;
  else if (tokens > 9000) brevity = 2;
  else if (words > 3000) brevity = 4;
  else if (words > 1500) brevity = 7;
  brevity -= Math.min(2, longLines);

  clarity = clamp(Math.round(clarity), 0, 25);
  specificity = clamp(Math.round(specificity), 0, 15);
  brevity = clamp(Math.round(brevity), 0, 10);
  const total = clamp(structure + clarity + specificity + brevity, 0, 100);

  return { structure, clarity, specificity, brevity, total, grade: gradeFor(total) };
}

export function lintPrompt(text: string, options: LintOptions = {}): LintReport {
  const stats = analyzeStats(text);
  const sections = detectStructure(text);

  const candidates = [
    ...patternFindings(text),
    ...repeatedLines(text),
    ...longSentences(text),
    ...shouting(text),
    ...unclosedFence(text),
    ...followingWithoutDelimiter(text),
    ...oversizedPrompt(text, stats.tokens),
    ...missingSectionFindings(sections)
  ];

  candidates.sort((left, right) => {
    const severity = SEVERITY_ORDER[right.severity] - SEVERITY_ORDER[left.severity];
    if (severity !== 0) return severity;
    if (left.line !== right.line) return left.line - right.line;
    return left.ruleId.localeCompare(right.ruleId);
  });

  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0, info: 0 };
  for (const finding of candidates) counts[finding.severity] += 1;

  const findings: Finding[] = candidates.map(({ category: _category, ...finding }) => finding);
  const score = computeScore(sections, candidates, stats.words, stats.tokens, stats.longLines);
  const windows = [8000, 32000, 128000, 200000];

  return {
    tool: 'promptlens',
    name: 'NoxaPlus PromptLens',
    version: options.version ?? '0.0.0',
    stats,
    structure: sections,
    missingSections: sections.filter(section => !section.present).map(section => section.id),
    findings,
    counts,
    score,
    contextUsage: windows.map(window => ({
      window,
      percent: Math.round((stats.tokens / window) * 1000) / 10
    }))
  };
}
