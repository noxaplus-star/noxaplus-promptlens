import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { detectStructure, SECTION_WEIGHTS } from '../src/structure.js';

function present(text: string): string[] {
  return detectStructure(text)
    .filter(section => section.present)
    .map(section => section.id)
    .sort();
}

describe('detectStructure', () => {
  it('finds every section in the structured sample', async () => {
    const prompt = await readFile(new URL('../examples/support-reply.v2.md', import.meta.url), 'utf8');
    const sections = detectStructure(prompt);
    expect(sections.every(section => section.present)).toBe(true);
    expect(sections).toHaveLength(7);
  });

  it('detects markdown headings', () => {
    expect(present('# Role\nYou are a tester.\n\n# Objective\nWrite one test.')).toEqual(['objective', 'role']);
  });

  it('detects inline role and objective language', () => {
    expect(present('You are a careful editor. Write a summary.')).toEqual(['objective', 'role']);
  });

  it('detects bold and colon headings', () => {
    expect(present('**Role:** You are a reviewer.\n\nTASK: Review the patch.')).toEqual(['objective', 'role']);
  });

  it('detects context, output, examples, and tone from content', () => {
    const prompt = [
      'Here is the document: a short paragraph.',
      'Respond with a JSON object.',
      'For example: {"ok": true}',
      'Use a formal tone.'
    ].join('\n');
    expect(present(prompt)).toEqual(['context', 'examples', 'output', 'tone']);
  });

  it('detects constraints from requirement language', () => {
    expect(present('The answer must stay under 100 words.')).toEqual(['constraints']);
  });

  it('keeps evidence for a detected heading', () => {
    const sections = detectStructure('# Context\nA short background.');
    const context = sections.find(section => section.id === 'context');
    expect(context?.evidence).toBe('# Context');
  });

  it('reports an empty prompt as entirely missing', () => {
    expect(present('')).toEqual([]);
  });

  it('assigns weights that add up to 50', () => {
    const total = Object.values(SECTION_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBe(50);
  });
});
