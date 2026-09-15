(() => {
  const pages = [
    ['Home', '/'],
    ['Download', '/download'],
    ['Pricing', '/pricing'],
    ['Archive', '/archive'],
    ['Company', '/company'],
  ];
  const menu = document.createElement('dialog');
  menu.className = 'page-menu';
  menu.id = 'page-menu';
  menu.setAttribute('aria-labelledby', 'page-menu-title');
  menu.innerHTML = `<header><h2 id="page-menu-title">Explore Oriphim</h2><button type="button" aria-label="Close page menu">×</button></header><nav aria-label="All pages"></nav><p>F to open or close · Esc to dismiss</p>`;
  const current = location.pathname.replace(/\/$/, '') || '/';
  for (const [label, href] of pages) {
    const link = document.createElement('a');
    link.href = href;
    link.textContent = label;
    if (href === current) link.setAttribute('aria-current', 'page');
    menu.querySelector('nav').append(link);
  }
  document.body.append(menu);
  const openMenu = () => {
    if (menu.open) return;
    menu.showModal();
    menu.querySelector('a[aria-current="page"], nav a').focus();
  };
  document.querySelectorAll('.footer-page-menu').forEach(button => button.addEventListener('click', openMenu));
  menu.querySelector('button').addEventListener('click', () => menu.close());
  menu.addEventListener('click', event => {
    if (event.target !== menu) return;
    const rect = menu.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) menu.close();
  });
  document.addEventListener('keydown', event => {
    if (event.key.toLowerCase() !== 'f' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return;
    if (!menu.open && [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')].some(dialog => dialog.getClientRects().length && getComputedStyle(dialog).visibility !== 'hidden')) return;
    event.preventDefault();
    if (menu.open) menu.close();
    else openMenu();
  });
})();
