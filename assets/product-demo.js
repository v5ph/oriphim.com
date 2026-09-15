(() => {
  const demo = document.querySelector('.product-demo');
  if (!demo) return;
  const win = demo.querySelector('.pd-window');
  const cursor = demo.querySelector('.pd-cursor');
  const typed = demo.querySelector('.pd-typed');
  const pause = demo.querySelector('.pd-pause');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const question = typed.textContent;
  const statuses = ['ready', 'draft brief', 'run complete'];
  let elapsed = motion.matches ? 15000 : 0;
  let paused = motion.matches;
  let previous = null;
  let phase = -1;
  let frame;
  const setControls = () => {
    demo.classList.toggle('pd-paused', paused);
    pause.textContent = paused ? '▷' : 'Ⅱ';
    pause.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} product demo`);
  };
  const render = () => {
    const t = elapsed % 22000;
    const next = t < 7000 ? 0 : t < 14000 ? 1 : 2;
    if (next !== phase) {
      phase = next;
      win.dataset.phase = phase;
      demo.querySelector('.pd-status').textContent = statuses[phase];
      demo.querySelectorAll('.pd-progress i').forEach((bar, i) => bar.classList.toggle('is-current', i === phase));
    }
    typed.textContent = question.slice(0, Math.max(0, Math.min(question.length, Math.floor((t - 1700) / 60))));
    win.classList.toggle('pd-expanded', phase === 1 && t < 11200);
    win.classList.toggle('pd-attached', t > 1400);
    win.classList.toggle('pd-submitted', t > 5300);
    win.classList.toggle('pd-signed', phase === 1 && t >= 11200);
    const position = phase === 0 ? (t < 1400 ? [88, 96] : [48, 54]) : phase === 1 ? (t < 10500 ? [64, 51] : [44, 83]) : [62, 41];
    cursor.style.left = `${position[0]}%`;
    cursor.style.top = `${position[1]}%`;
    cursor.style.opacity = phase === 2 && t > 16500 ? '0' : '1';
    win.style.setProperty('--click-x', `${position[0]}%`);
    win.style.setProperty('--click-y', `${position[1]}%`);
    win.classList.toggle('pd-clicking', (t > 1100 && t < 1750) || (t > 9100 && t < 9750));
  };
  const visible = () => !document.hidden && demo.classList.contains('is-active') && getComputedStyle(demo).display !== 'none';
  const tick = now => {
    frame = null;
    if (paused || !visible()) { previous = null; return; }
    if (previous !== null) elapsed += Math.min(now - previous, 100);
    previous = now;
    render();
    frame = requestAnimationFrame(tick);
  };
  const resume = () => { if (!frame && !paused && visible()) frame = requestAnimationFrame(tick); };
  pause.addEventListener('click', () => { paused = !paused; previous = null; setControls(); resume(); });
  demo.querySelector('.pd-replay').addEventListener('click', () => { elapsed = motion.matches ? 15000 : 0; paused = motion.matches; previous = null; render(); setControls(); resume(); });
  new MutationObserver(resume).observe(demo, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { previous = null; resume(); });
  window.addEventListener('resize', resume);
  motion.addEventListener('change', () => { paused = motion.matches; if (paused) elapsed = 15000; previous = null; render(); setControls(); resume(); });
  setControls(); render(); resume();
})();
