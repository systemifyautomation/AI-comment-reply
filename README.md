# ReplyFlow

## Icons

Replace `AI comment icon.png` with your source artwork, then run `powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1`. It creates the 16, 32, 48, and 128px icons in `icons/`.

## Configure the relay

1. On the separate relay host, edit `.env`. Set `REPLYFLOW_WEBHOOK_URL` to the existing n8n reply webhook and `REPLYFLOW_AUTH_WEBHOOK_URL` to the n8n email-verification webhook. `.env` is Git-ignored and must never be packaged with the extension.
2. Run `node server.js` and expose `/reply`, `/auth/request-code`, `/auth/verify-code`, and `/agents` through HTTPS. Set `ALLOWED_ORIGINS` to the extension's `chrome-extension://<id>` origin where possible.
3. Use Chrome managed storage to set `proxyUrl` to the relay reply URL, for example `https://replyflow.example/reply`. This must be the relay, never a secret n8n webhook URL.
4. Load the extension folder in `chrome://extensions` and use **Settings & agent access** to verify a user's email.

## User flow

The settings page sends a code to the entered email, verifies that code, then displays the agents assigned to that email. The verified email is stored locally in Chrome and added automatically to every reply request.

## n8n contracts

### Reply webhook

Receives a POST body like:

`{ "comment": "...", "videoUrl": "...", "videoTitle": "...", "channelID": "...", "videoChannelId": "...", "email": "user@example.com" }`

`channelID` is canonical; `videoChannelId` is retained for compatibility. Return `{ "reply": "..." }`.

### Email-verification webhook

The relay sends POST requests to `REPLYFLOW_AUTH_WEBHOOK_URL`:

`{ "email": "user@example.com", "action": "request_code" }`

`{ "email": "user@example.com", "code": "123456", "action": "verify_code" }`

The verification response must set one of `verified`, `success`, or `valid` to `true`, for example `{ "verified": true }`.

### Agent access

The relay calls `GET REPLYFLOW_WEBHOOK_URL?email=user%40example.com`. Return either an array of agents or `{ "agents": [...] }`. An agent may be a name string or an object with `name`, `title`, or `id`.

## Security

Browser extensions cannot keep a secret they can read. Keep `.env` solely on the relay host; extension users see only the relay's non-secret URL.
