/* Gravity particles + fabric cracks on click. Reads window.SPACE. */
(() => {
  const S = window.SPACE, cv = document.getElementById('fx');
  if (!S || !cv || S.reduce) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  addEventListener('resize', resize); resize();

  const N = S.lite ? 160 : 480;
  const X = new Float32Array(N), Y = new Float32Array(N), VX = new Float32Array(N), VY = new Float32Array(N), D = new Float32Array(N);
  const rnd = Math.random;

  function orbitVel(i, x, y) {
    const b = S.bh;
    if (b.r > 0) {
      const dx = x - b.x, dy = y - b.y, r = Math.hypot(dx, dy) + 1;
      const v = Math.sqrt(gmBH() / r) * (0.6 + rnd() * 0.5);
      VX[i] = -dy / r * v; VY[i] = dx / r * v;
    } else { VX[i] = (rnd() - 0.5) * 0.6; VY[i] = (rnd() - 0.5) * 0.6; }
  }
  function spawn(i, anywhere) {
    if (anywhere) { X[i] = rnd() * W; Y[i] = rnd() * H; }
    else {
      const e = rnd() * 4 | 0;
      if (e === 0) { X[i] = -20; Y[i] = rnd() * H; } else if (e === 1) { X[i] = W + 20; Y[i] = rnd() * H; }
      else if (e === 2) { X[i] = rnd() * W; Y[i] = -20; } else { X[i] = rnd() * W; Y[i] = H + 20; }
    }
    D[i] = rnd();
    orbitVel(i, X[i], Y[i]);
  }
  const gmBH = () => 700 * (S.bh.r / 0.2);
  for (let i = 0; i < N; i++) spawn(i, true);

  // scroll parallax: particles drift with the page
  let lastSY = scrollY;
  addEventListener('scroll', () => {
    const d = scrollY - lastSY; lastSY = scrollY;
    for (let i = 0; i < N; i++) Y[i] -= d * (0.15 + D[i] * 0.5);
  }, { passive: true });

  // cracks
  const segs = [];
  function grow(x, y, a, len, depth, t0) {
    const n = 7 + (rnd() * 4 | 0); let px = x, py = y, ang = a;
    for (let i = 0; i < n; i++) {
      ang += (rnd() - 0.5) * 0.75;
      const l = len / n * (0.6 + rnd() * 0.8);
      const nx = px + Math.cos(ang) * l, ny = py + Math.sin(ang) * l;
      segs.push({ x1: px, y1: py, x2: nx, y2: ny, t: t0 + i * 16 + depth * 70, d: depth });
      if (depth < 3 && rnd() < 0.28) grow(nx, ny, ang + (rnd() - 0.5) * 1.8, len * 0.55, depth + 1, t0 + i * 16 + depth * 70);
      px = nx; py = ny;
    }
  }
  function crack(x, y) {
    const arms = 5 + (rnd() * 3 | 0), t0 = performance.now(), base = rnd() * 6.28;
    for (let k = 0; k < arms; k++) grow(x, y, base + k * (6.28 / arms) + (rnd() - 0.5) * 0.5, (S.lite ? 110 : 170) + rnd() * 120, 0, t0);
    // shockwave: push particles outward
    const R = 260;
    for (let i = 0; i < N; i++) {
      const dx = X[i] - x, dy = Y[i] - y, r = Math.hypot(dx, dy) + 1;
      if (r < R) { const f = (1 - r / R) * 9; VX[i] += dx / r * f; VY[i] += dy / r * f; }
    }
    if (segs.length > 600) segs.splice(0, segs.length - 600);
  }
  addEventListener('pointerdown', e => {
    if (e.button > 0 || document.body.classList.contains('is-loading')) return;
    if (e.target.closest && e.target.closest('a,button,input,textarea,.nav,.orbitbar,.loader')) return;
    crack(e.clientX, e.clientY);
    window.SFX && SFX.play('crack');
  }, { passive: true });
  S.crack = crack;

  const styles = ['rgba(140,110,255,.3)', 'rgba(190,168,255,.45)', 'rgba(245,240,255,.6)'];
  S.ticks.push((now, dt) => {
    const k = Math.min(2, dt * 60);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const b = S.bh, m = S.mouse;
    const bhOn = b.r > 0, gb = bhOn ? gmBH() : 0, rh = b.r * 0.5 * H;
    const gm = 150 + S.boost * 600;
    const buckets = [[], [], []];

    for (let i = 0; i < N; i++) {
      let ax = 0, ay = 0, x = X[i], y = Y[i];
      if (bhOn) {
        const dx = b.x - x, dy = b.y - y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2) + 0.01;
        if (r < rh * 1.25) { spawn(i, false); continue; }
        const a = gb / (r2 + 900);
        ax += a * dx / r; ay += a * dy / r;
      }
      {
        const dx = m.x - x, dy = m.y - y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2) + 0.01;
        const a = gm / (r2 + 2800);
        ax += a * dx / r; ay += a * dy / r;
      }
      let vx = VX[i] + ax * k, vy = VY[i] + ay * k;
      const drag = 1 - 0.0025 * k; vx *= drag; vy *= drag;
      const sp0 = Math.hypot(vx, vy), VMAX = 5;
      if (sp0 > VMAX) { vx *= VMAX / sp0; vy *= VMAX / sp0; }
      const nx = x + vx * k, ny = y + vy * k;
      if (nx < -60 || nx > W + 60 || ny < -60 || ny > H + 60) { spawn(i, false); continue; }
      VX[i] = vx; VY[i] = vy; X[i] = nx; Y[i] = ny;
      const sp = Math.abs(vx) + Math.abs(vy);
      const c = sp < 1.6 ? 0 : sp < 4 ? 1 : 2;
      buckets[c].push(x, y, nx, ny);
    }
    ctx.lineCap = 'round';
    for (let c = 0; c < 3; c++) {
      const a = buckets[c]; if (!a.length) continue;
      ctx.strokeStyle = styles[c]; ctx.lineWidth = c === 0 ? 0.8 : c === 1 ? 1.1 : 1.5;
      ctx.beginPath();
      for (let j = 0; j < a.length; j += 4) { ctx.moveTo(a[j], a[j + 1]); ctx.lineTo(a[j + 2], a[j + 3]); }
      ctx.stroke();
    }

    // cracks
    const LIFE = 2400;
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i], age = now - s.t;
      if (age > LIFE) { segs.splice(i, 1); continue; }
      if (age < 0) continue;
      const a = age < 160 ? age / 160 : 1 - (age - 160) / (LIFE - 160);
      const w = Math.max(0.6, 2.4 - s.d * 0.6);
      ctx.strokeStyle = 'rgba(120,80,255,' + (a * 0.28).toFixed(3) + ')'; ctx.lineWidth = w * 4;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,232,255,' + a.toFixed(3) + ')'; ctx.lineWidth = w * 0.7;
      ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  });
})();
