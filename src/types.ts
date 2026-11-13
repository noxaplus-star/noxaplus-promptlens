export type Severity = 'info' | 'low' | 'medium' | 'high';

export const SEVERITY_ORDER: Record<Severity, number> = {
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  high: 5,
  medium: 3,
  low: 1,
  info: 0
};

export type SectionId = 'role' | 'objective' | 'context' | 'constraints' | 'output' | 'examples' | 'tone';

export interface SectionState {
  id: SectionId;
  label: string;
  present: boolean;
  weight: number;
  evidence?: string;
}

export interface PromptStats {
  characters: number;
  words: number;
  lines: number;
  paragraphs: number;
  sentences: number;
  averageWordsPerSentence: number;
  tokens: number;
  charactersPerToken: number;
  uniqueWords: number;
  longLines: number;
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  message: string;
  suggestion: string;
  line: number;
  excerpt: string;
  count: number;
}

export interface ScoreBreakdown {
  structure: number;
  clarity: number;
  specificity: number;
  brevity: number;
  total: number;
  grade: string;
}

export interface LintReport {
  tool: 'promptlens';
  name: 'NoxaPlus PromptLens';
  version: string;
  stats: PromptStats;
  structure: SectionState[];
  missingSections: SectionId[];
  findings: Finding[];
  counts: Record<Severity, number>;
  score: ScoreBreakdown;
  contextUsage: Array<{ window: number; percent: number }>;
}

export type DiffLineType = 'same' | 'add' | 'remove';

export interface DiffLine {
  type: DiffLineType;
  text: string;
  beforeLine?: number;
  afterLine?: number;
}

export interface DiffSummary {
  tokens: number;
  words: number;
  characters: number;
  lines: number;
  score: number;
  added: number;
  removed: number;
  unchanged: number;
}

export interface DiffReport {
  before: LintReport;
  after: LintReport;
  delta: DiffSummary;
  resolved: string[];
  introduced: string[];
  sectionsGained: SectionId[];
  sectionsLost: SectionId[];
  lines: DiffLine[];
  verdict: string;
}

export type OutputFormat = 'text' | 'json';

export interface CliOptions {
  command: 'lint' | 'diff' | 'serve' | 'rules' | 'sample' | 'help' | 'version';
  input: string | undefined;
  before: string | undefined;
  after: string | undefined;
  format: OutputFormat;
  out: string | undefined;
  port: number;
  host: string;
  noColor: boolean;
  quiet: boolean;
  failUnder: number | undefined;
  failOnRegression: boolean;
  sample: 'v1' | 'v2' | undefined;
}

export interface RuleInfo {
  id: string;
  title: string;
  severity: Severity;
  description: string;
}
