export interface BlackHoleState {
  x: number;
  y: number;
  r: number;
}

export interface BlackHoleHandle {
  state: BlackHoleState;
  setEnabled(on: boolean): void;
  pulse(): void;
}

const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform vec2 uBH; uniform float uBHR; uniform vec2 uMouse; uniform float uME; uniform float uLite; uniform float uPulse;

const float RIN = 3.0;
const float ROUT = 9.5;
const float ROLL = -0.2;
const float INC = 0.15;
const float K = 5.2;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){
  float v=0., a=.5;
  for(int i=0;i<5;i++){ if(uLite>.5 && i>2) break; v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; }
  return v;
}

vec3 fabric(vec2 uv, vec2 p){
  float gs=.068;
  vec2 g=abs(fract(uv/gs+.5)-.5)*gs;
  float line=1.-smoothstep(0.,1.6/uRes.y,min(g.x,g.y));
  float hasBH=step(.003,uBHR);
  float nb=hasBH*exp(-max(length(p-uBH)-uBHR*.48,0.)/max(uBHR*1.4,.02));
  float nm=exp(-length(p-uMouse)*12.)*(.32+uME*7.);
  vec3 gridCol=mix(vec3(.55,.22,1.),vec3(.88,.18,.52),clamp(nb*1.2,0.,1.));
  return gridCol*line*(.62*nb+.45*nm);
}

vec2 warpUV(vec2 pm){
  vec2 uv=pm;
  if(uBHR>.003){
    vec2 d=pm-uBH;
    uv-=1.25*uBHR*uBHR*d/max(dot(d,d),1e-4);
  }
  return uv;
}

vec3 diskRamp(float t){
  vec3 a=vec3(.16,.02,.2), b=vec3(.62,.1,.9), c=vec3(1.,.28,.62), d=vec3(1.,.9,.98), e=vec3(.62,.82,1.);
  if(t<.4) return mix(a,b,t/.4);
  if(t<.8) return mix(b,c,(t-.4)/.4);
  if(t<1.1) return mix(c,d,(t-.8)/.3);
  return mix(d,e,clamp((t-1.1)/.4,0.,1.));
}

vec4 disk(vec3 hit, float rr, vec3 rd){
  float v=min(sqrt(.5/max(rr-1.,.5)),.42);
  vec3 tang=normalize(vec3(-hit.z,0.,hit.x));
  float D=1./((1./sqrt(1.-v*v))*(1.-v*dot(tang,-rd)));
  float g=D*sqrt(max(1.-1./rr,0.));
  float e=smoothstep(RIN,RIN+.8,rr)*pow(RIN/rr,1.6)*(1.-smoothstep(ROUT-3.5,ROUT,rr));
  vec2 xz=rot(uTime*v/rr*2.2)*hit.xz;
  float n=fbm(xz*1.15);
  float rings=.6+.4*sin(rr*8.5+n*7.);
  float tex=(.4+.95*n)*rings;
  float I=e*tex*pow(g,2.2)*3.2*(1.+uPulse*.6);
  vec3 c=diskRamp(clamp(.55*g+.75*e,0.,1.5));
  return vec4(c*I, clamp(e*tex*2.4,0.,.94));
}

