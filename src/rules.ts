import type { RuleInfo, SectionId, Severity } from './types.js';

export type RuleCategory = 'clarity' | 'specificity' | 'format' | 'structure';

export interface LintRule extends RuleInfo {
  category: RuleCategory;
  pattern: RegExp;
  message: string;
  suggestion: string;
}

export interface StructureRule extends RuleInfo {
  section: SectionId;
}

export const LINT_RULES: LintRule[] = [
  {
    id: 'vague-quantifier',
    title: 'Vague quantity',
    severity: 'medium',
    category: 'specificity',
    description: 'A quantity is described with a word that has no measurable boundary.',
    pattern: /\b(some|several|many|few|a few|various|numerous|most|often|sometimes|occasionally|roughly|approximately|around)\b/gi,
    message: 'The amount is not measurable, so two readers can produce two different results.',
    suggestion: 'Replace it with a number, a range, or a concrete example.'
  },
  {
    id: 'hedge',
    title: 'Hedged instruction',
    severity: 'medium',
    category: 'clarity',
    description: 'The model is asked to do something tentatively instead of directly.',
    pattern: /\b(maybe|perhaps|possibly|probably|might|could|try to|if possible|kind of|sort of|somewhat|ideally|preferably)\b/gi,
    message: 'A hedge gives the model permission to skip the instruction.',
    suggestion: 'State the instruction directly, then add a constraint if the action is optional.'
  },
  {
    id: 'vague-quality',
    title: 'Unmeasured quality',
    severity: 'medium',
    category: 'clarity',
    description: 'A quality word stands in for a criterion the model cannot verify.',
    pattern: /\b(good|better|best|nice|great|bad|poor|appropriate|reasonable|suitable|proper|adequate|fast|slow|soon|recently|large|small|short|long|cheap|expensive|easy|hard)\b/gi,
    message: 'Quality words are judged differently by different readers.',
    suggestion: 'Name the observable property: length, tone, format, latency, or an acceptance test.'
  },
  {
    id: 'subjective-style',
    title: 'Subjective style word',
    severity: 'low',
    category: 'specificity',
    description: 'A style preference is stated as a mood rather than a rule.',
    pattern: /\b(beautiful|clean|elegant|user-friendly|modern|professional|engaging|interesting|creative|polished|delightful|robust|seamless)\b/gi,
    message: 'This describes a feeling, not a property the output can be checked against.',
    suggestion: 'Describe the audience and one or two concrete style choices instead.'
  },
  {
    id: 'etcetera',
    title: 'Open-ended list',
    severity: 'low',
    category: 'clarity',
    description: 'A list is left open with a phrase such as "etc." or "and so on".',
    pattern: /\b(etc\.?|and so on|and more|and the like)\b/gi,
    message: 'The model has to guess where the list ends.',
    suggestion: 'Close the list or say how additional items should be chosen.'
  },
  {
    id: 'open-ended',
    title: 'Open-ended subject',
    severity: 'medium',
    category: 'specificity',
    description: 'A catch-all word leaves the subject of the instruction undefined.',
    pattern: /\b(anything|whatever|something|stuff|things|someone|somewhere|wherever|whenever)\b/gi,
    message: 'This word does not tell the model what to include or exclude.',
    suggestion: 'Replace it with the concrete subject or a short list of allowed items.'
  },
  {
    id: 'placeholder',
    title: 'Unfilled placeholder',
    severity: 'high',
    category: 'specificity',
    description: 'A template placeholder is still in the prompt.',
    pattern:
      /\{\{[^}\n]+\}\}|\[(?:insert|add|your|name|topic|company)[^\]\n]*\]|<(?:insert|your|topic|name|company)[^>\n]*>|\b(?:TODO|TBD|FIXME)\b/gi,
    message: 'The model will see the placeholder literally or invent a value for it.',
    suggestion: 'Fill the value in, or move it into an explicit input section.'
  },
  {
    id: 'weak-instruction',
    title: 'Optional-sounding instruction',
    severity: 'medium',
    category: 'clarity',
    description: 'The instruction sounds like a suggestion the model can decline.',
    pattern: /\b(if you can|if you could|feel free to|it would be (?:nice|great|good)|you may want to|as much as possible|try your best)\b/gi,
    message: 'This weakens the requirement and makes the result inconsistent.',
    suggestion: 'Use a direct verb and a clear requirement.'
  },
  {
    id: 'first-person-wish',
    title: 'Wish instead of instruction',
    severity: 'low',
    category: 'clarity',
    description: 'The request is phrased as a personal wish rather than a task.',
    pattern: /\b(i want you to|i need you to|i would like you to|i'd like you to|i am hoping you)\b/gi,
    message: 'The intent is clear, but the instruction is longer than it needs to be.',
    suggestion: 'Start with the verb: "Summarize…", "Return…", "Compare…".'
  },
  {
    id: 'vague-pronoun',
    title: 'Unclear pronoun reference',
    severity: 'low',
    category: 'clarity',
    description: 'A sentence begins with a pronoun whose subject is not named locally.',
    pattern: /(^|[.!?]\s+|\n)\s*(?:[-*]\s*)?(it|this|that|they|these|those)\b/gi,
    message: 'The model has to infer what this refers to.',
    suggestion: 'Replace the pronoun with the noun it refers to.'
  },
  {
    id: 'vague-time',
    title: 'Vague time reference',
    severity: 'low',
    category: 'clarity',
    description: 'A time is described relative to an undefined moment.',
    pattern: /\b(as soon as possible|asap|soon|later|recently|currently|nowadays|these days|in the near future)\b/gi,
    message: 'The deadline or window depends on when the prompt is read.',
    suggestion: 'Use a date, a duration, or a concrete trigger.'
  },
  {
    id: 'unspecified-comparison',
    title: 'Comparison without a baseline',
    severity: 'low',
    category: 'clarity',
    description: 'The output is compared to something the prompt never defines.',
    pattern: /\b(better than|similar to|like before|the usual|same as last time|as we discussed)\b/gi,
    message: 'The baseline is not in the prompt, so the comparison cannot be applied.',
    suggestion: 'Paste the baseline or name the exact reference.'
  },
  {
    id: 'repeated-word',
    title: 'Repeated word',
    severity: 'low',
    category: 'clarity',
    description: 'The same word appears twice in a row.',
    pattern: /\b(\p{L}+)\s+\1\b/giu,
    message: 'A duplicated word usually means the prompt was edited in a hurry.',
    suggestion: 'Remove the duplicate.'
  },
  {
    id: 'absolute-language',
    title: 'Absolute language',
    severity: 'info',
    category: 'clarity',
    description: 'An absolute word leaves no room for a legitimate exception.',
    pattern: /\b(always|never|guaranteed|100%|perfect|every single|without exception)\b/gi,
    message: 'Absolute rules are easy to state and hard to satisfy.',
    suggestion: 'Keep the rule if it is intentional; otherwise add the exception explicitly.'
  },
  {
    id: 'assumed-knowledge',
    title: 'Assumed shared context',
    severity: 'low',
    category: 'clarity',
    description: 'The prompt refers to knowledge the model may not share.',
    pattern: /\b(obviously|clearly|as everyone knows|of course|it goes without saying|needless to say)\b/gi,
    message: 'This assumes the reader already agrees, which hides the actual requirement.',
    suggestion: 'State the fact or requirement instead of asserting that it is obvious.'
  }
];

