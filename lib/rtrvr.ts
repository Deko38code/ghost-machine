/**
 * rtrvr.ai web agent API — server-side only.
 *
 * Two one-shot HTTPS calls, no SDK and no headless browser to run:
 *   - runAgent(): a plain-English instruction carried out in a real cloud
 *     browser (it can click, search, paginate and fill forms)
 *   - scrape():   the raw text of pages, for feeding an LLM or a RAG index
 *
 * The key is read only from process.env.RTRVR_API_KEY. Never import this
 * module from browser code, and never log or print the key.
 */

export const RTRVR_API_BASE = "https://api.rtrvr.ai";

/** Response of POST /agent. The answer is `result.text`, or `result.json` when a schema was sent. */
export interface RtrvrAgentResponse {
  result?: {
    text?: string;
    json?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** One tab of POST /scrape, in the same order as the `urls` passed in. */
export interface RtrvrScrapeTab {
  url: string;
  title?: string;
  status: "success" | "error";
  content?: string;
  error?: string;
  [key: string]: unknown;
}

export interface RtrvrScrapeResponse {
  tabs?: RtrvrScrapeTab[];
  [key: string]: unknown;
}

export interface RunAgentOptions {
  /** Starting pages for the agent. */
  urls?: string[];
  /** JSON Schema the answer must match; the answer then arrives in `result.json`. */
  schema?: object;
}

function apiKey(): string {
  const key = process.env.RTRVR_API_KEY;
  if (!key) {
    throw new Error(
      "RTRVR_API_KEY is not set. Add it to your server environment (see .env.example)."
    );
  }
  return key;
}

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const res = await fetch(`${RTRVR_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`rtrvr.ai ${path} failed: HTTP ${res.status} ${text}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/**
 * Run a plain-English instruction in a real cloud browser and return the
 * parsed JSON. A run can take a minute or more, so call it from a script,
 * cron job, worker or background job — not inline in a user-facing request.
 */
export async function runAgent(
  input: string,
  options?: RunAgentOptions
): Promise<RtrvrAgentResponse> {
  return post<RtrvrAgentResponse>(
    "/agent",
    {
      input,
      urls: options?.urls,
      schema: options?.schema,
      response: { verbosity: "final" },
    },
    300_000
  );
}

/**
 * Return the raw text of pages. Cheaper than an agent run: it spends only
 * browser and proxy credits. `tabs` follows the order of `urls`.
 */
export async function scrape(urls: string[]): Promise<RtrvrScrapeResponse> {
  return post<RtrvrScrapeResponse>(
    "/scrape",
    { urls, settings: { extractionConfig: { onlyTextContent: true } } },
    120_000
  );
}
