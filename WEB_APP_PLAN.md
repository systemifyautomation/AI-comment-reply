# ReplyFlow web-app plan

## Purpose

ReplyFlow is a free, open-source control center for **business owners with one business**. VAs and business owners working as VAs use the extension to draft replies; the business owner uses the web app to manage access, connection settings, and account security for that one business.

This is deliberately not an agency product. It does not include agency workspaces, agency staff, parent/child client relationships, portfolio-level reporting, or a hierarchy where one owner manages several independent client businesses. A separate agency app will be designed with its own data model and permissions later.

The product must be usable without buying a ReplyFlow service: an owner can self-host the app, connect their own n8n workflows, and run their own Supabase project or compatible database setup. ReplyFlow can optionally be hired to design, build, host, or maintain a customer's database and n8n workflows. That implementation service is paid; using the open-source app is not.

## Open-source and service model

- Publish the application, extension, setup documentation, Supabase schema, and example n8n workflows under an open-source license.
- Do not gate core features, VA accounts, businesses, authentication, account selection, or webhook configuration behind a paid plan.
- Let each business owner supply the endpoints for workflows they own, using the same documented request and response contract as the included workflow templates.
- Provide importable reference workflows and a self-hosting guide so technical users can run the whole stack independently.
- Offer optional paid onboarding: database provisioning, workflow design, n8n/Supabase deployment, custom integrations, security review, and ongoing support.
- Keep paid-service credentials, hosted infrastructure, and support operations separate from the open-source codebase.

## Product boundary: one business per owner

Each owner account creates and manages exactly one business workspace. All of its VAs, AI context, connected n8n workflow, activity, and platform/channel mappings belong to that one business. A VA may be invited to multiple businesses, but each assignment is separate and the VA chooses the business in the extension when more than one is available.

Do not add agency concepts to this application. In particular, do not model an agency, agency owner, agency client, client-of-client, shared agency team, or cross-business administrative role. Those requirements belong to the future agency app and must not be retrofitted into this database.

## Roles and access

| Role | Access |
| --- | --- |
| Business owner | Creates the one business workspace, manages its VAs, configures AI instructions and workflow connection, and views its activity. |
| Business admin | Optional future role with management access for the one business, but no ownership controls. |
| VA | Uses ReplyFlow only for businesses to which they have been assigned. |
| Business owner acting as VA | Uses the extension with the same permissions and flow as a VA. |

A VA can be assigned to more than one business. If the VA has one assignment, the extension selects it automatically. If they have multiple assignments, the extension displays the existing business dropdown.

## Authentication and security

Use Supabase Auth as the identity system, alongside the existing Supabase database.

- Business-owner sign-up: name, business name, email, password.
- Email confirmation: send through Brevo.
- Sign-in: email and password.
- Two-step verification: require authenticator-app TOTP after password sign-in.
- Recovery codes: show once during 2FA setup and allow account recovery.
- Password reset: Brevo email flow.
- Sensitive actions: require password and 2FA again before removing a VA, disabling 2FA, or changing sensitive client settings.

VA accounts are invitation based. A business owner enters an email address, the VA receives an invitation, accepts it, creates a password if needed, confirms their email, and sets up 2FA.

## Web-app pages

### Public

- Landing page: product overview, sign-in, and sign-up.
- Sign-up, sign-in, password-reset, and email-confirmation pages.
- Two-step-verification setup and challenge pages.

### Authenticated business-owner area

- Dashboard: active VAs, recent reply activity, and AI configuration status.
- VA management: invite, resend invitation, deactivate, reactivate, and revoke access.
- AI and workflow settings: the single AI system prompt/client context plus the owner's n8n connection configuration.
- Workflow templates: documentation and import links for the supported self-hosted n8n workflows.
- Business profile: business details and internal platform/channel mappings.
- Account security: password, 2FA status, recovery codes, and active sessions.
- Extension connection: installation/sign-in guidance and assigned-client visibility.

## Database model

Use these Supabase tables in addition to `auth.users`. All application-owned tables for this product must begin with `business_owner_`, making their single-business-owner scope explicit and avoiding collisions with the future agency app.

| Table | Purpose |
| --- | --- |
| `business_owner_profiles` | User profile keyed by the Supabase Auth user UUID. |
| `business_owner_businesses` | The one business workspace created by an owner: owner, name, AI prompt, workflow connection, and active status. |
| `business_owner_memberships` | User-to-business access with `owner`, `admin`, or `va` role. |
| `business_owner_va_invitations` | Pending VA invitation email, token hash, role, expiry, and acceptance date. |
| `business_owner_channels` | Internal channel/page/profile mappings for the business. These are not shown as extension business choices. |
| `business_owner_reply_activity` | Business, VA user, platform, source URL, timestamp, and result status. |

Enforce the one-business rule with a unique constraint on `business_owner_businesses.owner_id`. The current `replyflow_client_access` table remains a compatibility layer during migration; it should later be replaced by `business_owner_memberships`.

## Extension integration

The web app should replace the extension's custom email-code flow with authenticated sessions. It must support both the included workflow set and customer-owned n8n workflows.

1. The user signs into the extension through the web-app authentication flow.
2. The extension receives a short-lived secure session or token.
3. It requests the user's permitted businesses from the application API.
4. The owner configures their own n8n base URL and approved workflow paths in the web app, or uses the provided self-hosted workflow defaults.
5. Each reply request includes the authenticated identity and selected client UUID.
6. The application relay resolves the configured connection server-side; do not expose secrets or require a distinct public webhook URL for every client.
7. The relay and n8n validate the authenticated request instead of trusting extension-local email data.

### Workflow contract

Customer-created workflows must keep the documented interface so that the extension works consistently:

- **Reply input:** authenticated user context, `businessId`, `comment`, platform metadata, and optional source/video fields.
- **Reply success:** `{ "reply": "..." }`.
- **Reply failure:** a non-2xx response or `{ "error": "clear user-safe explanation" }`, which the extension displays in red.
- **Business list:** only businesses to which the authenticated user has access.

Connection secrets belong in the deployment environment or encrypted server-side settings, never in the extension bundle or browser local storage.

## UI direction

Use the established ReplyFlow theme throughout the web app:

- White, black, and `#9d7a3c` are the primary colors.
- Errors are red.
- No rounded corners on buttons, inputs, cards, or panels.
- Use a clean editorial layout with strong black typography, white workspaces, and gold actions.
- Make invitation, access, and 2FA status highly visible.

## Delivery phases

1. **Foundation:** Supabase Auth, business-owner profiles, one-business ownership, and themed sign-up/sign-in.
2. **Security:** Email confirmation, TOTP 2FA, recovery codes, and session management.
3. **VA management:** Invitations, membership controls, resend/revoke flows, and access audit events.
4. **Bring-your-own workflow:** Workflow connection settings, contract validation, example imports, and self-hosting documentation.
5. **AI settings:** Business prompt/context management and n8n synchronization.
6. **Extension migration:** Secure web-app sessions replace email-code verification in the extension.
7. **Activity and auditing:** Reply history, access changes, and security events.

## Product rule

Business owners manage people, AI context, and their own workflow connection in the web app. Anyone doing reply work, whether a VA or the owner, uses the extension with only the business access they were granted. The core software remains free to use and self-host; paid work is optional implementation or support. This plan is intentionally limited to one business per owner; agencies use a separate future app.
