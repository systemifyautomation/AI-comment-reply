const toggle = document.getElementById('enabled');
const toggleLabel = document.getElementById('toggle-label');
const userSummary = document.getElementById('user-summary');
const emailForm = document.getElementById('email-form');
const codeForm = document.getElementById('code-form');
const emailInput = document.getElementById('email');
const codeInput = document.getElementById('code');
const status = document.getElementById('status');
const verificationSection = document.getElementById('verification-section');
const accountsSection = document.getElementById('accounts-section');
const accountSelect = document.getElementById('account-select');
const accountConfirm = document.getElementById('account-confirm');
const manualForm = document.getElementById('manual-form');
const manualComment = document.getElementById('manual-comment');
const manualGenerate = document.getElementById('manual-generate');
const manualStatus = document.getElementById('manual-status');
const manualResult = document.getElementById('manual-result');
const manualReply = document.getElementById('manual-reply');
const manualToggle = document.getElementById('manual-toggle');
const manualContent = document.getElementById('manual-content');

let confirmedAccountId = '';

function showTab(name) {
  document.querySelectorAll('.tab').forEach(tab => {
    const selected = tab.dataset.tab === name;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== `${name}-tab`));
}
function showStatus(message, isError = false) { status.textContent = message; status.classList.toggle('danger', isError); }
function showManualStatus(message, isError = false) { manualStatus.textContent = message; manualStatus.classList.toggle('danger', isError); }
function accountId(account) { return String(typeof account === 'string' ? account : account?.id ?? account?.accountId ?? account?.value ?? ''); }
function accountName(account) { return typeof account === 'string' ? account : account?.name ?? account?.clientName ?? account?.title ?? accountId(account); }
function showUser(user) { userSummary.textContent = user?.accountName ? `${user.email} - ${user.accountName}` : user?.email || 'Email verification required'; }
function setVerificationState(isVerified) { verificationSection.classList.toggle('hidden', isVerified); }

