// Generative space ambience on the Web Audio API — no audio files.
// A slow D-major drone whose voicing opens up with the scale (star → universe),
// plus rare starlight "plinks" that get denser in the neighbourhood and the galaxy.

const NOTES = {
  D1: 36.71, D2: 73.42, A2: 110, D3: 146.83, E3: 164.81, Fs3: 185, A3: 220, Cs4: 277.18, E4: 329.63,
};
// [frequency, wave, levels where the voice is present (0..4)]
const VOICES: [number, OscillatorType, number[]][] = [
  [NOTES.D1, 'sine', [3.6, 4.2]],
  [NOTES.D2, 'sine', [0, 4.2]],
  [NOTES.A2, 'triangle', [0, 3.4]],
  [NOTES.D3, 'sine', [0, 4.2]],
  [NOTES.E3, 'triangle', [0.8, 3.2]],
  [NOTES.A3, 'sine', [0.9, 4.2]],
  [NOTES.Fs3, 'sine', [1.7, 3.6]],
  [NOTES.Cs4, 'sine', [1.8, 3.4]],
  [NOTES.E4, 'sine', [2.6, 3.6]],
];
const PLINKS = [587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51];

export class Ambient {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private filter!: BiquadFilterNode;
  private wet!: GainNode;
  private voices: { gain: GainNode; range: number[] }[] = [];
  private p = 0;
  private plinkTimer = 0;
  on = false;

  private build() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // reverb: generated impulse, ~5 s of decaying stereo noise
    const len = Math.floor(ctx.sampleRate * 5);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    verb.connect(this.wet).connect(this.master);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;
    this.filter.Q.value = 0.4;
    const dry = ctx.createGain();
    dry.gain.value = 0.6;
    this.filter.connect(dry).connect(this.master);
    this.filter.connect(verb);

    // slow breathing of the filter
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.045;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(this.filter.frequency);
    lfo.start();

    for (const [freq, type, range] of VOICES) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.filter);
      // two slightly detuned oscillators per voice = soft chorus
      for (const cents of [-5, 5]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = cents;
        osc.connect(gain);
        osc.start();
      }
      this.voices.push({ gain, range });
    }
    this.applyScale(true);
  }

  private applyScale(instant = false) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const tc = instant ? 0.01 : 1.6;
    const p = this.p;
    for (const v of this.voices) {
      const [a, b] = v.range;
      const inside = Math.min(1, Math.max(0, Math.min(p - a + 0.6, b - p + 0.6) / 0.6));
      v.gain.gain.setTargetAtTime(inside * 0.055, now, tc);
    }
    // brighter in the middle scales, darker at the edges of the universe
    const cutoff = 380 + 900 * Math.sin(Math.min(1, p / 4.2) * Math.PI) + (p > 3.5 ? -150 : 0);
    this.filter.frequency.setTargetAtTime(cutoff, now, tc);
  }

  private plink() {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const pan = ctx.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.value = PLINKS[Math.floor(Math.random() * PLINKS.length)];
    pan.pan.value = Math.random() * 1.6 - 0.8;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.03, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 2.6);
    osc.connect(g).connect(pan);
    pan.connect(this.wet);
    pan.connect(this.master);
    osc.start(now);
    osc.stop(now + 2.8);
  }

  private schedule() {
    clearTimeout(this.plinkTimer);
    if (!this.on) return;
    // denser among the stars (neighbourhood, galaxy), rare at the star and in the web
    const density = 0.25 + Math.exp(-((this.p - 2.4) ** 2) / 1.2);
    const delay = (1800 + Math.random() * 3800) / density;
    this.plinkTimer = window.setTimeout(() => {
      this.plink();
      this.schedule();
    }, delay);
  }

  setScale(p: number) {
    if (Math.abs(p - this.p) < 0.02) return;
    this.p = p;
    if (this.on) this.applyScale();
  }

  async start() {
    if (!this.ctx) this.build();
    const ctx = this.ctx!;
    if (ctx.state !== 'running') await ctx.resume();
    this.on = true;
    this.applyScale(true);
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 1.2);
    this.schedule();
  }

  stop() {
    this.on = false;
    clearTimeout(this.plinkTimer);
    const ctx = this.ctx;
    if (!ctx) return;
    this.master.gain.cancelScheduledValues(ctx.currentTime);
    this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    window.setTimeout(() => {
      if (!this.on) ctx.suspend();
    }, 1800);
  }

  /** A soft rising sweep — used when the camera flies into a project. */
  whoosh(up = true) {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(up ? 220 : 1400, now);
    bp.frequency.exponentialRampToValueAtTime(up ? 1400 : 220, now + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.07, now + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
    src.connect(bp).connect(g);
    g.connect(this.master);
    g.connect(this.wet);
    src.start(now);
  }

  /** Pause with the tab. */
  visibility(hidden: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.on) return;
    if (hidden) ctx.suspend();
    else ctx.resume();
  }
}
