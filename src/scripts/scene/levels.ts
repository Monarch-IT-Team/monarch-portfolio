// The five scales of the journey. Each level is drawn at its "natural" size;
// the scene zooms between them by scaling every level by F^(k - p).

import * as THREE from 'three';
import {
  makePoints,
  pointsMaterial,
  starBillboard,
  glowBillboard,
  nebulaBillboard,
  orbitMaterial,
  drawLineMaterial,
} from './materials';
import { buffers, clamp, gauss, quat, smooth, unitVector, weighted, writeColor, type Rand } from './util';

export interface LabelDef {
  text: string;
  kind: 'skill' | 'project' | 'greek';
  index: number;
  local: (t: number, out: THREE.Vector3) => THREE.Vector3;
}

export interface Level {
  group: THREE.Group;
  /** Where the previous (smaller) level lives, in this level's local units. */
  anchor: THREE.Vector3;
  /** World orientation, refreshed every frame. */
  quat: THREE.Quaternion;
  labels?: LabelDef[];
  update(t: number, dt: number, p: number): void;
  setOpacity(o: number): void;
  highlight?(i: number | null): void;
  /** Local position of the i-th marker (projects in the galaxy). */
  pointOf?(i: number, t: number, out: THREE.Vector3): THREE.Vector3;
  /** Camera flew into marker i; amount 0..1. */
  setFocus?(i: number | null, amount: number): void;
}

const STELLAR: [number, number][] = [
  [0xffffff, 5],
  [0xfff1dc, 4],
  [0xcfdcff, 3],
  [0xffd2a1, 2],
  [0x9fb6ff, 1.2],
  [0xffa985, 0.8],
];

/** Shared "highlight" behaviour: uHi = index, uHiAmt eases in and out. */
function highlighter(mat: THREE.ShaderMaterial) {
  let target = 0;
  return {
    set(i: number | null) {
      if (i !== null) mat.uniforms.uHi.value = i;
      target = i === null ? 0 : 1;
    },
    step(dt: number) {
      const u = mat.uniforms.uHiAmt;
      u.value += (target - u.value) * (1 - Math.exp(-dt * 9));
    },
  };
}

/* ------------------------------------------------------------ background */

export function buildBackground(r: Rand, low: boolean) {
  const group = new THREE.Group();

  const n = low ? 1800 : 3800;
  const b = buffers(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    unitVector(r, v).multiplyScalar(30 + r() * 30);
    b.pos.set([v.x, v.y, v.z], i * 3);
    writeColor(b.color, i, weighted(r, STELLAR), 0.55 + 0.45 * r());
    b.size[i] = 2.2 + 8 * Math.pow(r(), 5);
    b.seed[i] = r();
  }
  const starMat = pointsMaterial({ twinkle: 0.45 });
  group.add(makePoints(b, starMat));

  // Faint distant galaxies that appear once we leave the Milky Way scale.
  const m = low ? 140 : 300;
  const g = buffers(m);
  for (let i = 0; i < m; i++) {
    unitVector(r, v).multiplyScalar(48 + r() * 26);
    g.pos.set([v.x, v.y, v.z], i * 3);
    writeColor(g.color, i, weighted(r, [[0xd9c7ff, 2], [0xffe0bd, 2], [0xbcd0ff, 2]]), 0.25 + 0.3 * r());
    g.size[i] = 9 + 11 * r();
    g.seed[i] = r();
  }
  const galMat = pointsMaterial({ twinkle: 0 });
  group.add(makePoints(g, galMat));

  return {
    group,
    update(t: number, p: number) {
      group.rotation.y = t * 0.004;
      starMat.uniforms.uOpacity.value = 1 - 0.85 * smooth(2.35, 2.95, p);
      galMat.uniforms.uOpacity.value = 0.9 * smooth(2.5, 3.3, p);
    },
  };
}

/* ------------------------------------------------------- L0 · the star */

export function buildStar() {
  const group = new THREE.Group();
  const { mesh, mat } = starBillboard();
  mesh.scale.setScalar(9);
  group.add(mesh);
  const level: Level & { ignite: THREE.IUniform<number> } = {
    group,
    anchor: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    update() {},
    setOpacity(o) {
      mat.uniforms.uOpacity.value = o;
    },
    ignite: mat.uniforms.uIgnite as THREE.IUniform<number>,
  };
  return level;
}

