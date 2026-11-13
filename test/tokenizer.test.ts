import { describe, expect, it } from 'vitest';
import { analyzeStats, countWords, estimateTokens } from '../src/tokenizer.js';

describe('estimateTokens', () => {
  it('returns zero for empty or whitespace-only text', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('   \n\t ')).toBe(0);
  });

  it('counts simple words deterministically', () => {
    expect(estimateTokens('hello world')).toBe(2);
    expect(estimateTokens('hello world')).toBe(estimateTokens('hello world'));
  });

  it('grows with punctuation and longer words', () => {
    expect(estimateTokens('hello, world!')).toBeGreaterThan(estimateTokens('hello world'));
    expect(estimateTokens('internationalization')).toBeGreaterThan(estimateTokens('cat'));
  });

  it('charges one token per CJK character', () => {
    expect(estimateTokens('你好世界')).toBe(4);
  });

  it('does not decrease when text is appended', () => {
    const base = 'Write a short summary.';
    expect(estimateTokens(`${base} Add one example.`)).toBeGreaterThanOrEqual(estimateTokens(base));
  });
});

describe('countWords', () => {
  it('treats contractions and hyphenated words as single words', () => {
    expect(countWords("Don't stop-believing in 42 ideas.")).toBe(5);
  });
});

describe('analyzeStats', () => {
  it('reports words, sentences, paragraphs, and lines', () => {
    const stats = analyzeStats('First sentence. Second sentence.\n\nNew paragraph.');
    expect(stats.words).toBe(6);
    expect(stats.sentences).toBe(3);
    expect(stats.paragraphs).toBe(2);
    expect(stats.lines).toBe(3);
    expect(stats.averageWordsPerSentence).toBe(2);
  });

  it('counts unique words case-insensitively', () => {
    expect(analyzeStats('Echo echo ECHO').uniqueWords).toBe(1);
  });

  it('flags long lines', () => {
    expect(analyzeStats('x'.repeat(161)).longLines).toBe(1);
    expect(analyzeStats('x'.repeat(160)).longLines).toBe(0);
  });

  it('reports a positive characters-per-token ratio', () => {
    const stats = analyzeStats('A sentence with a few words in it.');
    expect(stats.charactersPerToken).toBeGreaterThan(0);
    expect(stats.tokens).toBeGreaterThan(0);
  });

  it('returns zeros for empty text', () => {
    const stats = analyzeStats('');
    expect(stats.words).toBe(0);
    expect(stats.tokens).toBe(0);
    expect(stats.sentences).toBe(0);
    expect(stats.lines).toBe(0);
  });
});
