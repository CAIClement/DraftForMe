#!/usr/bin/env node
// PostToolUse hook (Edit|Write): auto-fixes the touched file with ESLint and,
// if errors remain after fixing, reports them back to the session so they can
// be addressed immediately rather than surfacing later in `npm run lint`.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const LINTABLE = /\.(ts|tsx|js|jsx|mjs)$/;
const SKIP = /(^|[/\\])(node_modules|\.next|\.claude[/\\]worktrees)([/\\]|$)/;

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const raw = readStdin();
let filePath;
try {
  const payload = JSON.parse(raw);
  filePath = payload?.tool_input?.file_path;
} catch {
  process.exit(0);
}

if (!filePath || !LINTABLE.test(filePath) || SKIP.test(filePath)) {
  process.exit(0);
}

// Invoked as `node <eslint bin>.js` (not `npx`/`npx.cmd`) so spawning it
// needs no shell: `.cmd` wrappers require one on Windows, and a shell
// re-splits an absolute path containing spaces (this repo's own path does).
const eslintBin = join(process.cwd(), "node_modules", "eslint", "bin", "eslint.js");
if (!existsSync(eslintBin)) {
  process.exit(0);
}

try {
  execFileSync(process.execPath, [eslintBin, "--fix", filePath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  process.exit(0);
} catch (error) {
  const output = [error.stdout, error.stderr].filter(Boolean).join("\n").trim();
  if (output) {
    console.error(`ESLint found problems in ${filePath} after auto-fix:\n${output}`);
  } else if (error.message) {
    console.error(`Could not run ESLint on ${filePath}: ${error.message}`);
  }
  process.exit(2);
}
