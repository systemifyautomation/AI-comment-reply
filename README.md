# ReplyFlow

ReplyFlow is a Chrome extension that drafts replies to comments across supported platforms. Users verify their email before they can generate replies, see the agents assigned to their account, and review every generated draft before posting it.

## Supported platforms

ReplyFlow includes adapters for YouTube, Facebook, Instagram, Reddit, LinkedIn, Rumble, and Spotify. YouTube has the most specific page integration. Social platforms regularly change their page structure, so the remaining adapters use their public reply-editor patterns and may need selector updates over time. Spotify currently has no public comment-reply editor; its adapter reserves the shared data model for future supported interaction surfaces.

## Manual replies

The **Home** tab includes **Reply to any comment** for content from unsupported platforms or other sources. Paste the comment, generate a draft, then use **Copy reply** to paste it wherever you want. Manual requests use the same n8n payload and response contract as platform-integrated requests; `videoUrl` is set to `manual://replyflow` and the title and channel fields are set to `Manual reply` and `manual`.

## Architecture

The Chrome extension never calls n8n directly. It calls the ReplyFlow relay, which keeps the private n8n webhook URLs in its server-side `.env` file.

```text
Chrome extension -> ReplyFlow relay -> n8n workflows
```

The extension sends the verified email with each reply request. n8n should use that email to enforce agent access and reply permissions.

## Requirements

- Chrome or another Chromium-based browser.
- Node.js 18 or later on the relay host.
- A public HTTPS URL for the relay in production.
- One n8n webhook for replies and agent access, plus one n8n webhook for email verification.

## Relay setup

Deploy `server.js` separately from the extension. On the relay host, create a `.env` file using `.env.example` as the template:

```dotenv
REPLYFLOW_WEBHOOK_URL=https://your-n8n-host/webhook/replyflow
REPLYFLOW_AUTH_WEBHOOK_URL=https://your-n8n-host/webhook/replyflow-email-verification
PORT=3000
ALLOWED_ORIGINS=chrome-extension://your-extension-id
```

Start the relay:

```powershell
node server.js
```

Put a reverse proxy with HTTPS in front of it for production. The relay exposes these endpoints:

| Method | Relay endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/request-code` | Ask n8n to email a verification code. |
| POST | `/auth/verify-code` | Verify the emailed code. |
| GET | `/agents?email=...` | Get agents available to a verified user. |
| POST | `/reply` | Generate a reply for a supported platform. |

## Extension setup

1. Load the project folder in `chrome://extensions` using **Developer mode** and **Load unpacked**.
2. Configure Chrome managed storage with the relay reply URL:

   ```json
   { "proxyUrl": "https://replyflow.example/reply" }
   ```

   `proxyUrl` is a non-secret relay URL. Never put an n8n webhook URL in the extension.
3. Open the ReplyFlow popup and select the **Settings** tab.
4. Enter an email address, request a code, then enter the emailed code.
5. After verification, the Settings tab lists the agents assigned to that email. On a supported platform, open a reply editor and select **Generate AI Reply**.

## n8n contracts

### Email-verification webhook

The relay sends requests to `REPLYFLOW_AUTH_WEBHOOK_URL`.

Request a code:

```json
{ "email": "user@example.com", "action": "request_code" }
```

Verify a code:

```json
{ "email": "user@example.com", "code": "123456", "action": "verify_code" }
```

The verification response must include one of these fields set to `true`:

```json
{ "verified": true }
```

`success` and `valid` are also accepted.

### Agent access

The relay calls the reply webhook as a GET request:

```text
GET REPLYFLOW_WEBHOOK_URL?email=user%40example.com
```

Return either a direct array or an `agents` property:

```json
{ "agents": [{ "id": "agent-1", "name": "Support Agent" }] }
```

Each agent may be a string or an object with `name`, `title`, or `id`.

### Reply generation

The relay forwards this POST body to `REPLYFLOW_WEBHOOK_URL`:

```json
{
  "comment": "Great video!",
  "videoUrl": "https://www.linkedin.com/feed/update/...",
  "videoTitle": "Page or post title",
  "channelID": "UC...",
  "videoChannelId": "UC...",
  "email": "user@example.com"
}
```

The payload and response shape stay identical on every platform. `videoUrl` identifies the source platform; `channelID` is the platform owner's identifier; and `videoChannelId` is included for compatibility with existing workflows. Return a reply in this format:

```json
{ "reply": "Thanks for watching!" }
```

## Security notes

- Keep the real `.env` only on the relay host. Do not include it in an extension ZIP or publish it to source control.
- The extension stores its verified email locally in Chrome. n8n must independently enforce access rules; email alone should not be treated as proof of identity for high-value actions.
- Restrict `ALLOWED_ORIGINS` to your production extension ID whenever possible.
- The formerly exposed n8n webhook URL should be rotated before production use.

## Icons

Replace `AI comment icon.png`, then regenerate the extension icons:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
```

This creates 16, 32, 48, and 128px PNG icons in `icons/`.
