const toggle = document.getElementById('enabled');
const toggleLabel = document.getElementById('toggle-label');
chrome.storage.local.get({enabled:true}, ({enabled}) => { toggle.checked = enabled; toggleLabel.textContent = enabled ? 'On' : 'Off'; });
toggle.addEventListener('change', async () => { await chrome.storage.local.set({enabled:toggle.checked}); toggleLabel.textContent = toggle.checked ? 'On' : 'Off'; });
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
(async () => {
 const {history = []} = await chrome.storage.local.get(['history']);
 document.getElementById('count').textContent = history.length;
 const target = document.getElementById('history');
 if (!history.length) {
  target.innerHTML = `<div class="empty"><div style="font-size:30px">✦</div><strong>No replies yet</strong>Open a YouTube video, click Reply on a comment, then Generate AI Reply.</div>`;
  return;
 }
 for (const item of history.slice(0, 15)) {
  const node = document.createElement('article'); node.className='item';
  const time = new Date(item.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  node.innerHTML = `<div class="item-top"><span class="pill">AI draft</span><span class="time">${escapeHtml(time)}</span></div><p class="snippet">${escapeHtml(item.comment).slice(0,140)}</p><p class="answer">${escapeHtml(item.reply).slice(0,230)}</p><div class="item-actions"><button class="link copy">Copy reply</button><a class="link" target="_blank" rel="noopener noreferrer" href="${escapeHtml(item.videoUrl)}">View video ↗</a></div>`;
  node.querySelector('.copy').addEventListener('click', async e => {await navigator.clipboard.writeText(item.reply);e.target.textContent='Copied!'});
  target.append(node);
 }
})();