/* ---------------------------------------- L1 · system: one orbit per year */

export function buildSystem(r: Rand, low: boolean, years: number): Level {
  const group = new THREE.Group();
  const n = clamp(Math.round(years), 3, 16);
  const radii = Array.from({ length: n }, (_, i) => 0.62 + i * (2.85 / (n - 1)));
  const orbitMats: THREE.ShaderMaterial[] = [];
  const SEG = 220;

  radii.forEach((rad, i) => {
    const milestone = i === 0 || i === n - 1;
    const pos = new Float32Array(SEG * 3);
    const ang = new Float32Array(SEG);
    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;
      pos[s * 3] = Math.cos(a) * rad;
      pos[s * 3 + 2] = Math.sin(a) * rad;
      ang[s] = a;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAng', new THREE.BufferAttribute(ang, 1));
    const mat = orbitMaterial(milestone ? 0xe8c47e : 0xc9d2ff, milestone ? 0.14 : 0.06);
    const line = new THREE.LineLoop(geo, mat);
    line.frustumCulled = false;
    group.add(line);
    orbitMats.push(mat);
  });

  // Planets — one per orbit; the first (2017) and the latest year are gold.
  const pb = buffers(n);
  const phase = radii.map(() => r() * Math.PI * 2);
  const omega = radii.map((rad) => 0.2 * Math.pow(rad, -1.5));
  for (let i = 0; i < n; i++) {
    const milestone = i === 0 || i === n - 1;
    writeColor(pb.color, i, milestone ? 0xf6d595 : weighted(r, [[0xdfe6ff, 2], [0xa9bcff, 1], [0xffe2c4, 1]]));
    pb.size[i] = milestone ? 8 : 4.6 + r() * 1.6;
    pb.seed[i] = r();
  }
  const planetMat = pointsMaterial({ twinkle: 0.06 });
  const planets = makePoints(pb, planetMat);
  group.add(planets);
  const pAttr = planets.geometry.getAttribute('position') as THREE.BufferAttribute;

  // Thin dust disk rotating with Kepler speeds.
  const nd = low ? 1300 : 2600;
  const d = buffers(nd);
  for (let i = 0; i < nd; i++) {
    const rad = 0.35 + 3.6 * Math.pow(r(), 0.8);
    const a = r() * Math.PI * 2;
    d.pos.set([Math.cos(a) * rad, gauss(r) * 0.035 * (1 + rad * 0.2), Math.sin(a) * rad], i * 3);
    writeColor(d.color, i, weighted(r, [[0xbfc8ff, 3], [0xffe7c9, 2], [0x8fa0ff, 1]]), 0.5);
    d.size[i] = 1.2 + Math.pow(r(), 3) * 2.2;
    d.seed[i] = r();
  }
  const dustMat = pointsMaterial({ kepler: true, spin: 0.2, twinkle: 0.3 });
  group.add(makePoints(d, dustMat));

  const mats = [planetMat, dustMat, ...orbitMats];
  return {
    group,
    anchor: new THREE.Vector3(),
    quat: quat(-0.68, 0, 0.16),
    update(t) {
      for (let i = 0; i < n; i++) {
        const th = phase[i] + t * omega[i];
        pAttr.setXYZ(i, Math.cos(th) * radii[i], 0, Math.sin(th) * radii[i]);
        orbitMats[i].uniforms.uPA.value = th;
      }
      pAttr.needsUpdate = true;
    },
    setOpacity(o) {
      for (const m of mats) m.uniforms.uOpacity.value = o;
    },
  };
}

/* ------------------------------ L2 · neighbourhood: skills are the stars */

