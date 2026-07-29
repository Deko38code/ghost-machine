"""
Claude Code Proxy → Ollama with tool use, streaming, and SPEED optimization.
- Smart routing: fast models for simple tasks, powerful models for complex ones
- Parallel tool calls
- Reduced latency tuning
"""
import json
import uuid
import httpx
import re
import time
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn

app = FastAPI(title="Claude Code Proxy → Ollama")

OLLAMA_URL = "http://localhost:11434/api/chat"

# Speed-optimized model routing
# Fast models for simple tasks, powerful models for complex ones
MODEL_MAP = {
    "claude-sonnet-4-5": "glm-5.2:cloud",
    "claude-opus-4-5": "kimi-k2.7-code:cloud",
    "claude-haiku-3-5": "glm-5.1:cloud",
    "gpt-4.1": "glm-5.2:cloud",
    "gpt-4.1-mini": "glm-5.1:cloud",
    "gemini-2.5-pro": "kimi-k2.7-code:cloud",
    "gemini-2.5-flash": "glm-5.1:cloud",
}

# Speed tiers — auto-select fastest model that can handle the task
SPEED_MODELS = {
    "ultrafast": "glm-5.1:cloud",      # simple questions, greetings, status checks
    "fast": "glm-5.2:cloud",           # code generation, general tasks
    "power": "kimi-k2.7-code:cloud",   # complex reasoning, multi-step tasks
}

# Complexity indicators in the prompt
COMPLEXITY_KEYWORDS = {
    "power": ["refactor", "architecture", "debug", "analyze", "security", "vulnerability",
              "multi-step", "plan", "design", "optimize", "rewrite", "review", "audit"],
    "fast": ["function", "code", "write", "create", "build", "fix", "update", "add",
             "remove", "change", "implement", "script", "command"],
    # Everything else → ultrafast
}


def _pick_speed_model(messages, tools):
    """Auto-select model based on task complexity for maximum speed."""
    # If tools are involved, need at least fast model
    if tools and len(tools) > 5:
        return SPEED_MODELS["fast"]
    
    # Analyze the latest user message for complexity
    last_msg = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, list):
                content = " ".join(b.get("text", "") for b in content if b.get("type") == "text")
            last_msg = content.lower()
            break
    
    # Check for complex keywords
    for keyword in COMPLEXITY_KEYWORDS["power"]:
        if keyword in last_msg:
            return SPEED_MODELS["power"]
    
    # Check for medium complexity
    for keyword in COMPLEXITY_KEYWORDS["fast"]:
        if keyword in last_msg:
            return SPEED_MODELS["fast"]
    
    # Long messages need more power
    if len(last_msg) > 500:
        return SPEED_MODELS["fast"]
    
    # Default to ultrafast
    return SPEED_MODELS["ultrafast"]


