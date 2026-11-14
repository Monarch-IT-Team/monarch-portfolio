// Orbital cursor: a gold point (the star) and a thin orbit with a tiny moon that trails behind it.
// Mouse only — touch screens and pens keep the native behaviour.

const INTERACTIVE = 'a, button, [data-skill], [data-project], [data-open-project]';

export function initCursor(reduced: boolean) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<span class="cursor__ring"><span class="cursor__orbit"><i class="cursor__moon"></i></span></span>' +
    '<span class="cursor__dot"></span>';
  document.body.appendChild(el);
  document.documentElement.classList.add('has-cursor');

  const ring = el.querySelector<HTMLElement>('.cursor__ring')!;
  const dot = el.querySelector<HTMLElement>('.cursor__dot')!;

  let x = -100;
  let y = -100;
  let rx = x;
  let ry = y;
  let shown = false;

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        shown = true;
        rx = x;
        ry = y;
        el.classList.add('is-on');
      }
      const target = e.target instanceof Element ? e.target.closest(INTERACTIVE) : null;
      el.classList.toggle('is-hover', !!target);
    },
    { passive: true },
  );

  document.documentElement.addEventListener('mouseleave', () => {
    shown = false;
    el.classList.remove('is-on');
  });
  addEventListener('pointerdown', () => el.classList.add('is-down'));
  addEventListener('pointerup', () => el.classList.remove('is-down'));
  addEventListener('blur', () => el.classList.remove('is-down'));

  let last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 14);
    rx += (x - rx) * k;
    ry += (y - ry) * k;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    ring.style.transform = `translate3d(${rx.toFixed(2)}px,${ry.toFixed(2)}px,0)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
