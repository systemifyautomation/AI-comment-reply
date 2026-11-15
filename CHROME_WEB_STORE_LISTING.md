# ReplyFlow — Chrome Web Store submission copy

Replace every bracketed placeholder before submission. Keep this copy aligned with the shipped extension and the public privacy policy.

## Store listing

| Chrome Web Store field | Value |
| --- | --- |
| Name | ReplyFlow - Social AI Replies |
| Category | Productivity |
| Language | English |
| Website | `https://[your-domain]` |
| Support URL | `https://[your-domain]/support` |
| Privacy policy URL | `https://[your-domain]/privacy` |

### Short description

Draft contextual social-media comment replies with AI. Review, copy, and post them yourself.

### Detailed description

ReplyFlow helps approved team members draft thoughtful replies to social-media comments without leaving the page.

After verifying an authorised email address, select the client you are working for. On supported sites, use ReplyFlow to generate a contextual reply based on the comment and page information. You can also paste a comment into the Manual reply tool and copy the generated draft for use anywhere.

ReplyFlow supports YouTube, Facebook, Instagram, Reddit, LinkedIn, Rumble, Spotify, and manual replies. It creates drafts only: it never posts, sends, edits, or deletes content on your behalf.

Features:

- Email verification for approved users.
- Client selection to keep each reply aligned with the correct client context.
- Contextual AI reply drafts for supported social platforms.
- A manual reply tool for any other platform or message.
- Local draft history, which can be cleared at any time with Reset.
- You stay in control: review, copy, and post every reply yourself.

ReplyFlow is intended for users whose administrator has granted them access. An active ReplyFlow account is required.

## Privacy practices form

### Single purpose description

ReplyFlow lets authorised users generate AI-assisted drafts for social-media comments, using the client context they select. It does not publish content for the user.

### Permission justifications

| Manifest permission / host access | Paste into the dashboard |
| --- | --- |
| `storage` | Stores the user's verified email, selected client, extension on/off preference, and locally saved reply drafts in Chrome extension storage so ReplyFlow works across browser sessions. The user can erase this local data with Reset. |
| YouTube, Facebook, Instagram, Reddit, Spotify, Rumble, and LinkedIn host access | Lets ReplyFlow add its visible “Generate AI Reply” control on supported social-media pages and read only the comment and surrounding page details needed when the user actively requests a draft. It does not run on unrelated websites. |
| `https://n8n.systemifyautomation.com/*` host access | Lets the extension send verification, client-selection, and user-requested reply-generation requests to the ReplyFlow n8n service over HTTPS. |

### Data-use declarations

Select these only if they exactly match the released extension and your deployed n8n workflow:

| Data type | Collected | Why it is needed | Where it goes |
| --- | --- | --- | --- |
| Personal information: email address | Yes | Verify that the user has been granted ReplyFlow access and retrieve their permitted clients. | ReplyFlow n8n service and its Supabase database. |
| Website content: comment text and relevant page context, such as title, URL, and channel/page identifier | Yes, only after the user requests a draft | Generate a contextual reply draft for the selected client. | ReplyFlow n8n service; its configured AI provider; and its database only where the workflow is configured to retain it. |
| User activity: extension setting, selected client, and generated draft history | Stored locally | Keep the extension usable between sessions and display recent drafts. | Chrome extension local storage on the user's device. |

Use these answers where the dashboard asks about data handling, provided they remain true:

- The extension does **not** sell user data.
- The extension does **not** use user data for personalised advertising, creditworthiness, or unrelated profiling.
- The extension transfers data only as needed to provide its disclosed reply-drafting feature.
- The extension lets the user delete its locally stored data with the Reset button.

Do **not** select “no data collected.” The extension handles email addresses, user-entered text, page content, and URLs.

### Reviewer test instructions

```text
ReplyFlow requires a pre-authorised test email because access is restricted to client-approved users.

Test account email: [REVIEWER_TEST_EMAIL]
Verification-code delivery: [HOW_GOOGLE_CAN_GET_THE_CODE — for example, a shared test inbox or test-only fixed-code workflow]
Test client name: [TEST_CLIENT_NAME]

Steps:
1. Open the ReplyFlow extension and go to Settings.
2. Enter the test email and request a verification code.
3. Enter the supplied code.
4. Select and confirm the test client if more than one is shown.
5. Open a supported social-media test page, or use Home > Manual reply.
6. Paste a benign test comment and select Generate reply.
7. Confirm that a draft appears. ReplyFlow does not post content automatically.

To verify data deletion, select Settings > Reset. This clears the email, client selection, locally saved drafts, and other ReplyFlow data from Chrome extension storage.
```

## Required visual assets

Create these from the actual extension—not mock functionality:

1. **Small promotional tile:** 440 × 280 px. Use the ReplyFlow icon, black/white/#9d7a3c palette, and minimal or no text.
2. **Screenshots:** upload at least one; prepare five 1280 × 800 px screenshots for the strongest listing.
   - Manual reply collapsed on Home.
   - Manual reply open with a generated draft.
   - Settings after verification with the client dropdown in the top-right.
   - A supported-page ReplyFlow control next to a comment.
   - Reset option and draft history.
3. **Optional marquee:** 1400 × 560 px.

Use only real product UI, square-corner screenshots without padding, and avoid social-platform logos unless you have permission to use them. Do not claim that ReplyFlow is endorsed by YouTube, Facebook, Instagram, Reddit, LinkedIn, Spotify, or Rumble.

## Submission checklist

- [ ] Increment `manifest.json` version for the release.
- [ ] Zip the extension files only; exclude `.env`, `N8N/`, `.git/`, documentation, and development files unless intentionally shipped.
- [ ] Upload the ZIP to the Chrome Web Store Developer Dashboard.
- [ ] Paste the short and detailed descriptions above.
- [ ] Add a working homepage, support URL, and publicly accessible privacy-policy URL.
- [ ] Complete the Privacy tab with the exact declarations and permission justifications above.
- [ ] Provide a reviewer test email and a reliable way to receive its verification code.
- [ ] Upload the icon, one promotional tile, and at least one actual-product screenshot.
- [ ] Verify every client account used for review exists and can return a safe test reply.
- [ ] Review the final listing against the current extension behavior before submitting.
