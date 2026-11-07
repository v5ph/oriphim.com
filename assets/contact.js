(() => {
  const config = window.oriphimContact || {};
  const address = config.email || 'hello@oriphim.com';
  document.querySelectorAll('form[data-questions]').forEach(form => {
    const status = form.querySelector('.contact-status');
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const value = name => String(fields.get(name) || '').trim();
      const lines = [`Name: ${value('name')}`, `Email: ${value('email')}`];
      for (const [field, label] of Object.entries(config[form.dataset.questions] || {})) {
        if (value(field)) lines.push(`${label}: ${value(field)}`);
      }
      const interest = value('interest') || 'Claim Check';
      const subject = `${interest} request: ${value('company')}`;
      window.location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
      status.replaceChildren(
        'Your email app should open with the request filled in. Just press send. If nothing opened, email ',
        Object.assign(document.createElement('a'), { href: `mailto:${address}`, textContent: address }),
        '.'
      );
    });
  });
})();
