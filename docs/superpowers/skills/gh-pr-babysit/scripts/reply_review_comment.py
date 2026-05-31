#!/usr/bin/env python3
"""Reply to a GitHub pull request review thread via gh GraphQL."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


MUTATION = """
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: {
    pullRequestReviewThreadId: $threadId,
    body: $body
  }) {
    comment {
      id
      url
      body
    }
  }
}
"""


def main() -> int:
  parser = argparse.ArgumentParser()
  parser.add_argument("--thread-id", required=True)
  group = parser.add_mutually_exclusive_group(required=True)
  group.add_argument("--body")
  group.add_argument("--body-file")
  args = parser.parse_args()

  body = args.body if args.body is not None else Path(args.body_file).read_text()
  payload = run_json([
    "gh",
    "api",
    "graphql",
    "-f",
    f"query={MUTATION}",
    "-F",
    f"threadId={args.thread_id}",
    "-F",
    f"body={body}",
  ])
  print(json.dumps(payload["data"]["addPullRequestReviewThreadReply"]["comment"], indent=2))
  return 0


def run_json(args: list[str]) -> dict:
  result = subprocess.run(args, check=False, text=True, capture_output=True)
  if result.returncode != 0:
    sys.stderr.write(result.stderr)
    raise SystemExit(result.returncode)
  return json.loads(result.stdout)


if __name__ == "__main__":
  raise SystemExit(main())
