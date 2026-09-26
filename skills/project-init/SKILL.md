---
name: project-init
description: Bootstrap a new project following a portable initialization pattern. Use when the user asks to create a new project, scaffold a repo, "criar novo projeto", "iniciar projeto", "new CLI", or create a GitHub repository for a fresh tool. Covers repository setup, documentation, i18n, and CI/CD pipelines.
---

# Project Init Skill

You bootstrap new projects following a consistent, portable initialization standard:
repository on GitHub, bilingual docs, i18n-ready CLI messages, and CI/CD
workflows with a hard quality gate and tag-based releases.

The reference stack is Node.js + TypeScript. For other technologies the same
stages apply using the per-stack equivalents listed in "Cross-Stack
Equivalents" below.

## Conventions (read first)

- GitHub owner and repository visibility are supplied by the user.
- Projects live in `~/Projects/<project-name>` by default and the GitHub repo must keep
  the same name as the project folder.
- Code style: clean code, no unnecessary comments, Single Responsibility,
  and "Package by Feature" architecture.
- CLI messages must support English (default) and Portuguese via a `t(key)`
  lookup; config file plus an env var `<NAME>_CLI_LANGUAGE`.
- Do not commit changes unless the user asks.

## Bootstrap flow

1. Confirm the requested project name and type (CLI, web app, library).
2. Prefer Node 20+ / LTS + TypeScript (strict). If the user asks for another
   stack (Go, Python, .NET, Java), map every stage below to the equivalent
   tooling and say so explicitly.
3. Create folder `~/Projects/<name>`:
   - `git init`
    - `gh repo create <owner>/<name> --public --source --remote origin`
   - Base files depending on the stack:

### Node + TypeScript reference files

`package.json`:

```json
{
  "name": "<name>",
  "version": "0.1.0",
  "type": "module",
  "bin": { "<name>": "dist/cli.js" },
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "format:check": "prettier --check .",
    "test": "vitest run --coverage"
  }
}
```

`tsconfig.json`: strict, `target` ES2022, `module` NodeNext,
`outDir dist`, `rootDir src`, `declaration true`.

Standard devDependencies for the quality gate:

- `typescript`, `tsx`
- `eslint` + `typescript-eslint` + `eslint-plugin-unicorn` +
  `eslint-plugin-sonarjs`
- `prettier`
- `vitest` + `@vitest/coverage-v8`
- `@yao-pkg/pkg` (release binaries)

Standard runtime deps for a network CLI: `commander` (arg parsing) and any
project-specific SDK.

## Documentation

Create `README.md` (English, canonical) and `README.pt-BR.md` (Portuguese
mirror), following the pattern of the other projects:

- Shields badges at the top (version, license MIT, platform, CI status).
- Language switch line:
  `**Languages:** [English](../../README.md) | [Português](../../README.pt-BR.md)`
- Sections: Features, Installation, Usage, Config / Environment vars (table),
  Project Structure, Tests, Quality.
- Include a banner that the CLI interface/help is English by default and that
  output messages follow a `language` config (`en` or `pt`).

## i18n (CLI projects)

- `i18n.ts` (or equivalent) exposing catalogs for `en` (default) and `pt`
  and a `t(key)` function bound to the current language.
- Config command: `config set --language pt|en` and env override
  `<NAME>_CLI_LANGUAGE`.
- Store config in the OS config dir: `~/.config/<name>/config.json`.

## Workflows

Create `.github/workflows/` with three files. Every workflow MUST emit a
summary table to `$GITHUB_STEP_SUMMARY`.

### `quality-gate.yml`

`workflow_call`: reusable, not duplicated.

Stages (Node reference):

- `npm ci`
- Professional child quality: `eslint . --max-warnings 0` with
  `eslint-plugin-unicorn` and `eslint-plugin-sonarjs` both enabled.
- Formatting: `prettier --check .`
- Type standards: `tsc --noEmit`
- Security: `npm audit --audit-level=high`
- Tests with coverage: `vitest run --coverage` with 100% threshold.
- Mandatory summary: `echo` a table `| Stage | Status |` with
  ✅/❌ per stage into `$GITHUB_STEP_SUMMARY`.

### `ci.yml`

Triggers: push to `main`/`develop`, PR to `main`. Calls `quality-gate.yml`
and writes a consolidated summary (job name + status + link).

### `release.yml`

- Triggers: push of tag `v*` and `workflow_dispatch`.
- `permissions: contents: write`.
- Job 1: call `quality-gate.yml` as a blocking gate.
- Job 2 (`needs: quality-gate`): build install packages:
  - Node: `@yao-pkg/pkg` targets `linux-x64`, `linux-arm64`,
    `win-x64`, `darwin-x64`, `darwin-arm64` producing `.tar.gz` (Linux/macOS)
    and `.exe` + `.zip` (Windows).
  - Generate release notes from `git log` between last tag and HEAD.
  - Publish with `softprops/action-gh-release@v3`, `draft: false`,
    `prerelease: contains(tag, alpha|beta|rc)`.
- Summary steps: table of generated artifacts per platform (file + size), then
  a confirmation of the created release (tag, URL, prerelease status).

## Cross-stack equivalents

When the project is not Node/TS, map each stage:

| Stage | Node reference | Go | Python |
| --- | --- | --- | --- |
| Lint / quality | eslint + unicorn + sonarjs | golangci-lint + staticcheck | ruff + bandit |
| Format | prettier --check | gofmt/go vet (gofmt -l) | ruff format --check |
| Type/tech standards | tsc --noEmit | go build/vet | mypy --strict |
| Security | npm audit | govulncheck | bandit -r |
| Tests + coverage | vitest + 100% | go test ./... -cover | pytest --cov-fail-under=100 |
| Release tool | @yao-pkg/pkg | goreleaser | python -m build + twine |
| Release artifacts | tar.gz/zip/exe per platform | .deb/.rpm/.tar.gz/.zip | sdist + wheel |

Follow the same workflow layout (callable quality gate + ci + release) and
the same summary-table requirement regardless of stack.

## Quality bar

- Run `npm run lint npm run typecheck && npm test` (or the stack equivalent)
  before finishing.
- No commented-out code; comments only when they add real value.
- Ask before `git commit`/`gh repo create` if not already requested.