export function buildNeighbourhood(r: Rand, low: boolean, skills = 10): Level {
  const group = new THREE.Group();
  const v = new THREE.Vector3();

  const n = low ? 650 : 1300;
  const b = buffers(n);
  for (let i = 0; i < n; i++) {
    unitVector(r, v).multiplyScalar(0.35 + 4.2 * Math.cbrt(r()));
    b.pos.set([v.x, v.y, v.z], i * 3);
    writeColor(b.color, i, weighted(r, STELLAR), 0.6 + 0.4 * r());
    b.size[i] = 2.2 + 7 * Math.pow(r(), 5);
    b.seed[i] = r();
  }
  const fieldMat = pointsMaterial({ twinkle: 0.35 });
  group.add(makePoints(b, fieldMat));

  // Ten named stars, laid out on a golden-angle spiral so labels never collide.
  const sb = buffers(skills);
  const local: THREE.Vector3[] = [];
  for (let i = 0; i < skills; i++) {
    const a = i * 2.39996 + 0.6;
    const rad = 0.95 + 1.35 * Math.sqrt((i + 0.5) / skills);
    const p = new THREE.Vector3(Math.cos(a) * rad * 0.95, Math.sin(a) * rad * 0.85, (r() - 0.5) * 1.2);
    local.push(p);
    sb.pos.set([p.x, p.y, p.z], i * 3);
    writeColor(sb.color, i, 0xf6dca0);
    sb.size[i] = 9;
    sb.seed[i] = r();
    sb.id[i] = i;
  }
  const skillMat = pointsMaterial({ twinkle: 0.1 });
  group.add(makePoints(sb, skillMat));
  const hi = highlighter(skillMat);

  const nebMats: THREE.ShaderMaterial[] = [];
  const nebulae: [number, number, number, number, number, number, number][] = [
    [-2.6, 1.3, -3.2, 8.5, 0x2f2a7a, 0x6f8dff, 1.3],
    [3.0, -1.6, -4.2, 10, 0x173f7a, 0x8a5cff, 4.1],
    [0.6, 2.6, -5.5, 7, 0x4a2260, 0x3f7bff, 7.7],
  ];
  for (const [x, y, z, s, c1, c2, seed] of low ? nebulae.slice(0, 2) : nebulae) {
    const { mesh, mat } = nebulaBillboard(c1, c2, seed);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(s);
    group.add(mesh);
    nebMats.push(mat);
  }

  const q = new THREE.Quaternion();
  return {
    group,
    anchor: new THREE.Vector3(),
    quat: q,
    labels: local.map((p, i) => ({
      text: String(i + 1).padStart(2, '0'),
      kind: 'skill' as const,
      index: i,
      local: (_t: number, out: THREE.Vector3) => out.copy(p),
    })),
    update(t, dt) {
      q.copy(quat(0.2, Math.sin(t * 0.03) * 0.25, 0));
      hi.step(dt);
    },
    setOpacity(o) {
      fieldMat.uniforms.uOpacity.value = o;
      skillMat.uniforms.uOpacity.value = o;
      for (const m of nebMats) m.uniforms.uOpacity.value = o * 0.38;
    },
    highlight: hi.set,
  };
}

/* ------------------------------------- L3 · galaxy: projects are systems */

const GALAXY_SPIN = 0.018;

function galaxyAngle(t: number, rad: number) {
  return t * GALAXY_SPIN * (1 + 0.35 / (0.45 + rad));
}

