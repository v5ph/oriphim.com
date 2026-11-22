// Public integration settings only. Never place service/API secrets here.
// Secrets (RESEND_API_KEY, TURNSTILE_SECRET) and the booking link live in the Cloudflare Pages project. See docs/contact-form.md.
window.oriphimContact = {
  // Applications are posted here and emailed to the team.
  endpoint: '/api/contact',
  // Public Cloudflare Turnstile site key (safe to publish; the secret key stays in Cloudflare Pages).
  turnstileSiteKey: '0x4AAAAAAGMaGaUW_IMZiZAb',
  // If sending fails, the visitor's email app opens, addressed here, with the form filled in.
  email: 'hello@oriphim.com',
  // Field order and labels in that fallback email body.
  contactQuestions: { company: 'Organisation', role: 'You are', raised: 'Raised so far', next: 'Coming up', interest: 'Interested in', description: 'Work and question' }
};
