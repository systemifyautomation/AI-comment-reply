(() => {
  const processed = new WeakSet();
  let enabled = true;
  chrome.storage.local.get({enabled:true}, state => { enabled = state.enabled; updateButtons(); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.enabled) { enabled = changes.enabled.newValue !== false; updateButtons(); } });
  function updateButtons() { document.querySelectorAll(".rf-bar").forEach(el => { el.style.display = enabled ? "" : "none"; }); if (enabled) scan(); }
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function videoId() { return new URL(location.href).searchParams.get('v'); }
  function channelIdFromDom() {
    const player = document.querySelector('ytd-watch-flexy');
    const data = player?.data || document.querySelector('ytd-watch-metadata')?.data;
    const fromData = data?.videoDetails?.channelId || data?.playerResponse?.videoDetails?.channelId;
    if (fromData) return fromData;
    const link = document.querySelector('ytd-watch-metadata ytd-channel-name a[href^="/channel/"], #owner a[href^="/channel/"]');
    return link?.getAttribute('href')?.match(/\/channel\/(UC[\w-]+)/)?.[1] || null;
  }
  function channelId() {
    const fallback = channelIdFromDom();
    const requestId = crypto.randomUUID();
    return new Promise(resolve => {
      const timer = setTimeout(() => { window.removeEventListener('message', onMessage); resolve(fallback); }, 750);
      function onMessage(event) {
        if (event.source !== window || event.data?.source !== 'replyflow-page' || event.data?.type !== 'CHANNEL_ID' || event.data.requestId !== requestId) return;
        clearTimeout(timer); window.removeEventListener('message', onMessage);
        resolve(event.data.channelId || fallback);
      }
      window.addEventListener('message', onMessage);
      window.postMessage({source: 'replyflow-extension', type: 'GET_CHANNEL_ID', requestId}, location.origin);
    });
  }
  function title() {
    return document.querySelector('ytd-watch-metadata h1 yt-formatted-string')?.textContent?.trim()
      || document.querySelector('h1.ytd-watch-metadata')?.textContent?.trim()
      || document.title.replace(/\s*-\s*YouTube\s*$/, '').trim();
  }
  function commentText(thread) {
    const comment = thread.querySelector('ytd-comment-view-model, ytd-comment-renderer') || thread;
    return comment.querySelector('#content-text')?.innerText?.trim() || '';
  }
  function editorFor(thread) {
    return thread.querySelector('ytd-comment-reply-dialog-renderer #contenteditable-root[contenteditable="true"], ytd-commentbox #contenteditable-root[contenteditable="true"], #contenteditable-root[contenteditable="true"]');
  }
  function insertText(editor, value) {
    editor.focus();
    editor.textContent = value;
    editor.dispatchEvent(new InputEvent('input', {bubbles:true, composed:true, inputType:'insertText', data:value}));
    editor.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function addButton(thread) {
    const editor = editorFor(thread);
    if (!enabled || !editor || processed.has(editor)) return;
    processed.add(editor);
    const container = editor.closest('ytd-commentbox, ytd-comment-reply-dialog-renderer') || editor.parentElement;
    if (container.querySelector('.rf-generate')) return;
    const btn = document.createElement('button');
    btn.className = 'rf-generate'; btn.type = 'button'; btn.textContent = '✦ Generate AI Reply';
    const status = document.createElement('span'); status.className = 'rf-status'; status.setAttribute('role','status');
    const bar = document.createElement('div'); bar.className = 'rf-bar'; bar.append(btn, status);
    const actions = container.querySelector('#buttons, #footer, #actions');
    (actions || editor.parentElement).append(bar);
    btn.addEventListener('click', async () => {
      if (!enabled) { status.textContent = 'ReplyFlow is turned off.'; return; }
      const comment = commentText(thread);
      if (!comment) { status.textContent = 'Could not read this comment.'; return; }
      btn.disabled = true; btn.textContent = 'Generating…'; status.textContent = '';
      const id = videoId();
      const resolvedChannelId = await channelId();
      const payload = {
        comment,
        videoUrl: id ? `https://www.youtube.com/watch?v=${id}` : location.href,
        videoTitle: title(),
        channelID: resolvedChannelId,
        // Retained for existing n8n workflows that use the earlier field name.
        videoChannelId: resolvedChannelId
      };
      try {
        const response = await chrome.runtime.sendMessage({type:'GENERATE_REPLY', payload});
        if (response?.error) throw new Error(response.error);
        if (!editor.isConnected) throw new Error('Reply editor closed. Open it again.');
        insertText(editor, response.reply);
        status.textContent = 'Draft inserted. Review before posting.';
      } catch(e) { status.textContent = e.message || 'Request failed.'; }
      finally {btn.disabled = false; btn.textContent = '✦ Generate AI Reply';}
    });
  }
  let queued = false;
  function scan() {
    queued = false;
    document.querySelectorAll('ytd-comment-thread-renderer').forEach(addButton);
  }
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(scan, 250);
  });
  observer.observe(document.documentElement, {childList:true, subtree:true});
  document.addEventListener('yt-navigate-finish', () => setTimeout(scan, 700));
  scan();
})();
