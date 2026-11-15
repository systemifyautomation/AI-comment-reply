const toggle = document.getElementById('enabled');
const toggleLabel = document.getElementById('toggle-label');
const userSummary = document.getElementById('user-summary');
const emailForm = document.getElementById('email-form');
const codeForm = document.getElementById('code-form');
const emailInput = document.getElementById('email');
const codeInput = document.getElementById('code');
const status = document.getElementById('status');
const agentsSection = document.getElementById('agents-section');
const agentsList = document.getElementById('agents');
const manualForm = document.getElementById('manual-form');
const manualComment = document.getElementById('manual-comment');
const manualGenerate = document.getElementById('manual-generate');
const manualStatus = document.getElementById('manual-status');
const manualResult = document.getElementById('manual-result');
const manualReply = document.getElementById('manual-reply');
const manualToggle = document.getElementById('manual-toggle');
const manualContent = document.getElementById('manual-content');

function showTab(name) {
  document.querySelectorAll('.tab').forEach(tab => {
    const selected = tab.dataset.tab === name;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
  });
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('hidden', panel.id !== `${name}-tab`));
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('danger', isError);
}

function showManualStatus(message, isError = false) {
  manualStatus.textContent = message;
  manualStatus.classList.toggle('danger', isError);
}

function renderAgents(agents) {
  agentsList.replaceChildren();
  if (!agents.length) {
    const item = document.createElement('li');
    item.textContent = 'No agents are currently assigned to this account.';
    agentsList.append(item);
  } else {
    for (const agent of agents) {
      const item = document.createElement('li');
      item.textContent = typeof agent === 'string' ? agent : agent.name || agent.title || agent.id || JSON.stringify(agent);
      agentsList.append(item);
    }
  }
  agentsSection.classList.remove('hidden');
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

manualForm.addEventListener('submit', async event => {
  event.preventDefault();
  const comment = manualComment.value.trim();
  if (!comment) { showManualStatus('Paste a comment before generating a reply.', true); return; }
  manualGenerate.disabled = true;
  manualGenerate.textContent = 'Generating...';
  manualResult.classList.add('hidden');
  showManualStatus('');
  try {
    const response = await send({
      type: 'GENERATE_REPLY',
      payload: {
        comment,
        videoUrl: 'manual://replyflow',
        videoTitle: 'Manual reply',
        channelID: 'manual',
        videoChannelId: 'manual'
      }
    });
    manualReply.value = response.reply;
    manualResult.classList.remove('hidden');
    showManualStatus('Draft generated. Copy it when you are ready.');
  } catch (error) { showManualStatus(error.message || 'Request failed.', true); }
  finally { manualGenerate.disabled = false; manualGenerate.textContent = 'Generate reply'; }
});

document.getElementById('manual-copy').addEventListener('click', async event => {
  try {
    await navigator.clipboard.writeText(manualReply.value);
    event.target.textContent = 'Copied!';
  } catch (error) { showManualStatus(`Could not copy the reply: ${error.message}`, true); }
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
    userSummary.textContent = user.email;
    renderAgents(user.agents || []);
    codeForm.classList.add('hidden');
    codeInput.value = '';
    showStatus(`Verified as ${user.email}.`);
  } catch (error) { showStatus(error.message, true); }
});

document.getElementById('refresh-agents').addEventListener('click', async () => {
  try {
    showStatus('Refreshing agents...');
    const {agents} = await send({type: 'GET_AGENTS'});
    renderAgents(agents);
    showStatus('Agent access updated.');
  } catch (error) { showStatus(error.message, true); }
});

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

async function restoreState() {
  const {enabled = true, user, pendingEmail = '', history = []} = await chrome.storage.local.get({enabled: true, user: null, pendingEmail: '', history: []});
  toggle.checked = enabled;
  toggleLabel.textContent = enabled ? 'On' : 'Off';
  if (user?.email) {
    emailInput.value = user.email;
    userSummary.textContent = user.email;
    renderAgents(user.agents || []);
    showStatus(`Verified as ${user.email}.`);
  } else if (pendingEmail) {
    emailInput.value = pendingEmail;
    codeForm.classList.remove('hidden');
    showStatus('Enter the code sent to your email.');
  }

  document.getElementById('count').textContent = history.length;
  const target = document.getElementById('history');
  if (!history.length) {
    target.innerHTML = '<div class="empty"><div class="empty-symbol">*</div><strong>No replies yet</strong>Open a supported platform, click Reply on a comment, then Generate AI Reply.</div>';
    return;
  }
  for (const item of history.slice(0, 15)) {
    const node = document.createElement('article');
    node.className = 'item';
    const time = new Date(item.createdAt).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
    node.innerHTML = `<div class="item-top"><span class="pill">AI draft</span><span class="time">${escapeHtml(time)}</span></div><p class="snippet">${escapeHtml(item.comment).slice(0, 140)}</p><p class="answer">${escapeHtml(item.reply).slice(0, 230)}</p><div class="item-actions"><button class="link copy">Copy reply</button><a class="link" target="_blank" rel="noopener noreferrer" href="${escapeHtml(item.videoUrl)}">View source</a></div>`;
    node.querySelector('.copy').addEventListener('click', async event => { await navigator.clipboard.writeText(item.reply); event.target.textContent = 'Copied!'; });
    target.append(node);
  }
}

restoreState();
