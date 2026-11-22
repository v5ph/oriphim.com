// Tests the /api/contact Pages Function with a mocked Resend and Turnstile. Sends nothing real.
// Run: node tests/contact-function.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const application = {
  name: 'Ada Lovelace', email: 'ada@example.org', company: 'Analytical Engines Lab', role: 'A researcher',
  next: 'A paper or thesis', interest: 'My first Groundwork', description: 'Does our solver converge?\nSecond line.'
};

const post = (body, { origin = 'https://oriphim.com', raw } = {}) => new Request('https://oriphim.com/api/contact', {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: raw ?? JSON.stringify(body)
});

(async () => {
  const { onRequestPost, onRequest } = await import(pathToFileURL(path.resolve(__dirname, '../functions/api/contact.js')).href);
  const realFetch = globalThis.fetch;
  let calls;
  let resendStatus;
  let turnstileSuccess;
  let turnstileHostname;
  let turnstileAction;
  globalThis.fetch = async (url, init = {}) => {
    const entry = { url: String(url), init };
    calls.push(entry);
    if (entry.url.includes('turnstile')) return new Response(JSON.stringify({ success: turnstileSuccess, hostname: turnstileHostname, action: turnstileAction }), { status: 200 });
    if (entry.url.includes('resend.com')) return new Response('{}', { status: resendStatus });
    throw new Error('Unexpected network call: ' + entry.url);
  };
  const reset = () => { calls = []; resendStatus = 200; turnstileSuccess = true; turnstileHostname = 'oriphim.com'; turnstileAction = 'contact'; };
  const emails = () => calls.filter(c => c.url.includes('resend.com')).map(c => JSON.parse(c.init.body));
  const env = { RESEND_API_KEY: 're_test', TURNSTILE_SECRET: 'ts_secret', BOOKING_URL: 'https://calendar.app.google/abc' };
  const read = async res => ({ status: res.status, body: await res.json() });

  try {
    // Wrong or missing origin is refused before anything else happens.
    reset();
    assert.equal((await onRequestPost({ request: post(application, { origin: 'https://evil.example' }), env })).status, 403);
    assert.equal(calls.length, 0);

    // Honeypot: looks like success to a bot, sends nothing.
    reset();
    let out = await read(await onRequestPost({ request: post({ ...application, hp_extra: 'http://spam' }), env }));
    assert.deepEqual([out.status, out.body.ok], [200, true]);
    assert.equal(calls.length, 0);

    // Validation.
    reset();
    assert.equal((await onRequestPost({ request: post({ ...application, email: 'not-an-email' }), env })).status, 400);
    assert.equal((await onRequestPost({ request: post({ ...application, description: '   ' }), env })).status, 400);
    assert.equal((await onRequestPost({ request: post(null, { raw: '{broken' }), env })).status, 400);
    assert.equal((await onRequestPost({ request: post(null, { raw: '[]' }), env })).status, 400);
    assert.equal((await onRequestPost({ request: post(null, { raw: JSON.stringify({ description: 'x'.repeat(20000) }) }), env })).status, 413);
    assert.equal(calls.length, 0);

    // Not configured yet: the page falls back to the visitor's email app.
    reset();
    assert.equal((await onRequestPost({ request: post(application), env: {} })).status, 503);
    assert.equal(calls.length, 0);

    // Turnstile required once its secret is set.
    reset();
    assert.equal((await onRequestPost({ request: post(application), env })).status, 403);
    turnstileSuccess = false;
    assert.equal((await onRequestPost({ request: post({ ...application, turnstile: 'bad' }), env })).status, 403);
    // A genuine token minted on another hostname (for example localhost, using the public site key) is refused.
    turnstileSuccess = true;
    turnstileHostname = 'localhost';
    assert.equal((await onRequestPost({ request: post({ ...application, turnstile: 'elsewhere' }), env })).status, 403);
    // A token issued for a different widget action is refused.
    turnstileHostname = 'oriphim.com';
    turnstileAction = 'newsletter';
    assert.equal((await onRequestPost({ request: post({ ...application, turnstile: 'wrong-action' }), env })).status, 403);
    assert.equal(emails().length, 0);
    // An oversized token is refused without calling Cloudflare at all.
    turnstileAction = 'contact';
    calls = [];
    assert.equal((await onRequestPost({ request: post({ ...application, turnstile: 'x'.repeat(3000) }), env })).status, 403);
    assert.equal(calls.length, 0);

    // Full success: notification to both inboxes plus a confirmation to the applicant.
    reset();
    out = await read(await onRequestPost({ request: post({ ...application, turnstile: 'good' }), env }));
    assert.deepEqual(out, { status: 200, body: { ok: true, confirmation: true, bookingUrl: 'https://calendar.app.google/abc' } });
    const [notice, confirm] = emails();
    assert.equal(calls[0].init.headers?.Authorization, undefined, 'The Resend key must not go to Turnstile');
    assert.deepEqual(notice.to, ['hello@oriphim.com', 'philv@oriphim.com']);
    assert.equal(notice.reply_to, 'ada@example.org');
    assert.equal(notice.subject, 'My first Groundwork: Analytical Engines Lab');
    assert.match(notice.text, /Organisation: Analytical Engines Lab/);
    assert.match(notice.text, /Work and question:\nDoes our solver converge\?\nSecond line\./);
    assert.deepEqual(confirm.to, ['ada@example.org']);
    assert.equal(confirm.reply_to, 'hello@oriphim.com');
    assert.match(confirm.text, /^Hi Ada,/);
    assert.match(confirm.text, /calendar\.app\.google\/abc/);
    assert.equal(calls.filter(c => c.url.includes('resend.com')).every(c => c.init.headers.Authorization === 'Bearer re_test'), true);

    // Without Turnstile configured, the team is notified but no confirmation goes to the typed address.
    reset();
    out = await read(await onRequestPost({ request: post(application), env: { RESEND_API_KEY: 're_test' } }));
    assert.deepEqual([out.status, out.body.confirmation, out.body.bookingUrl], [200, false, '']);
    assert.equal(emails().length, 1);

    // Delivery failure: the page falls back to the visitor's email app.
    reset();
    resendStatus = 500;
    assert.equal((await onRequestPost({ request: post({ ...application, turnstile: 'good' }), env })).status, 502);

    // Newlines cannot reach the subject or reply address; markup is passed as plain text.
    reset();
    await onRequestPost({ request: post({ ...application, company: 'Acme\r\nBcc: x@y.z', name: 'Eve\nMallory', turnstile: 'good' }), env });
    const [injected, injectedConfirm] = emails();
    assert.equal(/[\r\n]/.test(injected.subject), false);
    assert.equal(injected.subject.includes('Bcc: x@y.z'), true, 'Text stays, but only as part of one subject line');
    assert.equal(injectedConfirm.text.startsWith('Hi Eve,'), true);

    // Only https booking links are ever passed on; CONTACT_TO can be overridden.
    reset();
    out = await read(await onRequestPost({ request: post({ ...application, turnstile: 'good' }), env: { ...env, BOOKING_URL: 'javascript:alert(1)', CONTACT_TO: 'a@oriphim.com, b@oriphim.com' } }));
    assert.equal(out.body.bookingUrl, '');
    assert.deepEqual(emails()[0].to, ['a@oriphim.com', 'b@oriphim.com']);
    assert.equal(emails()[1].text.includes('javascript'), false);

    // Other methods are refused.
    assert.equal((await onRequest()).status, 405);

    console.log('PASS: /api/contact validates, verifies, notifies both inboxes, confirms the applicant, and fails safe.');
  } finally {
    globalThis.fetch = realFetch;
  }
})().catch(error => { console.error(error); process.exit(1); });
