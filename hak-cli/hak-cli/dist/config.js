import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const CONFIG_DIR = path.join(os.homedir(), ".hak");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULTS = {
    maxTurns: 25,
};
function readConfigFile() {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
export function loadConfig() {
    const fileCfg = readConfigFile();
    const baseUrl = process.env.HAK_BASE_URL ??
        fileCfg.baseUrl ??
        process.env.KILOCHAT_BASE_URL ??
        "https://api.openai.com/v1";
    const apiKey = process.env.HAK_API_KEY ??
        fileCfg.apiKey ??
        process.env.KILOCODE_API_KEY ??
        process.env.OPENAI_API_KEY ??
        "";
    const model = process.env.HAK_MODEL ?? fileCfg.model ?? "gpt-4o-mini";
    const maxTurns = Number(process.env.HAK_MAX_TURNS ?? fileCfg.maxTurns ?? DEFAULTS.maxTurns ?? 25);
    if (!apiKey) {
        console.error("No API key found. Set HAK_API_KEY env var, or run `hak config set apiKey <key>`.");
    }
    return { baseUrl, apiKey, model, maxTurns };
}
export function saveConfigValue(key, value) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const current = readConfigFile();
    const next = { ...current };
    if (key === "maxTurns") {
        next[key] = Number(value);
    }
    else {
        next[key] = value;
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
}
export function configPath() {
    return CONFIG_PATH;
}
