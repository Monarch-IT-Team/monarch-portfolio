import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createScene, type SceneHandle } from './scene';
import { initCursor } from './cursor';
import { Ambient } from './sound';
import { initTerminal } from './terminal';
import { SITE } from '../config';

gsap.registerPlugin(ScrollTrigger);

interface MX {
  lang: string;
  years: number;
  t(key: string): string;
}
const mx = (window as unknown as { __mx?: MX }).__mx;
const t = (key: string) => mx?.t(key) ?? key;

const root = document.documentElement;
root.classList.add('ready');

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 899px)');
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

initCursor(reduced);

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  },
};

console.log(
  '%c✦ Monexarch%c\nPress ~ to open the kernel terminal.',
  'font: 600 16px Jost, sans-serif; color: #e2c07c; letter-spacing: .2em',
  'font: 12px monospace; color: #bab5ab',
);

/* ------------------------------------------------------- scroll → scale */

interface Stop {
  start: number;
  end: number;
  level: number;
  fx: number;
  fy: number;
}

const sections = $$<HTMLElement>('[data-level]');
let stops: Stop[] = [];

// Each section "holds" its scale while it covers the screen; between two sections
// the scale glides over exactly one viewport of scrolling.
function measure() {
  const vh = innerHeight;
  const m = mobile.matches;
  stops = sections.map((s) => {
    const top = s.getBoundingClientRect().top + scrollY;
    let start = top;
    let end = top + s.offsetHeight - vh;
    if (end < start) start = end = (start + end) / 2;
    const d = s.dataset;
    return {
      start: Math.max(0, start),
      end: Math.max(0, end),
      level: Number(d.level ?? 0),
      fx: m ? Number(d.fxM ?? 0.5) : Number(d.fx ?? 0.5),
      fy: m ? Number(d.fyM ?? 0.5) : Number(d.fy ?? 0.5),
    };
  });
}

const ease = (x: number) => x * x * (3 - 2 * x);

function sample(y: number) {
  const first = stops[0];
  if (!first) return { level: 0, fx: 0.5, fy: 0.5 };
  if (y <= first.end) return first;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (y < b.start) {
      const k = ease(Math.min(1, Math.max(0, (y - a.end) / Math.max(1, b.start - a.end))));
      return {
        level: a.level + (b.level - a.level) * k,
        fx: a.fx + (b.fx - a.fx) * k,
        fy: a.fy + (b.fy - a.fy) * k,
      };
    }
    if (y <= b.end) return b;
  }
  return stops[stops.length - 1];
}

/* -------------------------------------------------------------- readout */

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) => [...String(n)].map((c) => SUP[+c]).join('');
const readVal = $('.readout__val');
const readName = $('.readout__name');
let lastReadout = '';

function onFrame(p: number) {
  let e = 9 + 4 * Math.max(0, p);
  let n = Math.floor(e);
  let mant = Math.pow(10, e - n);
  if (mant >= 9.95) {
    mant = 1;
    n += 1;
  }
  const val = `${mant.toFixed(1)} × 10${sup(n)}`;
  const k = Math.min(4, Math.max(0, Math.round(p)));
  const key = `${val}|${k}|${mx?.lang}`;
  if (key !== lastReadout) {
    lastReadout = key;
    if (readVal) readVal.textContent = val;
    if (readName) readName.textContent = t(`rail.l${k}`);
  }
  ambient.setScale(p);
}

window.addEventListener('mx:lang', () => {
  lastReadout = '';
});

/* ---------------------------------------------------------------- scene */

