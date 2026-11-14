import * as THREE from 'three';

// Uniforms shared by every material (same object references → one update per frame).
export const shared = {
  uTime: { value: 0 },
  uPR: { value: 1 },
  uVH: { value: 900 },
};

const NOISE = /* glsl */ `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return v;
  }
`;

/* ---------------------------------------------------------------- points */

const POINT_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPR;
  uniform float uVH;
  uniform float uOpacity;
  uniform float uSizeMul;
  uniform float uHi;
  uniform float uHiAmt;
  uniform float uTwinkle;
  uniform float uSpin;
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  attribute float aId;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHi;

  void main() {
    vec3 p = position;
    #ifdef GALAXY
      float r = length(p.xz);
      float a = uTime * uSpin * (1.0 + 0.35 / (0.45 + r));
      float s = sin(a), c = cos(a);
      p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
    #endif
    #ifdef KEPLER
      float r = length(p.xz);
      float a = uTime * uSpin / pow(max(r, 0.25), 1.5);
      float s = sin(a), c = cos(a);
      p.xz = vec2(c * p.x - s * p.z, s * p.x + c * p.z);
    #endif
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float depth = max(-mv.z, 0.01);
    float hi = (aId > -0.5 && abs(aId - uHi) < 0.5) ? uHiAmt : 0.0;
    float ps = aSize * uSizeMul * (1.0 + hi * 1.6) * uPR * (uVH / 900.0) * (10.0 / depth);
    float fade = clamp(ps / (1.25 * uPR), 0.0, 1.0);
    gl_PointSize = clamp(ps, 1.25 * uPR, 96.0 * uPR);

    float tw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.7 + aSeed * 2.3) + aSeed * 37.0));
    float near = smoothstep(0.4, 2.2, depth);
    vColor = aColor;
    vHi = hi;
    vAlpha = uOpacity * tw * near * fade * (1.0 + hi * 1.2);
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vHi;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(c, c);
    if (r2 > 1.0) discard;
    float core = exp(-r2 * 10.0);
    float halo = exp(-r2 * 2.6) * 0.28;
    float a = (core + halo) * vAlpha;
    vec3 col = mix(vColor, vec3(1.0), core * 0.45 + vHi * 0.25);
    gl_FragColor = vec4(col, a);
  }
`;

export interface PointsOpts {
  twinkle?: number;
  sizeMul?: number;
  spin?: number;
  galaxy?: boolean;
  kepler?: boolean;
}

export function pointsMaterial(o: PointsOpts = {}) {
  const defines: Record<string, string> = {};
  if (o.galaxy) defines.GALAXY = '';
  if (o.kepler) defines.KEPLER = '';
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uOpacity: { value: 1 },
      uSizeMul: { value: o.sizeMul ?? 1 },
      uHi: { value: -10 },
      uHiAmt: { value: 0 },
      uTwinkle: { value: o.twinkle ?? 0.35 },
      uSpin: { value: o.spin ?? 0 },
    },
    defines,
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

/** Builds a Points object from plain arrays. */
export function makePoints(
  data: { pos: Float32Array; color: Float32Array; size: Float32Array; seed: Float32Array; id?: Float32Array },
  material: THREE.ShaderMaterial,
) {
  const n = data.size.length;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(data.color, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(data.size, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(data.seed, 1));
  g.setAttribute('aId', new THREE.BufferAttribute(data.id ?? new Float32Array(n).fill(-1), 1));
  const pts = new THREE.Points(g, material);
  pts.frustumCulled = false;
  return pts;
}

/* ------------------------------------------------------------ billboards */

// Camera-facing quad; size = world scale of the mesh, optionally never smaller than uMinPx.
const BILLBOARD_VERT = /* glsl */ `
  uniform float uVH;
  uniform float uMinPx;
  varying vec2 vUv;
  varying float vPx;
  void main() {
    vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float sc = length(vec3(modelMatrix[0].x, modelMatrix[0].y, modelMatrix[0].z));
    float depth = max(-c.z, 0.01);
    float px = sc * projectionMatrix[1][1] * 0.5 * uVH / depth;
    float k = px < uMinPx ? uMinPx / max(px, 1e-4) : 1.0;
    sc *= k; px *= k;
    c.xy += position.xy * sc;
    gl_Position = projectionMatrix * c;
    vUv = position.xy * 2.0;
    vPx = px;
  }
