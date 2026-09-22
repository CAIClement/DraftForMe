#!/usr/bin/env node
// SessionStart hook: prints a short status of where this checkout stands
// before the session does anything, since branch and worktree layout here
// are easy to get wrong (see below) and there is no other cheap way to see it.
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const lines = [];

const branch = run("git rev-parse --abbrev-ref HEAD");
if (branch) {
  lines.push(`Branch: ${branch}`);
}

// This checkout can keep `main` in a sibling worktree (see
// memory/draftforme-parallel-worktrees.md): a session on a feature branch
// must not assume the primary checkout's `main` is current.
const worktrees = run("git worktree list --porcelain");
if (worktrees && branch && branch !== "main") {
  const holdsMain = worktrees
    .split("\n\n")
    .some((block) => block.includes("branch refs/heads/main"));
  if (holdsMain) {
    lines.push(
      "Note: `main` is checked out in a sibling worktree, not here. " +
        "Run `git worktree list` before assuming this checkout's `main` is current."
    );
  }
}

const currentPath = ".claude/work/current.md";
if (existsSync(currentPath)) {
  const body = readFileSync(currentPath, "utf8").trim();
  if (body && !body.startsWith("# Current work\n\nNothing in progress")) {
    lines.push("--- .claude/work/current.md ---");
    lines.push(body);
  }
}

if (lines.length > 0) {
  console.log(lines.join("\n"));
}
