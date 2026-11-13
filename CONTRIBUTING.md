# Contributing to NoxaPlus PromptLens

Thanks for taking the time to look under the hood. PromptLens is intentionally small: a tokenizer, a section detector, a rule list, a scorer, a diff, and two frontends. Small means a change is usually easy to reason about.

## Get set up

Requires Node.js 22 or newer.

```bash
npm ci
npm run typecheck
npm test
npm run build
node dist/cli.js lint examples/support-reply.v1.md
```

## What makes a good change

- **Keep it deterministic.** The same prompt must produce the same report on every run and every machine. No randomness, no clocks in the score, no model calls.
- **Explain the finding.** Every rule needs a short title, a message that says why it matters, and a suggestion the reader can act on.
- **Prefer precision over coverage.** A rule that fires on good prompts trains people to ignore the tool. If a pattern is ambiguous, test both sides and narrow it.
- **Match the existing shape.** Findings use the `Finding` type, rules live in `src/rules.ts`, structure checks live in `src/structure.ts`, and text rendering stays in `src/report.ts`.

## Adding a rule

1. Add an entry to `LINT_RULES` (or `STRUCTURE_RULES` for a section check) with an ID, severity, category, title, message, and suggestion.
2. If the rule needs a pattern, keep the regular expression local and reset `lastIndex` when the regex is global.
3. Add a test in `test/lint.test.ts` that fires the rule on a realistic prompt.
4. Add a test that a nearby good prompt does not fire it.
5. Run `npm test` and `npm run typecheck`.

Rule IDs use lowercase kebab-case and should describe the problem, not the fix (`missing-output`, not `add-output`).

## Submitting

- Open an issue first for a new rule or a scoring change, so the discussion happens before the code.
- Keep pull requests focused. One rule or one bug per PR is easier to review than a rewrite.
- Update `CHANGELOG.md` under an `Unreleased` heading when behavior changes.
- Run the full suite before pushing. CI runs typecheck, tests, build, and a smoke test of the examples on Node 22 and 24.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