export const STRUCTURE_RULES: StructureRule[] = [
  {
    id: 'missing-objective',
    title: 'No clear objective',
    severity: 'high',
    section: 'objective',
    description: 'The prompt does not state what the model should produce.'
  },
  {
    id: 'missing-output',
    title: 'No output format',
    severity: 'high',
    section: 'output',
    description: 'The prompt does not describe the shape of the expected response.'
  },
  {
    id: 'missing-constraints',
    title: 'No constraints',
    severity: 'medium',
    section: 'constraints',
    description: 'The prompt does not say what the response must avoid or stay within.'
  },
  {
    id: 'missing-role',
    title: 'No role or persona',
    severity: 'medium',
    section: 'role',
    description: 'The prompt does not set the perspective the model should answer from.'
  },
  {
    id: 'missing-context',
    title: 'No context section',
    severity: 'low',
    section: 'context',
    description: 'The prompt does not label the background or input material.'
  },
  {
    id: 'missing-examples',
    title: 'No examples',
    severity: 'low',
    section: 'examples',
    description: 'The prompt does not show a sample of a good response.'
  },
  {
    id: 'missing-tone',
    title: 'No tone or audience',
    severity: 'info',
    section: 'tone',
    description: 'The prompt does not name the audience or the voice to use.'
  }
];

export const ALL_RULES: RuleInfo[] = [...LINT_RULES, ...STRUCTURE_RULES].map(rule => ({
  id: rule.id,
  title: rule.title,
  severity: rule.severity,
  description: rule.description
}));

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  info: 'INFO'
};
