import type { BlackHoleState } from './blackhole';

interface Letter {
  el: HTMLElement;
  x: number;
  y: number;
  r: number;
  s: number;
}

function splitInto(el: HTMLElement): HTMLElement[] {
  if (el.querySelector('.ch')) return [...el.querySelectorAll<HTMLElement>('.ch')];
  const text = el.textContent ?? '';
  el.textContent = '';
  el.setAttribute('aria-label', text);
  const out: HTMLElement[] = [];
  const words = text.split(/(\s+)/);
  for (const w of words) {
    if (/^\s+$/.test(w)) {
      el.appendChild(document.createTextNode(' '));
      continue;
    }
    const wrap = document.createElement('span');
    wrap.className = 'word-nb';
    wrap.setAttribute('aria-hidden', 'true');
    for (const c of w) {
      const s = document.createElement('span');
      s.className = 'ch ch--phys';
      s.textContent = c;
      wrap.appendChild(s);
      out.push(s);
    }
    el.appendChild(wrap);
  }
  return out;
}

export function initTextPhysics(bh: BlackHoleState | null, reduced: boolean) {
  if (reduced || matchMedia('(pointer: coarse)').matches) return;

  const hosts = [...document.querySelectorAll<HTMLElement>('[data-gravity]')];
  const letters: Letter[] = [];
  const sectionOf = new Map<Letter, HTMLElement>();
  for (const host of hosts) {
    const section = host.closest<HTMLElement>('section') ?? document.body;
    for (const el of splitInto(host)) {
      const l: Letter = { el, x: 0, y: 0, r: 0, s: 1 };
      letters.push(l);
      sectionOf.set(l, section);
    }
  }
  if (!letters.length) return;

  document.documentElement.classList.add('mx-physics');

  const mouse = { x: -9999, y: -9999, boost: 0 };
  addEventListener(
    'pointermove',
    (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    },
    { passive: true },
  );
  addEventListener('pointerdown', () => (mouse.boost = 1), { passive: true });
  document.addEventListener('mouseleave', () => {
    mouse.x = mouse.y = -9999;
  });

  let last = performance.now();
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    mouse.boost *= Math.pow(0.04, dt);
    const R = 230 + mouse.boost * 220;
    const vh = innerHeight;

    for (const l of letters) {
      const sec = sectionOf.get(l)!;
      const sr = sec.getBoundingClientRect();
      if (sr.bottom < 0 || sr.top > vh) continue;

      const b = l.el.getBoundingClientRect();
      const cx = b.left + b.width / 2 - l.x;
      const cy = b.top + b.height / 2 - l.y;
      let tx = 0;
      let ty = 0;
      let tr = 0;
      let ts = 1;

      const dx = cx - mouse.x;
      const dy = cy - mouse.y;
      const d = Math.hypot(dx, dy) + 0.01;
      if (d < R) {
        const f = Math.pow(1 - d / R, 2) * (42 + mouse.boost * 80);
        tx += (dx / d) * f;
        ty += (dy / d) * f;
        tr += (dx / d) * f * 0.3;
      }

      if (bh && bh.r > 0.004) {
        const bx = bh.x - cx;
        const by = bh.y - cy;
        const bd = Math.hypot(bx, by) + 1;
        const horizon = bh.r * vh * 0.5;
        const reach = bh.r * vh * 5.2;
        if (bd < reach) {
          const k = 1 - bd / reach;
          const pull = Math.min(bd - horizon * 0.6, k * k * 150);
          if (pull > 0) {
            tx += (bx / bd) * pull + (-by / bd) * pull * 0.35;
            ty += (by / bd) * pull + (bx / bd) * pull * 0.35;
            tr += k * 18 * Math.sign(bx || 1);
            ts = 1 - k * 0.35;
          }
        }
      }

      l.x += (tx - l.x) * 0.12;
      l.y += (ty - l.y) * 0.12;
      l.r += (tr - l.r) * 0.12;
      l.s += (ts - l.s) * 0.12;
      l.el.style.translate = `${l.x.toFixed(2)}px ${l.y.toFixed(2)}px`;
      l.el.style.rotate = `${l.r.toFixed(2)}deg`;
      l.el.style.scale = l.s.toFixed(3);
    }
  };
  requestAnimationFrame(tick);
}

