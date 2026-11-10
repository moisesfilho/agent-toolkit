# Agent Note Writer MCP

A small MCP stdio server that appends one timestamped line to the task note of
one fixed role. It is intentionally separate from the TypeSafe Jev harness and
does not register MCP resources or prompts.

## Contract

| Item | Value |
| --- | --- |
| Transport | MCP stdio (`type: "local"`) |
| Request | `{ "task_slug": string, "text": string }` only |
| Role | Fixed by the server instance (`--role <role>`), never by the request |
| Workspace | `process.cwd()` supplied by the launcher |
| Destination | `<workspace>/docs/agent-state/<task_slug>/<role>.md` |
| Output | `<YYYY-MM-DD HH:MM ±HH:MM> - <text>\n` |
| Time zone | `America/Fortaleza`, minute resolution, server clock |
| Entry limit | 4096 UTF-8 bytes (`text`) |
| Note limit | 1 MiB per resulting file |
| Lock wait | 500 ms |
| Operation budget | 2000 ms, including lock, validation, write and fsync |
| Slug | Lowercase ASCII segments: one `[a-z0-9]` byte, or the same leading/trailing byte with up to 62 `[a-z0-9-]` characters between them; 1–64 bytes, one segment |
| Text | One printable line; NUL, C0/C1 controls, newlines, U+2028/U+2029, lone surrogates and U+FFFD replacement characters are rejected |

The limits live in [`src/constants.mjs`](src/constants.mjs). Tests import them
instead of duplicating the numbers.

## What It Guarantees

- Only `task_slug` and `text` are accepted. Extra fields such as `path`, `file`,
  `role` or `timestamp` are rejected before any filesystem write.
- The role comes from the spawn configuration. The tool name is `append`; the
  server advertises no resources or prompts, so a resource read cannot leak a
  note.
- The slug is validated as a single lowercase ASCII segment; traversal, `.`,
  `..`, separators, Unicode, spaces and control characters are rejected.
- Existing `docs`, `docs/agent-state`, task directories and the note file are
  checked for symbolic links. The note is opened with `O_NOFOLLOW`, checked for
  `nlink > 1` and, on Linux, verified through `/proc/self/fd` to be inside the
  workspace.
- Appends are serialized with an exclusive lock file. A dead owner is detected
  by PID liveness and replaced atomically under a recovery mutex: the new owner
  writes a candidate lock and renames it over the stale one, then verifies its
  nonce. A live holder is never removed. Mutations of the recovery mutex itself
  are serialized by a kernel guard (an abstract Unix socket on Linux, a local
  port otherwise) that the kernel releases when the process exits. The guard
  destroys incoming connections on accept and closes its listener without
  waiting for close callbacks, so an idle client cannot delay recovery. A stale
  check cannot remove a mutex created in the window. Wait is bounded by the lock
  budget and then by the operation budget.
- The new timestamp is compared with the last stamped entry already recorded in
  the note. A server clock that would produce an earlier timestamp fails closed
  with `CLOCK_REGRESSION` instead of writing a decreasing entry. A
  timestamp-shaped anchor with an impossible calendar date, time or offset is
  rejected with `NOTE_TIMESTAMP_INVALID`; it is never normalized or skipped.
- The file and creation directory are `fsync`ed. A write that crosses the total
  budget is truncated back to its original size before an error is returned, so
  a timeout never reports success or leaves a partial line.
- An existing note above the file limit is rejected without truncation.
- Appends are single writes under the lock; concurrent writers do not interleave
  lines.

## What It Does Not Guarantee

This is **protection against accidental misuse under a trusted configuration**,
not an isolation boundary.

- The workspace root is the launcher's `cwd`, not an authenticated identity. A
  configuration that sets `cwd` (or an agent that edits the configuration) can
  point the server at another workspace. This was measured in the tester harness
  (ESC1/ESC2) and is an explicitly accepted residual risk.
- An agent with shell or file-write access in the same OS user can edit
  configuration, call the binary directly, or write any file it can reach. The
  MCP cannot prevent that.
- Intermediate-directory `TOCTOU` races cannot be fully removed without
  `openat`/directory file descriptors. The checks above are best effort; the
  final `O_NOFOLLOW` and `/proc/self/fd` check prevent writing through a note
  symlink and outside the workspace on Linux, but an attacker racing directory
  components is out of scope.
- Stale-lock recovery assumes a writer cannot stall for the 30 s stale age
  between creating the lock file and writing its owner payload; the 2 s
  operation budget treats that as an out-of-bounds condition.
- The recovery guard is a local kernel mutex, not an authentication boundary.
  Another process in the same user can bind or occupy the guard and block
  recovery, which fails closed.
- The server does not validate the harness ACL. Per-agent permissions are
  configured in the harness and measured by its tests.

## Install

Requires Node.js 20 or newer.

```bash
npm ci --prefix harnesses/agent-note-writer-mcp
```

## OpenCode Configuration

The integration is project-local: place `opencode.json` (or
`.opencode/opencode.json`) at the project root. OpenCode V2 keeps MCP servers
under `mcp.servers`. The example at
[`examples/opencode.json`](examples/opencode.json) declares one local server per
role with `codemode: false` so the native tool is `note_<role>_append`, no `cwd`,
no `pool: true`, a top-level `permissions` entry denying `note_*`, and a
per-agent allow for that role's tool only. OpenCode reloads configuration on
save; use `/reload` if a session does not pick up the new servers.

