#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";
import readline from "node:readline";
import { loadConfig, saveConfigValue, configPath } from "./config.js";
import { runAgent } from "./agent.js";
import { chatCommand, specCommand, fixCommand, testCommand } from "./commands/chat.js";

const VERSION = "1.0.0";

function banner(cfg: ReturnType<typeof loadConfig>, cwd: string) {
  const lines = [
    chalk.bold.cyan("hak") + chalk.dim(`  v${VERSION}`),
    "",
    chalk.dim("model  ") + cfg.model,
    chalk.dim("dir    ") + cwd,
    "",
    chalk.dim("type a task, or ") + chalk.yellow("/exit") + chalk.dim(" to quit"),
  ];
  console.log(
    boxen(lines.join("\n"), {
      padding: 1,
      margin: 1,
      borderColor: "cyan",
      borderStyle: "round",
    })
  );
}

async function interactive(cfg: ReturnType<typeof loadConfig>, cwd: string) {
  banner(cfg, cwd);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  rl.on("close", () => {
    closed = true;
  });
  const ask = (): Promise<string | null> =>
    new Promise((resolve) => {
      if (closed) {
        resolve(null);
        return;
      }
      rl.question(chalk.bold.green("› "), resolve);
    });

  while (true) {
    const input = await ask();
    if (input === null) break;
    const trimmed = input.trim();
    if (trimmed === "/exit" || trimmed === "/quit") break;
    if (trimmed === "/clear") {
      console.clear();
      banner(cfg, cwd);
      continue;
    }
    if (!trimmed) continue;

    try {
      await runAgent(trimmed, cfg, cwd, (text) => {
        console.log("\n" + chalk.cyanBright(text) + "\n");
      });
    } catch (err: any) {
      console.error(chalk.red(`✖ ${err.message ?? String(err)}`));
    }
  }
  if (!closed) rl.close();
  console.log(chalk.dim("bye 👋"));
}

const program = new Command();

program
  .name("hak")
  .description(
    "haksterAi CLI — agentic terminal coding assistant. Chat, spec, fix, and test."
  )
  .version(VERSION);

program
  .command("run <task...>")
  .description("Run a one-off agentic task and exit")
  .action(async (taskParts: string[]) => {
    const task = taskParts.join(" ");
    const cfg = loadConfig();
    const cwd = process.cwd();
    try {
      await runAgent(task, cfg, cwd, (text) => {
        console.log("\n" + chalk.cyanBright(text) + "\n");
      });
    } catch (err: any) {
      console.error(chalk.red(`✖ ${err.message ?? String(err)}`));
      process.exitCode = 1;
    }
  });

program
  .command("chat")
  .description("Start an interactive streaming chat session with the AI")
  .option("-s, --server <url>", "haksterAi server URL", process.env.HAK_SERVER || "http://localhost:3579")
  .option("-p, --provider <provider>", "AI provider (ollama, anthropic, openai, hermes)", "ollama")
  .option("-m, --model <model>", "Model name", "llama3.2")
  .option("--session <id>", "Resume an existing session ID")
  .action(async (opts) => {
    process.env.HAK_SERVER = opts.server;
    await chatCommand({
      provider: opts.provider,
      model: opts.model,
      session: opts.session,
    });
  });

program
  .command("spec <description...>")
  .description("Generate a detailed specification from a description")
  .option("-s, --server <url>", "haksterAi server URL", process.env.HAK_SERVER || "http://localhost:3579")
  .option("-p, --provider <provider>", "AI provider", "ollama")
  .option("-m, --model <model>", "Model name", "llama3.2")
  .action(async (desc: string[], opts) => {
    process.env.HAK_SERVER = opts.server;
    await specCommand(desc, { provider: opts.provider, model: opts.model });
  });

program
  .command("fix <input...>")
  .description("Paste an error or bug description — get a fix")
  .option("-s, --server <url>", "haksterAi server URL", process.env.HAK_SERVER || "http://localhost:3579")
  .option("-p, --provider <provider>", "AI provider", "ollama")
  .option("-m, --model <model>", "Model name", "llama3.2")
  .action(async (input: string[], opts) => {
    process.env.HAK_SERVER = opts.server;
    await fixCommand(input, { provider: opts.provider, model: opts.model });
  });

program
  .command("test <target...>")
  .description("Generate comprehensive tests for a description or file path")
  .option("-s, --server <url>", "haksterAi server URL", process.env.HAK_SERVER || "http://localhost:3579")
  .option("-p, --provider <provider>", "AI provider", "ollama")
  .option("-m, --model <model>", "Model name", "llama3.2")
  .action(async (target: string[], opts) => {
    process.env.HAK_SERVER = opts.server;
    await testCommand(target, { provider: opts.provider, model: opts.model });
  });

const config = program.command("config").description("Manage hak configuration");

config
  .command("set <key> <value>")
  .description("Set a config value (baseUrl, apiKey, model, maxTurns)")
  .action((key: string, value: string) => {
    saveConfigValue(key as any, value);
    console.log(`Saved ${key} to ${configPath()}`);
  });

config
  .command("show")
  .description("Show current effective config (redacts apiKey)")
  .action(() => {
    const cfg = loadConfig();
    console.log(
      JSON.stringify(
        { ...cfg, apiKey: cfg.apiKey ? cfg.apiKey.slice(0, 6) + "…" : "(none)" },
        null,
        2
      )
    );
  });

// If invoked with no subcommand (just `hak`), launch interactive agent
const knownSubcommands = new Set(["run", "chat", "spec", "fix", "test", "config", "help"]);
const firstArg = process.argv[2];

if (!firstArg || (!knownSubcommands.has(firstArg) && !firstArg.startsWith("-"))) {
  const cfg = loadConfig();
  const cwd = process.cwd();
  interactive(cfg, cwd);
} else {
  program.parseAsync(process.argv);
}