/* MONEXARCH: page logic (loader, i18n, HUD cursor, Lenis + GSAP scroll, orbit scrollbar, gauge). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const S = window.SPACE || {};
  const SFX = window.SFX || { play() {}, setEnabled() {}, enabled: false, supported: false };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  if (hasGSAP) { gsap.registerPlugin(ScrollTrigger); document.documentElement.classList.add('js'); }
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const session = (k, v) => {
    try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {}
    return null;
  };

  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------
     Split headings into words (keeps <em>, <strong>, <br>)
     --------------------------------------------------------- */
  function splitWords(el) {
    const walk = (node) => {
      Array.from(node.childNodes).forEach((ch) => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const inner = document.createElement('span'); inner.textContent = p;
            w.appendChild(inner); frag.appendChild(w);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1 && ch.tagName !== 'BR' && !ch.classList.contains('w')) walk(ch);
      });
    };
    walk(el);
    if (hasGSAP && !reduced) gsap.set($$('.w > span', el), { yPercent: el.dataset.shown ? 0 : 110 });
  }

  /* ---------------------------------------------------------
     i18n (UZ / EN / RU) with sliding pill
     --------------------------------------------------------- */
  const T = window.I18N || (typeof I18N !== 'undefined' ? I18N : { en: {} });
  let lang = store.get('lang');
  if (!T[lang]) {
    const nl = (navigator.language || 'en').toLowerCase();
    lang = nl.startsWith('uz') ? 'uz' : nl.startsWith('ru') ? 'ru' : 'en';
  }
  const t = (k) => (T[lang] && T[lang][k]) ?? (T.en && T.en[k]);
  const pill = $('.lang__pill');
  function moveLangPill() {
    const b = $(`.lang [data-lang="${lang}"]`);
    if (!pill || !b) return;
    pill.style.width = `${b.offsetWidth}px`;
    pill.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  function applyLang(l) {
    lang = T[l] ? l : 'en';
    document.documentElement.lang = lang;
    $$('[data-i18n]').forEach((el) => {
      const v = t(el.dataset.i18n);
      if (v == null) return;
      el.innerHTML = v;
      if (el.classList.contains('split')) splitWords(el);
    });
    $$('[data-lang]').forEach((b) => {
      const on = b.dataset.lang === lang;
      b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on);
    });
    moveLangPill();
    store.set('lang', lang);
    requestAnimationFrame(() => { moveNavInk(); hasGSAP && ScrollTrigger.refresh(); });
  }
  $$('[data-lang]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.lang !== lang) { applyLang(b.dataset.lang); SFX.play('whoosh'); } }));
  $$('.split:not([data-i18n])').forEach(splitWords);

  /* ---------------------------------------------------------
     Letters pushed by the cursor's gravity well
     --------------------------------------------------------- */
  const grav = $$('[data-gravity]');
  if (grav.length && !reduced) {
    const L = [];
    grav.forEach((el) => {
      const text = el.textContent;
      el.innerHTML = [...text].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
      $$('.ch', el).forEach((ch) => L.push({ el: ch, x: 0, y: 0, r: 0 }));
    });
    const host = grav[0].closest('section') || document.body;
    const tick = () => {
      requestAnimationFrame(tick);
      const hr = host.getBoundingClientRect();
      if (hr.bottom < 0 || hr.top > innerHeight) return;
      const mx = S.mouse ? S.mouse.x : -9999, my = S.mouse ? S.mouse.y : -9999;
      const boost = S.boost || 0, R = 240 + boost * 220;
      for (const l of L) {
        const b = l.el.getBoundingClientRect();
        const cx = b.left + b.width / 2 - l.x, cy = b.top + b.height / 2 - l.y;
        const dx = cx - mx, dy = cy - my, d = Math.hypot(dx, dy) + 0.01;
        let tx = 0, ty = 0, tr = 0;
        if (d < R) { const f = Math.pow(1 - d / R, 2) * (40 + boost * 70); tx = (dx / d) * f; ty = (dy / d) * f; tr = (dx / d) * f * 0.25; }
        l.x += (tx - l.x) * 0.12; l.y += (ty - l.y) * 0.12; l.r += (tr - l.r) * 0.12;
        l.el.style.transform = `translate(${l.x.toFixed(2)}px,${l.y.toFixed(2)}px) rotate(${l.r.toFixed(2)}deg)`;
      }
    };
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     Sound toggle
     --------------------------------------------------------- */
  const soundBtn = $('#soundToggle');
  const syncSound = () => { if (soundBtn) { soundBtn.classList.toggle('is-on', SFX.enabled); soundBtn.setAttribute('aria-pressed', SFX.enabled); } };
  if (soundBtn) {
    if (!SFX.supported) soundBtn.hidden = true;
    soundBtn.addEventListener('click', () => { SFX.setEnabled(!SFX.enabled); SFX.play('tick'); });
  }
  document.addEventListener('sfx', syncSound); syncSound();
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('a, button')) SFX.play('tick');
  }, { passive: true });

  /* ---------------------------------------------------------
     Rifts: jagged tears in spacetime between sections
     --------------------------------------------------------- */
  function buildRift(el) {
    const w = el.clientWidth || innerWidth, h = 120, mid = h / 2;
    let d = `M0 ${mid}`, x = 0, br = '';
    const pts = [];
    while (x < w) {
      x += 18 + Math.random() * 46;
      const yy = mid + (Math.random() - 0.5) * 34 * Math.sin(Math.min(1, x / w) * Math.PI);
      pts.push([Math.min(x, w), yy]); d += ` L${Math.min(x, w).toFixed(1)} ${yy.toFixed(1)}`;
    }
    for (let i = 0; i < 7; i++) {
      const p = pts[(Math.random() * pts.length) | 0]; if (!p) continue;
      let bx = p[0], by = p[1];
      const a = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.9);
      br += `M${bx.toFixed(1)} ${by.toFixed(1)}`;
      for (let k = 0; k < 4; k++) {
        bx += Math.cos(a) * (8 + Math.random() * 14) * (Math.random() < 0.5 ? -1 : 1);
        by += Math.sin(a) * (6 + Math.random() * 10);
        br += ` L${bx.toFixed(1)} ${by.toFixed(1)}`;
      }
    }
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <path class="rift__glow" d="${d}" pathLength="1"/><path class="rift__core" d="${d}" pathLength="1"/>
      <path class="rift__br" d="${br}" pathLength="1"/></svg>`;
  }
  const rifts = $$('.rift');
  rifts.forEach(buildRift);
  if (rifts.length) {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.6 });
    rifts.forEach((r) => io.observe(r));
    let rw = innerWidth;
    addEventListener('resize', () => { if (Math.abs(innerWidth - rw) > 40) { rw = innerWidth; rifts.forEach(buildRift); } });
  }

  /* ---------------------------------------------------------
     HUD cursor: dot + trail + bracket frame + km/s readout
     --------------------------------------------------------- */
  const cursor = $('.cursor');
  if (finePointer && cursor) {
    const dot = $('.cursor__dot', cursor), frame = $('.cursor__frame', cursor), tag = $('.cursor__tag', cursor);
    const label = $('.cursor__label', cursor), speedEl = $('.cursor__speed', cursor);
    const cv = $('.cursor__trail', cursor), g2 = cv.getContext('2d');
    const LABELS = { open: 'Open ↗', copy: 'Copy', soon: 'Soon' };
    const HOVER = 'a, button, [data-cursor], input, textarea, select, label';
    const IDLE = 34, PAD = 7;
    let mx = -100, my = -100, fx = mx, fy = my, fw = IDLE, fh = IDLE;
    let target = null, vel = 0, lastMove = 0, lastX = 0, lastY = 0, trail = [], drew = false;
    const sizeCanvas = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    sizeCanvas(); addEventListener('resize', sizeCanvas);
    const setTarget = (el) => {
      if (el === target) return;
      target = el;
      const key = el && el.dataset.cursor;
      cursor.classList.toggle('is-hover', !!el);
      cursor.classList.toggle('is-label', !!(key && LABELS[key]));
      if (key && LABELS[key]) label.textContent = LABELS[key];
    };
    addEventListener('mousemove', (e) => {
      const now = performance.now();
      mx = e.clientX; my = e.clientY;
      const v = Math.hypot(mx - lastX, my - lastY) / Math.max(1, now - lastMove);
      vel = vel * 0.7 + v * 0.3;
      lastX = mx; lastY = my; lastMove = now;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      if (!reduced) trail.push({ x: mx, y: my, t: now });
      cursor.classList.remove('is-hidden');
    }, { passive: true });
    const hide = () => { cursor.classList.add('is-hidden'); setTarget(null); };
    document.addEventListener('pointerover', (e) => setTarget(e.target.closest ? e.target.closest(HOVER) : null), { passive: true });
    document.documentElement.addEventListener('mouseleave', (e) => {
      const x = e.clientX, y = e.clientY;
      if (x <= 2 || y <= 2 || x >= innerWidth - 2 || y >= innerHeight - 2) hide();
    });
    addEventListener('mousedown', () => cursor.classList.add('is-down'), true);
    addEventListener('mouseup', () => cursor.classList.remove('is-down'), true);

    const lerp = (a, b, k) => a + (b - a) * k;
    const loop = () => {
      const now = performance.now();
      let tx = mx - IDLE / 2, ty = my - IDLE / 2, tw = IDLE, th = IDLE;
      if (target && target.isConnected) {
        const r = target.getBoundingClientRect();
        const huge = r.width > innerWidth * 0.8 || r.height > innerHeight * 0.75;
        if (r.width && r.height && !huge) { tx = r.left - PAD; ty = r.top - PAD; tw = r.width + PAD * 2; th = r.height + PAD * 2; }
        else { tw = th = 46; tx = mx - 23; ty = my - 23; }
      } else if (target) setTarget(null);
      const k = target ? 0.24 : 0.2;
      fx = lerp(fx, tx, k); fy = lerp(fy, ty, k); fw = lerp(fw, tw, k); fh = lerp(fh, th, k);
      frame.style.transform = `translate(${fx}px, ${fy}px)`;
      frame.style.width = `${fw}px`; frame.style.height = `${fh}px`;
      tag.style.transform = `translate(${mx + 16}px, ${my + 16}px)`;

      // speed in km/s; above 11.2 km/s you leave Earth's orbit
      if (now - lastMove > 90) vel *= 0.85;
      const kms = Math.min(vel * 4.2, 42);
      const fast = kms > 3;
      cursor.classList.toggle('is-fast', fast);
      if (fast) {
        const esc = kms >= 11.2;
        speedEl.classList.toggle('is-esc', esc);
        speedEl.textContent = esc ? `ESC VEL · ${kms.toFixed(1)} km/s` : `${kms.toFixed(1)} km/s`;
      }

      while (trail.length && now - trail[0].t > 170) trail.shift();
      if (drew || trail.length > 1) {
        g2.clearRect(0, 0, innerWidth, innerHeight);
        drew = false;
        if (trail.length > 1) {
          g2.lineCap = 'round';
          const n = trail.length;
          for (let i = 1; i < n; i++) {
            const a = i / n;
            g2.strokeStyle = `rgba(166, 133, 255, ${(a * 0.85).toFixed(3)})`;
            g2.lineWidth = 0.5 + a * 3;
            g2.beginPath(); g2.moveTo(trail[i - 1].x, trail[i - 1].y); g2.lineTo(trail[i].x, trail[i].y); g2.stroke();
          }
          drew = true;
        }
      }
      requestAnimationFrame(loop);
    };
    loop();

    $$('.magnetic').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
    if (!reduced) $$('.tilt').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.transform = `perspective(1000px) rotateY(${(px - 0.5) * 8}deg) rotateX(${(0.5 - py) * 8}deg)`;
        el.style.setProperty('--gx', `${px * 100}%`); el.style.setProperty('--gy', `${py * 100}%`);
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .6s cubic-bezier(.22,1,.36,1)'; el.style.transform = '';
        setTimeout(() => { el.style.transition = ''; }, 600);
      });
    });
  }
  // spotlight on grid cells and the big contact card
  $$('.stack__cell, .contact__big').forEach((el) => el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100, py = ((e.clientY - r.top) / r.height) * 100;
    el.style.setProperty('--gx', `${px}%`); el.style.setProperty('--gy', `${py}%`);
    el.style.setProperty('--mx', `${px}%`); el.style.setProperty('--my', `${py}%`);
  }));

  /* ---------------------------------------------------------
     Nav: burger, smooth anchors, sliding ink
     --------------------------------------------------------- */
  const nav = $('#nav'), burger = $('#burger'), navLinksEl = $('#navLinks');
  let lenis = null;
  if (burger) burger.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  const closeMenu = () => {
    if (nav && nav.classList.contains('is-open')) { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); lenis && lenis.start(); }
  };
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : (id.length > 1 ? $(id) : null);
    if (target === null) return;
    e.preventDefault(); closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: -70, duration: 1.4 });
    else if (target === 0) scrollTo({ top: 0, behavior: 'smooth' });
    else target.scrollIntoView({ behavior: 'smooth' });
  }));
  $$('#navLinks a:not([href^="#"])').forEach((a) => a.addEventListener('click', closeMenu));

  const navInk = document.createElement('span');
  navInk.className = 'nav__ink';
  if (navLinksEl) navLinksEl.appendChild(navInk);
  const navActive = new Set();
  let navCur = null, navLock = false, navLockT = 0;
  function moveNavInk() {
    if (!navCur || !navCur.offsetWidth) { navInk.classList.remove('is-on'); return; }
    const fresh = !navInk.classList.contains('is-on');
    if (fresh) navInk.classList.add('no-anim');
    navInk.style.width = `${navCur.offsetWidth}px`;
    navInk.style.transform = `translateX(${navCur.offsetLeft}px)`;
    if (fresh) { void navInk.offsetWidth; navInk.classList.remove('no-anim'); navInk.classList.add('is-on'); }
  }
  function renderNav() {
    if (!navLinksEl) return;
    $$('a', navLinksEl).forEach((a) => a.classList.toggle('is-active', a === navCur));
    moveNavInk();
  }
  function navSection(link, on) {
    if (on) { navActive.add(link); navCur = link; }
    else { navActive.delete(link); if (navCur === link) navCur = [...navActive].pop() || null; }
    if (!navLock) renderNav();
  }
  if (navLinksEl) $$('a[href^="#"]', navLinksEl).forEach((a) => a.addEventListener('click', () => {
    navCur = a; navLock = true; renderNav();
    clearTimeout(navLockT);
    navLockT = setTimeout(() => { navLock = false; navCur = [...navActive].pop() || a; renderNav(); }, 1700);
  }));
  addEventListener('resize', () => { moveNavInk(); moveLangPill(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { moveNavInk(); moveLangPill(); });

  /* ---------------------------------------------------------
     Orbit scrollbar with a rocket
     --------------------------------------------------------- */
  const bar = $('#orbitbar'), probe = $('#orbitbarProbe');
  const END = 16;
  let bLastY = 0, bMoveT = null, bDrag = false;
  const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
  function updateBar(y) {
    if (!bar || !bar.clientHeight) return;
    const p = Math.min(1, Math.max(0, y / maxScroll()));
    probe.style.transform = `translate(-50%, ${END + p * (bar.clientHeight - probe.offsetHeight - END * 2)}px)`;
    bar.style.setProperty('--off', `${(-y * 0.35).toFixed(1)}px`);
    if (Math.abs(y - bLastY) > 0.5) {
      bar.classList.toggle('is-up', y < bLastY);
      bar.classList.add('is-moving');
      clearTimeout(bMoveT); bMoveT = setTimeout(() => bar.classList.remove('is-moving'), 180);
    }
    bLastY = y;
  }
  function seekBar(e, immediate) {
    const r = bar.getBoundingClientRect(), ch = probe.offsetHeight;
    const p = Math.min(1, Math.max(0, (e.clientY - r.top - END - ch / 2) / (r.height - END * 2 - ch)));
    const y = p * maxScroll();
    if (lenis) lenis.scrollTo(y, immediate ? { immediate: true, force: true } : { duration: 1.2, force: true });
    else scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' });
  }
  if (bar) {
    bar.addEventListener('pointerdown', (e) => { bDrag = true; bar.classList.add('is-drag'); bar.setPointerCapture(e.pointerId); seekBar(e, probe.contains(e.target)); });
    bar.addEventListener('pointermove', (e) => { if (bDrag) seekBar(e, true); });
    const stop = () => { bDrag = false; bar.classList.remove('is-drag'); };
    bar.addEventListener('pointerup', stop); bar.addEventListener('pointercancel', stop);
    addEventListener('resize', () => updateBar(scrollY));
    requestAnimationFrame(() => updateBar(scrollY));
  }
  function onScroll(y) {
    updateBar(y);
    if (nav) nav.classList.toggle('is-scrolled', y > 40);
  }

  /* ---------------------------------------------------------
     Gauge: escape velocity, km/s
     --------------------------------------------------------- */
  const gaugeFill = $('#gaugeFill');
  const gaugeState = { p: 0 };
  let setGauge = () => {};
  if (gaugeFill) {
    const gLen = gaugeFill.getTotalLength();
    gaugeFill.style.strokeDasharray = gLen; gaugeFill.style.strokeDashoffset = gLen;
    const cx = 150, cy = 161.9, a0 = 151, sweep = 238, max = 15;
    let html = '';
    for (let i = 0; i <= max; i++) {
      const a = ((a0 + (sweep * i) / max) * Math.PI) / 180, major = i % 5 === 0;
      const r1 = major ? 88 : 94, r2 = 103;
      html += `<line class="${major ? 'major' : ''}" x1="${cx + r1 * Math.cos(a)}" y1="${cy + r1 * Math.sin(a)}" x2="${cx + r2 * Math.cos(a)}" y2="${cy + r2 * Math.sin(a)}"/>`;
      if (i % 3 === 0) html += `<text x="${cx + 74 * Math.cos(a)}" y="${cy + 74 * Math.sin(a)}">${i}</text>`;
    }
    $('#gaugeTicks').innerHTML = html;
    const stages = $$('#gaugeStages i'), readout = $('#gaugeValue');
    setGauge = (p) => {
      gaugeFill.style.strokeDashoffset = gLen * (1 - p);
      readout.textContent = (p * max).toFixed(1);
      const on = Math.round(p * 11);
      stages.forEach((l, i) => { l.className = i < on ? (i < 3 ? 'on-c' : i < 7 ? 'on-v' : 'on-s') : ''; });
    };
  }
  const GAUGE_TARGET = 11.2 / 15;

  /* ---------------------------------------------------------
     Contact: copy email, GitHub repo count, résumé
     --------------------------------------------------------- */
  const copyBtn = $('#copyEmail');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    const email = copyBtn.dataset.email;
    const done = () => {
      copyBtn.classList.add('is-done'); copyBtn.textContent = t('contact.copied');
      setTimeout(() => { copyBtn.classList.remove('is-done'); copyBtn.textContent = t('contact.copy'); }, 1600);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(email).then(done, () => {});
  });
  const repoWrap = $('#repoWrap');
  if (repoWrap) fetch('https://api.github.com/users/Monarch-IT')
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => { if (typeof d.public_repos === 'number' && d.public_repos > 0) { $('#repoCount').textContent = d.public_repos; repoWrap.hidden = false; $('#repoName').hidden = true; } })
    .catch(() => {});
  const resume = $('[data-resume]');
  if (resume && location.protocol !== 'file:') fetch(resume.getAttribute('href'), { method: 'HEAD' })
    .then((r) => { if (r.ok) resume.hidden = false; }).catch(() => {});

  applyLang(lang);

  /* ---------------------------------------------------------
     No GSAP: show everything, plain scroll
     --------------------------------------------------------- */
  if (!hasGSAP) {
    const l = $('#loader'); if (l) l.remove();
    document.body.classList.remove('is-loading');
    setGauge(GAUGE_TARGET);
    addEventListener('scroll', () => onScroll(scrollY), { passive: true });
    onScroll(scrollY);
    return;
  }

  /* ---------------------------------------------------------
     Lenis smooth scroll
     --------------------------------------------------------- */
  if (typeof window.Lenis !== 'undefined' && !reduced) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', (e) => { ScrollTrigger.update(); onScroll(e.scroll); });
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  }
  onScroll(scrollY);

  /* ---------------------------------------------------------
     Scroll animations
     --------------------------------------------------------- */
  function initScroll() {
    gsap.to('.progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
    if (reduced) { setGauge(GAUGE_TARGET); return; }

    $$('.split').forEach((el) => ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => { el.dataset.shown = 1; gsap.to($$('.w > span', el), { yPercent: 0, duration: 1.1, stagger: 0.05, ease: 'expo.out' }); }
    }));
    ScrollTrigger.batch('.reveal', {
      start: 'top 90%', once: true,
      onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 1, stagger: 0.07, ease: 'expo.out', overwrite: true, clearProps: 'transform' })
    });

    if ($('.hero')) {
      gsap.to('.hero__text', { y: -80, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: '.hero', start: '20% top', end: 'bottom top', scrub: true } });
    }
    if ($('.mission')) {
      gsap.fromTo('.mission__bigtext', { xPercent: 10 }, { xPercent: -30, ease: 'none', scrollTrigger: { trigger: '.mission', start: 'top bottom', end: 'bottom top', scrub: true } });
    }
    if (gaugeFill) gsap.to(gaugeState, {
      p: GAUGE_TARGET, ease: 'power2.out',
      scrollTrigger: { trigger: '.gauge-box', start: 'top 85%', end: 'center 45%', scrub: 0.6 },
      onUpdate: () => setGauge(gaugeState.p)
    });
    if ($('.contact__title')) gsap.fromTo('.contact__title', { letterSpacing: '0.01em' }, { letterSpacing: '-0.05em', ease: 'none', scrollTrigger: { trigger: '.contact__title', start: 'top 95%', end: 'top 45%', scrub: true } });

    $$('main section[id]').forEach((sec) => {
      const link = navLinksEl && $(`a[href="#${sec.id}"]`, navLinksEl);
      if (!link) return;
      ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (self) => navSection(link, self.isActive) });
    });
  }

  function heroIntro() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.hero__name .word', { yPercent: 110, duration: 1.4, stagger: 0.1 })
      .from('.hero__kicker', { opacity: 0, x: -30, duration: 1 }, '-=1.1')
      .from('.hero__alias', { opacity: 0, y: 16, duration: 0.9 }, '-=1.1')
      .from('.hero__slogan', { opacity: 0, y: 30, duration: 1 }, '-=1.1')
      .from('.hero__ctas > *', { opacity: 0, y: 20, duration: 0.9, stagger: 0.08 }, '-=1.0')
      .from('.hero__hint', { opacity: 0, duration: 0.8 }, '-=0.8')
      .from('.hero__tag', { opacity: 0, x: -30, duration: 0.9 }, '-=0.9')
      .from('.telemetry > *', { opacity: 0, y: 16, duration: 0.8, stagger: 0.06 }, '-=0.9')
      .from('.nav', { yPercent: -100, duration: 1, clearProps: 'transform' }, '-=1.2');
  }
  function caseIntro() {
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from('.case-title .word', { yPercent: 110, duration: 1.4 })
      .from('.case-hero .back, .case-status', { opacity: 0, x: -24, duration: 0.9, stagger: 0.08 }, '-=1.1')
      .from('.case-hero .lead, .case-hero .telemetry > *', { opacity: 0, y: 20, duration: 0.9, stagger: 0.06 }, '-=1.0');
  }

  /* ---------------------------------------------------------
     Loader: matter collapses into a singularity, then spacetime
     cracks through it and the two halves of the screen part
     --------------------------------------------------------- */
  function runLoader(loader) {
    const fx = window.LoaderFX;
    const fast = reduced || session('seenLoader');
    const pctEl = $('#loaderPct'), stageEl = $('#loaderStage'), barEl = $('#loaderBar');
    const prog = { p: 0 };
    let done = false, started = false, tw = null;
    S.intro = 0;
    if (lenis) lenis.stop();

    const stageKey = (p) => (p >= 1 ? 'loader.s4' : p > 0.7 ? 'loader.s3' : p > 0.3 ? 'loader.s2' : 'loader.s1');
    const render = () => {
      pctEl.textContent = String(Math.round(prog.p * 100)).padStart(3, '0');
      barEl.style.setProperty('--p', prog.p);
      if (fx) fx.set(prog.p);
      const k = stageKey(prog.p);
      if (stageEl.dataset.k !== k) { stageEl.dataset.k = k; stageEl.textContent = t(k); }
    };

    function makeHalves() {
      const W = innerWidth, H = innerHeight;
      const c = fx ? fx.center : { x: W / 2, y: H * 0.4 };
      const jag = Math.min(H * 0.07, 60);
      const pts = [[-30, c.y + (Math.random() - 0.5) * jag]];
      for (let x = -30; x < W + 30;) {
        x += 26 + Math.random() * 70;
        // the crack runs through the singularity
        const near = Math.abs(x - c.x) < 60;
        pts.push([x, near ? c.y + (Math.random() - 0.5) * 8 : c.y + (Math.random() - 0.5) * jag]);
      }
      pts.sort((a, b) => a[0] - b[0]);
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      const poly = pts.map((p) => `${p[0].toFixed(1)}px ${p[1].toFixed(1)}px`);
      const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="g" d="${line}"/><path class="c" d="${line}" pathLength="1"/></svg>`;
      const top = document.createElement('div'), bot = document.createElement('div');
      top.className = bot.className = 'loader__half';
      top.style.clipPath = `polygon(-30px -30px, ${W + 30}px -30px, ${[...poly].reverse().join(', ')})`;
      bot.style.clipPath = `polygon(${poly.join(', ')}, ${W + 30}px ${H + 30}px, -30px ${H + 30}px)`;
      top.style.transformOrigin = `${c.x}px ${c.y}px`; bot.style.transformOrigin = `${c.x}px ${c.y}px`;
      top.innerHTML = bot.innerHTML = svg;
      top.style.opacity = bot.style.opacity = 0;
      loader.insertBefore(top, $('.loader__flash', loader));
      loader.insertBefore(bot, $('.loader__flash', loader));
      return [top, bot];
    }

    const finish = () => {
      if (done) return;
      done = true;
      if (tw) tw.kill();
      prog.p = 1; render();
      loader.classList.add('is-started', 'is-imploding');
      if (fx) fx.implode();
      SFX.play('launch');
      const [top, bot] = makeHalves();
      const flash = $('.loader__flash', loader);
      const cores = $$('.c', loader);
      gsap.timeline()
        .to(flash, { opacity: 1, duration: 0.16, ease: 'power2.in' }, 0.48)
        .add(() => {
          loader.classList.add('is-split');
          top.style.opacity = bot.style.opacity = 1;
          if (fx) fx.stop();
          SFX.play('crack');
          document.body.classList.remove('is-loading');
          if (lenis) lenis.start();
        }, 0.64)
        .to(flash, { opacity: 0, duration: 0.7, ease: 'power2.out' }, 0.64)
        .to(cores, { strokeDashoffset: 0, duration: 0.32, ease: 'power3.out' }, 0.64)
        .add(() => {
          S.boost = 1;
          gsap.to(S, { intro: 1, duration: 2.4, ease: 'expo.out' });
          heroIntro();
        }, 0.95)
        .to(top, { yPercent: -110, rotate: -3, duration: 1.3, ease: 'expo.inOut' }, 0.95)
        .to(bot, { yPercent: 110, rotate: 3, duration: 1.3, ease: 'expo.inOut' }, 0.95)
        .add(() => loader.remove(), 2.3);
      initScroll(); ScrollTrigger.refresh();
      session('seenLoader', '1');
    };
    const start = (withSound) => {
      if (started || done) return;
      started = true;
      if (withSound !== undefined) SFX.setEnabled(withSound);
      loader.classList.add('is-started');
      const dur = fast ? 0.9 : 2.6;
      SFX.play('charge', dur);
      tw = gsap.to(prog, { p: 1, duration: dur, ease: 'power1.inOut', onUpdate: render, onComplete: finish });
    };

    if (!fast && SFX.supported) {
      loader.classList.add('has-gate');
      $('#loaderGo').addEventListener('click', (e) => { e.stopPropagation(); start(true); });
      $('#loaderMute').addEventListener('click', (e) => { e.stopPropagation(); start(false); });
      $('#loaderGo').focus({ preventScroll: true });
    } else start();
    loader.addEventListener('click', () => (started ? finish() : start(true)));
    addEventListener('keydown', (e) => {
      if (done) return;
      if (!started) {
        if (e.key === 'Escape') start(false);
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(true); }
        return;
      }
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    });
  }

  const loader = $('#loader');
  if (loader) runLoader(loader);
  else {
    document.body.classList.remove('is-loading');
    if ($('.hero')) heroIntro();
    if ($('.case-hero')) caseIntro();
    initScroll();
  }
  addEventListener('load', () => ScrollTrigger.refresh());
})();
