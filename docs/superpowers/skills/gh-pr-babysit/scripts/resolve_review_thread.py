#!/usr/bin/env python3
"""Resolve a GitHub pull request review thread via gh GraphQL."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys


MUTATION = """
mutation($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
    thread {
      id
      isResolved
    }
  }
}
"""


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--thread-id", required=True)
  args = parser.parse_args()

  payload = run_json([
    "gh",
    "api",
    "graphql",
    "-f",
    f"query={MUTATION}",
    "-F",
    f"threadId={args.thread_id}",
  ])
  print(json.dumps(payload["data"]["resolveReviewThread"]["thread"], indent=2))
  return 0


def run_json(args: list[str]) -> dict:
  result = subprocess.run(args, check=False, text=True, capture_output=True)
  if result.returncode != 0:
    sys.stderr.write(result.stderr)
    raise SystemExit(result.returncode)
  return json.loads(result.stdout)


if __name__ == "__main__":
  raise SystemExit(main())
