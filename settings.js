const emailForm = document.getElementById('email-form');
const codeForm = document.getElementById('code-form');
const emailInput = document.getElementById('email');
const codeInput = document.getElementById('code');
const status = document.getElementById('status');
const agentsSection = document.getElementById('agents-section');
const agentsList = document.getElementById('agents');
function showStatus(message, isError = false) { status.textContent = message; status.classList.toggle('danger', isError); }
function renderAgents(agents) { agentsList.replaceChildren(); if (!agents.length) { const item = document.createElement('li'); item.textContent = 'No agents are currently assigned to this account.'; agentsList.append(item); } else { for (const agent of agents) { const item = document.createElement('li'); item.textContent = typeof agent === 'string' ? agent : agent.name || agent.title || agent.id || JSON.stringify(agent); agentsList.append(item); } } agentsSection.classList.remove('hidden'); }
async function send(message) { const response = await chrome.runtime.sendMessage(message); if (response?.error) throw new Error(response.error); return response; }
async function restoreState() { const {user, pendingEmail = ''} = await chrome.storage.local.get(['user', 'pendingEmail']); if (user?.email) { emailInput.value = user.email; renderAgents(user.agents || []); showStatus(`Verified as ${user.email}.`); } else if (pendingEmail) { emailInput.value = pendingEmail; codeForm.classList.remove('hidden'); showStatus('Enter the code sent to your email.'); } }
emailForm.addEventListener('submit', async event => { event.preventDefault(); try { showStatus('Sending verification code…'); await send({type: 'REQUEST_CODE', email: emailInput.value}); codeForm.classList.remove('hidden'); codeInput.focus(); showStatus('Check your email, then enter the code below.'); } catch (error) { showStatus(error.message, true); } });
codeForm.addEventListener('submit', async event => { event.preventDefault(); try { showStatus('Verifying code…'); const {user} = await send({type: 'VERIFY_CODE', code: codeInput.value}); renderAgents(user.agents || []); codeForm.classList.add('hidden'); codeInput.value = ''; showStatus(`Verified as ${user.email}.`); } catch (error) { showStatus(error.message, true); } });
document.getElementById('refresh-agents').addEventListener('click', async () => { try { showStatus('Refreshing agents…'); const {agents} = await send({type: 'GET_AGENTS'}); renderAgents(agents); showStatus('Agent access updated.'); } catch (error) { showStatus(error.message, true); } });
restoreState();
