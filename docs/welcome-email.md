# Oriphim welcome email

The account signup confirmation template is `supabase/templates/confirmation.html`.
Subject: **Welcome to Oriphim — confirm your email**.

The message opens directly with “Oriphim is working to lower the cost of scientific discovery” without a heading or personalized greeting. Keep Supabase’s `{{ .ConfirmationURL }}` intact: it carries the recipient’s verification link. The HTML uses inline styles, presentation tables, and text branding so the message remains usable with remote images blocked. The wordmark above the message uses Loom, with Georgia as its fallback. The message, button, and footer use Arial with Helvetica and sans-serif fallbacks. The Loom font is included in the site build and must be deployed before activating the template. The closing tagline is “Sight is a gift.”

## Activation

The repository configuration registers the template for local Supabase. Local email confirmations are currently disabled (`auth.email.enable_confirmations = false`), so registering the template alone does not send it or change signup behavior.

For the hosted project, open **Authentication → Email Templates → Confirm signup** and copy in the subject and HTML. Check that email confirmations are enabled, the production Site URL is `https://oriphim.com`, and the existing `https://oriphim.com/sign-in` redirect is allowed. Configure a verified SMTP sender with display name **Oriphim** before relying on production delivery. Do not assume the public contact address is already a verified sender.

Test with a controlled email/password signup: check delivery and the confirmation link through to sign-in. This repository change has not updated hosted settings or sent any messages.

## Mailing-list welcome

This template is an account confirmation email. OAuth signups and mailing-list opt-ins do not trigger it. The signed-in waitlist currently saves preferences in user metadata; the contact-page signup endpoint is unconfigured. A separate subscriber welcome needs a connected email service and a server-side send after a verified opt-in, with duplicate-send protection and an unsubscribe mechanism. Do not treat account creation as consent to research or product updates.

Reference: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Colors

The email uses the warm black palette: `#0F0A06` background, `#16100B` message panel, `#4D433C` top rule, `#F3E9E2` primary text and button fill, `#BCB0A7` tagline, and `#91857C` footer text. The button text uses `#0F0A06`. Colors are inline literals for email compatibility.
