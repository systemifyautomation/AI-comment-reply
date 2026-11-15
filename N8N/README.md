# ReplyFlow n8n workflows

Import the three JSON files in this folder into n8n, then activate them. They match the URLs already expected by the relay:

| Workflow | Webhook path | Method | Purpose |
| --- | --- | --- | --- |
| `01-email-verification.json` | `replyflow-email-verification` | POST | Send and verify email codes. |
| `02-list-clients.json` | `replyflow-accounts` | GET | Return the verified email's client list. |
| `03-generate-reply.json` | `replyflow` | POST | Produce a reply using the selected client's prompt. |
| `04-grant-va-access-form.json` | `replyflow-grant-access` | n8n Form | Admin form for giving a VA email access to a client. |

## Before importing

1. Run [supabase.sql](supabase.sql) in Supabase SQL Editor.
2. In n8n, connect the native **Supabase** credential used in each Supabase node. The exported workflows reference the supplied **Systemify Cold Leads** credential; choose your own credential in the nodes if that name or ID does not exist in the target n8n instance.
3. In n8n, create an SMTP credential named **Brevo SMTP**. Use Brevo's SMTP host, port, sender address, and SMTP key from your Brevo account. Attach it to the **Send verification email** node after import.
4. Set this sender environment variable on the n8n host, then restart n8n:

   ```dotenv
   REPLYFLOW_FROM_EMAIL=reply@example.com
   ```

   The OpenAI credential is configured in n8n's **Message a model** node; keep its API key in that n8n credential, never in the extension or repository `.env`.
5. In `03-generate-reply.json`, change the model or select a different n8n OpenAI credential if needed. It uses the native OpenAI node and returns a structured reply object.
6. Set the n8n base URL in the relay `.env`. The relay adds the three workflow paths itself:

   ```dotenv
   REPLYFLOW_N8N_URL=https://n8n.example
   ```

## Client data

Only clients are returned to the extension. A client may have many YouTube channels, pages, and profiles; keep those mappings and the client prompt inside your Supabase/n8n setup. The extension receives only:

```json
{ "accounts": [{ "id": "11111111-1111-4111-8111-111111111111", "name": "Acme" }] }
```

The reply workflow checks that the submitted email is assigned to the submitted client before generating a reply.

The workflows use native n8n Supabase and OpenAI nodes; no HTTP Request node is used.

## Granting a VA access

Import and activate `04-grant-va-access-form.json`. Its production form URL is shown by the **Admin access form** node. The form requires an authenticated n8n user with workflow-execute permission, then collects the VA email and client UUID and creates the access row. Do not share the form URL with VAs or other non-admin users.

## Supabase CSV imports

Import these files from the Supabase Table Editor after running `supabase.sql`:

| File | Target table | Required headers | Purpose |
| --- | --- | --- | --- |
| [data/replyflow_clients.csv](data/replyflow_clients.csv) | `replyflow_clients` | `id`, `name`, `active`, `system_prompt` | Each client and the instructions for its single AI reply agent. `id` must be a UUID. |
| [data/replyflow_client_access.csv](data/replyflow_client_access.csv) | `replyflow_client_access` | `id`, `email`, `client_id`, `active` | Which verified VA email can select which client. Both `id` and `client_id` must be UUIDs. |

Replace the sample rows before importing. Generate a UUID for every `id`, and make every `client_id` exactly match a client `id`. Use `true` or `false` for `active`. Quote the `system_prompt` when it contains commas or line breaks; standard CSV escaping doubles any quote inside the text.

Do **not** import `replyflow_verification_codes`: that table is created by the SQL but populated automatically when a VA requests a verification code.
