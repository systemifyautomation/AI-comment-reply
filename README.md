# ReplyFlow v2.1

## Configure (administrator)
1. Open `config.js` and replace `REPLYFLOW_WEBHOOK_URL` with your n8n production HTTPS webhook URL.
2. In Chrome, open `chrome://extensions`, enable Developer mode, and select **Load unpacked**. Choose this folder.
3. Click the ReplyFlow extension icon. Use the **On/Off** switch to enable or disable AI reply generation.
4. On YouTube, open a comment reply box and click **Generate AI Reply**. Review the draft and manually click YouTube's Reply button.

No settings page or webhook editor is exposed in the extension UI. Recent drafts remain in the popup.

### n8n request
`{ "comment": "...", "videoUrl": "...", "videoTitle": "...", "videoChannelId": "..." }`

### n8n response
`{ "reply": "..." }`

### Security note
Embedding a URL in an extension hides it from the normal settings UI, **not** from a user who can inspect installed extension files or network traffic. For a truly private n8n URL, configure a server-side proxy with authentication and keep the actual n8n webhook URL on the server.

### Updating
Edit `config.js`, then click **Reload** on the extension in `chrome://extensions`.
