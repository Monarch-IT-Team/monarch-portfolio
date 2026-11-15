export async function initStarPortrait(_canvas: HTMLCanvasElement | null, _reduced: boolean) {
  const el = document.getElementById('heroPortrait');
  if (!el) return;
  const update = () => {
    const fade = Math.max(0, Math.min(1, 1 - scrollY / (innerHeight * 0.85)));
    el.style.opacity = String(fade);
  };
  addEventListener('scroll', update, { passive: true });
  update();
}
