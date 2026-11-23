import io, sys, time
P = "/home/ghost/haksterAi/dev/build-history/lib/stability.cjs"
BAK = P + ".bak-probehang-20261121Z"
src = io.open(P, encoding="utf-8").read()
import shutil; shutil.copyfile(P, BAK)

old = """function httpOnce(url, timeout, headers) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const started = Date.now();
    const req = lib.get(url, { timeout, headers: headers || {} }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; if (body.length > 100000) res.destroy(); });
      res.on('end', () => resolve({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        ms: Date.now() - started,
        body,
        location: res.headers.location || null,
      }));
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, ms: Date.now() - started, error: 'timeout' }); });
    req.on('error', (e) => resolve({ ok: false, status: 0, ms: Date.now() - started, error: e.code || e.message }));
  });
}"""

new = """function httpOnce(url, timeout, headers) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const started = Date.now();
    // Every probe must settle exactly once. The old body cap called
    // res.destroy() and then waited for 'end', which never fires on a
    // destroyed stream — any page larger than 100 KB hung the whole
    // evaluation, so the applet sat on zeros (owner 2026-11-21: "its been
    // on zero"). Now truncation resolves immediately, the response socket is
    // closed, and a hard deadline settles the promise no matter what the
    // server or the socket does.
    let settled = false;
    let res = null;
    const done = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      try { if (res) res.destroy(); } catch (_) { /* already closed */ }
      try { req.destroy(); } catch (_) { /* already closed */ }
      resolve(value);
    };
    const req = lib.get(url, { timeout, headers: headers || {} }, (response) => {
      res = response;
      let body = '';
      const finish = (truncated) => done({
        ok: res.statusCode >= 200 && res.statusCode < 300,
        status: res.statusCode,
        ms: Date.now() - started,
        body,
        truncated: !!truncated,
        location: res.headers.location || null,
      });
      res.on('data', (c) => {
        if (settled) return;
        body += c;
        if (body.length > 100000) finish(true);
      });
      res.on('end', () => finish(false));
      res.on('close', () => finish(false));
      res.on('error', (e) => done({ ok: false, status: res.statusCode || 0, ms: Date.now() - started, error: e.code || e.message }));
    });
    const deadline = setTimeout(() => done({ ok: false, status: 0, ms: Date.now() - started, error: 'deadline' }), Number(timeout) > 0 ? Number(timeout) + 2000 : 10000);
    req.on('timeout', () => done({ ok: false, status: 0, ms: Date.now() - started, error: 'timeout' }));
    req.on('error', (e) => done({ ok: false, status: 0, ms: Date.now() - started, error: e.code || e.message }));
  });
}"""

if old not in src:
    sys.exit("FAIL anchor httpOnce")
src = src.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(src)
print("PATCHED", P)
