/* Intro canvas: matter spirals into a forming black hole, then implodes into a singularity. */
window.LoaderFX = (() => {
  const cv = document.getElementById('loaderCanvas');
  if (!cv) return null;
  const ctx = cv.getContext('2d');
  const lite = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const N = lite ? 260 : 620, NS = lite ? 120 : 260;
  const TILT = -0.2, FLAT = 0.26;
  let W = 0, H = 0, cx = 0, cy = 0, base = 1;
  let charge = 0.12, target = 0.12, imp = 0, impT = 0, running = true, last = performance.now();
  const P = [], STARS = [];

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H * 0.4; base = Math.min(W, H) * 0.12;
    STARS.length = 0;
    for (let i = 0; i < NS; i++) STARS.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random(), t: Math.random() * 6.28 });
  }
  function spawn(p, fresh) {
    p.r = base * (fresh ? 1.2 + Math.random() * 3.4 : 3.6 + Math.random() * 1.2);
    p.a = Math.random() * Math.PI * 2;
    p.s = 0.6 + Math.random() * 0.8;
    p.px = null;
  }
  resize();
  for (let i = 0; i < N; i++) { const p = {}; spawn(p, true); P.push(p); }
  addEventListener('resize', resize);

  const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
  const proj = (r, a) => {
    const x = Math.cos(a) * r, y = Math.sin(a) * r * FLAT;
    return [cx + x * cosT - y * sinT, cy + x * sinT + y * cosT];
  };
  const COLORS = ['rgba(70,45,170,.55)', 'rgba(139,92,255,.75)', 'rgba(200,180,255,.85)', 'rgba(250,247,255,.95)'];

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    charge += (target - charge) * Math.min(1, dt * 4);
    if (impT) imp = Math.min(1, (now - impT) / 550);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(5,4,8,.26)';
    ctx.fillRect(0, 0, W, H);

    // background stars, dragged toward the singularity during the collapse
    const pull = imp * imp;
    for (const s of STARS) {
      const x = s.x + (cx - s.x) * pull, y = s.y + (cy - s.y) * pull;
      const a = (0.25 + 0.55 * s.s) * (0.7 + 0.3 * Math.sin(now / 700 + s.t)) * (1 - pull * 0.6);
      ctx.fillStyle = `rgba(230,225,255,${a.toFixed(3)})`;
      const sz = s.s > 0.92 ? 1.6 : 1;
      ctx.fillRect(x, y, sz, sz);
    }

    const rh = base * (0.12 + 0.5 * Math.min(charge, 1)) * (1 - imp);
    const spin = 0.6 + 2.6 * charge + 10 * imp;
    const fall = 3 + 70 * charge * charge + 900 * imp;
    const back = [[], [], [], []], front = [[], [], [], []];
    for (const p of P) {
      const k = base / p.r;
      p.a += spin * p.s * Math.pow(k, 1.5) * dt;
      p.r -= fall * Math.sqrt(k) * dt * (0.6 + p.s * 0.4);
      if (p.r < rh * 1.08 || p.r < 2) { if (imp > 0) { p.r = 0; continue; } spawn(p, false); }
      const [x, y] = proj(p.r, p.a);
      if (p.px !== null) {
        const t = (p.r - rh) / (base * 3.2);
        const c = t < 0.12 ? 3 : t < 0.35 ? 2 : t < 0.7 ? 1 : 0;
        (Math.sin(p.a) > 0 ? front : back)[c].push(p.px, p.py, x, y);
      }
      p.px = x; p.py = y;
    }
    const stroke = (set) => {
      ctx.lineCap = 'round';
      for (let c = 0; c < 4; c++) {
        const a = set[c]; if (!a.length) continue;
        ctx.strokeStyle = COLORS[c]; ctx.lineWidth = c === 3 ? 1.6 : 1.1;
        ctx.beginPath();
        for (let j = 0; j < a.length; j += 4) { ctx.moveTo(a[j], a[j + 1]); ctx.lineTo(a[j + 2], a[j + 3]); }
        ctx.stroke();
      }
    };

    ctx.globalCompositeOperation = 'lighter';
    stroke(back);
    if (rh > 0.5) {
      // light from the far side of the disk, bent over the shadow
      ctx.strokeStyle = `rgba(166,133,255,${(0.1 + 0.22 * charge).toFixed(3)})`;
      ctx.lineWidth = rh * 0.32;
      ctx.beginPath(); ctx.arc(cx, cy, rh * 1.36, 0, Math.PI * 2); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(cx, cy, rh, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = 'rgba(139,92,255,.9)'; ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(240,234,255,.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(cx, cy, rh * 1.05, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // before the horizon forms: a hot point of compressed matter
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26);
      g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.3, 'rgba(166,133,255,.6)'); g.addColorStop(1, 'rgba(139,92,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
    }
    stroke(front);
    ctx.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);

  return {
    get center() { return { x: cx, y: cy }; },
    set(p) { target = 0.12 + p * 0.95; },
    implode() { if (!impT) impT = performance.now(); },
    stop() { running = false; removeEventListener('resize', resize); }
  };
})();
