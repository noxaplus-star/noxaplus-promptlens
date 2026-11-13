# Changelog

All notable changes to NoxaPlus PromptLens are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/noxaplus-star/noxaplus-promptlens/releases/tag/v1.0.0
