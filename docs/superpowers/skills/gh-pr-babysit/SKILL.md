---
name: gh-pr-babysit
description: "Use when asked to babysit a GitHub pull request until it is merge-ready: create or find the PR, monitor CI, inspect failing GitHub Actions logs, address actionable review conversations, reply with verification evidence, resolve conversations only after addressing them, and repeat until checks are green and no actionable unresolved review threads remain."
---

# GitHub PR Babysit

## Overview

Use this skill to keep a PR moving until it is objectively ready: CI green, Quality Gate green, and review conversations either resolved after being addressed or explicitly reported as blocked.

## Golden Rules

- Never resolve a review conversation before the comment has been addressed by code, documentation, tests, or a clear written answer.
- Every code change must preserve the ratchet: a PR may improve or match quality metrics, but must not regress any blocking metric.
- Do not update `quality/baseline.json` automatically. Update it only when the user explicitly approves a real quality improvement.
- Treat ambiguous, contradictory, or unaddressed review threads as blockers.
- Keep GitHub writes traceable: every reply should state what changed and which verification command passed.

## Prerequisites

Run these before entering the loop:

```bash
gh auth status
git status --short --branch
bun --version
docker version
```

If there is no PR for the current branch, create one with `gh pr create` using the current branch as head and the repository default branch as base.

## Babysit Loop

Repeat until all exit criteria pass:

1. Inspect PR state.
   - `gh pr view --json number,url,state,headRefName,baseRefName,mergeStateStatus,statusCheckRollup`
   - `python3 scripts/fetch_review_threads.py --pr <number>`
2. Run local gates before editing when the branch has local changes or review comments require code changes.
   - `bun run lint`
   - `bun run check:types`
   - `bun run test:unit`
   - `bun run test:coverage`
   - `bun run quality:gate`
   - `docker compose config`
3. Watch CI.
   - `gh pr checks <number> --watch --interval 10`
   - If a GitHub Actions check fails, inspect it with `gh run view <run-id> --log` and fix the root cause.
4. Address review threads.
   - Fetch unresolved threads with `scripts/fetch_review_threads.py`.
   - Cluster actionable comments by behavior or file.
   - Implement the smallest traceable fix for each actionable cluster.
   - Add or update tests for each behavioral fix.
5. Verify after changes.
   - Run the smallest relevant regression test first.
   - Run `bun run ci:local` before push.
   - Run `bun run ci:e2e` when changes touch Docker, Kong, Keycloak, RabbitMQ, database, auth, API flows, or service integration.
6. Commit and push.
   - Commit only related changes.
   - Push the branch and wait for checks again.
7. Reply and resolve review threads.
   - Reply with `scripts/reply_review_comment.py --thread-id <id> --body-file <file>`.
   - Resolve with `scripts/resolve_review_thread.py --thread-id <id>` only after the fix and verification are complete.

## Exit Criteria

Stop only when all are true:

- `git status --short --branch` is clean or contains only intentionally untracked local-only artifacts.
- `gh pr checks <number>` reports all required checks passing.
- `bun run quality:gate` passes against the committed baseline.
- `python3 scripts/fetch_review_threads.py --pr <number>` shows no actionable unresolved threads.
- Any unresolved non-actionable thread is listed in the final response with the reason it was not resolved.

## Bundled Scripts

- `scripts/fetch_review_threads.py`: thread-aware PR review reader using GitHub GraphQL.
- `scripts/reply_review_comment.py`: replies to a review thread using GitHub GraphQL through `gh`.
- `scripts/resolve_review_thread.py`: resolves a review thread using GitHub GraphQL through `gh`.

Use the scripts from this skill directory. They require `gh` to be authenticated and do not manage tokens directly.
