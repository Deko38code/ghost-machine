// ── services ────────────────────────────────────────────────────────────
// Every service we run, on this box and across the fleet, with a live probe.
program
  .command('services')
  .alias('ports')
  .description('List every service and port (this host + the fleet) with live health')
  .action(async () => {
    const net = require('net');
    const { execFile } = require('child_process');

    const SERVICES = [
      { host: '127.0.0.1',   port: 3579,  name: 'haksterAi server',      path: '/api/version' },
      { host: '127.0.0.1',   port: 4000,  name: 'phantom core',          path: '/' },
      { host: '127.0.0.1',   port: 8082,  name: 'claude-code-proxy',     path: '/' },
      { host: '127.0.0.1',   port: 5555,  name: 'miniforge',             path: '/' },
      { host: '127.0.0.1',   port: 8081,  name: 'cinevault',             path: '/' },
      { host: '127.0.0.1',   port: 11434, name: 'ollama relay',          path: '/api/tags' },
      { host: '127.0.0.1',   port: 5432,  name: 'postgres',              tcp: true },
      { host: '10.0.0.251',  port: 5006,  name: 'junkalot.co (Parrot)',  path: '/' },
      { host: '10.0.0.251',  port: 4199,  name: 'free-lanes (Parrot)',   path: '/health' },
      { host: '10.0.0.251',  port: 4000,  name: 'phantom (Parrot)',      path: '/' },
      { host: '10.0.0.251',  port: 5555,  name: 'miniforge (Parrot)',    path: '/' },
      { host: '10.0.0.131',  port: 3579,  name: 'haksterAi (Dell)',      path: '/api/version' },
      { host: '10.0.0.210',  port: 3579,  name: 'haksterAi (mint)',      path: '/api/version' },
    ];

    const probeTcp = (host, port, timeoutMs = 1200) => new Promise((resolve) => {
      const started = Date.now();
      const sock = net.connect({ host, port });
      const done = (up) => { try { sock.destroy(); } catch {} resolve({ up, ms: Date.now() - started }); };
      sock.setTimeout(timeoutMs);
      sock.once('connect', () => done(true));
      sock.once('timeout', () => done(false));
      sock.once('error', () => done(false));
    });

    const probeHttp = (host, port, p, timeoutMs = 1500) => new Promise((resolve) => {
      const started = Date.now();
      const mod = require('http');
      const req = mod.get({ host, port, path: p || '/', timeout: timeoutMs }, (res) => {
        res.resume();
        res.on('end', () => resolve({ up: res.statusCode < 500, code: res.statusCode, ms: Date.now() - started }));
      });
      req.on('timeout', () => { req.destroy(); resolve({ up: false, ms: Date.now() - started }); });
      req.on('error', () => resolve({ up: false, ms: Date.now() - started }));
    });

    console.log(`\n${C.cyan}Fleet services${C.reset}`);
    const results = await Promise.all(SERVICES.map(async (s) => {
      const r = s.tcp ? await probeTcp(s.host, s.port) : await probeHttp(s.host, s.port, s.path);
      return { ...s, ...r };
    }));
    for (const r of results) {
      const mark = r.up ? `${C.green}● up${C.reset}` : `${C.red}○ down${C.reset}`;
      const addr = `${r.host}:${String(r.port).padEnd(5)}`;
      const extra = r.code ? `${C.gray}HTTP ${r.code}${C.reset}` : `${C.gray}tcp${C.reset}`;
      const ms = r.up ? `${C.gray}${r.ms}ms${C.reset}` : `${C.gray}—${C.reset}`;
      console.log(`  ${mark}  ${addr} ${r.name.padEnd(24)} ${extra.padEnd(18)} ${ms}`);
    }

    // Local listeners, labelled where we know the port.
    const labels = { 3579: 'haksterAi', 4000: 'phantom', 4199: 'free-lanes', 5006: 'junkalot',
      5555: 'miniforge', 5556: 'miniforge-dev', 8081: 'cinevault', 8082: 'claude-code-proxy',
      11434: 'ollama', 5432: 'postgres', 3001: 'app 3001', 3002: 'app 3002', 8888: 'app 8888',
      9999: 'app 9999', 9050: 'tor-socks', 80: 'http', 22: 'ssh', 53: 'dns' };
    const listening = await new Promise((resolve) => {
      execFile('ss', ['-ltn'], { timeout: 4000 }, (err, stdout) => {
        if (err) return resolve([]);
        const ports = new Set();
        for (const line of String(stdout).split('\n').slice(1)) {
          const m = line.trim().split(/\s+/)[3];
          if (!m) continue;
          const port = Number(String(m).split(':').pop());
          if (port) ports.add(port);
        }
        resolve([...ports].sort((a, b) => a - b));
      });
    });
    console.log(`\n${C.cyan}Listening on this host${C.reset}`);
    if (!listening.length) {
      console.log(`  ${C.gray}(ss unavailable)${C.reset}`);
    } else {
      for (const port of listening) {
        console.log(`  ${C.green}●${C.reset} ${String(port).padEnd(6)} ${labels[port] ? labels[port] : `${C.gray}unmapped${C.reset}`}`);
      }
    }
    console.log();
  });

