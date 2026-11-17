# GLOBIS — AI TEAM & WORKFLOW

_Roles updated 2026-11-17._

## Roles

| Tool | Intended role | Important limitation / rule |
|---|---|---|
| **ChatGPT** | Product thinking, architecture, task breakdown, UX reasoning, code review and coordination. | Use GitHub as durable handoff; do not assume another account shares chat history. |
| **Claude Code** | Leads technical implementation for GLOBIS. | On return, check recent commits, open PRs and Issue #1 before resuming work. |
| **Codex** | Supporting co-developer. Continues owner-assigned work when Claude Code reaches its usage limit. | Use a feature branch and PR. Leave the PR link, change summary and test results in Issue #1 for Claude Code. |
| **Google Antigravity** | Main IDE / local agent environment when available. | Treat as the coding workspace, not a shared conversation memory across tools. |
| **Gemini Work Pro** | Large research, competitor analysis, UX/UI audits, second opinions and ideas. | In this setup it has not been able to connect directly to GitHub; record useful conclusions in GitHub. |
| **Manus AI** | Autonomous research, competitor analysis, data collection and broader exploratory work. | Record decisions/findings in GitHub so they persist. |
| **Figma + Mobbin** | Design exploration, reference gathering and interface design. | Final approved decisions should be documented in repo/issues. |

## Shared source of truth

GitHub repository: https://github.com/nojusdr-lab/globis

- Issues hold durable task instructions, decisions and cross-agent handoffs.
- Pull requests hold code changes, diffs, review comments and test results.
- Repository docs hold stable project context and design/product decisions.
- Chat history is useful but not the canonical project record.

Key issues:
- #1: https://github.com/nojusdr-lab/globis/issues/1
- #2: https://github.com/nojusdr-lab/globis/issues/2

## Working rules

1. Do not ask the owner to copy/paste long prompts between agents. Put the instruction in a GitHub issue and have the next agent read it.
2. One agent edits a given set of files at a time. Avoid concurrent overlapping edits.
3. Coding work happens on a feature branch and is submitted as a PR.
4. Never commit directly to main.
5. Before implementation, inspect the current branch, HEAD, workflow and relevant files.
6. Before each PR, explain scope, likely files, tests and risks in plain Lithuanian.
7. Do not create paid accounts, deploy to production or connect external services without explicit approval.
8. Report exactly what was changed, tested, not tested and still uncertain.

## Recommended handoff pattern

- Product/UX decision → write it to GitHub issue or `docs/handoff`.
- Research agent → provide findings and sources; record only validated conclusions.
- Coding agent → read issue + docs, implement one scoped PR, report test results.
- Reviewer → inspect diff against acceptance criteria; request changes or approve.
- Owner → approves product decisions and PR merge.

## Current immediate project priority

Follow Issue #2. Reinspect repository/workflow first, then prepare **PR 1 — P0 data integrity and correctness** only. Do not start later PRs until PR1 is reviewed.
