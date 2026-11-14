/* Synthesized sound effects (Web Audio, no files). Off until the visitor opts in. */
window.SFX = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, enabled = false, lastTick = 0;
  try { enabled = localStorage.getItem('sfx') === '1'; } catch (e) {}

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.32;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(f, t0, dur, type, g, f2) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    a.gain.setValueAtTime(0.0001, t0);
    a.gain.exponentialRampToValueAtTime(g, t0 + 0.012);
    a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(a).connect(master); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, g, fc, fc2) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = b;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(fc, t0);
    if (fc2) f.frequency.exponentialRampToValueAtTime(fc2, t0 + dur);
    const a = ctx.createGain();
    a.gain.setValueAtTime(g, t0); a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(f).connect(a).connect(master); n.start(t0);
  }

  function swell(f, f2, t0, dur, type, g) {
    const o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(g, t0 + dur);
    a.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.25);
    o.connect(a).connect(master); o.start(t0); o.stop(t0 + dur + 0.3);
  }

  const sounds = {
    charge(d) {   // matter being compressed: a rising drone
      const t = ctx.currentTime, dur = d || 2.4;
      swell(38, 150, t, dur, 'sawtooth', 0.05);
      swell(76, 300, t, dur, 'sine', 0.2);
      swell(1200, 4200, t + dur * 0.5, dur * 0.5, 'sine', 0.015);
    },
    launch() {   // collapse into the event horizon
      const t = ctx.currentTime;
      tone(320, t, 1.5, 'sawtooth', 0.08, 30);
      tone(70, t, 2.0, 'sine', 0.4, 22);
      noise(t, 1.5, 0.22, 3000, 90);
    },
    crack() { const t = ctx.currentTime; noise(t, 0.32, 0.32, 4200, 300); tone(110, t, 0.45, 'sine', 0.22, 38); },
    tick() { const now = performance.now(); if (now - lastTick < 60) return; lastTick = now; tone(2100, ctx.currentTime, 0.035, 'sine', 0.025); },
    whoosh() { const t = ctx.currentTime; noise(t, 0.4, 0.12, 400, 2600); }
  };

  return {
    get supported() { return !!AC; },
    get enabled() { return enabled; },
    setEnabled(v) {
      enabled = !!v;
      try { localStorage.setItem('sfx', enabled ? '1' : '0'); } catch (e) {}
      if (enabled) ensure();
      document.dispatchEvent(new CustomEvent('sfx', { detail: enabled }));
    },
    play(name, arg) {
      if (!enabled || !AC || !ensure()) return;
      try { sounds[name] && sounds[name](arg); } catch (e) {}
    }
  };
})();
