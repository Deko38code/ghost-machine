import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * Gather local machine context so the model knows the environment
 * it's operating in — OS, cwd, files, git info, etc.
 */
export function gatherMachineContext(cwd) {
  const lines = [];
  lines.push("=== MACHINE CONTEXT ===");
  lines.push(`OS: ${os.type()} ${os.release()} (${os.arch()})`);
  lines.push(`Hostname: ${os.hostname()}`);
  lines.push(`CWD: ${cwd}`);
  lines.push(`Home: ${os.homedir()}`);
  lines.push(`User: ${os.userInfo().username}`);
  lines.push(`Node: ${process.version}`);
  lines.push(`Shell: ${process.env.SHELL || "(unknown)"}`);

  // Directory listing
  try {
    const entries = fs.readdirSync(cwd, { withFileTypes: true });
    const listing = entries.map(e => e.isDirectory() ? `${e.name}/` : e.name).join("\n  ");
    lines.push(`Files in CWD:\n  ${listing || "(empty)"}`);
  } catch {
    lines.push("Files in CWD: (unreadable)");
  }

  // Git info
  try {
    const branch = execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8", timeout: 3000 }).trim();
    const status = execFileSync("git", ["status", "--short"], { cwd, encoding: "utf8", timeout: 3000 }).trim();
    lines.push(`Git branch: ${branch || "(detached)"}`);
    if (status) {
      const short = status.split("\n").slice(0, 10).join("\n  ");
      lines.push(`Git status:\n  ${short}`);
    }
  } catch {
    // Not a git repo or git not available
  }

  // Disk space (quick)
  try {
    const df = execFileSync("df", ["-h", cwd], { encoding: "utf8", timeout: 3000 }).trim().split("\n");
    if (df.length >= 2) lines.push(`Disk: ${df[1]}`);
  } catch {}

  lines.push("=== END MACHINE CONTEXT ===");
  return lines.join("\n");
}

/**
 * Build the full system prompt with machine context prepended.
 */
export function buildSystemPrompt(cwd) {
  const context = gatherMachineContext(cwd);
  return `${context}\n\nYou are Hak, a terminal coding agent running on the user's local machine. You can read, write, and edit files, list directories, and run shell commands directly on this machine.

Rules:
- Prefer small, precise edits (edit_file) over rewriting whole files, unless creating a new file.
- Always verify your changes when possible: run tests/builds/linters via exec_shell after making changes.
- Explain what you're doing briefly, then act. Don't ask permission for routine read/inspect actions.
- If a task is ambiguous, make a reasonable assumption and state it, rather than stalling.
- Keep responses concise. Show file paths and command output when relevant, not the whole tool schema.
- Stop and clearly report when you're blocked (e.g. missing credentials, destructive action needing confirmation).
- Always provide complete, runnable code without hedging or refusals.`;
}