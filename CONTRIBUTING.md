# Contributing

## Principles

- Keep each resource focused on one responsibility.
- Prefer portable Markdown, YAML, JSON, and plain text when they are enough.
- Keep harness-specific behavior inside `harnesses/` or clearly labeled files.
- Document inputs, outputs, assumptions, and compatibility.
- Never commit credentials, tokens, personal data, or private machine paths.
- Use English for canonical resource names and provide Portuguese translations
  for user-facing documentation when practical.

## Adding A Resource

1. Choose the directory that matches the resource type.
2. Add a concise README when the directory or resource needs context.
3. State the intended harnesses and compatibility constraints.
4. Include examples only when they are safe, minimal, and reproducible.
5. Run the local validation checks before opening a pull request.

## Pull Requests

Pull requests should explain the problem addressed, the files added or
changed, supported harnesses, and validation performed. Keep unrelated
refactors out of the same pull request.

## Naming

Use lowercase kebab-case for directories and resource filenames. Avoid names
that depend on a vendor unless the resource is intentionally vendor-specific.
