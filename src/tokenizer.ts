import type { PromptStats } from './types.js';

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu;
const PUNCT_PATTERN = /[^\s\p{L}\p{N}]+/gu;
const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u;

function wordCost(word: string): number {
  if (CJK_PATTERN.test(word)) {
    let cost = 0;
    let latin = 0;
    for (const character of word) {
      if (CJK_PATTERN.test(character)) {
        cost += 1;
      } else {
        latin += 1;
      }
    }
    if (latin > 0) cost += Math.ceil(latin / 4);
    return Math.max(1, cost);
  }
  const length = [...word].length;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 14) return 3;
  return Math.ceil(length / 4);
}

/**
 * Approximate token count for planning, not a provider-exact tokenizer.
 * Latin words cost 1 token up to five characters, then grow in steps;
 * CJK characters cost one token each. Punctuation and layout add a little.
 */
export function estimateTokens(text: string): number {
  if (text.trim().length === 0) return 0;
  const normalized = text.replace(/\r\n?/g, '\n');
  let tokens = 0;
  for (const match of normalized.matchAll(WORD_PATTERN)) {
    tokens += wordCost(match[0]);
  }
  for (const match of normalized.matchAll(PUNCT_PATTERN)) {
    tokens += Math.max(1, Math.ceil([...match[0]].length / 2));
  }
  const newlines = (normalized.match(/\n/g) ?? []).length;
  tokens += Math.ceil(newlines / 4);
  return Math.max(1, tokens);
}

export function countWords(text: string): number {
  return [...text.matchAll(WORD_PATTERN)].length;
}

export function analyzeStats(text: string): PromptStats {
  const normalized = text.replace(/\r\n?/g, '\n');
  const wordMatches = [...normalized.matchAll(WORD_PATTERN)].map(match => match[0]);
  const words = wordMatches.length;
  const uniqueWords = new Set(wordMatches.map(word => word.toLowerCase())).size;
  const lines = normalized.length === 0 ? 0 : normalized.split('\n').length;
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .filter(block => block.trim().length > 0).length;
  const sentences =
    words === 0 ? 0 : Math.max(1, normalized.split(/[.!?]+(?:["')\]]*)/).filter(part => part.trim().length > 0).length);
  const tokens = estimateTokens(normalized);
  const characters = normalized.length;

  return {
    characters,
    words,
    lines,
    paragraphs,
    sentences,
    averageWordsPerSentence: sentences === 0 ? 0 : Math.round((words / sentences) * 10) / 10,
    tokens,
    charactersPerToken: tokens === 0 ? 0 : Math.round((characters / tokens) * 10) / 10,
    uniqueWords,
    longLines: normalized.split('\n').filter(line => line.length > 160).length
  };
}