Server/tool names must stay unique after normalization: `note` + `alice_append`
and `note_alice` + `append` both become `note_alice_append` and must not be
configured together.

The command in the project-local example is relative to the session workspace
(useful when the checkout contains this harness). For a shared toolkit checkout,
use the variable variant in
[`examples/opencode.env-path.json`](examples/opencode.env-path.json): the
launcher passes `AGENT_TOOLKIT_DIR` and `NODE_BIN` through `environment` and runs
`"$NODE_BIN" "$AGENT_TOOLKIT_DIR/harnesses/agent-note-writer-mcp/index.mjs"`.
That is a spawn command chosen by the operator, not an agent `shell` permission,
and it grants no filesystem boundary. Replace both placeholders with the real
paths; never commit a private home path. If Node is managed by NVM, point
`NODE_BIN` at the desired Node binary or load NVM in the launcher; agent
instructions and permissions do not change for that.

The ACL is best effort: it reduces accidental cross-role writes under a stable
configuration, but it does not prevent an agent with configuration or shell
access from bypassing the server. The example grants live in the project
configuration and assume the matching agent definitions exist in the harness;
keep the `agents` entries aligned with the agents actually in use. This
repository's agent frontmatter is intentionally unchanged here. If a harness
resolves permissions only from agent files, add the same
`note_<role>_append` allow there before activation. The example configures only
`planner`, `coder`, `tester` and `reviewer`: the developer writes the
consolidated record at `docs/agent-state/<task>.md` manually, outside this MCP.

Validate the `mcp.servers` block (plain JSON; export or strip JSONC comments
first):

```bash
node harnesses/agent-note-writer-mcp/validate-config.mjs path/to/opencode.json
```

The command checks note servers for `type: "local"`, `codemode: false`,
absence of `cwd`, absence of `pool: true`, `--role` consistency (including a
role embedded in a composed command), exact `note_<role>` names, duplicate
roles and normalized tool-name collisions. Any local server whose command
contains `--role` is treated as a note server, so an alias cannot escape these
checks. Roles are restricted to `planner`, `coder`, `tester` and `reviewer`; a
well-formed `note_developer` server is rejected because the developer's record
is written manually. It does not inspect ACLs.

## Tool Calls

```json
{ "task_slug": "agent-note-writer", "text": "Implemented the stdio server and focused tests." }
```

Success returns a JSON payload with `ok`, `role`, `taskSlug`, `path`,
`timestamp`, `entryBytes`, `lineBytes`, `fileBytes`, `created`, `elapsedMs` and
`directorySynced`. Failures return `isError: true` with a JSON `error.code`.

| Code | Meaning |
| --- | --- |
| `INVALID_ARGUMENTS` | Extra/missing fields or wrong types |
| `UNKNOWN_TOOL` | Tool name is not `append` |
| `ROLE_INVALID` | Invalid role at startup |
| `SLUG_INVALID` | Slug is empty, too long, non-ASCII or not one segment |
| `TEXT_INVALID` / `TEXT_EMPTY` / `TEXT_CONTROL` / `TEXT_ENCODING` | Invalid text |
| `TEXT_TOO_LARGE` | Entry exceeds 4096 UTF-8 bytes |
| `CLOCK_REGRESSION` | Server clock would produce a timestamp earlier than the last recorded entry |
| `NOTE_TIMESTAMP_INVALID` | Note contains a timestamp-shaped anchor with an invalid date, time or offset |
| `FILE_TOO_LARGE` | Append would exceed or already exceeds 1 MiB |
| `ROOT_INVALID` / `ROOT_SYMLINK` / `ROOT_NOT_WRITABLE` | Workspace root rejected |
| `PATH_SYMLINK` / `PATH_INVALID` / `PATH_OUTSIDE_ROOT` | Unsafe path component |
| `NOTE_SYMLINK` / `NOTE_HARDLINK` / `NOTE_NOT_REGULAR` | Unsafe note target |
| `LOCK_BUSY` / `LOCK_ERROR` | Lock not acquired within the wait budget |
| `TIMEOUT` | Operation budget exceeded; the entry is rolled back |
| `WRITE_FAILED` / `FS_ERROR` | I/O failure; no success is reported |

## Behavior Details

- The lock file is `docs/agent-state/<task_slug>/.note-writer-<role>.lock` and
  is removed on success and on error. A process killed while holding it leaves
  a stale file that the next writer recovers when the PID is gone; recovery is
  serialized by a `.recover` mutex and installs the new owner with an atomic
  rename, so two recoverers cannot both acquire the stale lock. Release only
  removes the lock when its owner nonce still matches.
- `docs` and `docs/agent-state` are created inside the workspace when missing.
- Notes are created with mode `0644`; lock files use `0600`.
- The timestamp is read once per operation, after the lock is acquired, so
  serialized appends are non-decreasing at minute resolution. It must not be
  earlier than the last stamped entry already in the note; otherwise the append
  fails closed with `CLOCK_REGRESSION`.
- The note format is one line per call. Send one entry per call instead of
  embedding newlines.

## Development

```bash
npm ci
npm test
node validate-config.mjs examples/opencode.json
```

The tests use Node's built-in test runner and cover request validation, limits,
timestamp, root/symlink/hardlink handling, lock wait and orphan recovery,
concurrent writers, total-time rollback, MCP protocol behavior (single tool, no
resources/prompts) and config-name uniqueness.