`;

const STAR_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uIgnite;
  varying vec2 vUv;
  varying float vPx;
  void main() {
    float ig = max(uIgnite, 1e-3);
    vec2 p = vUv / ig;
    float r = length(p);
    float pxu = max(vPx * 0.5 * ig, 1.0);          // css px per uv unit

    float rc = max(0.024, 2.2 / pxu);
    float core = exp(-(r * r) / (rc * rc));
    float inner = exp(-r / max(0.055, 4.0 / pxu));
    float glow = 0.016 / (r * r + 0.016);
    float ang = atan(p.y, p.x);
    float fl = 0.88 + 0.12 * sin(ang * 7.0 + uTime * 0.6) * sin(ang * 3.0 - uTime * 0.37 + 1.3);

    float kw = pxu / 1.3;                            // ~1.3px wide diffraction spikes
    float sp = 0.0;
    for (int i = 0; i < 3; i++) {
      float th = 1.5708 + float(i) * 1.0472;
      vec2 d = vec2(cos(th), sin(th));
      float along = abs(dot(p, d));
      float across = abs(dot(p, vec2(-d.y, d.x)));
      sp += exp(-across * kw) * exp(-along * 4.4);
    }
    sp += 0.45 * exp(-abs(p.y) * kw) * exp(-abs(p.x) * 7.0);

    float edge = 1.0 - smoothstep(0.7, 1.0, length(vUv));
    vec3 white = vec3(1.0), gold = vec3(1.0, 0.82, 0.56), blue = vec3(0.55, 0.64, 1.0);
    vec3 col = white * core * 1.3
             + gold * (inner * 0.85 + glow * 0.75 * fl)
             + blue * glow * 0.3 * smoothstep(0.04, 0.5, r)
             + mix(white, gold, 0.35) * sp * 0.5;
    float flash = 1.0 + max(uIgnite - 1.0, 0.0) * 3.0;
    gl_FragColor = vec4(col * edge * uOpacity * min(uIgnite * 1.5, 1.0) * flash, 1.0);
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform float uOpacity;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float g = exp(-r * r * 9.0) * 0.9 + 0.03 / (r * r + 0.03) * 0.35;
    g *= 1.0 - smoothstep(0.6, 1.0, r);
    vec3 col = mix(uColor2, uColor, exp(-r * r * 14.0));
    gl_FragColor = vec4(col * g * uOpacity, 1.0);
  }
`;

const NEBULA_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform float uSeed;
  varying vec2 vUv;
  ${NOISE}
  void main() {
    vec2 p = vUv;
    float mask = 1.0 - smoothstep(0.25, 1.0, length(p));
    vec2 q = p * 1.7 + vec2(uSeed, uSeed * 1.3);
    float n = fbm(q + vec2(uTime * 0.006, -uTime * 0.004));
    float m = fbm(q * 2.1 + n * 1.4 + 4.0);
    float d = smoothstep(0.35, 0.95, n) * mask;
    vec3 col = mix(uC1, uC2, m);
    gl_FragColor = vec4(col * d * uOpacity, 1.0);
  }
`;

function billboard(frag: string, uniforms: Record<string, THREE.IUniform>, minPx = 0) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uOpacity: { value: 1 }, uMinPx: { value: minPx }, ...uniforms },
    vertexShader: BILLBOARD_VERT,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

export const starBillboard = () => billboard(STAR_FRAG, { uIgnite: { value: 0 } }, 30);

export const glowBillboard = (c1: number, c2: number) =>
  billboard(GLOW_FRAG, { uColor: { value: new THREE.Color(c1) }, uColor2: { value: new THREE.Color(c2) } });

export const nebulaBillboard = (c1: number, c2: number, seed: number) =>
  billboard(NEBULA_FRAG, {
    uC1: { value: new THREE.Color(c1) },
    uC2: { value: new THREE.Color(c2) },
    uSeed: { value: seed },
  });

/* ----------------------------------------------------------------- lines */

// Orbit ring that is bright right behind its planet and fades along the trail.
export function orbitMaterial(color: number, base: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 },
      uPA: { value: 0 },
      uBase: { value: base },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      attribute float aAng;
      uniform float uPA;
      varying float vTrail;
      void main() {
        float d = mod(uPA - aAng, 6.2831853) / 6.2831853;
        vTrail = pow(1.0 - d, 6.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uBase;
      varying float vTrail;
      void main() { gl_FragColor = vec4(uColor, (uBase + vTrail * 0.7) * uOpacity); }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Polyline that draws itself: vertices with aT <= uDraw are visible.
export function drawLineMaterial(color: number, alpha: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 1 },
      uDraw: { value: 0 },
      uAlpha: { value: alpha },
      uColor: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      attribute float aT;
      varying float vT;
      void main() {
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uDraw;
      uniform float uAlpha;
      varying float vT;
      void main() {
        float a = 1.0 - step(uDraw, vT);
        gl_FragColor = vec4(uColor, a * uAlpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
