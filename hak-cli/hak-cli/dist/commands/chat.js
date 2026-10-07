import chalk from "chalk";
import ora from "ora";
import readline from "node:readline";
const DEFAULT_SERVER = process.env.HAK_SERVER || "http://localhost:3579";
async function apiFetch(path, opts) {
    const server = process.env.HAK_SERVER || DEFAULT_SERVER;
    const url = `${server}${path}`;
    const res = await fetch(url, {
        ...opts,
        headers: {
            "Content-Type": "application/json",
            ...(opts?.headers || {}),
        },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body}`);
    }
    return res;
}
/** Interactive streaming chat session */
export async function chatCommand(opts = {}) {
    const server = process.env.HAK_SERVER || DEFAULT_SERVER;
    const provider = opts.provider || "ollama";
    const model = opts.model || "llama3.2";
    // Create or resume session
    let sessionId = opts.session;
    if (!sessionId) {
        const res = await apiFetch("/api/sessions", {
            method: "POST",
            body: JSON.stringify({ provider, model, title: "CLI Chat" }),
        });
        const data = await res.json();
        sessionId = data.id;
    }
    console.log(chalk.bold.cyan("hak chat") +
        chalk.dim(`  server=${server}  session=${sessionId?.slice(0, 8)}…`));
    console.log(chalk.dim(`provider=${provider}  model=${model}  type /exit to quit\n`));
    const messages = [];
    // Load existing session messages
    if (opts.session) {
        try {
            const res = await apiFetch(`/api/sessions/${opts.session}`);
            const data = await res.json();
            messages.push(...(data.messages || []));
            console.log(chalk.dim(`Restored ${messages.length} messages\n`));
        }
        catch { }
    }
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    const ask = () => new Promise((resolve) => {
        rl.question(chalk.bold.green("› "), (answer) => resolve(answer));
    });
    while (true) {
        const input = await ask();
        if (!input)
            continue;
        const trimmed = input.trim();
        if (trimmed === "/exit" || trimmed === "/quit")
            break;
        if (trimmed === "/clear") {
            console.clear();
            continue;
        }
        messages.push({ role: "user", content: trimmed });
        const spinner = ora({ text: "thinking…", color: "cyan" }).start();
        try {
            const res = await fetch(`${server}/api/chat/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    provider,
                    model,
                    messages,
                    sessionId,
                }),
            });
            if (!res.ok) {
                spinner.fail(`Error ${res.status}`);
                const err = await res.text();
                console.error(chalk.red(err));
                continue;
            }
            spinner.stop();
            let fullContent = "";
            // Read SSE stream
            const reader = res.body?.getReader();
            if (reader) {
                const decoder = new TextDecoder();
                let buffer = "";
                process.stdout.write(chalk.cyan(""));
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";
                    for (const line of lines) {
                        if (!line.startsWith("data: "))
                            continue;
                        const payload = line.slice(6).trim();
                        if (!payload)
                            continue;
                        try {
                            const event = JSON.parse(payload);
                            if (event.type === "delta") {
                                process.stdout.write(event.content);
                                fullContent += event.content;
                            }
                            else if (event.type === "error") {
                                process.stdout.write(chalk.red(`\nError: ${event.error}`));
                            }
                        }
                        catch { }
                    }
                }
                process.stdout.write("\n\n");
            }
            else {
                // Fallback to non-streaming
                const data = await res.json();
                fullContent = data.content || data.response || JSON.stringify(data);
                console.log(chalk.cyan(fullContent));
            }
            messages.push({ role: "assistant", content: fullContent });
            // Persist assistant message
            apiFetch(`/api/sessions/${sessionId}/messages`, {
                method: "POST",
                body: JSON.stringify({ role: "assistant", content: fullContent, provider, model }),
            }).catch(() => { });
        }
        catch (err) {
            spinner.fail("request failed");
            console.error(chalk.red(err.message));
        }
    }
    rl.close();
    console.log(chalk.dim(`\nSession: ${sessionId}`));
    console.log(chalk.dim("bye 👋"));
}
/** One-shot: generate a spec from a description */
export async function specCommand(description, opts = {}) {
    const server = process.env.HAK_SERVER || DEFAULT_SERVER;
    const provider = opts.provider || "ollama";
    const model = opts.model || "llama3.2";
    const prompt = description.join(" ");
    const res = await fetch(`${server}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            provider,
            model,
            messages: [
                {
                    role: "system",
                    content: "You are a senior engineer writing a detailed specification. Output a clear, structured spec with sections: Overview, Requirements, API Design, Data Model, Edge Cases, and Testing Strategy. Be thorough and specific.",
                },
                { role: "user", content: `Write a spec for: ${prompt}` },
            ],
        }),
    });
    await streamResponse(res, "spec");
}
/** One-shot: fix a bug or error */
export async function fixCommand(input, opts = {}) {
    const server = process.env.HAK_SERVER || DEFAULT_SERVER;
    const provider = opts.provider || "ollama";
    const model = opts.model || "llama3.2";
    const prompt = input.join(" ");
    const res = await fetch(`${server}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            provider,
            model,
            messages: [
                {
                    role: "system",
                    content: "You are a debugging expert. Analyze errors and provide precise fixes with code. Always: 1) Identify root cause 2) Show the exact fix 3) Explain why it works. Output working code, not pseudocode.",
                },
                { role: "user", content: `Fix this: ${prompt}` },
            ],
        }),
    });
    await streamResponse(res, "fix");
}
/** One-shot: generate tests */
export async function testCommand(input, opts = {}) {
    const server = process.env.HAK_SERVER || DEFAULT_SERVER;
    const provider = opts.provider || "ollama";
    const model = opts.model || "llama3.2";
    const prompt = input.join(" ");
    const res = await fetch(`${server}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            provider,
            model,
            messages: [
                {
                    role: "system",
                    content: "You are a QA engineer writing comprehensive tests. Output complete, runnable test files. Cover: happy path, edge cases, error handling, and integration scenarios. Use appropriate testing framework (jest, pytest, etc).",
                },
                { role: "user", content: `Write tests for: ${prompt}` },
            ],
        }),
    });
    await streamResponse(res, "test");
}
async function streamResponse(res, label) {
    if (!res.ok) {
        const err = await res.text();
        console.error(chalk.red(`Error ${res.status}: ${err}`));
        return;
    }
    const reader = res.body?.getReader();
    if (!reader) {
        const data = await res.json();
        console.log(data.content || JSON.stringify(data));
        return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
            if (!line.startsWith("data: "))
                continue;
            const payload = line.slice(6).trim();
            if (!payload)
                continue;
            try {
                const event = JSON.parse(payload);
                if (event.type === "delta") {
                    process.stdout.write(event.content);
                }
                else if (event.type === "error") {
                    process.stdout.write(chalk.red(`\nError: ${event.error}`));
                }
            }
            catch { }
        }
    }
    process.stdout.write("\n");
}