const canvas = $<HTMLCanvasElement>('#scene');
const nav = navigator as Navigator & { deviceMemory?: number };
const low = mobile.matches || (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;

let scene: SceneHandle | null = null;
const ambient = new Ambient();
// Lite mode = no 3D at all (remembered; the head script already set the class).
let three = !root.classList.contains('mx-lite');

// Building the universe takes a moment; during the intro it happens behind the overlay,
// after the boot log has already painted.
function initScene() {
  if (scene || !three) return;
  try {
    if (!canvas) throw new Error('no canvas');
    scene = createScene({
      canvas,
      labelRoot: $('#labels')!,
      low,
      reduced,
      years: mx?.years ?? new Date().getFullYear() - 2017,
      projects: $$<HTMLElement>('[data-project]').map((el) => el.dataset.title ?? ''),
      onFrame,
    });
  } catch (err) {
    console.warn('[monexarch] WebGL is unavailable, using the static background.', err);
    root.classList.add('no-webgl');
    $('[data-three-btn]')?.setAttribute('hidden', '');
    return;
  }
  measure();
  const s = sample(scrollY);
  scene.jump(s.level, s.fx, s.fy);
  // The intro ignites the star itself; otherwise light it now.
  if (!root.classList.contains('mx-intro')) igniteStar(false);
}

measure();
onFrame(sample(scrollY).level);

const header = $('.header');
// ?shot = jump straight to the target scale (used for screenshots).
const instant = /[?&]shot\b/.test(location.search);
function onScroll() {
  const s = sample(scrollY);
  if (instant) scene?.jump(s.level, s.fx, s.fy);
  else scene?.setTarget(s.level, s.fx, s.fy);
  if (!scene || !three) onFrame(s.level);
  header?.classList.toggle('is-scrolled', scrollY > 40);
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', () => {
  measure();
  onScroll();
});
new ResizeObserver(() => {
  measure();
  onScroll();
}).observe(document.querySelector('main')!);
document.fonts?.ready.then(() => {
  measure();
  onScroll();
  ScrollTrigger.refresh();
});
onScroll();

// The camera leans slightly towards the mouse (parallax).
addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType !== 'mouse') return;
    scene?.setPointer((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  },
  { passive: true },
);

/* ------------------------------------------------------- sound & 3D */

const soundBtn = $('[data-sound-btn]');
const threeBtn = $('[data-three-btn]');

async function setSound(on: boolean) {
  if (on) {
    try {
      await ambient.start();
    } catch {
      on = false;
    }
  } else {
    ambient.stop();
  }
  soundBtn?.setAttribute('aria-pressed', String(on));
  root.classList.toggle('mx-sound', on);
  store.set('mx-sound', on ? '1' : '0');
  return on;
}

soundBtn?.addEventListener('click', () => setSound(!ambient.on));
document.addEventListener('visibilitychange', () => ambient.visibility(document.hidden));
// Sound was on last time: browsers need a gesture first, so resume on the first one.
if (store.get('mx-sound') === '1') {
  const resume = () => {
    removeEventListener('pointerdown', resume);
    removeEventListener('keydown', resume);
    if (!ambient.on) setSound(true);
  };
  addEventListener('pointerdown', resume);
  addEventListener('keydown', resume);
}

function setThree(on: boolean) {
  if (root.classList.contains('no-webgl')) return false;
  three = on;
  root.classList.toggle('mx-lite', !on);
  threeBtn?.setAttribute('aria-pressed', String(on));
  store.set('mx-lite', on ? '0' : '1');
  if (on) {
    if (scene) scene.setEnabled(true);
    else initScene();
  } else {
    scene?.setEnabled(false);
  }
  onScroll();
  return on;
}
threeBtn?.setAttribute('aria-pressed', String(three));
threeBtn?.addEventListener('click', () => setThree(!three));

/* ------------------------------------------------- project systems */

const system = $('#system');
const systemItems = $$<HTMLElement>('[data-system]');
const systemCount = $('.system__count');
let current: number | null = null;
let returnFocus: Element | null = null;
const pad2 = (n: number) => String(n).padStart(2, '0');

function showSystem(i: number) {
  current = i;
  for (const el of systemItems) el.hidden = Number(el.dataset.system) !== i;
  if (systemCount) systemCount.textContent = `${pad2(i + 1)} / ${pad2(systemItems.length)}`;
  const m = mobile.matches;
  scene?.focusProject(i, m ? 0.5 : 0.3, m ? 0.24 : 0.5);
  scene?.highlight('project', i);
}

function openSystem(i: number) {
  if (!system || !systemItems.length) return;
  // the galaxy has to be on screen first
  if (Math.abs(sample(scrollY).level - 3) > 0.05) {
    document.getElementById('projects')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    onScroll();
  }
  returnFocus = document.activeElement;
  showSystem(i);
  system.hidden = false;
  root.classList.add('mx-system');
  requestAnimationFrame(() => system.classList.add('is-open'));
  ambient.whoosh(true);
  setTimeout(() => system.querySelector<HTMLElement>('.system__close')?.focus(), 60);
}

function stepSystem(d: number) {
  if (current === null) return;
  const n = systemItems.length;
  showSystem((current + d + n) % n);
  ambient.whoosh(d > 0);
}

