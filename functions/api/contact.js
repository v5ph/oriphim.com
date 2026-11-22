// Cloudflare Pages Function: POST /api/contact
//
// Receives the contact-page application, checks it, then emails it through Resend:
//   1. a notification to the team inboxes (reply goes straight to the applicant), and
//   2. a short confirmation to the applicant, only once Turnstile has verified them,
//      so the endpoint cannot be used to send mail to strangers.
//
// Secrets and settings live in the Pages project, never in this repo:
//   RESEND_API_KEY   secret, required. Without it the form falls back to the visitor's email app.
//   TURNSTILE_SECRET secret, recommended. Without it no confirmation email is sent.
//   CONTACT_TO       optional, comma-separated. Defaults to the two inboxes below.
//   BOOKING_URL      optional https link to the booking page, shown after sending and in the confirmation.

const DEFAULT_TO = ['hello@oriphim.com', 'philv@oriphim.com'];
const NOTIFY_FROM = 'Oriphim forms <forms@oriphim.com>';
const CONFIRM_FROM = 'Oriphim <hello@oriphim.com>';
const CONFIRM_REPLY_TO = 'hello@oriphim.com';

const MAX_BODY_BYTES = 10_000;
const MAX_TURNSTILE_TOKEN = 2048;
// Must match the action the contact page passes to the Turnstile widget (assets/contact.js).
const TURNSTILE_ACTION = 'contact';
const LIMITS = { name: 120, email: 254, company: 160, role: 60, raised: 60, next: 60, interest: 60, description: 1500 };
const REQUIRED = ['name', 'email', 'company', 'role', 'interest', 'description'];
// Order and labels of the lines in the notification email.
const LABELS = [
  ['name', 'Name'], ['email', 'Email'], ['company', 'Organisation'], ['role', 'You are'],
  ['raised', 'Raised so far'], ['next', 'Coming up'], ['interest', 'Interested in']
];

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

// Collapse control characters (including CR/LF) so a value can never break a header or subject.
const oneLine = value => value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
const multiLine = value => value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();

function clean(input) {
  const out = {};
  for (const [field, max] of Object.entries(LIMITS)) {
    const raw = typeof input[field] === 'string' ? input[field] : '';
    out[field] = (field === 'description' ? multiLine(raw) : oneLine(raw)).slice(0, max);
  }
  return out;
}

function validate(fields) {
  for (const name of REQUIRED) if (!fields[name]) return `Missing ${name}`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return 'Invalid email';
  return '';
}

function recipients(env) {
  const list = String(env.CONTACT_TO || '').split(',').map(item => item.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_TO;
}

function bookingUrl(env) {
  try {
    const url = new URL(String(env.BOOKING_URL || ''));
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

async function verifyTurnstile(env, token, request) {
  if (!env.TURNSTILE_SECRET) return { checked: false, ok: true };
  if (!token || token.length > MAX_TURNSTILE_TOKEN) return { checked: true, ok: false };
  try {
    const form = new FormData();
    form.set('secret', env.TURNSTILE_SECRET);
    form.set('response', token);
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) form.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    // The token must have been issued on this site (not on localhost or another site using the public site key) and for this form.
    return { checked: true, ok: data.success === true && data.hostname === new URL(request.url).hostname && data.action === TURNSTILE_ACTION };
  } catch {
    return { checked: true, ok: false };
  }
}

async function sendEmail(env, message) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) console.error('contact: email provider returned', res.status);
    return res.ok;
  } catch (error) {
    console.error('contact: email provider unreachable', error?.name);
    return false;
  }
}

function notification(fields, env) {
  const lines = LABELS.filter(([name]) => fields[name]).map(([name, label]) => `${label}: ${fields[name]}`);
  return {
    from: NOTIFY_FROM,
    to: recipients(env),
    reply_to: fields.email,
    subject: `${fields.interest}: ${fields.company}`.slice(0, 150),
    text: `New application from the contact page.\n\n${lines.join('\n')}\n\nWork and question:\n${fields.description}\n`
  };
}

function confirmation(fields, env) {
  const first = fields.name.split(' ')[0];
  const booking = bookingUrl(env);
  const text = [
    `Hi ${first},`,
    '',
    'Thank you for your application. We have it, and we reply within two business days.',
    booking ? `\nIf you would rather talk it through, you can pick a time here:\n${booking}` : '',
    '\nYou can reply to this email to add anything you forgot.',
    '\nOriphim'
  ].join('\n').replace(/\n{3,}/g, '\n\n');
  return { from: CONFIRM_FROM, to: [fields.email], reply_to: CONFIRM_REPLY_TO, subject: 'We received your application', text };
}

export async function onRequestPost({ request, env }) {
  // The page posts to its own origin; anything else is not our form.
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json(403, { ok: false, error: 'origin' });

  let input;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'too-large' });
    input = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, error: 'invalid' });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return json(400, { ok: false, error: 'invalid' });

  // Hidden field that people never fill in. Bots do; they get a normal-looking success and nothing is sent.
  if (typeof input.hp_extra === 'string' && input.hp_extra.trim()) return json(200, { ok: true, confirmation: false, bookingUrl: '' });

  const fields = clean(input);
  if (validate(fields)) return json(400, { ok: false, error: 'invalid' });

  if (!env.RESEND_API_KEY) return json(503, { ok: false, error: 'not-configured' });

  const human = await verifyTurnstile(env, typeof input.turnstile === 'string' ? input.turnstile : '', request);
  if (!human.ok) return json(403, { ok: false, error: 'verification' });

  const [delivered, confirmed] = await Promise.all([
    sendEmail(env, notification(fields, env)),
    human.checked ? sendEmail(env, confirmation(fields, env)) : Promise.resolve(false)
  ]);
  if (!delivered) return json(502, { ok: false, error: 'delivery' });
  return json(200, { ok: true, confirmation: confirmed, bookingUrl: bookingUrl(env) });
}

export const onRequest = () => json(405, { ok: false, error: 'method' });
