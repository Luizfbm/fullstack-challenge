#!/usr/bin/env python3
"""Fetch GitHub PR review threads with resolution state via gh GraphQL."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from typing import Any


QUERY = """
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      id
      number
      url
      title
      reviewThreads(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          startLine
          originalLine
          originalStartLine
          diffSide
          startDiffSide
          comments(first: 100) {
            nodes {
              id
              databaseId
              author {
                login
              }
              body
              url
              createdAt
            }
          }
        }
      }
    }
  }
}
"""


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--repo", help="owner/repo. Defaults to gh repo view.")
  parser.add_argument("--pr", type=int, help="Pull request number. Defaults to current branch PR.")
  parser.add_argument("--include-resolved", action="store_true")
  args = parser.parse_args()

  owner, name = resolve_repo(args.repo)
  number = args.pr or resolve_current_pr()
  threads = fetch_threads(owner, name, number)

  if not args.include_resolved:
    threads = [thread for thread in threads if not thread["isResolved"]]

  print(json.dumps({
    "repository": f"{owner}/{name}",
    "pullRequest": number,
    "threads": threads,
  }, indent=2))
  return 0


def fetch_threads(owner: str, name: str, number: int) -> list[dict[str, Any]]:
  cursor: str | None = None
  threads: list[dict[str, Any]] = []

  while True:
    args = [
      "gh",
      "api",
      "graphql",
      "-f",
      f"query={QUERY}",
      "-F",
      f"owner={owner}",
      "-F",
      f"name={name}",
      "-F",
      f"number={number}",
    ]
    if cursor:
      args.extend(["-F", f"cursor={cursor}"])

    payload = run_json(args)
    pr = payload["data"]["repository"]["pullRequest"]
    page = pr["reviewThreads"]
    threads.extend(page["nodes"])

    if not page["pageInfo"]["hasNextPage"]:
      return threads
    cursor = page["pageInfo"]["endCursor"]


def resolve_repo(repo: str | None) -> tuple[str, str]:
  if repo:
    owner, name = repo.split("/", 1)
    return owner, name

  value = run_text(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
  owner, name = value.split("/", 1)
  return owner, name


def resolve_current_pr() -> int:
  return int(run_text(["gh", "pr", "view", "--json", "number", "-q", ".number"]))


def run_json(args: list[str]) -> dict[str, Any]:
  return json.loads(run_text(args))


def run_text(args: list[str]) -> str:
  result = subprocess.run(args, check=False, text=True, capture_output=True)
  if result.returncode != 0:
    sys.stderr.write(result.stderr)
    raise SystemExit(result.returncode)
  return result.stdout.strip()


if __name__ == "__main__":
  raise SystemExit(main())
