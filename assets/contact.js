(() => {
  const config = window.oriphimContact || {};
  const address = config.email || 'hello@oriphim.com';
  const endpoint = config.endpoint || '/api/contact';
  const siteKey = config.turnstileSiteKey || '';

  const link = (href, text) => Object.assign(document.createElement('a'), { href, textContent: text, target: '_blank', rel: 'noopener noreferrer' });

  // Cloudflare Turnstile loads only when a site key is configured, and stays invisible unless a visitor looks suspicious.
  const turnstile = { widget: null, broken: false, token: '', waiting: [] };
  const acceptToken = token => { turnstile.token = token; turnstile.waiting.splice(0).forEach(resolve => resolve(token)); };
  const turnstileUsable = () => turnstile.widget !== null && !turnstile.broken;
  const nextToken = () => turnstile.token
    ? Promise.resolve(turnstile.token)
    : new Promise(resolve => { turnstile.waiting.push(resolve); setTimeout(() => resolve(''), 12000); });
  const respawnTurnstile = () => {
    turnstile.token = '';
    if (turnstileUsable()) try { window.turnstile.reset(turnstile.widget); } catch {}
  };
  const loadTurnstile = box => {
    if (!siteKey || !box) return;
    const script = Object.assign(document.createElement('script'), { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async: true });
    script.onload = () => {
      try {
        turnstile.widget = window.turnstile.render(box, {
          // The action name is checked again on the server (TURNSTILE_ACTION in functions/api/contact.js).
          sitekey: siteKey, action: 'contact', theme: 'dark', appearance: 'interaction-only', callback: acceptToken,
          'expired-callback': () => { turnstile.token = ''; },
          'error-callback': () => { turnstile.broken = true; acceptToken(''); }
        });
      } catch { turnstile.broken = true; }
    };
    script.onerror = () => { turnstile.broken = true; acceptToken(''); };
    document.head.append(script);
  };

  document.querySelectorAll('form[data-questions]').forEach(form => {
    const status = form.querySelector('.contact-status');
    const button = form.querySelector('button[type="submit"]');
    const conditional = [...form.querySelectorAll('[data-show-when]')];
    let sending = false;

    const sync = () => conditional.forEach(el => {
      const [field, want] = el.dataset.showWhen.split('=');
      const show = form.elements[field] && form.elements[field].value === want;
      el.hidden = !show;
      el.querySelectorAll('input,select,textarea').forEach(input => { input.disabled = !show; });
    });
    form.addEventListener('change', sync);
    sync();
    loadTurnstile(form.querySelector('[data-turnstile]'));

    // Fallback when the site cannot send for us: open the visitor's email app with the request filled in.
    const openEmailApp = fields => {
      const lines = [`Name: ${fields.name || ''}`, `Email: ${fields.email || ''}`];
      for (const [field, label] of Object.entries(config[form.dataset.questions] || {})) {
        if (fields[field]) lines.push(`${label}: ${fields[field]}`);
      }
      const subject = `${fields.interest || 'Groundwork'}: ${fields.company || ''}`;
      window.location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      status.replaceChildren(
        'We could not send that from here, so your email app should open with the request filled in. Just press send. If nothing opened, email ',
        Object.assign(document.createElement('a'), { href: `mailto:${address}`, textContent: address }),
        '.'
      );
    };

    const send = async fields => {
      const token = siteKey ? await nextToken() : '';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...fields, turnstile: token }),
          signal: controller.signal
        });
        return { status: res.status, body: await res.json().catch(() => ({})) };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (sending || !form.reportValidity()) return;
      sending = true;
      button.disabled = true;
      status.textContent = 'Sending…';
      const fields = {};
      for (const [name, value] of new FormData(form)) {
        if (typeof value === 'string' && name !== 'cf-turnstile-response') fields[name] = value.trim();
      }
      const result = await send(fields);
      if (result?.body?.ok) {
        const parts = [`Thank you. We have your application${result.body.confirmation ? ` and sent a confirmation to ${fields.email}` : ''}. We reply within two business days.`];
        if (/^https:\/\//.test(result.body.bookingUrl || '')) parts.push(' Prefer to talk sooner? ', link(result.body.bookingUrl, 'Book a time'), '.');
        status.replaceChildren(...parts);
        form.reset();
        sync();
      } else if (result && (result.status === 400 || result.status === 413)) {
        status.textContent = 'Something in the form was not accepted. Please check your answers and try again.';
      } else if (result && result.status === 403 && turnstileUsable()) {
        status.textContent = 'We could not confirm you are a person. Please try again.';
      } else {
        openEmailApp(fields);
      }
      if (siteKey) respawnTurnstile();
      sending = false;
      button.disabled = false;
    });
  });
})();
