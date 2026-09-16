(() => {
  const auth = window.oriphimAuth?.client.auth;
  if (!auth) return;
  let user = null;
  let busy = false;
  let dismissed = new Set();
  const dialog = document.createElement('dialog');
  dialog.className = 'waitlist-popup';
  dialog.setAttribute('aria-labelledby', 'waitlist-title');
  dialog.innerHTML = `<form><header><span class="waitlist-brand">oriphim</span><button type="button" data-close aria-label="Close waitlist prompt">×</button></header><h2 id="waitlist-title">Be part of what’s next.</h2><p>Join the Oriphim waitlist to hear when access becomes available.</p><p class="waitlist-email"></p><label><input type="checkbox" name="newsletter"> Also email me occasional research notes and product updates.</label><p class="waitlist-status" role="status" aria-live="polite"></p><button class="waitlist-primary" type="submit">Join the waitlist</button><button class="waitlist-secondary" type="button" data-close>Not now</button><button class="waitlist-secondary" type="button" data-leave hidden>Leave waitlist and stop updates</button></form>`;
  document.body.append(dialog);
  const status = dialog.querySelector('.waitlist-status');
  const join = dialog.querySelector('[type="submit"]');
  const newsletter = dialog.querySelector('[name="newsletter"]');
  const leave = dialog.querySelector('[data-leave]');
  const menuLink = document.createElement('a');
  menuLink.href = '#waitlist';
  menuLink.textContent = 'Waitlist & email preferences';
  menuLink.hidden = true;
  document.querySelector('.page-menu nav')?.append(menuLink);
  function rememberDismissal() {
    if (!user) return;
    dismissed.add(user.id);
    try { sessionStorage.setItem('oriphim.waitlist.dismissed.' + user.id, '1'); } catch {}
  }
  function wasDismissed() {
    try { return dismissed.has(user.id) || sessionStorage.getItem('oriphim.waitlist.dismissed.' + user.id) === '1'; }
    catch { return dismissed.has(user.id); }
  }
  function show() {
    if (!user || dialog.open) return;
    const joined = user.user_metadata?.oriphim_waitlist?.joined === true;
    dialog.querySelector('h2').textContent = joined ? 'You’re on the list.' : 'Be part of what’s next.';
    dialog.querySelector('.waitlist-email').textContent = 'Updates go to ' + user.email;
    newsletter.checked = user.user_metadata?.oriphim_waitlist?.newsletter === true;
    join.textContent = joined ? 'Save preferences' : 'Join the waitlist';
    dialog.querySelector('.waitlist-secondary[data-close]').textContent = joined ? 'Close' : 'Not now';
    leave.hidden = !joined;
    status.textContent = '';
    dialog.showModal();
  }
  menuLink.addEventListener('click', event => {
    event.preventDefault();
    document.querySelector('.page-menu')?.close();
    show();
  });
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { if (!busy) { rememberDismissal(); dialog.close(); } }));
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); else rememberDismissal(); });
  dialog.addEventListener('close', rememberDismissal);
  async function save(joined) {
    if (busy || !user) return;
    busy = true;
    dialog.querySelectorAll('button,input').forEach(el => el.disabled = true);
    status.textContent = 'Saving…';
    try {
      // These are contact preferences only, never authorization claims.
      const preference = { joined, newsletter: joined && newsletter.checked, updated_at: new Date().toISOString(), consent_version: 'waitlist-v1' };
      const { data, error } = await auth.updateUser({ data: { oriphim_waitlist: preference } });
      if (error || !data.user) throw error || new Error('No account returned');
      user = data.user;
      rememberDismissal();
      status.textContent = joined ? 'You’re on the waitlist. Your email preferences are saved.' : 'You’ve left the waitlist and opted out of updates.';
      join.textContent = joined ? 'Save preferences' : 'Join the waitlist';
      leave.hidden = !joined;
      if (!joined) newsletter.checked = false;
      dialog.querySelector('h2').textContent = joined ? 'You’re on the list.' : 'Preferences updated.';
      dialog.querySelector('.waitlist-secondary[data-close]').textContent = 'Done';
    } catch {
      status.textContent = 'We couldn’t save your preference. Please try again.';
    } finally {
      busy = false;
      dialog.querySelectorAll('button,input').forEach(el => el.disabled = false);
    }
  }
  dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); save(true); });
  leave.addEventListener('click', () => save(false));
  async function refresh() {
    const { data, error } = await auth.getUser();
    user = error ? null : data.user;
    menuLink.hidden = !user;
    if (!user) { if (dialog.open) dialog.close(); return; }
    if (user.user_metadata?.oriphim_waitlist || wasDismissed()) return;
    if (document.querySelector('dialog[open], .auth-popup:not([hidden])')) return;
    show();
  }
  refresh().catch(() => {});
  auth.onAuthStateChange(event => {
    // Keep asynchronous auth calls outside Supabase's synchronous callback.
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => refresh().catch(() => {}), 0);
  });
})();
