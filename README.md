# ReplyFlow

ReplyFlow drafts comment replies across supported platforms. A user verifies their email, then selects the client whose information should guide the replies. Each client can have any number of channels or pages behind the scenes; the extension only exposes the client choice.

## Supported platforms and manual replies

ReplyFlow includes adapters for YouTube, Facebook, Instagram, Reddit, LinkedIn, Rumble, and Spotify. The **Home** tab also includes a collapsed **Manual reply** tool: paste any comment, generate a draft, then copy it to use anywhere.

## Architecture

```text
Chrome extension -> n8n workflows
```

n8n is the complete backend. The extension sends HTTP requests directly to its active production webhooks; no Node relay, local server, or extension-side `.env` file is required.

The n8n base URL is set once in `background.js` as `N8N_BASE_URL`. It is a public routing URL, so it cannot be kept secret in a Chrome extension. Keep credentials, Supabase keys, SMTP keys, and OpenAI keys inside n8n instead.

Import-ready n8n workflows and the required Supabase schema are in [N8N](N8N/README.md). They use Brevo SMTP for the email code and Supabase for client access and verification-code storage.

## Extension setup

1. Load the extension folder in `chrome://extensions` using **Developer mode** and **Load unpacked**.
2. In the extension popup, open **Settings**, enter an email, and verify the emailed code.
3. If one client is returned, it is selected automatically. If multiple clients are returned, choose one from the dropdown and click **Confirm client**.
4. Generate replies in a supported platform or use the manual-reply tool.

## Stored user data structure

The extension stores this local Chrome-storage object after verification:

```json
{
  "email": "va@example.com",
  "verifiedAt": "2026-11-15T10:00:00.000Z",
  "accounts": [{ "id": "11111111-1111-4111-8111-111111111111", "name": "Acme" }],
  "accountId": "11111111-1111-4111-8111-111111111111",
  "accountName": "Acme"
}
```

For a user with multiple clients, `accountId` and `accountName` are initially empty. They are populated only after the user confirms a client. This prevents replies from being generated with the wrong client's information.

## n8n request and response structures

### 1. Request email code

**POST** `REPLYFLOW_N8N_URL/webhook/replyflow-email-verification`

```json
{ "email": "va@example.com", "action": "request_code" }
```

A successful 2xx response indicates that the request was accepted. Optional example:

```json
{ "sent": true }
```

### 2. Verify email code

**POST** `REPLYFLOW_N8N_URL/webhook/replyflow-email-verification`

```json
{ "email": "va@example.com", "code": "123456", "action": "verify_code" }
```

The response must include one of these truthy verification fields:

```json
{ "verified": true }
```

`success`, `valid`, or `status: "verified"` are also accepted.

### 3. Get clients

**GET** `REPLYFLOW_N8N_URL/webhook/replyflow-accounts?email=va%40example.com`

Return a direct array or an object with `accounts` or `data`:

```json
{
  "accounts": [
    { "id": "11111111-1111-4111-8111-111111111111", "name": "Acme" },
    { "id": "northstar", "name": "Northstar Media" }
  ]
}
```

An account is a client in the extension UI. It may be a string or an object. Object IDs can use `id`, `accountId`, or `value`; client IDs should be UUIDs. Labels can use `name`, `clientName`, or `title`. n8n should resolve the client's channels, brand details, and single AI-agent configuration internally.

### 4. Generate a reply

**POST** `REPLYFLOW_N8N_URL/webhook/replyflow`

```json
{
  "comment": "Great video!",
  "videoUrl": "https://www.linkedin.com/feed/update/...",
  "videoTitle": "Page or post title",
  "channelID": "linkedin:/company/acme",
  "videoChannelId": "linkedin:/company/acme",
  "email": "va@example.com",
  "accountId": "11111111-1111-4111-8111-111111111111"
}
```

The same reply structure is used on every platform. For manual replies, `videoUrl` is `manual://replyflow`, `videoTitle` is `Manual reply`, and both channel fields are `manual`.

Return:

```json
{ "reply": "Thanks for sharing your thoughts!" }
```

## Error responses

For every request, return a non-2xx status with an `error`, `message`, `description`, or `details` field when a request fails. ReplyFlow displays the returned detail to the user.

```json
{ "error": "Account access denied", "details": "This email is not assigned to the selected client." }
```

## Security notes

- n8n must verify that the email is authorized for the supplied `accountId`. Do not trust extension-local storage alone for access control.
- Keep Supabase, SMTP, and OpenAI credentials in n8n credentials or its server environment. Do not put them in the extension.
- Treat each webhook URL as public and use n8n authentication or a request signature if the workflow is exposed outside this extension.

## Icons

Replace `AI comment icon.png`, then run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/generate-icons.ps1
```