export function buildGalaxy(r: Rand, low: boolean, projects: string[]): Level {
  const group = new THREE.Group();
  const R = 3.3;
  const R0 = 0.35;
  const B = 0.42; // log-spiral pitch: θ = ln(r / R0) / B
  const armAngle = (rad: number, arm: number) => arm * Math.PI + Math.log(rad / R0) / B;

  const warm = new THREE.Color(0xffdcaa);
  const white = new THREE.Color(0xf3f0ff);
  const blue = new THREE.Color(0x8faaff);
  const c = new THREE.Color();
  const radial = (f: number) =>
    f < 0.35 ? c.copy(warm).lerp(white, f / 0.35) : c.copy(white).lerp(blue, (f - 0.35) / 0.65);

  const n = low ? 22000 : 56000;
  const b = buffers(n);
  for (let i = 0; i < n; i++) {
    const kind = r();
    let x: number, y: number, z: number;
    if (kind < 0.17) {
      // bulge
      const rad = Math.abs(gauss(r)) * 0.42;
      const a = r() * Math.PI * 2;
      y = gauss(r) * 0.16 * Math.max(0.2, 1 - rad / 1.2);
      x = Math.cos(a) * rad;
      z = Math.sin(a) * rad;
      writeColor(b.color, i, weighted(r, [[0xffe2b0, 3], [0xfff1dc, 2], [0xffc98a, 1]]), 0.34 + 0.2 * r());
      b.size[i] = 1.6 + 2.4 * Math.pow(r(), 3);
    } else if (kind < 0.37) {
      // diffuse disk between the arms
      const rad = R0 + (R - R0) * Math.pow(r(), 0.7);
      const a = r() * Math.PI * 2;
      x = Math.cos(a) * rad;
      z = Math.sin(a) * rad;
      y = gauss(r) * 0.05;
      radial(rad / R);
      b.color.set([c.r * 0.32, c.g * 0.32, c.b * 0.32], i * 3);
      b.size[i] = 1.2 + Math.pow(r(), 3) * 1.4;
    } else {
      // spiral arms
      const rad = R0 + (R - R0) * Math.pow(r(), 0.85);
      const arm = r() < 0.5 ? 0 : 1;
      const a = armAngle(rad, arm) + gauss(r) * (0.12 + 0.16 * (1 - rad / R));
      x = Math.cos(a) * rad;
      z = Math.sin(a) * rad;
      y = gauss(r) * 0.045;
      if (r() < 0.04) {
        writeColor(b.color, i, 0xff8fb3, 0.75);
        b.size[i] = 2.6 + 1.4 * r();
      } else {
        radial(rad / R);
        const m = 0.5 + 0.3 * r();
        b.color.set([c.r * m, c.g * m, c.b * m], i * 3);
        b.size[i] = 1.3 + 2.2 * Math.pow(r(), 4);
      }
    }
    b.pos.set([x, y, z], i * 3);
    b.seed[i] = r();
  }
  const diskMat = pointsMaterial({ galaxy: true, spin: GALAXY_SPIN, twinkle: 0.15, sizeMul: 0.9 });
  group.add(makePoints(b, diskMat));

  const bulge = glowBillboard(0xfff0d6, 0xffb36b);
  bulge.mesh.scale.setScalar(2.6);
  group.add(bulge.mesh);

  // Pinned projects = bright gold systems sitting on the arms.
  const count = projects.length;
  const mb = buffers(Math.max(count, 1));
  const mLocal: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const rad = 1.25 + ((i * 0.62) % 2.2);
    const a = armAngle(rad, i % 2) + 0.05;
    const p = new THREE.Vector3(Math.cos(a) * rad, 0.04, Math.sin(a) * rad);
    mLocal.push(p);
    mb.pos.set([p.x, p.y, p.z], i * 3);
    writeColor(mb.color, i, 0xf7d08a);
    mb.size[i] = 10;
    mb.seed[i] = r();
    mb.id[i] = i;
  }
  const markMat = pointsMaterial({ galaxy: true, spin: GALAXY_SPIN, twinkle: 0.08 });
  if (count) group.add(makePoints(mb, markMat));
  const hi = highlighter(markMat);

  const pointOf = (i: number, t: number, out: THREE.Vector3) => {
    const p = mLocal[i];
    const a = galaxyAngle(t, Math.hypot(p.x, p.z));
    const s = Math.sin(a);
    const co = Math.cos(a);
    return out.set(co * p.x - s * p.z, p.y, s * p.x + co * p.z);
  };

  // A tiny planetary system that appears around a project star when the camera flies in.
  const sys = new THREE.Group();
  sys.visible = false;
  group.add(sys);
  const sysRadii = [0.07, 0.115, 0.165];
  const sysMats = sysRadii.map((rad, i) => {
    const SEG = 96;
    const pos = new Float32Array(SEG * 3);
    const ang = new Float32Array(SEG);
    for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2;
      pos[k * 3] = Math.cos(a) * rad;
      pos[k * 3 + 2] = Math.sin(a) * rad;
      ang[k] = a;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAng', new THREE.BufferAttribute(ang, 1));
    const mat = orbitMaterial(i === 1 ? 0xf2d08c : 0xc9d2ff, 0.22);
    const line = new THREE.LineLoop(geo, mat);
    line.frustumCulled = false;
    sys.add(line);
    return mat;
  });
  const sp = buffers(3);
  sysRadii.forEach((_, i) => {
    writeColor(sp.color, i, i === 1 ? 0xf6d595 : 0xdfe6ff);
    sp.size[i] = 5;
    sp.seed[i] = r();
  });
  const sysPlanetMat = pointsMaterial({ twinkle: 0 });
  const sysPlanets = makePoints(sp, sysPlanetMat);
  sys.add(sysPlanets);
  const spAttr = sysPlanets.geometry.getAttribute('position') as THREE.BufferAttribute;
  let focusIdx: number | null = null;
  let focusAmt = 0;
  let levelOp = 1;

  const sunRad = 2.45;
  const sunA = armAngle(sunRad, 0) + 0.12;

  return {
    group,
    anchor: new THREE.Vector3(Math.cos(sunA) * sunRad, 0, Math.sin(sunA) * sunRad),
    quat: quat(-0.8, 0, 0.32),
    labels: mLocal.map((_p, i) => ({
      text: `${String(i + 1).padStart(2, '0')}  ${projects[i]}`,
      kind: 'project' as const,
      index: i,
      local: (t: number, out: THREE.Vector3) => pointOf(i, t, out),
    })),
    update(t, dt) {
      hi.step(dt);
      sys.visible = focusIdx !== null && focusAmt > 0.01;
      if (!sys.visible || focusIdx === null) return;
      pointOf(focusIdx, t, sys.position);
      const o = focusAmt * levelOp;
      sysRadii.forEach((rad, i) => {
        const th = t * (0.9 / (i + 1)) + i * 2.1;
        sysMats[i].uniforms.uPA.value = th;
        sysMats[i].uniforms.uOpacity.value = o;
        spAttr.setXYZ(i, Math.cos(th) * rad, 0, Math.sin(th) * rad);
      });
      spAttr.needsUpdate = true;
      sysPlanetMat.uniforms.uOpacity.value = o;
    },
    setOpacity(o) {
      levelOp = o;
      // while the camera is inside a project system the rest of the galaxy steps back
      const dim = 1 - 0.7 * focusAmt;
      diskMat.uniforms.uOpacity.value = o * dim;
      markMat.uniforms.uOpacity.value = o;
      bulge.mat.uniforms.uOpacity.value = o * 0.6 * dim;
    },
    highlight: hi.set,
    pointOf,
    setFocus(i, amount) {
      if (i !== null) focusIdx = i;
      focusAmt = amount;
    },
  };
}

