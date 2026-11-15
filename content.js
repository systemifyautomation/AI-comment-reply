(() => {
  // Platform data stays internal. Every adapter is mapped to the unchanged n8n payload below.
  const PLATFORM_ADAPTERS = {
    youtube: {
      name: 'YouTube',
      hosts: ['www.youtube.com', 'youtube.com'],
      editorSelector: 'ytd-comment-thread-renderer #contenteditable-root[contenteditable="true"]',
      thread: editor => editor.closest('ytd-comment-thread-renderer'),
      commentSelectors: ['#content-text'],
      ownerSelector: 'ytd-watch-metadata ytd-channel-name a, #owner a',
      title: () => document.querySelector('ytd-watch-metadata h1 yt-formatted-string')?.textContent?.trim() || document.title.replace(/\s*-\s*YouTube\s*$/, '').trim(),
      ownerId: youtubeChannelId
    },
    facebook: {
      name: 'Facebook', hosts: ['www.facebook.com', 'facebook.com', 'm.facebook.com'],
      editorSelector: '[role="article"] [contenteditable="true"][role="textbox"], [role="dialog"] [contenteditable="true"][role="textbox"]',
      thread: editor => editor.closest('[role="article"], [role="dialog"]'),
      commentSelectors: ['[dir="auto"]'], ownerSelector: 'a[role="link"][href*="facebook.com"]'
    },
    instagram: {
      name: 'Instagram', hosts: ['www.instagram.com', 'instagram.com'],
      editorSelector: 'textarea[placeholder*="Reply" i], textarea[placeholder*="comment" i], [contenteditable="true"][role="textbox"]',
      thread: editor => editor.closest('article, [role="dialog"]'),
      commentSelectors: ['ul li span', 'span'], ownerSelector: 'article header a[href]'
    },
    reddit: {
      name: 'Reddit', hosts: ['www.reddit.com', 'reddit.com', 'old.reddit.com'],
      editorSelector: 'textarea[placeholder*="Reply" i], textarea[placeholder*="reply" i], shreddit-comment textarea',
      thread: editor => editor.closest('shreddit-comment, .Comment, [data-testid="comment"]'),
      commentSelectors: ['[slot="comment"]', '[data-testid="comment"]', '.md'], ownerSelector: 'a[href*="/user/"]'
    },
    linkedin: {
      name: 'LinkedIn', hosts: ['www.linkedin.com', 'linkedin.com'],
      editorSelector: '[data-test-comment-box] [contenteditable="true"], .comments-comment-box [contenteditable="true"], [contenteditable="true"][role="textbox"]',
      thread: editor => editor.closest('.comments-comment-item, [data-urn], .feed-shared-update-v2'),
      commentSelectors: ['.comments-comment-item__main-content', '.comments-comment-item-content-body', '[dir="ltr"]'], ownerSelector: 'a[href*="/in/"]'
    },
    rumble: {
      name: 'Rumble', hosts: ['rumble.com', 'www.rumble.com'],
      editorSelector: 'textarea[placeholder*="Reply" i], textarea[placeholder*="comment" i], [contenteditable="true"][role="textbox"]',
      thread: editor => editor.closest('[class*="comment" i]'),
      commentSelectors: ['[class*="comment" i] [class*="text" i]', '[class*="comment" i] p'], ownerSelector: 'a[href*="/user/"]'
    },
    spotify: {
      name: 'Spotify', hosts: ['open.spotify.com'],
      // Spotify does not currently provide public comment-reply editors. This adapter reserves its data model for supported interaction surfaces.
      editorSelector: '[data-replyflow-spotify-editor]',
      thread: editor => editor.closest('[data-replyflow-spotify-thread]'),
      commentSelectors: ['[data-replyflow-comment]'], ownerSelector: 'a[href]'
    }
  };

  const adapter = Object.values(PLATFORM_ADAPTERS).find(item => item.hosts.includes(location.hostname));
  if (!adapter) return;

  const processed = new WeakSet();
  let enabled = true;
  chrome.storage.local.get({enabled: true}, state => { enabled = state.enabled; updateButtons(); });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.enabled) { enabled = changes.enabled.newValue !== false; updateButtons(); } });

  function updateButtons() {
    document.querySelectorAll('.rf-bar').forEach(bar => { bar.style.display = enabled ? '' : 'none'; });
    if (enabled) scan();
  }

  function youtubeChannelId() {
    const player = document.querySelector('ytd-watch-flexy');
    const data = player?.data || document.querySelector('ytd-watch-metadata')?.data;
    const fromDom = data?.videoDetails?.channelId || data?.playerResponse?.videoDetails?.channelId || document.querySelector('ytd-watch-metadata ytd-channel-name a[href^="/channel/"], #owner a[href^="/channel/"]')?.getAttribute('href')?.match(/\/channel\/(UC[\w-]+)/)?.[1];
    const requestId = crypto.randomUUID();
    return new Promise(resolve => {
      const timer = setTimeout(() => { window.removeEventListener('message', onMessage); resolve(fromDom || 'youtube:unknown'); }, 750);
      function onMessage(event) {
        if (event.source !== window || event.data?.source !== 'replyflow-page' || event.data?.type !== 'CHANNEL_ID' || event.data.requestId !== requestId) return;
        clearTimeout(timer); window.removeEventListener('message', onMessage);
        resolve(event.data.channelId || fromDom || 'youtube:unknown');
      }
      window.addEventListener('message', onMessage);
      window.postMessage({source: 'replyflow-extension', type: 'GET_CHANNEL_ID', requestId}, location.origin);
    });
  }

  function text(element) { return element?.innerText?.trim() || element?.textContent?.trim() || ''; }

  function ownerId() {
    if (adapter.ownerId) return adapter.ownerId();
    const href = document.querySelector(adapter.ownerSelector)?.getAttribute('href');
    if (href) {
      try { return `${adapter.name.toLowerCase()}:${new URL(href, location.origin).pathname.replace(/\/+$/, '')}`; } catch { /* use fallback */ }
    }
    return `${adapter.name.toLowerCase()}:${location.hostname}`;
  }

  function commentText(editor) {
    const thread = adapter.thread(editor);
    if (!thread) return '';
    for (const selector of adapter.commentSelectors) {
      const value = text(thread.querySelector(selector));
      if (value) return value;
    }
    return '';
  }

  async function createContext(editor) {
    const owner = await ownerId();
    return {
      platform: adapter.name,
      comment: commentText(editor),
      contentUrl: location.href,
      contentTitle: adapter.title?.() || document.title.trim(),
      ownerId: owner
    };
  }

  // Do not change this mapping without changing the n8n workflow contract.
  function n8nPayload(context) {
    return {
      comment: context.comment,
      videoUrl: context.contentUrl,
      videoTitle: context.contentTitle,
      channelID: context.ownerId,
      videoChannelId: context.ownerId
    };
  }

  function insertText(editor, value) {
    editor.focus();
    if (editor instanceof HTMLTextAreaElement || editor instanceof HTMLInputElement) editor.value = value;
    else editor.textContent = value;
    editor.dispatchEvent(new InputEvent('input', {bubbles: true, composed: true, inputType: 'insertText', data: value}));
    editor.dispatchEvent(new Event('change', {bubbles: true}));
  }

  function addButton(editor) {
    if (!enabled || processed.has(editor)) return;
    const container = adapter.thread(editor) || editor.parentElement;
    if (!container || container.querySelector('.rf-generate')) return;
    processed.add(editor);
    const button = document.createElement('button');
    button.className = 'rf-generate'; button.type = 'button'; button.textContent = 'Generate AI Reply';
    const status = document.createElement('span'); status.className = 'rf-status'; status.setAttribute('role', 'status');
    const bar = document.createElement('div'); bar.className = 'rf-bar'; bar.append(button, status);
    const actions = container.querySelector('#buttons, #footer, #actions, [class*="actions" i]');
    (actions || editor.parentElement).append(bar);
    button.addEventListener('click', async () => {
      if (!enabled) { status.classList.add('danger'); status.textContent = 'ReplyFlow is turned off.'; return; }
      const context = await createContext(editor);
      if (!context.comment) { status.classList.add('danger'); status.textContent = `Could not read this ${adapter.name} comment.`; return; }
      button.disabled = true; button.textContent = 'Generating...'; status.textContent = ''; status.classList.remove('danger');
      try {
        const response = await chrome.runtime.sendMessage({type: 'GENERATE_REPLY', payload: n8nPayload(context)});
        if (response?.error) throw new Error(response.error);
        if (!editor.isConnected) throw new Error('Reply editor closed. Open it again.');
        insertText(editor, response.reply);
        status.textContent = 'Draft inserted. Review before posting.';
      } catch (error) { status.classList.add('danger'); status.textContent = error.message || 'Request failed.'; }
      finally { button.disabled = false; button.textContent = 'Generate AI Reply'; }
    });
  }

  let queued = false;
  function scan() { queued = false; document.querySelectorAll(adapter.editorSelector).forEach(addButton); }
  const observer = new MutationObserver(() => { if (!queued) { queued = true; setTimeout(scan, 250); } });
  observer.observe(document.documentElement, {childList: true, subtree: true});
  document.addEventListener('yt-navigate-finish', () => setTimeout(scan, 700));
  scan();
})();
