importScripts("config.js");
const MAX_HISTORY = 100;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'GENERATE_REPLY') return;
  (async () => {
    const { enabled = true } = await chrome.storage.local.get('enabled');
    if (!enabled) throw new Error('ReplyFlow is turned off.');
    const webhookUrl = REPLYFLOW_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.includes('YOUR-N8N-DOMAIN')) throw new Error('Webhook URL has not been configured in config.js.');
    const url = new URL(webhookUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid webhook URL.');
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Use an HTTPS webhook URL.');
    const response = await fetch(url.toString(), {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(message.payload), signal: AbortSignal.timeout(45000)
    });
    if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}`);
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;
    const reply = result?.reply ?? result?.output?.reply ?? result?.output ?? result?.text;
    if (typeof reply !== 'string' || !reply.trim()) throw new Error('Webhook must return JSON with a nonempty "reply" string.');
    const item = { id: crypto.randomUUID(), ...message.payload, reply: reply.trim(), createdAt: new Date().toISOString(), status: 'drafted' };
    const { history = [] } = await chrome.storage.local.get('history');
    await chrome.storage.local.set({history: [item, ...history].slice(0, MAX_HISTORY)});
    return { reply: item.reply, id: item.id };
  })().then(sendResponse).catch(e => sendResponse({error: e.message}));
  return true;
});
