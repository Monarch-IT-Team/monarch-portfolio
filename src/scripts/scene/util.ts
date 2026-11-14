import * as THREE from 'three';

/** Deterministic random, so the universe looks the same on every visit. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = () => number;

export function gauss(r: Rand) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export function unitVector(r: Rand, out = new THREE.Vector3()) {
  const z = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return out.set(s * Math.cos(a), s * Math.sin(a), z);
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function smooth(a: number, b: number, x: number) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Picks a colour from [hex, weight] pairs. */
export function weighted(r: Rand, list: [number, number][]) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [c, w] of list) {
    x -= w;
    if (x <= 0) return c;
  }
  return list[list.length - 1][0];
}

const tmp = new THREE.Color();
export function writeColor(arr: Float32Array, i: number, hex: number, mul = 1) {
  tmp.setHex(hex);
  arr[i * 3] = tmp.r * mul;
  arr[i * 3 + 1] = tmp.g * mul;
  arr[i * 3 + 2] = tmp.b * mul;
}

export function quat(x: number, y: number, z: number) {
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), x);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), y);
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), z);
  // tilt around X first, then spin around Y, then roll around Z (world)
  return qz.multiply(qy).multiply(qx);
}

export function buffers(n: number) {
  return {
    pos: new Float32Array(n * 3),
    color: new Float32Array(n * 3),
    size: new Float32Array(n),
    seed: new Float32Array(n),
    id: new Float32Array(n).fill(-1),
  };
}
