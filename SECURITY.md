# Security policy

## What PromptLens touches

PromptLens is a local analysis tool. It reads the prompt you give it, compares the text against built-in rules, and prints or serves a report. It does not make outbound network requests, call a model, run the prompt, or write prompt text to disk unless you pass `--out`.

The dashboard binds to `127.0.0.1` by default. It serves a self-contained page, keeps no history, and exposes only the routes documented in the README. Binding to a public interface with `--host` is your decision and your responsibility.

## Reporting a vulnerability

If you find a security issue — for example, a path handling problem, a request that can read files it should not, or a crash caused by untrusted input — please report it privately.

- Use GitHub's [private vulnerability reporting](https://github.com/noxaplus-star/noxaplus-promptlens/security/advisories/new).
- Include the version, the input that triggers the issue, and what you expected to happen.
- Please do not open a public issue for a vulnerability before a fix is available.

You can expect an acknowledgement within a few days and an update once the issue is understood. Credit is offered in the advisory if you want it.

## Scope

PromptLens does not evaluate model output, fetch remote prompts, or store credentials, so most classic application vulnerabilities do not apply. Reports about the accuracy of a rule, the score, or a token estimate are welcome as regular issues, not security reports.
