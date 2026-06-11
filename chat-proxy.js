/**
 * BotDeck Chat Proxy
 * Runs on the VPS host and bridges Docker containers to the OpenClaw gateway
 * which is bound to loopback (127.0.0.1:18789) and not reachable from Docker.
 *
 * Install as a service: see README.md
 */

const http = require('http');
const fs = require('fs');

const CONFIG_PATH = process.env.OPENCLAW_CONFIG || '/root/.openclaw/openclaw.json';
const PORT = process.env.PROXY_PORT || 3002;
const GATEWAY_PORT = process.env.GATEWAY_PORT || 18789;

let OPENCLAW_TOKEN;
try {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  OPENCLAW_TOKEN = config.gateway?.auth?.token;
  if (!OPENCLAW_TOKEN) throw new Error('No token found');
  console.log(`Chat proxy: loaded token from ${CONFIG_PATH}`);
} catch (e) {
  console.error(`Chat proxy: failed to load token: ${e.message}`);
  process.exit(1);
}

http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    const options = {
      hostname: '127.0.0.1',
      port: GATEWAY_PORT,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const proxy = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
      proxyRes.pipe(res);
    });

    proxy.on('error', (e) => {
      console.error('Proxy error:', e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Gateway unreachable', detail: e.message }));
    });

    proxy.write(body);
    proxy.end();
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`BotDeck chat proxy listening on port ${PORT}`);
  console.log(`Forwarding to OpenClaw gateway on 127.0.0.1:${GATEWAY_PORT}`);
});
