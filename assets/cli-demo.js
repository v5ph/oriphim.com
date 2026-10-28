// The terminal on the landing page prints its lines one at a time the first time it scrolls into view.
(() => {
  const demo = document.querySelector('.cli-demo');
  if (!demo || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const lines = demo.querySelectorAll('.ln');
  demo.classList.add('is-typing');
  const observer = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    observer.disconnect();
    lines.forEach((line, i) => setTimeout(() => line.classList.add('is-shown'), 250 + i * 420));
  }, { threshold: 0.35 });
  observer.observe(demo);
})();
