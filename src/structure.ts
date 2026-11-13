import type { SectionId, SectionState } from './types.js';

interface SectionDefinition {
  id: SectionId;
  label: string;
  weight: number;
  heading: RegExp;
  content: RegExp;
}

const DEFINITIONS: SectionDefinition[] = [
  {
    id: 'role',
    label: 'Role',
    weight: 6,
    heading: /^(role|persona|identity|who you are|your role)\b/,
    content: /\b(you are (?:an?|the)\b|act as\b|assume the role\b|you're an?\b)/i
  },
  {
    id: 'objective',
    label: 'Objective',
    weight: 12,
    heading: /^(task|objective|goal|mission|job|instruction|instructions|what to do|deliverable)\b/,
    content:
      /(^|[.\n])\s*(?:[-*]\s*)?(analyze|answer|build|classify|compare|convert|create|critique|design|draft|evaluate|explain|extract|fix|generate|list|plan|produce|review|rewrite|score|summarize|translate|write)\b/i
  },
  {
    id: 'context',
    label: 'Context',
    weight: 8,
    heading: /^(context|background|input|data|situation|given|source material)\b/,
    content: /\b(here is|here are|given the following|using the (?:text|data|document)|context:|background:)\b/i
  },
  {
    id: 'constraints',
    label: 'Constraints',
    weight: 9,
    heading: /^(constraints?|rules?|requirements?|guardrails?|boundaries|limitations?|don'?ts)\b/,
    content: /\b(must not|must|never|do not|don't|only|avoid|at most|at least|no more than|no fewer than|within \d+)\b/i
  },
  {
    id: 'output',
    label: 'Output format',
    weight: 9,
    heading: /^(output|format|response|return|schema|structure|deliverable shape)\b/,
    content: /\b(respond with|return (?:a|an|the|only)\b|output (?:format|should|must)|in json|as markdown|use (?:this|the following) (?:format|schema)|format:)/i
  },
  {
    id: 'examples',
    label: 'Examples',
    weight: 3,
    heading: /^(examples?|samples?|few[- ]shot|demonstrations?)\b/,
    content: /\b(for example|e\.g\.|example:|input:|output:)\b/i
  },
  {
    id: 'tone',
    label: 'Tone and audience',
    weight: 3,
    heading: /^(tone|style|voice|audience|register|personality)\b/,
    content: /\b(tone|voice|audience|formal|casual|friendly|professional|conversational|technical level)\b/i
  }
];

function cleanHeading(raw: string): string {
  return raw
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[*_`[\s]+|[*_`\]:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function truncate(text: string, length = 90): string {
  const compact = text.trim().replace(/\s+/g, ' ');
  return compact.length <= length ? compact : `${compact.slice(0, length - 1)}…`;
}

export function detectStructure(text: string): SectionState[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const normalized = text.replace(/\r\n?/g, '\n');

  return DEFINITIONS.map(definition => {
    let evidence: string | undefined;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      const heading = cleanHeading(trimmed);
      const looksLikeHeading =
        /^#{1,6}\s+/.test(trimmed) ||
        /^\*\*[^*]+\*\*:?$/.test(trimmed) ||
        /^[A-Za-z][A-Za-z /'-]{1,30}:\s+\S/.test(trimmed) ||
        /^[A-Za-z][A-Za-z /'-]{1,30}:$/.test(trimmed);
      if (looksLikeHeading && definition.heading.test(heading)) {
        evidence = truncate(trimmed);
        break;
      }
    }
    if (evidence === undefined && definition.content.test(normalized)) {
      const match = definition.content.exec(normalized);
      if (match) {
        const index = match.index;
        const lineStart = normalized.lastIndexOf('\n', index) + 1;
        const lineEnd = normalized.indexOf('\n', index);
        evidence = truncate(normalized.slice(lineStart, lineEnd === -1 ? undefined : lineEnd));
      }
    }
    const base = {
      id: definition.id,
      label: definition.label,
      present: evidence !== undefined,
      weight: definition.weight
    };
    return evidence === undefined ? base : { ...base, evidence };
  });
}

export const SECTION_WEIGHTS: Record<SectionId, number> = Object.fromEntries(
  DEFINITIONS.map(definition => [definition.id, definition.weight])
) as Record<SectionId, number>;