function renderClients(accounts, selectedId = '') {
  confirmedAccountId = selectedId;
  accountSelect.replaceChildren();
  accountsSection.classList.remove('hidden');
  if (!accounts.length) {
    accountSelect.add(new Option('No clients are linked to this email', ''));
    accountSelect.disabled = true;
    accountConfirm.classList.add('hidden');
    return;
  }
  if (accounts.length > 1) accountSelect.add(new Option('Choose a client', ''));
  for (const account of accounts) accountSelect.add(new Option(accountName(account), accountId(account)));
  accountSelect.value = selectedId;
  accountSelect.disabled = accounts.length === 1;
  accountConfirm.classList.toggle('hidden', accounts.length === 1);
  accountConfirm.disabled = !accountSelect.value || accountSelect.value === confirmedAccountId;
}
async function send(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response?.error) throw new Error(response.error);
  return response;
}

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
manualToggle.addEventListener('click', () => {
  const willOpen = manualContent.classList.contains('hidden');
  manualContent.classList.toggle('hidden', !willOpen);
  manualToggle.setAttribute('aria-expanded', String(willOpen));
  manualToggle.classList.toggle('expanded', willOpen);
});
toggle.addEventListener('change', async () => {
  await chrome.storage.local.set({enabled: toggle.checked});
  toggleLabel.textContent = toggle.checked ? 'On' : 'Off';
});
accountSelect.addEventListener('change', () => {
  accountConfirm.disabled = !accountSelect.value || accountSelect.value === confirmedAccountId;
  if (accountSelect.value && accountSelect.value !== confirmedAccountId) showStatus('Confirm this client before generating replies.');
});
accountConfirm.addEventListener('click', async () => {
  try {
    showStatus('Confirming client...');
    const {user} = await send({type: 'SELECT_ACCOUNT', accountId: accountSelect.value});
    showUser(user);
    renderClients(user.accounts || [], user.accountId);
    showStatus(`Client confirmed: ${user.accountName}.`);
  } catch (error) { showStatus(error.message, true); }
});
manualForm.addEventListener('submit', async event => {
  event.preventDefault();
  const comment = manualComment.value.trim();
  if (!comment) { showManualStatus('Paste a comment before generating a reply.', true); return; }
  manualGenerate.disabled = true;
  manualGenerate.textContent = 'Generating...';
  manualResult.classList.add('hidden');
  showManualStatus('');
  try {
    const response = await send({type: 'GENERATE_REPLY', payload: {comment, videoUrl: 'manual://replyflow', videoTitle: 'Manual reply', channelID: 'manual', actorID: 'manual'}});
    manualReply.value = response.reply;
    manualResult.classList.remove('hidden');
    showManualStatus('Draft generated. Copy it when you are ready.');
  } catch (error) { showManualStatus(error.message || 'Request failed.', true); }
  finally { manualGenerate.disabled = false; manualGenerate.textContent = 'Generate reply'; }
});
document.getElementById('manual-copy').addEventListener('click', async event => {
  try { await navigator.clipboard.writeText(manualReply.value); event.target.textContent = 'Copied!'; }
  catch (error) { showManualStatus(`Could not copy the reply: ${error.message}`, true); }
});
emailForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    showStatus('Sending verification code...');
    await send({type: 'REQUEST_CODE', email: emailInput.value});
    codeForm.classList.remove('hidden');
    codeInput.focus();
    showStatus('Check your email, then enter the code below.');
  } catch (error) { showStatus(error.message, true); }
});
codeForm.addEventListener('submit', async event => {
  event.preventDefault();
  try {
    showStatus('Verifying code...');
    const {user} = await send({type: 'VERIFY_CODE', code: codeInput.value});
    showUser(user);
    renderClients(user.accounts || [], user.accountId);
    setVerificationState(true);
    codeForm.classList.add('hidden');
    codeInput.value = '';
    showStatus(user.accountId ? `Verified as ${user.email}.` : 'Verified. Choose and confirm a client.');
  } catch (error) { showStatus(error.message, true); }
});
document.getElementById('refresh-accounts').addEventListener('click', async () => {
  try {
    showStatus('Refreshing clients...');
    const {user} = await send({type: 'GET_ACCOUNTS'});
    showUser(user);
    renderClients(user.accounts || [], user.accountId);
    showStatus('Clients updated.');
  } catch (error) { showStatus(error.message, true); }
});
document.getElementById('reset-app').addEventListener('click', async () => {
  try {
    await send({type: 'RESET_APP'});
    confirmedAccountId = '';
    emailForm.reset();
    codeForm.reset();
    codeForm.classList.add('hidden');
    accountsSection.classList.add('hidden');
    accountSelect.replaceChildren();
    setVerificationState(false);
    showUser(null);
    showStatus('ReplyFlow data has been cleared.');
    document.getElementById('history').innerHTML = '<div class="empty"><div class="empty-symbol">*</div><strong>No replies yet</strong>Open a supported platform, click Reply on a comment, then Generate Reply.</div>';
    document.getElementById('count').textContent = '0';
  } catch (error) { showStatus(error.message, true); }
});

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
async function restoreState() {
  const {enabled = true, user, pendingEmail = '', history = []} = await chrome.storage.local.get({enabled: true, user: null, pendingEmail: '', history: []});
  toggle.checked = enabled;
  toggleLabel.textContent = enabled ? 'On' : 'Off';
  if (user?.email) {
    emailInput.value = user.email;
    showUser(user);
    renderClients(user.accounts || [], user.accountId);
    setVerificationState(true);
    showStatus(user.accountId ? `Verified as ${user.email}.` : 'Choose and confirm a client.');
  } else if (pendingEmail) {
    emailInput.value = pendingEmail;
    codeForm.classList.remove('hidden');
    showStatus('Enter the code sent to your email.');
  } else {
    setVerificationState(false);
  }
  document.getElementById('count').textContent = history.length;
  const target = document.getElementById('history');
  if (!history.length) {
    target.innerHTML = '<div class="empty"><div class="empty-symbol">*</div><strong>No replies yet</strong>Open a supported platform, click Reply on a comment, then Generate Reply.</div>';
    return;
  }
  for (const item of history.slice(0, 15)) {
    const node = document.createElement('article');
    node.className = 'item';
    const time = new Date(item.createdAt).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
    node.innerHTML = `<button class="item-summary" type="button" aria-expanded="false"><div class="item-top"><span class="pill">Draft</span><span class="time">${escapeHtml(time)}</span></div><p class="reply-preview">${escapeHtml(item.reply)}</p></button><div class="item-details hidden"><div class="detail-label">Comment</div><p class="snippet">${escapeHtml(item.comment)}</p><div class="detail-label">Generated reply</div><p class="answer">${escapeHtml(item.reply)}</p><div class="item-actions"><button class="link copy" type="button">Copy reply</button><a class="source-icon" target="_blank" rel="noopener noreferrer" href="${escapeHtml(item.videoUrl)}" aria-label="View source" title="View source"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9 2h5v5M14 2 7 9M13 9v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg></a></div></div>`;
    const summary = node.querySelector('.item-summary');
    const details = node.querySelector('.item-details');
    summary.addEventListener('click', () => {
      const expanded = summary.getAttribute('aria-expanded') !== 'true';
      summary.setAttribute('aria-expanded', String(expanded));
      details.classList.toggle('hidden', !expanded);
      node.classList.toggle('expanded', expanded);
    });
    node.querySelector('.copy').addEventListener('click', async event => { await navigator.clipboard.writeText(item.reply); event.target.textContent = 'Copied!'; });
    target.append(node);
  }
}
restoreState();
