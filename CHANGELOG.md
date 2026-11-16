# Changelog

All notable changes to NoxaPlus PromptLens are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-11-16

### Added

- A static browser playground, published at <https://noxaplus-star.github.io/noxaplus-promptlens/>, for people who want to use PromptLens without installing Node.js or starting a server.
- Live linting with a score ring, severity counts, score breakdown, structure checklist, token budget, and copy or JSON export of the report.
- Version comparison with score and token deltas, resolved and introduced findings, sections gained or lost, and a line-by-line diff.
- A searchable catalog of all 22 rules inside the playground.
- Light and dark themes, a local draft and theme in `localStorage`, and <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Enter</kbd> to analyze.
- `npm run build:web`, which compiles the browser-safe engine into `web/engine/` and generates `version.js` and `samples.js` from `package.json` and `examples/`.
- Browser playground tests covering the generated version, sample parity with the example files, lint and diff results, and the static entry page.
- A CI check that rebuilds the browser engine and fails when the committed output is stale.

### Changed

- The README now leads with a no-install playground link, documents the page, and separates the hosted playground from the local dashboard and HTTP API.

[1.1.0]: https://github.com/noxaplus-star/noxaplus-promptlens/releases/tag/v1.1.0

## [1.0.1] - 2026-11-14

### Fixed

- Restore neutral findings and structure indicators when the prompt is cleared or contains only whitespace.
- Cancel pending lint work and ignore delayed responses after Clear, including stale errors and loading indicators.
- Add six dashboard regressions covering Clear, manual deletion, delayed responses, and subsequent sample/comparison usage.

## [1.0.0] - 2026-11-13

First public release.

### Added

- Deterministic prompt linting with 22 rules: 15 wording checks and 7 structure checks.
- 100-point score split across structure, clarity, specificity, and brevity, with letter grades.
- Section detection for role, objective, context, constraints, output format, examples, and tone.
- Approximate token estimation with context-window usage for 8k, 32k, 128k, and 200k tokens.
- Version comparison with line diff, score delta, sections gained or lost, and resolved or introduced findings.
- `promptlens lint`, `diff`, `serve`, `sample`, and `rules` commands.
- Text and JSON reports, stdin input, `--fail-under`, and `--fail-on-regression` for CI.
- Local dashboard with Lint and Compare views and a small HTTP API.
- Bundled before/after example prompts.
- Zero runtime dependencies; requires Node.js 22 or newer.

[1.0.1]: https://github.com/noxaplus-star/noxaplus-promptlens/releases/tag/v1.0.1
[1.0.0]: https://github.com/noxaplus-star/noxaplus-promptlens/releases/tag/v1.0.0
