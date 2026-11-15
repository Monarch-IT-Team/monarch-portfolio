import * as THREE from 'three';
import { shared } from './materials';
import { buildBackground, buildStar, buildSystem, buildNeighbourhood, buildGalaxy, buildWeb, type Level, type LabelDef } from './levels';
import { clamp, rng, smooth } from './util';

export interface SceneOptions {
  canvas: HTMLCanvasElement;
  labelRoot: HTMLElement;
  low: boolean;
  reduced: boolean;
  years: number;
  projects: string[];
  onFrame?: (p: number) => void;
}

export type HighlightKind = 'skill' | 'project';

export interface SceneHandle {
  setTarget(p: number, fx: number, fy: number): void;
  jump(p: number, fx: number, fy: number): void;
  /** Pointer in -1..1 (y down) — slight camera parallax. */
  setPointer(x: number, y: number): void;
  highlight(kind: HighlightKind, i: number | null): void;
  /** Fly the camera into a project star; null flies back. fx/fy = where the star sits on screen. */
  focusProject(i: number | null, fx?: number, fy?: number): void;
  /** Lite mode: stops rendering completely. */
  setEnabled(on: boolean): void;
  ignite: THREE.IUniform<number>;
}

const F = 12; // zoom factor between two neighbouring scales
const D = 10; // camera distance
const D_FOCUS = 2.4; // camera distance when flying into a project

/** Zoom window of each level. */
function levelOpacity(k: number, p: number) {
  if (k === 0) return 1 - smooth(2.45, 2.95, p);
  const fin = smooth(k - 0.8, k - 0.3, p);
  // past the last scale the web dims so the contacts stay readable
  const fout = k === 4 ? 1 - 0.5 * smooth(4.02, 4.12, p) : 1 - smooth(k + 0.45, k + 0.9, p);
  return fin * fout;
}

class Labels {
  private items: { el: HTMLElement; level: number; group: THREE.Object3D; def: LabelDef; shown: boolean }[] = [];
  private v = new THREE.Vector3();
  constructor(private root: HTMLElement) {}

  add(level: number, group: THREE.Object3D, def: LabelDef) {
    const el = document.createElement('span');
    el.className = `lbl lbl--${def.kind}`;
    el.textContent = def.text;
    if (def.kind === 'project') el.dataset.openProject = String(def.index);
    this.root.appendChild(el);
    this.items.push({ el, level, group, def, shown: false });
  }

  setHighlight(kind: string, i: number | null) {
    for (const it of this.items) it.el.classList.toggle('is-hi', it.def.kind === kind && it.def.index === i);
  }

  hideAll() {
    for (const it of this.items) {
      it.el.style.opacity = '0';
      it.el.classList.remove('is-live');
      it.shown = false;
    }
  }

  update(camera: THREE.Camera, W: number, H: number, opac: number[], t: number, on: boolean, focusIdx: number | null, fe: number) {
    for (const it of this.items) {
      let o = on ? Math.pow(opac[it.level], 3) : 0;
      // while flying into a project only its own label stays
      if (fe > 0 && !(it.def.kind === 'project' && it.def.index === focusIdx)) o *= 1 - fe;
      if (o < 0.02) {
        if (it.shown) {
          it.el.style.opacity = '0';
          it.el.classList.remove('is-live');
          it.shown = false;
        }
        continue;
      }
      it.def.local(t, this.v).applyMatrix4(it.group.matrixWorld).project(camera);
      if (this.v.z > 1) continue;
      const x = (this.v.x * 0.5 + 0.5) * W;
      const y = (-this.v.y * 0.5 + 0.5) * H;
      it.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      it.el.style.opacity = o.toFixed(3);
      it.el.classList.toggle('is-live', o > 0.5 && fe < 0.05);
      it.shown = true;
    }
  }
}