function closeSystem() {
  if (!system || current === null) return;
  current = null;
  system.classList.remove('is-open');
  root.classList.remove('mx-system');
  scene?.focusProject(null);
  scene?.highlight('project', null);
  ambient.whoosh(false);
  setTimeout(() => {
    if (current === null) system.hidden = true;
  }, 600);
  (returnFocus as HTMLElement | null)?.focus?.({ preventScroll: true });
}

document.addEventListener('click', (e) => {
  const el = e.target as Element;
  const opener = el.closest<HTMLElement>('[data-open-project]');
  if (opener) return openSystem(Number(opener.dataset.openProject));
  if (el.closest('[data-system-close]')) return closeSystem();
  const step = el.closest<HTMLElement>('[data-system-step]');
  if (step) return stepSystem(Number(step.dataset.systemStep));
  // a click anywhere on a project card (except its links) opens it too
  const card = el.closest<HTMLElement>('.card[data-project]');
  if (card && !el.closest('a, button')) openSystem(Number(card.dataset.project));
});

addEventListener('keydown', (e) => {
  if (current === null || root.classList.contains('mx-term')) return;
  if (e.key === 'Escape') closeSystem();
  else if (e.key === 'ArrowRight') stepSystem(1);
  else if (e.key === 'ArrowLeft') stepSystem(-1);
});

/* ------------------------------------------------------------ terminal */

initTerminal({
  t,
  lang: () => mx?.lang ?? 'en',
  setLang: (l) => (window as unknown as { __mx?: { setLang(l: string): void } }).__mx?.setLang(l),
  goto: (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }),
  sound: (on) => setSound(on ?? !ambient.on),
  three: (on) => setThree(on ?? !three),
  openProject: openSystem,
  projects: $$<HTMLElement>('.card[data-project]').map((el) => ({
    title: el.dataset.title ?? '',
    url: el.querySelector<HTMLAnchorElement>('a[href*="github.com"]')?.href ?? '',
    homepage: '',
  })),
  links: [
    { label: 'Telegram', href: SITE.links.telegram, text: SITE.links.telegramHandle },
    { label: 'Email', href: `mailto:${SITE.links.email}`, text: SITE.links.email },
    { label: 'GitHub', href: SITE.links.github, text: SITE.links.githubHandle },
    { label: 'LinkedIn', href: SITE.links.linkedin, text: SITE.links.linkedinHandle },
  ],
  years: mx?.years ?? new Date().getFullYear() - SITE.codingSince,
  since: SITE.codingSince,
});

/* ---------------------------------------------------------- signal form */

const form = $<HTMLFormElement>('#signal-form');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(form);
  const status = form.querySelector<HTMLElement>('.signal-form__status')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const say = (key: string, state: 'ok' | 'err' | 'wait') => {
    status.textContent = t(key);
    status.dataset.state = state;
  };
  const name = String(fd.get('name') ?? '').trim();
  const contact = String(fd.get('contact') ?? '').trim();
  const message = String(fd.get('message') ?? '').trim();
  if (String(fd.get('website') ?? '')) return; // a bot filled the hidden field
  if (!message) {
    say('form.empty', 'err');
    form.querySelector('textarea')?.focus();
    return;
  }

  const endpoint = form.dataset.endpoint;
  if (!endpoint) {
    // No bot yet: copy the text and open the Telegram chat.
    const text = [message, name && `— ${name}`, contact && `(${contact})`].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — the chat still opens */
    }
    window.open(form.dataset.telegram, '_blank', 'noopener');
    say('form.copied', 'ok');
    return;
  }

  button.disabled = true;
  say('form.sending', 'wait');
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, message, lang: mx?.lang ?? 'en', page: location.href }),
    });
    if (!res.ok) throw new Error(String(res.status));
    form.reset();
    say('form.ok', 'ok');
  } catch {
    say('form.err', 'err');
  } finally {
    button.disabled = false;
  }
});

// Hovering a skill or a project lights up its star.
function bindHighlight(selector: string, attr: 'skill' | 'project') {
  for (const el of $$<HTMLElement>(selector)) {
    const i = Number(el.dataset[attr]);
    const on = () => scene?.highlight(attr, i);
    const off = () => scene?.highlight(attr, null);
    el.addEventListener('pointerenter', on);
    el.addEventListener('pointerleave', off);
    el.addEventListener('focusin', on);
    el.addEventListener('focusout', off);
  }
}
bindHighlight('[data-skill]', 'skill');
bindHighlight('[data-project]', 'project');

/* ------------------------------------------------------- star & hero */

