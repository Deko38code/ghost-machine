// Tiny static file server — no deps
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = parseInt(process.env.PORT || '8213', 10);
const root = __dirname;
const mime = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.json':'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(root, path.resolve(p).replace(/^(\.\.[\/\\])+/, ''));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/plain'}); return res.end('not found'); }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(PORT, () => console.log(`mockminer http://localhost:${PORT}`));
