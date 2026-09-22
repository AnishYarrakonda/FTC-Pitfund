# Agent prompts

One task per file, written to be handed to a fresh coding agent (Antigravity or otherwise) that has no
memory of any prior conversation about this project. Each file is self-contained: ground rules, context,
exact task, and a definition of done. See `docs/OUTSTANDING.md` for the plain-English summary of what these
cover and why, and how confident each finding is.

**Give an agent exactly one file per session.** That's the reason these are split up instead of being one
big backlog — a focused task is much less likely to go sideways than a pile of unrelated changes at once.

## Current prompts

| # | File | What it does |
|---|------|---------------|
| 01 | `01-route-handlers-missing-connection.md` | Add a missing `connection()` guard to four API route handlers |
| 02 | `02-percent-encoded-path-crash.md` | Investigate (and fix, if real) a reported crash on a malformed `%` in a URL |
| 03 | `03-first-verified-badge-audit.md` | Find out whether FIRST-verified status actually renders where it should |

## The mini-prompt

To kick off any one of these with a fresh agent, use this template — just swap the number:

```
Read docs/agent-prompts/01-route-handlers-missing-connection.md in this repository and execute it exactly
as written. Read CLAUDE.md and everything under .claude/rules/ first, as the prompt tells you to.
```

Swap `01-route-handlers-missing-connection.md` for `02-percent-encoded-path-crash.md`,
`03-first-verified-badge-audit.md`, or any future numbered file added here.

## Adding a new prompt

Same shape every time:
1. A short "ground rules" section (branch first, `npm run check` before committing, never touch v1, follow
   this repo's existing patterns — copy it from an existing prompt file, it barely changes).
2. **Context**: what's actually known, and how confident it is (confirmed by reading code / confirmed live
   in production / reported secondhand and unverified). Don't state a guess as a fact.
3. **Task**: numbered, concrete steps.
4. **Done when**: a checklist an agent (or a human reviewing its work) can verify without re-reading the
   whole task.

Add a row to the table above and bump `docs/OUTSTANDING.md` if the new prompt closes or supersedes something
listed there.
