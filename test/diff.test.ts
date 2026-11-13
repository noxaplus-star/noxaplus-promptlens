import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { diffPrompts } from '../src/diff.js';

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

async function samples(): Promise<{ v1: string; v2: string }> {
  const [v1, v2] = await Promise.all([
    readFile(new URL('../examples/support-reply.v1.md', import.meta.url), 'utf8'),
    readFile(new URL('../examples/support-reply.v2.md', import.meta.url), 'utf8')
  ]);
  return { v1, v2 };
}

describe('diffPrompts', () => {
  it('reports no change for identical prompts', () => {
    const diff = diffPrompts(GOOD_PROMPT, GOOD_PROMPT, { version: '1.0.0' });
    expect(diff.delta.score).toBe(0);
    expect(diff.delta.tokens).toBe(0);
    expect(diff.resolved).toEqual([]);
    expect(diff.introduced).toEqual([]);
    expect(diff.verdict).toContain('unchanged');
    expect(diff.lines.every(line => line.type === 'same')).toBe(true);
  });

  it('detects an improved version', async () => {
    const { v1, v2 } = await samples();
    const diff = diffPrompts(v1, v2, { version: '1.0.0' });
    expect(diff.delta.score).toBeGreaterThan(0);
    expect(diff.delta.tokens).toBeGreaterThan(0);
    expect(diff.delta.added).toBeGreaterThan(0);
    expect(diff.resolved).toContain('missing-output');
    expect(diff.sectionsGained).toContain('output');
    expect(diff.verdict).toContain('score improved');
  });

  it('detects sections and findings lost when moving backwards', async () => {
    const { v1, v2 } = await samples();
    const diff = diffPrompts(v2, v1, { version: '1.0.0' });
    expect(diff.delta.score).toBeLessThan(0);
    expect(diff.sectionsLost).toContain('output');
    expect(diff.introduced).toContain('missing-output');
  });

  it('introduces a new finding', () => {
    const diff = diffPrompts(GOOD_PROMPT, `${GOOD_PROMPT}\n\nUse {{API_KEY}}.`, { version: '1.0.0' });
    expect(diff.introduced).toContain('placeholder');
    expect(diff.delta.score).toBeLessThan(0);
  });

  it('marks individual lines as added, removed, or same', () => {
    const diff = diffPrompts('alpha beta\nshared line\nold tail', 'alpha beta\nshared line\nnew tail', {
      version: '1.0.0'
    });
    expect(diff.delta.added).toBe(1);
    expect(diff.delta.removed).toBe(1);
    expect(diff.delta.unchanged).toBe(2);
    expect(diff.lines.filter(line => line.type === 'add').map(line => line.text)).toEqual(['new tail']);
    expect(diff.lines.filter(line => line.type === 'remove').map(line => line.text)).toEqual(['old tail']);
  });

  it('keeps line numbers for both sides', () => {
    const diff = diffPrompts('one\ntwo', 'one\nthree', { version: '1.0.0' });
    const same = diff.lines.find(line => line.type === 'same');
    expect(same?.beforeLine).toBe(1);
    expect(same?.afterLine).toBe(1);
    const removed = diff.lines.find(line => line.type === 'remove');
    expect(removed?.beforeLine).toBe(2);
    const added = diff.lines.find(line => line.type === 'add');
    expect(added?.afterLine).toBe(2);
  });

  it('falls back cleanly for very large prompts', () => {
    const before = Array.from({ length: 1300 }, (_, index) => `line ${index}`).join('\n');
    const after = before.replace('line 1299', 'line changed');
    const diff = diffPrompts(before, after, { version: '1.0.0' });
    expect(diff.lines.length).toBe(1301);
    expect(diff.delta.added).toBe(1);
    expect(diff.delta.removed).toBe(1);
  });
});
