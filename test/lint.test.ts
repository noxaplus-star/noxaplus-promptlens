import { describe, expect, it } from 'vitest';
import { lintPrompt } from '../src/lint.js';

const GOOD_PROMPT = `# Role
You are a support agent for an outdoor shop.

# Objective
Write one reply that answers the customer question about order #A-1042.

# Context
Customer: Maya. Order: #A-1042. Item: two-person tent.

# Constraints
Keep under 120 words. Offer exactly one remedy. Do not promise a delivery date.

# Output format
Return plain text with a subject line and two paragraphs.

# Examples
Input: Where is order #A-0991?
Output: Subject: Order #A-0991. We are checking the depot now.

# Tone
Direct and warm.`;

function ids(text: string): string[] {
  return lintPrompt(text, { version: '1.0.0' }).findings.map(finding => finding.ruleId);
}

describe('lintPrompt', () => {
  it('gives a complete prompt a perfect deterministic score', () => {
    const first = lintPrompt(GOOD_PROMPT, { version: '1.0.0' });
    const second = lintPrompt(GOOD_PROMPT, { version: '1.0.0' });
    expect(first.findings).toHaveLength(0);
    expect(first.score).toEqual({ structure: 50, clarity: 25, specificity: 15, brevity: 10, total: 100, grade: 'A' });
    expect(second).toEqual(first);
    expect(first.version).toBe('1.0.0');
  });

  it('scores an empty prompt at zero and reports every missing section', () => {
    const report = lintPrompt('', { version: '1.0.0' });
    expect(report.score.total).toBe(0);
    expect(report.stats.words).toBe(0);
    expect(report.missingSections).toHaveLength(7);
    expect(report.findings).toHaveLength(7);
  });

  it('flags a high placeholder', () => {
    const report = lintPrompt('Use {{API_KEY}} to call the endpoint.', { version: '1.0.0' });
    const placeholder = report.findings.find(finding => finding.ruleId === 'placeholder');
    expect(placeholder?.severity).toBe('high');
    expect(placeholder?.line).toBe(1);
  });

  it('counts repeated vague words in one finding', () => {
    const report = lintPrompt('Make it good and short.', { version: '1.0.0' });
    const vague = report.findings.find(finding => finding.ruleId === 'vague-quality');
    expect(vague?.count).toBe(2);
  });

  it('flags a long sentence', () => {
    const words = Array.from({ length: 40 }, (_, index) => `token${index}`).join(' ');
    const report = lintPrompt(`${words}.`, { version: '1.0.0' });
    expect(report.findings.map(finding => finding.ruleId)).toContain('long-sentence');
  });

  it('flags shouting', () => {
    expect(ids('DO NOT SHIP THIS BUILD TODAY')).toContain('shouting');
  });

  it('flags an unclosed code fence', () => {
    const report = lintPrompt('```\nconst value = 1;', { version: '1.0.0' });
    const fence = report.findings.find(finding => finding.ruleId === 'unclosed-code-fence');
    expect(fence?.severity).toBe('high');
  });

  it('flags a duplicated line', () => {
    const line = 'This line is long enough to be counted as duplicate content.';
    expect(ids(`${line}\n${line}`)).toContain('duplicate-instruction');
  });

  it('flags undelimited pasted input', () => {
    expect(ids('Summarize the following text: hello world.')).toContain('undelimited-input');
  });

  it('reports absolute language as informational', () => {
    const report = lintPrompt('Always return JSON.', { version: '1.0.0' });
    const absolute = report.findings.find(finding => finding.ruleId === 'absolute-language');
    expect(absolute?.severity).toBe('info');
  });

  it('reports a repeated word', () => {
    expect(ids('This is is a test.')).toContain('repeated-word');
  });

  it('returns counts that match the findings', () => {
    const report = lintPrompt('Write a good summary. Use {{TOPIC}}.', { version: '1.0.0' });
    const total = Object.values(report.counts).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(report.findings.length);
  });

  it('reports context usage for four windows', () => {
    const report = lintPrompt(GOOD_PROMPT, { version: '1.0.0' });
    expect(report.contextUsage.map(usage => usage.window)).toEqual([8000, 32000, 128000, 200000]);
    const percentages = report.contextUsage.map(usage => usage.percent);
    expect(percentages[0]).toBeGreaterThanOrEqual(percentages[1] ?? 0);
    expect(percentages[1]).toBeGreaterThanOrEqual(percentages[2] ?? 0);
  });

  it('keeps the total between 0 and 100 for unusual input', () => {
    const report = lintPrompt(' '.repeat(50), { version: '1.0.0' });
    expect(report.score.total).toBeGreaterThanOrEqual(0);
    expect(report.score.total).toBeLessThanOrEqual(100);
  });
});
