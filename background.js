const MAX_HISTORY = 100;

async function relayUrl(pathname) {
  const {proxyUrl = ''} = await chrome.storage.managed.get({proxyUrl: ''});
  if (!proxyUrl) throw new Error('ReplyFlow proxy URL has not been configured by your administrator.');
  const replyUrl = new URL(proxyUrl);
  if (!['https:', 'http:'].includes(replyUrl.protocol)) throw new Error('Invalid proxy URL.');
  if (replyUrl.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(replyUrl.hostname)) throw new Error('Use an HTTPS proxy URL.');
  return new URL(pathname, replyUrl.origin);
}

function n8nErrorDetails(data) {
  const result = Array.isArray(data) ? data[0] : data;
  const candidates = [result?.error?.message, result?.error?.description, result?.error, result?.message, result?.description, result?.details, result?.output?.error, result?.output?.message, result?.json?.error, result?.json?.message];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 1500);
    if (candidate && typeof candidate === 'object') return JSON.stringify(candidate).slice(0, 1500);
  }
  return '';
}

async function relayRequest(pathname, {method = 'POST', body, email, accountId} = {}) {
  const url = await relayUrl(pathname);
  if (email) url.searchParams.set('email', email);
  if (accountId) url.searchParams.set('accountId', accountId);
  const response = await fetch(url, {method, headers: body ? {'Content-Type': 'application/json'} : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45_000)});
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = {message: text}; }
  if (!response.ok) throw new Error(`n8n request failed (${method} ${pathname}, HTTP ${response.status}): ${n8nErrorDetails(data) || 'No error details were returned by the webhook.'}`);
  return data;
}

function validEmail(email) { return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()); }
function verified(result) { return result?.verified === true || result?.success === true || result?.valid === true || result?.status === 'verified'; }
function normalizeAccounts(result) { const accounts = Array.isArray(result) ? result : result?.accounts ?? result?.employers ?? result?.data ?? []; return Array.isArray(accounts) ? accounts : []; }
function accountId(account) { return String(typeof account === 'string' ? account : account?.id ?? account?.accountId ?? account?.value ?? ''); }
function accountName(account) { return typeof account === 'string' ? account : account?.name ?? account?.clientName ?? account?.channelName ?? account?.pageName ?? account?.employerName ?? account?.title ?? accountId(account); }

async function accountsFor(email) { return normalizeAccounts(await relayRequest('/accounts', {method: 'GET', email})); }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'REQUEST_CODE') {
      const email = message.email?.trim().toLowerCase();
      if (!validEmail(email)) throw new Error('Enter a valid email address.');
      await relayRequest('/auth/request-code', {body: {email}});
      await chrome.storage.local.set({pendingEmail: email});
      return {email};
    }

    if (message.type === 'VERIFY_CODE') {
      const {pendingEmail = ''} = await chrome.storage.local.get('pendingEmail');
      const code = String(message.code || '').trim();
      if (!validEmail(pendingEmail)) throw new Error('Request a verification code first.');
      if (!code) throw new Error('Enter the verification code from your email.');
      const verification = await relayRequest('/auth/verify-code', {body: {email: pendingEmail, code}});
      const result = Array.isArray(verification) ? verification[0] : verification;
      if (!verified(result)) throw new Error(n8nErrorDetails(result) || 'That verification code is not valid.');
      const accounts = await accountsFor(pendingEmail);
      const selected = accounts.length === 1 ? accounts[0] : null;
      const user = {email: pendingEmail, verifiedAt: new Date().toISOString(), accounts, accountId: selected ? accountId(selected) : '', accountName: selected ? accountName(selected) : ''};
      await chrome.storage.local.set({user, pendingEmail: ''});
      return {user};
    }

    if (message.type === 'GET_ACCOUNTS') {
      const {user} = await chrome.storage.local.get('user');
      if (!validEmail(user?.email)) throw new Error('Verify your email to see available clients.');
      const accounts = await accountsFor(user.email);
      const stillSelected = accounts.find(account => accountId(account) === user.accountId) || (accounts.length === 1 ? accounts[0] : null);
      const {agents: ignoredAgents, ...userWithoutAgents} = user;
      const nextUser = {...userWithoutAgents, accounts, accountId: stillSelected ? accountId(stillSelected) : '', accountName: stillSelected ? accountName(stillSelected) : ''};
      await chrome.storage.local.set({user: nextUser});
      return {user: nextUser};
    }

    if (message.type === 'SELECT_ACCOUNT') {
      const {user} = await chrome.storage.local.get('user');
      const selected = user?.accounts?.find(account => accountId(account) === String(message.accountId || ''));
      if (!selected) throw new Error('Choose a client from the available list.');
      const {agents: ignoredAgents, ...userWithoutAgents} = user;
      const nextUser = {...userWithoutAgents, accountId: accountId(selected), accountName: accountName(selected)};
      await chrome.storage.local.set({user: nextUser});
      return {user: nextUser};
    }

    if (message.type === 'GENERATE_REPLY') {
      const {enabled = true, user} = await chrome.storage.local.get(['enabled', 'user']);
      if (!enabled) throw new Error('ReplyFlow is turned off.');
      if (!validEmail(user?.email)) throw new Error('Verify your email in ReplyFlow settings before generating replies.');
      if (!user.accountId) throw new Error('Select and confirm a client in ReplyFlow settings before generating replies.');
      const response = await relayRequest('/reply', {body: {...message.payload, email: user.email, accountId: user.accountId}});
      const result = Array.isArray(response) ? response[0] : response;
      const reply = result?.reply ?? result?.output?.reply ?? result?.output ?? result?.text;
      if (typeof reply !== 'string' || !reply.trim()) throw new Error(n8nErrorDetails(result) ? `n8n returned an error: ${n8nErrorDetails(result)}` : 'Webhook must return JSON with a nonempty "reply" string.');
      const item = {id: crypto.randomUUID(), ...message.payload, email: user.email, accountId: user.accountId, reply: reply.trim(), createdAt: new Date().toISOString(), status: 'drafted'};
      const {history = []} = await chrome.storage.local.get('history');
      await chrome.storage.local.set({history: [item, ...history].slice(0, MAX_HISTORY)});
      return {reply: item.reply, id: item.id};
    }
  })().then(sendResponse).catch(error => sendResponse({error: error.message}));
  return true;
});
