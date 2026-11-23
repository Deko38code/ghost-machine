#!/usr/bin/env python3
"""
Claude Code Proxy — Anthropic API -> free remote Ollama (deek) bridge.
Listens on 127.0.0.1:8082. Routes all claude models to the free Ollama box
at 10.0.0.251 with automatic fallback: deepseek-coder-v2:16b (deek) first,
kimi-k2.6:cloud as instant fallback while deek loads.
"""
import json, os, time, uuid, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

REMOTE = os.environ.get("DEEK_REMOTE", "http://10.0.0.251:11434/v1")
DEEK_MODEL = os.environ.get("DEEK_MODEL", "deepseek-coder-v2:16b")
FALLBACK_MODEL = os.environ.get("DEEK_FALLBACK", "kimi-k2.6:cloud")
PORT = int(os.environ.get("CLAUDE_PROXY_PORT", "8082"))
BACKEND_TIMEOUT = int(os.environ.get("DEEK_TIMEOUT", "45"))

# Anthropic model name -> ordered list of (base_url, upstream_model) to try
def chain():
    return [(REMOTE, DEEK_MODEL), (REMOTE, FALLBACK_MODEL)]

def anthropic_to_openai(data):
    messages = []
    for m in data.get("messages", []):
        role = m.get("role", "user")
        content = m.get("content", "")
        if isinstance(content, list):
            parts = []
            for c in content:
                if c.get("type") == "text":
                    parts.append(c.get("text", ""))
                elif c.get("type") == "tool_use":
                    parts.append(json.dumps(c.get("input", {})))
                elif c.get("type") == "tool_result":
                    rc = c.get("content", "")
                    if isinstance(rc, list):
                        rc = " ".join(x.get("text", "") for x in rc if isinstance(x, dict))
                    parts.append(str(rc))
            content = "\n".join(parts)
        messages.append({"role": role, "content": content})
    if data.get("system"):
        sys_c = data["system"]
        if isinstance(sys_c, list):
            sys_c = "\n".join(x.get("text", "") for x in sys_c if isinstance(x, dict))
        messages.insert(0, {"role": "system", "content": sys_c})
    return messages

def call_backend(base_url, model, messages, max_tokens, stream):
    url = base_url.rstrip("/") + "/chat/completions"
    body = {"model": model, "messages": messages, "max_tokens": max_tokens, "stream": stream}
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(req, timeout=BACKEND_TIMEOUT)

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path in ("/", "/health", "/v1/models"):
            self._json(200, {"ok": True, "service": "claude-code-proxy", "port": PORT,
                             "backend": REMOTE, "deek": DEEK_MODEL, "fallback": FALLBACK_MODEL})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if "/messages" not in self.path:
            return self._json(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception as e:
            return self._json(400, {"error": f"bad request: {e}"})

        model = data.get("model", "claude-sonnet-4-5")
        messages = anthropic_to_openai(data)
        max_tokens = min(int(data.get("max_tokens", 4096)), 16384)
        stream = bool(data.get("stream", False))

        resp = None
        last_err = None
        for base_url, up_model in chain():
            try:
                resp = call_backend(base_url, up_model, messages, max_tokens, stream)
                used_model = up_model
                break
            except Exception as e:
                last_err = e
                continue
        if resp is None:
            return self._json(502, {"error": f"all backends failed: {last_err}"})

        if not stream:
            try:
                out = json.loads(resp.read().decode())
                msg = out["choices"][0]["message"]
                text = msg.get("content") or ""
                if isinstance(text, list):
                    text = "".join(p.get("text", "") for p in text if isinstance(p, dict))
                if not text and msg.get("reasoning"):
                    text = msg["reasoning"]
                return self._json(200, {
                    "id": "msg_" + uuid.uuid4().hex[:24], "type": "message",
                    "role": "assistant", "model": model,
                    "content": [{"type": "text", "text": text}],
                    "stop_reason": "end_turn",
                    "usage": {"input_tokens": 0, "output_tokens": 0},
                })
            except Exception as e:
                return self._json(502, {"error": f"parse failed: {e}"})

        # Streaming: OpenAI SSE -> Anthropic SSE
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        msg_id = "msg_" + uuid.uuid4().hex[:24]
        def ev(t, d):
            self.wfile.write(f"event: {t}\ndata: {json.dumps(d)}\n\n".encode())
        try:
            ev("message_start", {"type": "message_start", "message": {"id": msg_id, "type": "message", "role": "assistant", "model": model, "content": [], "usage": {"input_tokens": 0, "output_tokens": 0}}})
            ev("content_block_start", {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}})
            for line in resp:
                line = line.decode("utf-8", "replace").strip()
                if not line.startswith("data: "):
                    continue
                payload = line[6:]
                if payload == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                except Exception:
                    continue
                delta = chunk.get("choices", [{}])[0].get("delta", {})
                text = delta.get("content", "")
                if text:
                    ev("content_block_delta", {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": text}})
            ev("content_block_stop", {"type": "content_block_stop", "index": 0})
            ev("message_delta", {"type": "message_delta", "delta": {"stop_reason": "end_turn"}, "usage": {"output_tokens": 0}})
            ev("message_stop", {"type": "message_stop"})
        except Exception:
            pass

def warm_deek():
    """Load the deek model into remote RAM so first real request is fast."""
    try:
        call_backend(REMOTE, DEEK_MODEL, [{"role": "user", "content": "hi"}], 5, False).read()
        print("deek warm")
    except Exception as e:
        print("deek warm failed:", e)

if __name__ == "__main__":
    import threading
    threading.Thread(target=warm_deek, daemon=True).start()
    srv = HTTPServer(("127.0.0.1", PORT), Handler)
    print(f"claude-code-proxy on 127.0.0.1:{PORT} -> {REMOTE} (deek={DEEK_MODEL}, fallback={FALLBACK_MODEL})")
    srv.serve_forever()
