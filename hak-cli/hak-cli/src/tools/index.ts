import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (args: any, cwd: string) => Promise<string>;
}

function resolveSafe(cwd: string, p: string): string {
  const resolved = path.resolve(cwd, p);
  return resolved;
}

const readFileTool: ToolDef = {
  name: "read_file",
  description:
    "Read a text file's contents. Optionally limit to a line range for large files.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path, relative or absolute" },
      offset: { type: "number", description: "1-indexed start line (optional)" },
      limit: { type: "number", description: "Max number of lines to return (optional)" },
    },
    required: ["path"],
  },
  run: async (args, cwd) => {
    const full = resolveSafe(cwd, args.path);
    const content = fs.readFileSync(full, "utf8");
    const lines = content.split("\n");
    const offset = args.offset ? Math.max(1, args.offset) : 1;
    const limit = args.limit ?? lines.length;
    const slice = lines.slice(offset - 1, offset - 1 + limit);
    return slice.map((l, i) => `${offset + i}\t${l}`).join("\n");
  },
};

const writeFileTool: ToolDef = {
  name: "write_file",
  description:
    "Create or overwrite a file with the given content. Creates parent directories as needed.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      content: { type: "string" },
    },
    required: ["path", "content"],
  },
  run: async (args, cwd) => {
    const full = resolveSafe(cwd, args.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, args.content, "utf8");
    return `Wrote ${Buffer.byteLength(args.content, "utf8")} bytes to ${full}`;
  },
};

const editFileTool: ToolDef = {
  name: "edit_file",
  description:
    "Replace an exact, unique text match in a file with new text. Use this for precise, small edits instead of rewriting the whole file.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string" },
      old_text: { type: "string", description: "Exact text to find (must be unique in the file)" },
      new_text: { type: "string" },
    },
    required: ["path", "old_text", "new_text"],
  },
  run: async (args, cwd) => {
    const full = resolveSafe(cwd, args.path);
    const content = fs.readFileSync(full, "utf8");
    const count = content.split(args.old_text).length - 1;
    if (count === 0) {
      throw new Error("old_text not found in file");
    }
    if (count > 1) {
      throw new Error(
        `old_text matched ${count} times; it must be unique. Add more context.`
      );
    }
    const next = content.replace(args.old_text, args.new_text);
    fs.writeFileSync(full, next, "utf8");
    return `Edited ${full}`;
  },
};

const listDirTool: ToolDef = {
  name: "list_dir",
  description: "List files and subdirectories of a directory (non-recursive).",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Directory path, defaults to cwd" },
    },
  },
  run: async (args, cwd) => {
    const full = resolveSafe(cwd, args.path ?? ".");
    const entries = fs.readdirSync(full, { withFileTypes: true });
    return entries
      .map((e) => `${e.isDirectory() ? "d" : "-"} ${e.name}`)
      .join("\n");
  },
};

const execShellTool: ToolDef = {
  name: "exec_shell",
  description:
    "Run a shell command and return its stdout/stderr. Use for builds, tests, git, installs, etc.",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string" },
      timeout_ms: { type: "number", description: "Optional timeout in ms, default 60000" },
    },
    required: ["command"],
  },
  run: async (args, cwd) => {
    return new Promise((resolve, reject) => {
      execFile(
        "/bin/sh",
        ["-c", args.command],
        { cwd, timeout: args.timeout_ms ?? 60_000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const out = `stdout:\n${stdout}\nstderr:\n${stderr}`;
          if (err && (err as any).killed) {
            reject(new Error(`Command timed out.\n${out}`));
            return;
          }
          // Return output even on non-zero exit so the model can react to failures.
          resolve(`exit_code: ${err ? (err as any).code ?? 1 : 0}\n${out}`);
        }
      );
    });
  },
};

export const tools: ToolDef[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirTool,
  execShellTool,
];

export function toolsAsOpenAiSchema() {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

export async function runTool(name: string, args: any, cwd: string): Promise<string> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.run(args, cwd);
}