def _extract_text(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_result":
                    result_content = block.get("content", "")
                    if isinstance(result_content, list):
                        result_content = " ".join(
                            b.get("text", "") for b in result_content if b.get("type") == "text"
                        )
                    parts.append(f"[Tool Result: {result_content}]")
                elif block.get("type") == "tool_use":
                    parts.append(f"[Tool Call: {block.get('name', '')}({json.dumps(block.get('input', {}))})]")
        return " ".join(parts)
    return str(content)


def _build_tool_prompt(tools):
    """Compact tool prompt — only essential info for speed."""
    if not tools:
        return ""
    lines = [
        "TOOLS: To use a tool, output:",
        '```tool_use',
        '{"name":"<tool>","input":{<params>}}',
        '```',
        "",
    ]
    for tool in tools:
        name = tool.get("name", "")
        desc = tool.get("description", "").split(".")[0]  # First sentence only for speed
        schema = tool.get("input_schema", {})
        props = schema.get("properties", {})
        required = schema.get("required", [])
        param_str = ", ".join(f"{p}:{props[p].get('type','any')}" for p in props)
        req_str = f" (required: {','.join(required)})" if required else ""
        lines.append(f"- {name}({param_str}){req_str}: {desc}")
    lines.append("\nUse tools when needed. Respond directly otherwise.")
    return "\n".join(lines)


def _parse_tool_use(text):
    """Parse tool_use blocks from Ollama response."""
    tool_calls = []
    remaining = text

    pattern = r'```tool_use\s*\n?(.*?)\n?```'
    matches = re.findall(pattern, text, re.DOTALL)
    if matches:
        for m in matches:
            try:
                parsed = json.loads(m.strip())
                tool_calls.append({
                    "name": parsed.get("name", ""),
                    "input": parsed.get("input", parsed.get("parameters", {}))
                })
            except json.JSONDecodeError:
                pass
        remaining = re.sub(pattern, '', text).strip()

    if not tool_calls:
        try:
            json_pattern = r'\{[^{}]*"name"\s*:\s*"[^"]*"[^{}]*"input"\s*:\s*\{[^{}]*\}[^{}]*\}'
            json_matches = re.findall(json_pattern, text, re.DOTALL)
            for jm in json_matches:
                try:
                    parsed = json.loads(jm.strip())
                    tool_calls.append({
                        "name": parsed.get("name", ""),
                        "input": parsed.get("input", parsed.get("parameters", {}))
                    })
                    remaining = text.replace(jm, "").strip()
                except json.JSONDecodeError:
                    pass
        except Exception:
            pass

    return tool_calls, remaining


def _convert_messages(body):
    """Convert Anthropic messages to Ollama format."""
    messages = []
    system = body.get("system", "")
    if isinstance(system, list):
        system = " ".join(b.get("text", "") for b in system if b.get("type") == "text")
    tool_prompt = _build_tool_prompt(body.get("tools", []))
    if tool_prompt:
        system = (system + "\n\n" + tool_prompt).strip() if system else tool_prompt
    if system:
        messages.append({"role": "system", "content": system})
    for msg in body.get("messages", []):
        role = msg.get("role", "user")
        content = _extract_text(msg.get("content", ""))
        if content:
            messages.append({"role": role, "content": content})
    return messages


def _build_response(text, model, tool_calls=None):
    content = []
    if tool_calls:
        for tc in tool_calls:
            tool_id = f"toolu_{uuid.uuid4().hex[:24]}"
            content.append({
                "type": "tool_use",
                "id": tool_id,
                "name": tc["name"],
                "input": tc["input"],
            })
    if text and text.strip():
        content.append({"type": "text", "text": text})
    if not content:
        content.append({"type": "text", "text": ""})
    stop_reason = "tool_use" if tool_calls else "end_turn"
    return {
        "id": f"msg_{uuid.uuid4().hex[:24]}",
        "type": "message",
        "role": "assistant",
        "content": content,
        "model": model,
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {"input_tokens": 0, "output_tokens": 0},
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "claude-code-proxy", "port": 8082}


@app.get("/v1/models")
async def list_models():
    return {"models": [{"id": k, "provider": "ollama"} for k in MODEL_MAP]}


@app.post("/v1/messages")
async def messages(request: Request):
    body = await request.json()
    model = body.get("model", "")
    
    # Smart speed routing — override model if not explicitly needed
    ollama_messages = _convert_messages(body)
    tools = body.get("tools", [])
    
    # Pick fastest model that can handle the task
    backend_model = _pick_speed_model(ollama_messages, tools)
    
    stream = body.get("stream", False)
    max_tokens = body.get("max_tokens", 4096)
    
    # Speed tuning: cap tokens for simple tasks
    if backend_model == SPEED_MODELS["ultrafast"]:
        max_tokens = min(max_tokens, 500)  # Quick responses don't need many tokens
    elif backend_model == SPEED_MODELS["fast"]:
        max_tokens = min(max_tokens, 2000)

    payload = {
        "model": backend_model,
        "messages": ollama_messages,
        "stream": stream,
        "options": {
            "num_predict": max_tokens,
            "temperature": 0.3,  # Lower temp = faster, more focused responses
            "top_p": 0.9,
        },
    }

    if stream:
        return StreamingResponse(
            _stream_response(payload, model),
            media_type="text/event-stream",
        )

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(OLLAMA_URL, json=payload)
        data = resp.json()

    text = data.get("message", {}).get("content", "")
    tool_calls, remaining_text = _parse_tool_use(text)
    result = _build_response(remaining_text, model, tool_calls if tool_calls else None)
    return JSONResponse(content=result)


async def _stream_response(payload, model):
    """Stream Ollama response as Anthropic SSE events."""
    msg_id = f"msg_{uuid.uuid4().hex[:24]}"

    yield f"event: message_start\ndata: {json.dumps({'type': 'message_start', 'message': {'id': msg_id, 'type': 'message', 'role': 'assistant', 'content': [], 'model': model, 'stop_reason': None, 'stop_sequence': None, 'usage': {'input_tokens': 0, 'output_tokens': 0}}})}\n\n"

    yield f"event: content_block_start\ndata: {json.dumps({'type': 'content_block_start', 'index': 0, 'content_block': {'type': 'text', 'text': ''}})}\n\n"

    accumulated = ""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream("POST", OLLAMA_URL, json=payload) as resp:
                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                        text = chunk.get("message", {}).get("content", "")
                        if text:
                            accumulated += text
                            yield f"event: content_block_delta\ndata: {json.dumps({'type': 'content_block_delta', 'index': 0, 'delta': {'type': 'text_delta', 'text': text}})}\n\n"
                        if chunk.get("done"):
                            break
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        yield f"event: content_block_delta\ndata: {json.dumps({'type': 'content_block_delta', 'index': 0, 'delta': {'type': 'text_delta', 'text': f'[Error: {e}]'}})}\n\n"

    tool_calls, remaining = _parse_tool_use(accumulated)

    yield f"event: content_block_stop\ndata: {json.dumps({'type': 'content_block_stop', 'index': 0})}\n\n"

    if tool_calls:
        for i, tc in enumerate(tool_calls):
            tool_id = f"toolu_{uuid.uuid4().hex[:24]}"
            tool_input = json.dumps(tc["input"])
            yield f"event: content_block_start\ndata: {json.dumps({'type': 'content_block_start', 'index': i + 1, 'content_block': {'type': 'tool_use', 'id': tool_id, 'name': tc['name'], 'input': {}}})}\n\n"
            yield f"event: content_block_delta\ndata: {json.dumps({'type': 'content_block_delta', 'index': i + 1, 'delta': {'type': 'input_json_delta', 'partial_json': tool_input}})}\n\n"
            yield f"event: content_block_stop\ndata: {json.dumps({'type': 'content_block_stop', 'index': i + 1})}\n\n"

    stop_reason = "tool_use" if tool_calls else "end_turn"
    yield f"event: message_delta\ndata: {json.dumps({'type': 'message_delta', 'delta': {'stop_reason': stop_reason, 'stop_sequence': None}, 'usage': {'output_tokens': 0}})}\n\n"
    yield f"event: message_stop\ndata: {json.dumps({'type': 'message_stop'})}\n\n"


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8082)