let ignited = false;
function igniteStar(flash: boolean) {
  if (ignited || !scene) return;
  ignited = true;
  const u = scene.ignite;
  if (reduced) {
    u.value = 1;
    return;
  }
  gsap
    .timeline()
    .to(u, { value: flash ? 1.18 : 1.06, duration: flash ? 1 : 1.5, ease: 'expo.out' })
    .to(u, { value: 1, duration: 1.2, ease: 'sine.inOut' });
}

function splitChars(el: HTMLElement) {
  const text = el.textContent ?? '';
  el.textContent = '';
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = ch;
    el.appendChild(s);
  }
}

const name = $('.hero__name');
$$<HTMLElement>('.hero__name .line__inner').forEach(splitChars);

let heroShown = false;
function revealHero(delay = 0) {
  if (heroShown) return;
  heroShown = true;
  const chars = $$('.hero__name .ch');
  if (name) name.style.visibility = 'visible';
  if (reduced) {
    gsap.set('[data-hero]', { opacity: 1, y: 0 });
    return;
  }
  gsap
    .timeline({ delay })
    .fromTo(chars, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out', stagger: 0.03 }, 0)
    .to('[data-hero]', { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.1 }, 0.4);
}

/* ---------------------------------------------------------------- intro */

const BOOT: [string, '' | 'head' | 'ok' | 'final'][] = [
  [`monexarch kernel ${mx?.years ?? 9}.0.0 · boot`, 'head'],
  ['[0.000] cpu0: one mind online', ''],
  ['[0.012] memory: 10 disciplines mapped', ''],
  ['[0.027] mount /dev/imagination', 'ok'],
  ['[0.041] modules: design dev 3d sound arch os srv fullstack ml kernel', ''],
  ['[0.058] link github.com/Monarch-IT', 'ok'],
  ['[0.073] init universe', 'final'],
];

function playIntro() {
  const intro = $('#intro');
  const log = $('#intro-log');
  if (!intro || !log) return;
  try {
    localStorage.setItem('mx-intro', '1');
  } catch {
    /* storage unavailable — the intro may play again next time */
  }

  const step = 0.17;
  const tl = gsap.timeline({ onComplete: done });
  BOOT.forEach(([text, kind], i) => {
    tl.call(
      () => {
        const row = document.createElement('div');
        row.className = `intro__row${kind ? ` is-${kind}` : ''}`;
        row.textContent = text;
        if (kind === 'ok') row.insertAdjacentHTML('beforeend', '<b>ok</b>');
        if (kind === 'final') row.insertAdjacentHTML('beforeend', '<span class="intro__caret"></span>');
        log.appendChild(row);
        gsap.fromTo(row, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.24, ease: 'none' });
      },
      [],
      0.3 + i * step,
    );
  });
  tl.fromTo('.intro__bar i', { scaleX: 0 }, { scaleX: 1, duration: 0.4 + BOOT.length * step, ease: 'power2.inOut' }, 0);
  tl.to('.intro__flash', { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.in' }, '+=0.3');
  tl.call(() => {
    igniteStar(true);
    revealHero(0.25);
  });
  tl.to(intro, { opacity: 0, duration: 1, ease: 'power2.out' });

  let finished = false;
  function done() {
    if (finished) return;
    finished = true;
    igniteStar(true);
    revealHero(0);
    root.classList.remove('mx-intro');
    intro?.remove();
    removeEventListener('keydown', onKey);
    removeEventListener('wheel', skip);
    removeEventListener('touchstart', skip);
    measure();
    onScroll();
  }
  function skip() {
    tl.progress(1);
  }
  function onKey(e: KeyboardEvent) {
    if (['Escape', 'Enter', ' ', 'ArrowDown', 'PageDown'].includes(e.key)) skip();
  }
  $('#intro-skip')?.addEventListener('click', skip);
  addEventListener('keydown', onKey);
  addEventListener('wheel', skip, { passive: true });
  addEventListener('touchstart', skip, { passive: true });
}

if (root.classList.contains('mx-intro') && !reduced) {
  playIntro();
  requestAnimationFrame(() => setTimeout(initScene, 60));
} else {
  root.classList.remove('mx-intro');
  $('#intro')?.remove();
  initScene();
  revealHero(0.15);
}

/* -------------------------------------------------------------- reveals */

if (reduced) {
  gsap.set('[data-reveal]', { opacity: 1, y: 0 });
} else {
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, overwrite: true }),
  });
}
