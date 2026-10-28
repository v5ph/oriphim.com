(() => {
  const config = window.oriphimContact || {};
  document.querySelectorAll('form[data-questions]').forEach(form => {
    const button = form.querySelector('button');
    const status = form.querySelector('.contact-status');
    if (!config.calendlyUrl) {
      button.disabled = true;
      form.querySelector('.contact-submit p').textContent = 'Booking will open soon.';
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!config.calendlyUrl || !form.reportValidity()) return;
      try {
        const destination = new URL(config.calendlyUrl);
        if (destination.protocol !== 'https:' || !(destination.hostname === 'calendly.com' || destination.hostname.endsWith('.calendly.com'))) throw Error('Invalid booking destination');
        const fields = new FormData(form);
        destination.searchParams.set('name', fields.get('name').trim());
        destination.searchParams.set('email', fields.get('email').trim());
        for (const [field, parameter] of Object.entries(config[form.dataset.questions] || {})) {
          destination.searchParams.set(parameter, String(fields.get(field) || '').trim());
        }
        window.location.assign(destination.href);
      } catch {
        status.textContent = 'Booking is unavailable right now. Please try again later.';
      }
    });
  });
})();
