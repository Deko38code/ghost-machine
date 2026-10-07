import chalk from "chalk";
import ora from "ora";
import { toolsAsOpenAiSchema, runTool } from "./tools/index.js";
import { buildSystemPrompt } from "./context.js";

export async function runAgent(task, cfg, cwd, onAssistantText) {
    const messages = [
        { role: "system", content: buildSystemPrompt(cwd) },
        { role: "user", content: task },
    ];
    for (let turn = 0; turn < cfg.maxTurns; turn++) {
        const spinner = ora({ text: "thinking…", color: "cyan" }).start();
        let res;
        try {
            res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${cfg.apiKey}`,
                },
                body: JSON.stringify({
                    model: cfg.model,
                    messages,
                    tools: toolsAsOpenAiSchema(),
                }),
            });
        }
        catch (err) {
            spinner.fail("request failed");
            throw err;
        }
        if (!res.ok) {
            spinner.fail(`API error ${res.status}`);
            const body = await res.text();
            throw new Error(`API error ${res.status}: ${body}`);
        }
        spinner.stop();
        const data = await res.json();
        const choice = data.choices?.[0];
        if (!choice)
            throw new Error("No choices returned from API");
        const message = choice.message;
        messages.push({
            role: "assistant",
            content: message.content ?? null,
            tool_calls: message.tool_calls,
        });
        if (message.content) {
            onAssistantText(message.content);
        }
        if (!message.tool_calls || message.tool_calls.length === 0) {
            // Done — no more tool calls requested.
            return;
        }
        for (const call of message.tool_calls) {
            const name = call.function.name;
            let args = {};
            try {
                args = JSON.parse(call.function.arguments || "{}");
            }
            catch {
                // leave args empty
            }
            const toolSpinner = ora({
                text: chalk.dim(`${name}(${truncateArgs(args)})`),
                color: "yellow",
            }).start();
            let result;
            try {
                result = await runTool(name, args, cwd);
                toolSpinner.succeed(chalk.dim(`${name}(${truncateArgs(args)})`));
            }
            catch (err) {
                result = `Error: ${err.message ?? String(err)}`;
                toolSpinner.fail(chalk.dim(`${name}(${truncateArgs(args)})`));
            }
            console.log(chalk.gray(indent(result.slice(0, 2000))));
            messages.push({
                role: "tool",
                tool_call_id: call.id,
                name,
                content: result,
            });
        }
    }
    onAssistantText("[hak] Reached max turns without finishing. Consider raising HAK_MAX_TURNS or narrowing the task.");
}
function truncateArgs(args) {
    const s = JSON.stringify(args);
    return s.length > 80 ? s.slice(0, 77) + "..." : s;
}
function indent(text) {
    return text
        .split("\n")
        .map((l) => "  " + l)
        .join("\n");
}