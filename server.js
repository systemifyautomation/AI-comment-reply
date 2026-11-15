const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadEnv(path.join(__dirname, '.env'));
const n8nUrl = process.env.REPLYFLOW_N8N_URL;
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean));
if (!n8nUrl) throw new Error('REPLYFLOW_N8N_URL is required in .env');

let n8nBaseUrl;
try {
  n8nBaseUrl = new URL(n8nUrl);
  if (!['https:', 'http:'].includes(n8nBaseUrl.protocol)) throw new Error('Unsupported protocol');
} catch {
  throw new Error('REPLYFLOW_N8N_URL must be a valid HTTP(S) URL.');
}
function n8nWebhook(pathname) { return new URL(`/webhook/${pathname}`, n8nBaseUrl); }
const replyWebhookUrl = n8nWebhook('replyflow');
const authWebhookUrl = n8nWebhook('replyflow-email-verification');
const accountsWebhookUrl = n8nWebhook('replyflow-accounts');

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 100_000) throw new Error('Request body is too large.');
  }
  return JSON.parse(body || '{}');
}

async function forward(res, url, method, body) {
  const response = await fetch(url, {
    method,
    headers: method === 'POST' ? {'Content-Type': 'application/json'} : undefined,
    body: method === 'POST' ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45_000)
  });
  const responseBody = await response.text();
  res.writeHead(response.status, {'Content-Type': response.headers.get('content-type') || 'application/json'}).end(responseBody);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.size && (!origin || !allowedOrigins.has(origin))) return res.writeHead(403).end('Origin is not allowed.');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && requestUrl.pathname === '/reply') return await forward(res, replyWebhookUrl, 'POST', await readJson(req));
    if (req.method === 'POST' && requestUrl.pathname === '/auth/request-code') {
      const body = await readJson(req);
      return await forward(res, authWebhookUrl, 'POST', {...body, action: 'request_code'});
    }
    if (req.method === 'POST' && requestUrl.pathname === '/auth/verify-code') {
      const body = await readJson(req);
      return await forward(res, authWebhookUrl, 'POST', {...body, action: 'verify_code'});
    }
    if (req.method === 'GET' && requestUrl.pathname === '/accounts') {
      const email = requestUrl.searchParams.get('email');
      if (!email) return res.writeHead(400).end(JSON.stringify({error: 'email is required.'}));
      const webhookUrl = new URL(accountsWebhookUrl);
      webhookUrl.searchParams.set('email', email);
      return await forward(res, webhookUrl, 'GET');
    }
    res.writeHead(404).end();
  } catch (error) {
    res.writeHead(502, {'Content-Type': 'application/json'}).end(JSON.stringify({
      error: 'ReplyFlow relay could not complete the n8n request.',
      details: error.message
    }));
  }
});

server.listen(Number(process.env.PORT || 3000), () => console.log(`ReplyFlow relay listening on port ${process.env.PORT || 3000}`));
