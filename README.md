# autostackrc

**Detect your tech stack → generate tailored rules & commands for your AI code assistants.**

`autostackrc` *generates* rules and slash-commands specific to your stack and writes them in the native
format of each assistant — Claude Code, Cursor, GitHub Copilot, and opencode.

📖 **Docs & portal:** https://cesarzuniga.github.io/autostackrc (deployed via GitHub Pages from [`docs/`](./docs/index.html)).

```bash
npx autostackrc
```

## How it works

1. **Detect** — scans dependency manifests (`package.json`, `pyproject.toml`, `requirements*.txt`, `pom.xml`,
   `build.gradle(.kts)`, `*.csproj`, `composer.json`, `Gemfile`), config files, and file extensions to identify
   your stack. Frameworks are only reported when you actually depend on them (e.g. Spring Boot vs. plain Java).
2. **Assemble** — builds a baseline of rules + commands from static templates (offline, auditable).
3. **Enrich** — hands the baseline to *your installed AI coder CLI* (using its existing login session,
   **no API key**) to make the rules specific and correct for your stack.
4. **Write** — projects one agent-agnostic result into every selected assistant's files.

If no coder CLI is found (or `--no-llm`), it emits the static templates as-is — never hard-fails.

## Output per assistant

| Assistant     | Rules                                                             | Commands                        |
| ------------- | ---------------------------------------------------------------- | ------------------------------- |
| Claude Code   | `CLAUDE.md` (managed block)                                       | `.claude/commands/*.md`         |
| Cursor        | `.cursor/rules/*.mdc` (one per tech, `globs`/`alwaysApply`)       | `.cursor/commands/*.md`         |
| GitHub Copilot| `.github/copilot-instructions.md` + `.github/instructions/*.md`  | `.github/prompts/*.prompt.md`   |
| opencode      | `AGENTS.md` (managed block)                                       | `.opencode/command/*.md`        |

Shared files (`CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md`) are edited inside an
`<!-- autostackrc:start -->…<!-- autostackrc:end -->` block, so re-runs update only that block and leave your
own content untouched. A `autostackrc-lock.json` records every file written.

## Enrichment without an API key

`autostackrc` does **not** call any API directly. It detects an installed coder CLI in this order and runs
it headless, feeding the prompt on stdin and parsing the JSON it returns:

- `claude` (Claude Code) — `claude -p`
- `opencode` — `opencode run`
- `cursor-agent` (Cursor) — `cursor-agent -p`

Whatever session that CLI is already logged into is what does the work. Force one with `--coder`.

## Options

```
npx autostackrc                        Detect, generate, write (interactive)
  -y, --yes         Skip confirmation prompts
  --dry-run         Show plan, write nothing
  -a, --agent       Target subset: claude-code cursor copilot opencode
  --no-llm          Skip enrichment, emit static templates only
  --coder <id>      Force coder CLI: claude, opencode, cursor-agent
  --model <id>      Model hint passed to the coder CLI (if supported)
  -v, --verbose     Show traces and error detail (incl. skipped malformed manifests)
  -h, --help        Show this help
```

## Spec-Driven Development (in progress)

> **Not available yet — planned for v0.1.0.** Today autostackrc generates rules and commands per stack.

In the next release, every run will also generate a complete **Spec-Driven Development** harness, adapted to
your stack (your real test command: `vitest`, `pytest`, `dotnet test`, `go test`…) and to each assistant:

| Piece          | What it generates                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Slash commands | `/sdd-constitution` `/sdd-spec` `/sdd-clarify` `/sdd-plan` `/sdd-tasks` `/sdd-implement` `/sdd-validate` `/sdd-change` `/sdd-status` |
| Skill          | `sdd` — workflow, spec template, EARS requirements, testability guide for your language                 |
| Agents         | `coordinator`, `planner`, `implementer`, `reviewer` with least-privilege permissions                    |
| Project docs   | `docs/constitution.md`, `MEMORY.md`, `specs/NNN-name/{spec,plan,tasks}.md` — created once, never overwritten |
| CLI            | `npx autostackrc sdd check` (CI: EARS lint + requirement→test traceability), `sdd status`, `update`      |

Flow: **constitution → spec → clarify → plan → tasks → implement (tests first, one task at a time) → validate**,
with your approval at each gate.

autostackrc is being built with this same workflow: see [`docs/constitution.md`](./docs/constitution.md),
[`docs/adr/`](./docs/adr/) and [`specs/`](./specs/). Spec 001 (multi-ecosystem detection) is done.

## Requirements

Node.js >= 22.6.0 (uses native TypeScript type-stripping).

## Extending

- Add a technology: create `templates/rules/<id>.md` (frontmatter + rule body) and add a seed
  (detect rules + command ids) to `TECH_SEEDS` in `catalog.ts`.
- Add a command: create `templates/commands/<id>.md` (frontmatter + prompt body); mark it
  `generic: true` to emit for every stack, or wire its id into a tech's `commands` in `catalog.ts`.
- Add an assistant: add a writer in `writers/` and register it in `writer.ts` + `agents.ts`.
