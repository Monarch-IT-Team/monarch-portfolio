// A static starfield tile (SVG data URI) for lite mode, the no-WebGL fallback and the 404 page.

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function starfield(seed = 2017, size = 720, count = 240) {
  const r = rng(seed);
  const colors = ['#ffffff', '#fff1dc', '#cfdcff', '#ffd2a1', '#9fb6ff'];
  let dots = '';
  for (let i = 0; i < count; i++) {
    const x = (r() * size).toFixed(1);
    const y = (r() * size).toFixed(1);
    const big = r() < 0.06;
    const rad = big ? 1 + r() * 0.8 : 0.35 + r() * 0.6;
    const op = big ? 0.75 + r() * 0.25 : 0.2 + r() * 0.5;
    dots += `<circle cx="${x}" cy="${y}" r="${rad.toFixed(2)}" fill="${colors[Math.floor(r() * colors.length)]}" opacity="${op.toFixed(2)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${dots}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