void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 dm=p-uMouse; float em=uME*uME;
  vec2 pm=p-em*dm/(dot(dm,dm)+em*.6);
  vec2 wuv=warpUV(pm);
  vec3 fab=fabric(wuv,p);

  float dc=length(p-uBH);
  float region=uBHR*2.25;
  if(uBHR<.003 || dc>region){
    float halo=0.;
    if(uBHR>.003) halo=exp(-max(dc-uBHR*.5,0.)/(uBHR*.75))*.22;
    vec3 hc=vec3(.5,.1,.8)*halo+fab;
    float a=clamp(max(halo*.9,length(fab)*1.1),0.,1.);
    gl_FragColor=vec4(hc,a);
    return;
  }

  vec2 q=rot(-ROLL)*(p-uBH)/uBHR*K;
  vec3 fwd=vec3(0.,-sin(INC),cos(INC)), up=vec3(0.,cos(INC),sin(INC)), rgt=vec3(1.,0.,0.);
  vec3 pos=-fwd*22.+rgt*q.x+up*q.y, vel=fwd;
  vec3 cr=cross(pos,vel); float h2=dot(cr,cr);
  float stepK = uLite>.5 ? .09 : .05;
  vec3 acc=vec3(0.); float alpha=0.; float trapped=0.; float fate=0.;
  for(int i=0;i<150;i++){
    if(uLite>.5 && i>=75) break;
    float r2=dot(pos,pos), r=sqrt(r2);
    if(r<1.){ trapped=1.; break; }
    if(r>30. && dot(pos,vel)>0.){ fate=1.; break; }
    if(alpha>.97) break;
    float dt=clamp(stepK*r,.012,1.6);
    vel+=-1.5*h2*pos/(r2*r2*r)*dt;
    vec3 np=pos+vel*dt;
    if(pos.y*np.y<0.){
      vec3 hit=mix(pos,np,pos.y/(pos.y-np.y));
      float rr=length(hit.xz);
      if(rr>RIN-.5 && rr<ROUT){
        vec4 dk=disk(hit,rr,normalize(vel));
        acc+=(1.-alpha)*dk.rgb; alpha+=(1.-alpha)*dk.a;
      }
    }
    pos=np;
  }

  vec3 bgFab=vec3(0.);
  if(fate>.5){
    vec3 d=normalize(vel);
    vec2 dv=vec2(dot(d,rgt),dot(d,up));
    float ang=acos(clamp(dot(d,fwd),-1.,1.));
    vec2 sh=(length(dv)>1e-5 ? normalize(dv) : vec2(0.))*ang*(3.*uBHR);
    bgFab=fabric(pm+rot(ROLL)*sh,p);
  }

  vec3 col=acc+(1.-alpha)*bgFab;
  col=1.-exp(-col*1.6);
  float a=clamp(alpha+trapped*(1.-alpha)+length(bgFab)*(1.-alpha)*.8,0.,1.);
  float ed=smoothstep(region*.85,region,dc);
  float halo=exp(-max(dc-uBHR*.5,0.)/(uBHR*.75))*.22*smoothstep(uBHR*.5,uBHR*.75,dc);
  vec3 outC=vec3(.5,.1,.8)*halo+fab;
  float outA=clamp(max(halo*.9,length(fab)*1.1),0.,1.);
  col=mix(col+vec3(.5,.1,.8)*halo*(1.-a),outC,ed);
  a=mix(max(a,outA),outA,ed);
  gl_FragColor=vec4(col,a);
}`;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function createBlackHole(canvas: HTMLCanvasElement, section: HTMLElement, reduced: boolean, anchor?: HTMLElement | null): BlackHoleHandle | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
    return s;
  };

  let program: WebGLProgram;
  try {
    program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'link');
  } catch (err) {
    console.warn('[blackhole] shader failed', err);
    return null;
  }
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U: Record<string, WebGLUniformLocation | null> = {};
  for (const n of ['uRes', 'uTime', 'uBH', 'uBHR', 'uMouse', 'uME', 'uLite', 'uPulse']) U[n] = gl.getUniformLocation(program, n);

  const coarse = matchMedia('(pointer: coarse)').matches;
  const lite = coarse || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
  gl.uniform1f(U.uLite, lite ? 1 : 0);

  const state: BlackHoleState = { x: 0, y: 0, r: 0 };
  let W = 2;
  let H = 2;
  let quality = 1;
  let enabled = true;
  let pulse = 0;
  let curR = 0;
  let slow = 0;
  let ema = 16;
  let prev = performance.now();
  let time = 0;
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2, vx: 0, vy: 0 };

  addEventListener(
    'pointermove',
    (e) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
    },
    { passive: true },
  );
  addEventListener('pointerdown', () => (pulse = 1), { passive: true });

  const resize = () => {
    const scale = (lite ? 0.5 : Math.min(devicePixelRatio || 1, 1) * 0.85) * quality;
    W = Math.max(2, Math.round(innerWidth * scale));
    H = Math.max(2, Math.round(innerHeight * scale));
    canvas.width = W;
    canvas.height = H;
    gl.viewport(0, 0, W, H);
  };
  addEventListener('resize', resize);
  resize();

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const raw = now - prev;
    prev = now;
    if (document.hidden || !enabled) return;
    const dt = Math.min(0.05, raw / 1000);
    time += reduced ? dt * 0.1 : dt;
    pulse *= Math.pow(0.05, dt);

    const px = mouse.x;
    const py = mouse.y;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 8);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 8);
    mouse.vx = (mouse.x - px) / Math.max(dt, 0.001);
    mouse.vy = (mouse.y - py) / Math.max(dt, 0.001);
    const speed = Math.hypot(mouse.vx, mouse.vy);
    const eM = 0.03 + Math.min(speed * 0.00005, 0.025) + pulse * 0.06;

    const w = innerWidth;
    const h = innerHeight;
    const rect = section.getBoundingClientRect();
    const mid = anchor ? anchor.getBoundingClientRect().top + anchor.getBoundingClientRect().height / 2 : rect.top + rect.height / 2;
    const vis = clamp(1 - Math.abs(mid - h / 2) / (h * 0.85 + rect.height * 0.15), 0, 1);
    canvas.dataset.vis = String(vis);
    const portrait = w < h * 0.9;
    let base = portrait
      ? { x: w * 0.5, y: h * 0.26, r: Math.min(0.2, 0.34 * (w / h)) }
      : { x: w * 0.76, y: h * 0.5, r: 0.22 };
    if (anchor) {
      const a = anchor.getBoundingClientRect();
      if (a.height > 0) base = { x: a.left + a.width / 2, y: a.top + a.height / 2, r: Math.min(0.42, (a.height / h) * 0.62) };
    }
    const target = vis < 0.04 ? 0 : base.r * Math.pow(vis, 0.8);
    curR += (target - curR) * 0.1;
    state.x = base.x;
    state.y = base.y;
    state.r = curR < 0.004 ? 0 : curR;
    canvas.style.visibility = state.r === 0 ? 'hidden' : 'visible';
    if (state.r === 0) return;

    ema = ema * 0.95 + Math.min(raw, 100) * 0.05;
    if (ema > 26 && quality > 0.55) {
      if (++slow > 45) {
        quality *= 0.85;
        slow = 0;
        resize();
      }
    } else slow = 0;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, W, H);
    gl.uniform1f(U.uTime, time);
    gl.uniform2f(U.uBH, (state.x - w / 2) / h, -(state.y - h / 2) / h);
    gl.uniform1f(U.uBHR, state.r);
    gl.uniform2f(U.uMouse, (mouse.x - w / 2) / h, -(mouse.y - h / 2) / h);
    gl.uniform1f(U.uME, eM);
    gl.uniform1f(U.uPulse, pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  requestAnimationFrame(frame);

  return {
    state,
    setEnabled(on: boolean) {
      enabled = on;
      canvas.style.visibility = on ? 'visible' : 'hidden';
    },
    pulse() {
      pulse = 1;
    },
  };
}