/* ------------------------- L4 · cosmic web with the Monexarch constellation */

export function buildWeb(r: Rand, low: boolean): Level {
  const group = new THREE.Group();
  const V = THREE.Vector3;

  // The "M": five stars, slightly irregular like a real constellation.
  const M = [
    new V(-1.75, -1.0, 1.3),
    new V(-1.15, 1.25, 1.25),
    new V(0.0, -0.12, 1.4),
    new V(1.2, 1.35, 1.2),
    new V(1.8, -0.9, 1.3),
  ];
  const nodes: THREE.Vector3[] = [...M];
  const target = (low ? 46 : 70) + M.length;
  for (let guard = 0; nodes.length < target && guard < 6000; guard++) {
    const p = new V((r() * 2 - 1) * 6.2, (r() * 2 - 1) * 3.8, -4.2 + r() * 5.4);
    if (nodes.every((o) => o.distanceTo(p) > 0.95)) nodes.push(p);
  }

  // Filaments: connect each node with its three nearest neighbours.
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => ({ j, d: a.distanceTo(b) }))
      .filter((e) => e.j !== i && e.d < 3.0)
      .sort((x, y) => x.d - y.d)
      .slice(0, 3)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([i, j]);
        }
      });
  });

  const density = low ? 90 : 200;
  const filCount = edges.reduce((s, [i, j]) => s + Math.round(nodes[i].distanceTo(nodes[j]) * density), 0);
  const f = buffers(filCount);
  let k = 0;
  const tmp = new V();
  for (const [i, j] of edges) {
    const a = nodes[i];
    const b = nodes[j];
    const cnt = Math.round(a.distanceTo(b) * density);
    const sigma = 0.04 + 0.05 * r();
    for (let s = 0; s < cnt; s++, k++) {
      tmp.copy(a).lerp(b, r());
      f.pos.set([tmp.x + gauss(r) * sigma, tmp.y + gauss(r) * sigma, tmp.z + gauss(r) * sigma], k * 3);
      writeColor(f.color, k, weighted(r, [[0x6d6bff, 3], [0x5b8cff, 3], [0x9b7bff, 1.5], [0xd7dcff, 0.6]]), 0.45 + 0.4 * r());
      f.size[k] = 1.1 + 1.6 * Math.pow(r(), 3);
      f.seed[k] = r();
    }
  }
  const filMat = pointsMaterial({ twinkle: 0.2 });
  group.add(makePoints(f, filMat));

  // Galaxy clusters at the nodes.
  const per = nodes.map(() => Math.round((low ? 40 : 90) + r() * 80));
  const nc = per.reduce((s, x) => s + x, 0);
  const nb = buffers(nc);
  k = 0;
  nodes.forEach((p, i) => {
    const sg = 0.12 + 0.08 * r();
    for (let s = 0; s < per[i]; s++, k++) {
      const rr = Math.abs(gauss(r)) * sg;
      unitVector(r, tmp).multiplyScalar(rr).add(p);
      nb.pos.set([tmp.x, tmp.y, tmp.z], k * 3);
      writeColor(nb.color, k, weighted(r, [[0xfff1dc, 3], [0xffd9a0, 2], [0xc9d2ff, 1]]), 0.55 + 0.3 * r());
      nb.size[k] = 1.4 + 2 * Math.pow(r(), 3);
      nb.seed[k] = r();
    }
  });
  const nodeMat = pointsMaterial({ twinkle: 0.25 });
  group.add(makePoints(nb, nodeMat));

  // Constellation stars + the line that draws the letter.
  const cb = buffers(M.length);
  const sizes = [11, 12, 16, 13, 10];
  M.forEach((p, i) => {
    cb.pos.set([p.x, p.y, p.z], i * 3);
    writeColor(cb.color, i, 0xfff0cc);
    cb.size[i] = sizes[i];
    cb.seed[i] = r();
    cb.id[i] = i;
  });
  const starMat = pointsMaterial({ twinkle: 0.12 });
  group.add(makePoints(cb, starMat));

  const SUB = 60;
  const lp = new Float32Array((M.length - 1) * SUB * 3 + 3);
  const lt = new Float32Array((M.length - 1) * SUB + 1);
  const total = M.slice(1).reduce((s, p, i) => s + p.distanceTo(M[i]), 0);
  let acc = 0;
  let w = 0;
  for (let i = 0; i < M.length - 1; i++) {
    const seg = M[i].distanceTo(M[i + 1]);
    for (let s = 0; s < SUB; s++, w++) {
      tmp.copy(M[i]).lerp(M[i + 1], s / SUB);
      lp.set([tmp.x, tmp.y, tmp.z], w * 3);
      lt[w] = (acc + (seg * s) / SUB) / total;
    }
    acc += seg;
  }
  lp.set([M[4].x, M[4].y, M[4].z], w * 3);
  lt[w] = 1;
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  lg.setAttribute('aT', new THREE.BufferAttribute(lt, 1));
  const lineMat = drawLineMaterial(0xe9c98a, 0.6);
  const line = new THREE.Line(lg, lineMat);
  line.frustumCulled = false;
  group.add(line);

  // The galaxy we came from sits in a node on the left.
  const want = new V(-3.0, 0.4, -1.5);
  let anchor = nodes[M.length];
  for (const p of nodes.slice(M.length)) if (p.distanceTo(want) < anchor.distanceTo(want)) anchor = p;

  const greek = ['δ', 'γ', 'α', 'β', 'ε'];
  const q = new THREE.Quaternion();
  return {
    group,
    anchor: anchor.clone(),
    quat: q,
    labels: M.map((p, i) => ({
      text: greek[i],
      kind: 'greek' as const,
      index: i,
      local: (_t: number, out: THREE.Vector3) => out.copy(p),
    })),
    update(t, _dt, p) {
      q.copy(quat(0.12, Math.sin(t * 0.035) * 0.16, 0));
      lineMat.uniforms.uDraw.value = smooth(3.5, 3.95, p) * 1.001;
    },
    setOpacity(o) {
      filMat.uniforms.uOpacity.value = o;
      nodeMat.uniforms.uOpacity.value = o;
      starMat.uniforms.uOpacity.value = o;
      lineMat.uniforms.uOpacity.value = o;
    },
  };
}
