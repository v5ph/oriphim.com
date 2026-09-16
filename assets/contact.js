(() => {
  const config = window.oriphimContact || {};
  const verification = document.getElementById('verification-form');
  const signup = document.getElementById('early-access-form');
  const bookingButton = verification.querySelector('button');
  const signupButton = signup.querySelector('button');
  if (!config.calendlyUrl) {
    bookingButton.disabled = true;
    verification.querySelector('.contact-submit p').textContent = 'Booking will open soon.';
  }
  if (!config.signupEndpoint) {
    signupButton.disabled = true;
    signup.querySelector('.contact-status').textContent = 'Early-access signup will open soon.';
  }
  verification.addEventListener('submit', event => {
    event.preventDefault();
    if (!config.calendlyUrl || !verification.reportValidity()) return;
    const status = verification.querySelector('.contact-status');
    try {
      const destination = new URL(config.calendlyUrl);
      if (destination.protocol !== 'https:' || !(destination.hostname === 'calendly.com' || destination.hostname.endsWith('.calendly.com'))) throw Error('Invalid booking destination');
      const fields = new FormData(verification);
      destination.searchParams.set('name', fields.get('name').trim());
      for (const [field, parameter] of Object.entries(config.calendlyQuestions || {})) {
        destination.searchParams.set(parameter, String(fields.get(field) || '').trim());
      }
      window.location.assign(destination.href);
    } catch {
      status.textContent = 'Booking is unavailable right now. Please try again later.';
    }
  });
  signup.addEventListener('submit', async event => {
    event.preventDefault();
    if (!config.signupEndpoint || signupButton.disabled || !signup.reportValidity()) return;
    const status = signup.querySelector('.contact-status');
    const fields = new FormData(signup);
    signupButton.disabled = true;
    status.textContent = 'Joining…';
    try {
      const endpoint = new URL(config.signupEndpoint, location.origin);
      if (endpoint.origin !== location.origin) throw Error('Signup endpoint must be same-origin');
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fields.get('email').trim(),
          research_interest: fields.get('research_interest').trim(),
          exploration: fields.get('exploration').trim(),
          consent: 'early-access-and-product-updates-v1',
          source: 'contact'
        }),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw Error('Signup not confirmed');
      status.textContent = result.confirmationRequired === true ? 'Check your email to confirm your signup.' : 'You’re on the list. We’ll be in touch.';
      signup.reset();
      signupButton.textContent = 'Joined';
    } catch {
      status.textContent = 'We couldn’t save your signup. Please try again.';
      signupButton.disabled = false;
    }
  });
})();
