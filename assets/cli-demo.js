// The terminal on the landing page.
//
// Scrolling works whatever the visitor's settings: the log can be wheeled, dragged, or moved with
// the keys, and the status line says what the real Ori says (tui.py): "reviewing earlier output"
// while you are looking back, and "new output below" if something arrives meanwhile.
//
// Playback is on top of that. The first time the terminal scrolls into view it plays one session
// in the order the real Ori does it: the prompt is typed and sent, its replies arrive in the log,
// and the working indicator sits above the prompt while Ori works. Without script, or with
// reduced motion, the whole session is simply there.
(() => {
  const demo = document.querySelector('.cli-demo');
  if (!demo) return;

  const $ = (id) => demo.querySelector(`[data-id="${id}"]`);
  const log = demo.querySelector('.tui-log');
  const body = demo.querySelector('.tui-in');
  const typed = demo.querySelector('.t-typed');
  const left = demo.querySelector('.t-s-left');
  const status = {
    idle: demo.querySelector('.t-s-idle'),
    type: demo.querySelector('.t-s-type'),
    work: demo.querySelector('.t-s-work'),
    review: demo.querySelector('.t-s-review'),
    fresh: demo.querySelector('.t-s-fresh')
  };

  // ---- scrolling ---------------------------------------------------------
  // The log is a column-reverse flex box, so it rests at its end and scrollTop is 0 at the latest
  // output, going negative as you read back up.
  let base = 'idle';       // what the status line says when you are at the latest output
  let reviewing = false;   // looking at earlier output
  let unseen = false;      // something arrived while you were
  const behind = () => Math.abs(log.scrollTop);
  const above = () => log.scrollHeight - log.clientHeight - behind();
  const renderStatus = () => {
    const name = reviewing ? (unseen ? 'fresh' : 'review') : base;
    for (const key in status) status[key].hidden = key !== name;
    left.classList.toggle('is-link', reviewing);
  };
  const update = () => {
    log.classList.toggle('can-up', above() > 2);
    log.classList.toggle('can-down', behind() > 2);
    reviewing = behind() > 4;
    if (!reviewing) unseen = false;
    renderStatus();
  };
  const setStatus = (name) => { base = name; renderStatus(); };
  const toLatest = () => { log.scrollTop = 0; unseen = false; update(); };

  log.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  left.addEventListener('click', () => { if (reviewing) toLatest(); });
  log.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'End') { event.preventDefault(); toLatest(); }
    else if (event.key === 'Home') { event.preventDefault(); log.scrollTop = -(log.scrollHeight - log.clientHeight); }
  });
  update();

  // ---- playback ----------------------------------------------------------
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  // New lines arrive below. If you are reading back, the view stays where it is, as it does in Ori.
  const show = (id) => {
    const before = log.scrollHeight;
    $(id).classList.add('is-shown');
    if (reviewing) {
      log.scrollTop -= log.scrollHeight - before;
      unseen = true;
    }
    update();
  };
  const frame = (id) => {
    demo.querySelectorAll('.t-frame.is-on').forEach((f) => f.classList.remove('is-on'));
    if (id) $(id).classList.add('is-on');
  };

  // The working indicator's ring turns while Ori works (ori/spinner.py).
  const RING = ['◴', '◷', '◶', '◵'];
  let turn = 0;
  const spin = () => setInterval(() => {
    turn += 1;
    demo.querySelectorAll('.t-frame.is-on .t-ring').forEach((el) => { el.textContent = RING[turn % RING.length]; });
  }, 150);

  // Type what the prompt box says, then send it: the box empties and the message joins the log.
  async function send(id) {
    const text = $(id).textContent.replace(/^\s*›\s*/, '');
    setStatus('type');
    for (const char of text) {
      typed.textContent += char;
      await sleep(24 + Math.random() * 34);
    }
    await sleep(380);
    typed.textContent = '';
    show(id);
    setStatus('idle');
  }

  async function play() {
    const spinning = spin();
    demo.classList.add('is-playing');
    update();
    show('head');
    show('hint');
    await sleep(1100);

    await send('you1');
    $('hint').classList.remove('is-shown');
    update();
    await sleep(300);
    show('op1');
    await sleep(500);
    show('op2');
    setStatus('work');
    for (const id of ['b1', 'b2', 'b3']) {
      frame(id);
      await sleep(1250);
    }
    frame(null);
    setStatus('idle');
    demo.classList.add('run-known');
    show('brief1');
    await sleep(800);
    show('claims');
    await sleep(2000);

    await send('you2');
    await sleep(500);
    show('brief2');
    await sleep(1900);

    await send('you3');
    await sleep(300);
    show('op3');
    setStatus('work');
    frame('r1');
    await sleep(1600);
    frame('r2');
    await sleep(1600);
    frame('done');
    setStatus('idle');
    show('assess');
    await sleep(700);
    show('result');
    await sleep(900);
    show('suggest');
    clearInterval(spinning);
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    play();
  }, { threshold: 0.35 });
  observer.observe(demo);
})();