export function createScene(o: SceneOptions): SceneHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas: o.canvas,
    antialias: !o.low,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x03040a, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.02, 500);
  const r = rng(20080328);

  const bg = buildBackground(r, o.low);
  const star = buildStar();
  const levels: Level[] = [
    star,
    buildSystem(r, o.low, o.years),
    buildNeighbourhood(r, o.low),
    buildGalaxy(r, o.low, o.projects),
    buildWeb(r, o.low),
  ];
  scene.add(bg.group);
  for (const l of levels) scene.add(l.group);

  const labels = new Labels(o.labelRoot);
  levels.forEach((l, k) => l.labels?.forEach((d) => labels.add(k, l.group, d)));

  let W = 0;
  let H = 0;
  function resize(force = false) {
    const w = o.canvas.clientWidth || innerWidth;
    const h = o.canvas.clientHeight || innerHeight;
    // Ignore small height jumps from mobile address bars.
    if (!force && w === W && Math.abs(h - H) < 140) return;
    W = w;
    H = h;
    const pr = Math.min(window.devicePixelRatio || 1, o.low ? 1.5 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    shared.uPR.value = pr;
    shared.uVH.value = H;
  }
  resize(true);

  const target = { p: 0, fx: 0.5, fy: 0.5 };
  const cur = { p: 0, fx: 0.5, fy: 0.5 };
  const pointer = { x: 0, y: 0 };
  const look = { x: 0, y: 0 };
  const view = { i: null as number | null, last: 0, fx: 0.34, fy: 0.5, amount: 0 };
  const opac = [0, 0, 0, 0, 0];
  const scales = [1, 1, 1, 1, 1];
  const pos = levels.map(() => new THREE.Vector3());
  const tmp = new THREE.Vector3();
  const marker = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const timer = new THREE.Timer();
  let t = 0;

  function frame(now: number) {
    timer.update(now);
    const dt = Math.min(timer.getDelta(), 0.05);
    t += dt * (o.reduced ? 0.3 : 1);
    shared.uTime.value = t;
    resize();

    const k = 1 - Math.exp(-dt * 3);
    cur.p += (target.p - cur.p) * k;
    cur.fx += (target.fx - cur.fx) * k;
    cur.fy += (target.fy - cur.fy) * k;
    const p = cur.p;

    // fly-in towards a project star
    const fTarget = view.i === null ? 0 : 1;
    view.amount += (fTarget - view.amount) * (1 - Math.exp(-dt * (o.reduced ? 20 : 2.2)));
    const fe = smooth(0, 1, view.amount);
    levels[3].setFocus?.(view.i ?? view.last, fe);

    for (const l of levels) l.update(t, dt, p);

    // Place every level: L4 at the origin, each smaller level inside its parent's anchor.
    for (let i = 0; i < 5; i++) scales[i] = Math.pow(F, i - p);
    pos[4].set(0, 0, 0);
    for (let i = 4; i >= 1; i--) {
      tmp.copy(levels[i].anchor).applyQuaternion(levels[i].quat).multiplyScalar(scales[i]);
      pos[i - 1].copy(pos[i]).add(tmp);
    }
    // The camera looks at the current level and glides to the next one.
    const pc = clamp(p, 0, 4);
    const k0 = Math.floor(pc);
    const k1 = Math.min(4, k0 + 1);
    focus.copy(pos[k0]).lerp(pos[k1], smooth(0, 1, pc - k0));
    if (fe > 0.0005 && levels[3].pointOf) {
      levels[3].pointOf(view.i ?? view.last, t, marker);
      marker.multiplyScalar(scales[3]).applyQuaternion(levels[3].quat).add(pos[3]);
      focus.lerp(marker, fe);
    }

    const bhEl = document.getElementById('bh');
    const bhVis = bhEl ? Math.min(1, (parseFloat(bhEl.dataset.vis || '0') || 0) * 1.65) : 0;
    levels.forEach((l, i) => {
      l.group.position.copy(pos[i]).sub(focus);
      l.group.scale.setScalar(scales[i]);
      l.group.quaternion.copy(l.quat);
      let op = levelOpacity(i, p);
      if (i === 1) op *= Math.max(0, 1 - bhVis);
      opac[i] = op;
      l.group.visible = op > 0.003;
      if (l.group.visible) l.setOpacity(op);
    });
    bg.update(t, p);

    const lk = 1 - Math.exp(-dt * 2);
    look.x += (pointer.x - look.x) * lk;
    look.y += (pointer.y - look.y) * lk;
    const free = 1 - fe;
    const yaw = o.reduced ? 0 : look.x * 0.06 * free + Math.sin(t * 0.05) * 0.025;
    const pitch = o.reduced ? 0 : -look.y * 0.04 * free + Math.sin(t * 0.037) * 0.015 + fe * 0.18;
    const dist = D + (D_FOCUS - D) * fe;
    camera.position.set(Math.sin(yaw) * dist * Math.cos(pitch), Math.sin(pitch) * dist, Math.cos(yaw) * dist * Math.cos(pitch));
    camera.lookAt(0, 0, 0);
    const fx = cur.fx + (view.fx - cur.fx) * fe;
    const fy = cur.fy + (view.fy - cur.fy) * fe;
    camera.setViewOffset(W, H, -(fx - 0.5) * W, -(fy - 0.5) * H, W, H);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();

    labels.update(camera, W, H, opac, t, W >= 760, view.i, fe);
    renderer.render(scene, camera);
    o.onFrame?.(p);
  }

  let enabled = true;
  renderer.setAnimationLoop(frame);

  return {
    setTarget(p, fx, fy) {
      target.p = p;
      target.fx = fx;
      target.fy = fy;
    },
    jump(p, fx, fy) {
      target.p = cur.p = p;
      target.fx = cur.fx = fx;
      target.fy = cur.fy = fy;
    },
    setPointer(x, y) {
      pointer.x = x;
      pointer.y = y;
    },
    highlight(kind, i) {
      levels[kind === 'skill' ? 2 : 3].highlight?.(i);
      labels.setHighlight(kind, i);
    },
    focusProject(i, fx = 0.34, fy = 0.5) {
      view.i = i;
      if (i !== null) view.last = i;
      view.fx = fx;
      view.fy = fy;
    },
    setEnabled(on) {
      if (on === enabled) return;
      enabled = on;
      if (on) {
        renderer.setAnimationLoop(frame);
      } else {
        renderer.setAnimationLoop(null);
        labels.hideAll();
      }
    },
    ignite: star.ignite,
  };
}
