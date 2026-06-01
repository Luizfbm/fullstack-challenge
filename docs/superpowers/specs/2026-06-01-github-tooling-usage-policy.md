# GitHub Tooling Usage Policy

Date: 2026-06-01
Status: Active project operating rule

## Summary

This spec defines how Codex should use GitHub tooling in this project.

The preferred operating model is hybrid:

- Use the GitHub MCP/app connector first for structured GitHub data and PR
  metadata.
- Use the local `gh` CLI for Actions logs, check details, current-branch PR
  discovery, and workflows tightly coupled to the local checkout.
- Use local `git` for branch state, history, commits, staging, fetch, pull,
  reset, merge, rebase, and push decisions.

No single tool should be treated as the exclusive source of truth. The correct
workflow is to keep GitHub remote state and the local checkout aligned before
acting.

## Goals

- Make GitHub work repeatable across Codex sessions.
- Avoid stacked PRs, accidental branch drift, and confusing history.
- Use the strongest tool for each GitHub task instead of forcing all work
  through one interface.
- Preserve the project rule that `crash-game-implementation` is the work
  branch and PRs target `main`.
- Ensure CI failures are diagnosed from real logs before making fixes.

## Non-Goals

- This spec does not replace `README.md` or the execution plan.
- This spec does not authorize force push, branch deletion, merge, or PR
  closure without explicit user confirmation.
- This spec does not change the TDD requirement for implementation work.
- This spec does not change the required quality gates.

## Mandatory Entry Workflow

For any task involving GitHub, PRs, issues, Actions, CI, merge state, remote
branches, reviews, or publishing:

1. Load the GitHub skill/instructions for the current session.
2. Resolve the repository from the local checkout with `gh repo view --json
   nameWithOwner,url` or equivalent local context.
3. Check local branch state with `git status --short --branch`.
4. Use the GitHub MCP/app connector for structured PR or repository metadata
   when available.
5. Use `gh` when the task needs current branch discovery, detailed Actions
   checks/logs, or operations not covered well by the connector.
6. Use local `git` for any operation that changes the local checkout or branch
   history.

If the GitHub MCP/app connector is not loaded in the current tool list, search
for it with tool discovery before falling back to `gh`.

## Tool Selection Matrix

### Use GitHub MCP/App Connector For

- PR metadata: title, body, base/head refs, merge state, status summary.
- Repository and issue orientation.
- Structured PR review data when available.
- Combined commit status.
- Workflow run summaries and artifacts when the connector exposes them.
- Adding a review or structured PR interaction when explicitly requested and
  supported.

The connector is preferred here because it returns structured data and avoids
parsing terminal output unnecessarily.

### Use `gh` CLI For

- `gh auth status`.
- Discovering the PR associated with the current branch.
- `gh pr checks` and check rollups tied to a branch or PR.
- GitHub Actions logs and failure details.
- Re-running checks when the connector does not expose the needed operation.
- Creating PRs when the branch has already been pushed and the connector path
  is insufficient.
- Any workflow where local checkout state and remote PR state must be compared.

`gh` is preferred for CI debugging because full Actions logs are not reliably
available through the connector alone.

### Use Local `git` For

- `git status --short --branch`.
- `git fetch --all --prune`.
- Switching branches.
- Updating `main` with fast-forward pulls.
- Resetting the local work branch to `main` when explicitly authorized.
- Inspecting commit history and divergence.
- Staging, committing, pushing, and any history-changing operation.

Local `git` is the source of truth for the workspace state.

## Project-Specific Branch and PR Rules

- Main branch: `main`.
- Work branch: `crash-game-implementation`.
- PR base: `main`.
- PR head: `crash-game-implementation`.
- Avoid stacked `codex/...` branches unless the user explicitly authorizes
  them.
- Keep commits organized by execution-plan step.
- After a PR is merged by rebase into `main`, update local state with:

```bash
git fetch --all --prune
git switch main
git pull --ff-only
git switch crash-game-implementation
git reset --hard main
```

The final `git reset --hard main` is allowed only when the worktree has been
checked and the user has authorized this alignment flow. Do not run it when the
worktree contains uncommitted user changes.

If `crash-game-implementation` diverges from `origin/crash-game-implementation`
after a rebase merge, do not force push automatically. Report the divergence
and ask for explicit confirmation before using `git push --force-with-lease`.

## PR and CI Workflow

When creating or babysitting a PR:

1. Confirm the local branch and remote branch match the intended PR.
2. Run the required local gates for the scope before publishing.
3. Use the `gh-pr-babysit` skill after PR creation or when asked to monitor a
   PR.
4. Use the GitHub MCP/app connector for PR metadata and status orientation.
5. Use `gh` for failing Actions logs.
6. Fix only the smallest necessary scope for a CI failure.
7. Re-run the relevant local gate before pushing a fix.
8. Push only from the intended work branch.
9. Do not merge, rebase, close, force push, delete remote branches, or resolve
   review threads without explicit authorization.

## TDD Interaction

For implementation or bug-fix work found while using GitHub tooling:

- Use TDD one behavior at a time.
- Prefer tests through public interfaces.
- Never delete, disable, skip, or reduce existing tests without explicit user
  authorization.
- Before any commit, run the full required test and quality gate set for the
  scope and do not commit while any test or gate is failing.
- Do not write broad speculative tests.
- For CI failures, reproduce or isolate the failing behavior before changing
  code whenever practical.
- Record relevant real build, test, Docker, migration, runtime, or integration
  failures in the implementation issue log.

For documentation-only GitHub process changes, a code RED/GREEN cycle is not
applicable. Verification should at minimum include `git diff --check` and a
review that the execution plan links to this spec.

## Expected Codex Behavior

Whenever future work mentions GitHub, PR, CI, Actions, checks, merge, branch
remote state, or publishing, Codex should:

- consult this spec;
- use the GitHub skill;
- prefer the GitHub MCP/app connector for structured GitHub data;
- use `gh` for detailed CI and local-branch-aware operations;
- use local `git` for workspace and history operations;
- state which tool was used for which part when reporting results.
