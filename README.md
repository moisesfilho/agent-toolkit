# Agent Toolkit

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Documentation](https://img.shields.io/badge/docs-bilingual-blue.svg)](README.pt-BR.md)
[![Validation](https://github.com/moisesfilho/agent-toolkit/actions/workflows/quality.yml/badge.svg)](https://github.com/moisesfilho/agent-toolkit/actions/workflows/quality.yml)

**Languages:** [English](README.md) | [Portugues](README.pt-BR.md)

A portable collection of AI agents, reusable skills, development workflows,
templates, and documentation for multiple AI coding harnesses.

## Status

This repository contains portable resources extracted from a local OpenCode
setup and sanitized for reuse. Machine-specific configuration, credentials,
logs, caches, and private memory are intentionally excluded.

## Goals

- Keep agent instructions portable across coding harnesses.
- Separate reusable skills from harness-specific adapters.
- Provide workflows and templates that are easy to inspect and customize.
- Document assumptions, compatibility, and safe usage.
- Prefer small, composable resources over opaque automation.

## Repository Structure

| Directory | Purpose |
| --- | --- |
| `agents/` | Reusable agent definitions and role instructions. |
| `skills/` | Focused, reusable capabilities and operating procedures. |
| `workflows/` | Development workflows for planning, implementation, review, and release. |
| `templates/` | Templates for project files, prompts, and documentation. |
| `docs/` | Concepts, conventions, compatibility notes, and guides. |
| `harnesses/` | Adapters and notes for specific AI coding harnesses. |

The initial collection includes the configured agents, reusable skills,
including the shared clean code baseline, the developer workflow, TypeSafe Jev
documentation and MCP harness, and search and decision policies.

## Portability And Security

Resources must not contain credentials, authentication files, private memory,
absolute home paths, hostnames, LAN addresses, logs, dependency caches, or
machine-specific backups. Harness integrations must read secrets from the
runtime environment or an external secret manager.

## Compatibility

The toolkit is designed to support multiple AI coding harnesses. Resources
should identify their target harness, required features, and any conversion
steps instead of assuming one vendor-specific format.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a resource. New
content should be focused, portable where possible, documented, and free of
credentials or private machine-specific data.

## License

This project is released under the [MIT License](LICENSE).
