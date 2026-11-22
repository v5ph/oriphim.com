# Contact form

The form on `/contact` posts to `/api/contact` ([functions/api/contact.js](../functions/api/contact.js)), a Cloudflare Pages Function. It emails each application through Resend:

1. **Notification** from `forms@oriphim.com` to `hello@oriphim.com` and `philv@oriphim.com`. Replying goes straight to the applicant.
2. **Confirmation** from `hello@oriphim.com` to the applicant, with the booking link if one is set. It is sent only after Cloudflare Turnstile has verified the visitor, so the form cannot be used to send mail to strangers.

If the function is missing, not configured, or Resend fails, the page falls back to opening the visitor's email app addressed to `hello@oriphim.com`, so an application is never silently lost.

## One-time setup

**Resend** (sends the mail)
1. Create an account, add the domain `oriphim.com`, and copy the DNS records it shows into Cloudflare DNS. They use their own names and do not touch the Google mail records. Wait for the status to read *Verified*.
2. Create an API key with sending access only.

**Turnstile** (blocks bots)
1. Cloudflare dashboard → Turnstile → add a widget with hostname `oriphim.com` (plus `www.oriphim.com` if the site is also served there). Keep the **site key** and **secret key**. The function also checks that each token was issued for the hostname the form was submitted on.
2. The site key (public) is set in `assets/contact-config.js` as `turnstileSiteKey`. The page tags the widget with the action `contact`, and the function rejects tokens issued for any other action. Only the secret key goes in Cloudflare Pages.

**Cloudflare Pages** → the `oriphim-com` project → Settings → Variables and Secrets (Production):

| Name | Type | Notes |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | Required. Without it the form uses the email-app fallback. |
| `TURNSTILE_SECRET` | Secret | Recommended. Without it no confirmation email is sent. |
| `BOOKING_URL` | Text | Optional. An `https://` booking page, shown after sending and in the confirmation. |
| `CONTACT_TO` | Text | Optional. Comma-separated; defaults to hello@ and philv@. |

Variable changes apply from the next deployment, so redeploy after setting them.

## After deploying

1. Submit the form on `/contact` with a personal address. Both inboxes should get the notification and the personal address should get the confirmation.
2. In Gmail, add a filter for `from:forms@oriphim.com` → *Never send it to Spam*, in each inbox that receives it.
3. In Cloudflare, the project's Functions tab should list `/api/contact`.

## Testing locally

`node tests/contact-function.cjs` exercises the function with a mocked Resend and Turnstile and sends nothing real. The static preview server (`npm run preview`) does not run Functions, so the form takes the email-app fallback there.

## Content security policy

`_headers` allows `https://challenges.cloudflare.com` for scripts, frames and connections, which Turnstile needs. The form itself posts to the same origin, so nothing else changed.
