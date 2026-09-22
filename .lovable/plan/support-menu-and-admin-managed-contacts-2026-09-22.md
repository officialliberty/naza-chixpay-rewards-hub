# Support menu and admin-managed contacts

## What will change
- Replace the member-facing Videos action in both the quick-actions grid and bottom menu with Support.
- Add a dedicated Support screen with three clear contact choices:
  - Email support
  - Open Telegram support chat
  - Join the private WhatsApp channel
- Show a friendly unavailable state when an admin has not yet configured a contact.
- Update public-facing copy and tutorial text so the removed video feature is no longer advertised.

## Admin controls
- Add a Support settings section to `/Liberty`.
- Let admins edit and save the support email, Telegram link, and private WhatsApp channel link.
- Store these values in the existing protected app settings so signed-in members can read them and only admins can change them.

## Validation and safety
- Validate the email address and require secure `https://` Telegram and WhatsApp links before saving.
- Open external destinations safely in a new tab; email opens the member’s mail app.
- Verify the member Support screen and the admin settings at desktop and mobile sizes.
