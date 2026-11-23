/**
 * Server-only example of the rtrvr.ai web agent API.
 *
 * The developer's current website task is to study the Freebuff CLI so they can
 * build their own; this pulls the product facts off that page with one agent
 * run and a JSON Schema, instead of rendering and parsing the page by hand.
 *
 * Node 24 runs TypeScript directly, so no install and no build step. Supply the
 * key either way round:
 *
 *   RTRVR_API_KEY=... node scripts/rtrvr-agent.ts
 *   cp .env.example .env      # fill it in, then run the same command
 *   RTRVR_API_KEY=... node scripts/rtrvr-agent.ts https://freebuff.com/desktop
 *
 * A run can take a minute or more: keep it in a script, cron job or worker,
 * never inline in a user-facing request.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { runAgent } from "../lib/rtrvr.ts";

/**
 * Read a `.env` sitting beside the repo root, if there is one.
 *
 * `.env.example` is a template a user is expected to copy to `.env`, and that
 * only means anything if something reads it. Nothing did, so a key filled in
 * there was ignored in silence while this script went on saying it was unset.
 * Node 24 has this built in, so it costs no dependency.
 *
 * `process.loadEnvFile` leaves variables that are already set alone, so
 * `RTRVR_API_KEY=... node scripts/rtrvr-agent.ts` still wins over the file. A
 * missing `.env` is deliberately not an error: the key check in lib/rtrvr.ts
 * explains what to do, which an ENOENT thrown from here would not.
 */
function loadDotEnv(): void {
  const envPath = fileURLToPath(new URL("../.env", import.meta.url));
  if (!existsSync(envPath)) return;
  process.loadEnvFile(envPath);
}

// At module load, so the key is in place before any request is built.
loadDotEnv();

/** JSON Schema matching the shape the caller expects back. */
const schema = {
  type: "object",
  properties: {
    product: {
      type: "object",
      properties: {
        name: { type: "string" },
        tagline: { type: "string" },
        installCommand: { type: "string" },
        features: { type: "array", items: { type: "string" } },
        models: { type: "array", items: { type: "string" } },
      },
      required: ["name", "tagline", "features"],
    },
  },
  required: ["product"],
};

const url = process.argv[2] ?? "https://freebuff.com/cli";

async function main() {
  const result = await runAgent(
    "Describe the CLI product on this page: its name, one-line tagline, the install command, its main features, and any AI models it lists.",
    { urls: [url], schema }
  );
  // With a schema the answer is in result.json; result.text is the fallback.
  console.log(JSON.stringify(result.result?.json ?? result.result?.text, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
