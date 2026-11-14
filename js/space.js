/* Deep-space background + ray-traced Schwarzschild black hole (WebGL).
   Also owns the shared state (window.SPACE) used by fx.js, loader.js and main.js. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lite = coarse || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;

  const S = (window.SPACE = {
    lite, reduce, coarse,
    bh: { x: 0, y: 0, r: 0 },           // r: apparent size in "height units" (shadow radius = r * 0.5)
    mouse: { x: innerWidth / 2, y: innerHeight * 0.6, vx: 0, vy: 0, active: false },
    boost: 0,
    intro: 1,            // 0..1, the loader grows the black hole in
    ticks: []
  });

  const canvas = document.getElementById('space');
  let gl = null;
  if (canvas) {
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }); } catch (e) {}
  }
  if (!gl) document.documentElement.classList.add('no-gl');

  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes; uniform float uTime; uniform vec2 uBH; uniform float uBHR;
uniform vec2 uMouse; uniform float uME; uniform float uLite; uniform float uScroll;

const float RIN = 3.0;     // inner edge of the disk: ISCO = 3 r_s
const float ROUT = 9.5;
const float ROLL = -0.2;   // image roll of the disk
const float INC = 0.15;    // camera elevation above the disk plane (rad)
const float K = 5.2;       // r_s per uBHR on screen: shadow radius = 2.6 r_s = 0.5 uBHR

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){
  float v=0., a=.5;
  for(int i=0;i<5;i++){ if(uLite>.5 && i>2) break; v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; }
  return v;
}

/* ---------- background ---------- */
vec3 starLayer(vec2 uv, float sc, float thr, float seed){
  vec2 g=uv*sc, id=floor(g), f=fract(g)-.5;
  float h=hash(id+seed);
  if(h<thr) return vec3(0.);
  vec2 o=vec2(hash(id+seed+3.1),hash(id+seed+7.7))-.5;
  vec2 d=f-o*.6;
  float b=(h-thr)/(1.-thr);
  float core=smoothstep(.05+.1*b,0.,length(d));
  float spike=0.;
  if(b>.88){ spike=(exp(-abs(d.x)*60.)*exp(-abs(d.y)*6.)+exp(-abs(d.y)*60.)*exp(-abs(d.x)*6.))*(b-.88)*6.; }
  float tw=.72+.28*sin(uTime*(.7+h*3.)+h*60.);
  float hc=hash(id+seed+11.);
  vec3 c = hc<.35 ? vec3(.72,.82,1.) : hc<.7 ? vec3(1.,.98,.97) : vec3(.86,.8,1.);
  return c*(core*(.35+1.4*b)+spike)*tw;
}

vec3 bg(vec2 uv){
  vec3 col=mix(vec3(.004,.003,.012),vec3(.018,.008,.045),smoothstep(.6,-.75,uv.y));
  // galactic band with dust lanes
  vec2 r=rot(.6)*uv;
  float bd=r.y+.1*sin(r.x*1.4)-.04;
  float band=exp(-bd*bd*14.);
  float dust=fbm(r*vec2(2.,5.5)+3.);
  float cloud=fbm(r*vec2(1.3,3.2)+vec2(uTime*.004,0.));
  float glow=band*(.25+.75*cloud)*(1.-smoothstep(.42,.7,dust)*.92);
  col+=glow*vec3(.075,.065,.17)+glow*band*vec3(.07,.075,.14);
  // sparse nebula wisps
  vec2 w=uv*1.1+vec2(fbm(uv*1.3+uTime*.006),fbm(uv*1.3-uTime*.005))*.8;
  float neb=smoothstep(.6,.88,fbm(w*1.6));
  col+=neb*mix(vec3(.2,.06,.42),vec3(.03,.12,.36),smoothstep(-.6,.6,uv.x))*.3;
  // stars, three depths, parallax with page scroll
  col+=starLayer(uv-vec2(0.,uScroll*.04),24.,.955,1.)*1.5;
  col+=starLayer(uv-vec2(0.,uScroll*.09),52.,.94,7.)*(.75+band*.9);
  if(uLite<.5) col+=starLayer(uv-vec2(0.,uScroll*.16),105.,.93-band*.07,13.)*(.45+band*1.3);
  return col;
}

// the fabric of spacetime shows itself only near a gravity well
vec3 fabric(vec2 uv, vec2 p){
  float gs=.07; vec2 g=abs(fract(uv/gs+.5)-.5)*gs;
  float line=1.-smoothstep(0.,1.5/uRes.y,min(g.x,g.y));
  float hasBH=step(.003,uBHR);
  float nb=hasBH*exp(-max(length(p-uBH)-uBHR*.55,0.)/max(uBHR*.8,.02));
  float nm=exp(-length(p-uMouse)*13.)*(.35+uME*8.);
  return vec3(.36,.24,.85)*line*(.45*nb+.5*nm);
}

vec3 outside(vec2 p, vec2 pm){
  vec2 uv=pm;
  if(uBHR>.003){ vec2 d=pm-uBH; uv-=1.154*uBHR*uBHR*d/max(dot(d,d),1e-4); }
  return bg(uv)+fabric(uv,p);
}

/* ---------- accretion disk ---------- */
vec3 diskRamp(float t){
  vec3 a=vec3(.1,.03,.3), b=vec3(.42,.2,1.), c=vec3(.84,.76,1.), d=vec3(1.), e=vec3(.76,.9,1.);
  if(t<.4) return mix(a,b,t/.4);
  if(t<.8) return mix(b,c,(t-.4)/.4);
  if(t<1.1) return mix(c,d,(t-.8)/.3);
  return mix(d,e,clamp((t-1.1)/.4,0.,1.));
}
vec4 disk(vec3 hit, float rr, vec3 rd){
  float v=min(sqrt(.5/max(rr-1.,.5)),.42);
  vec3 tang=normalize(vec3(-hit.z,0.,hit.x));
  float D=1./((1./sqrt(1.-v*v))*(1.-v*dot(tang,-rd)));   // relativistic Doppler
  float g=D*sqrt(max(1.-1./rr,0.));                       // + gravitational redshift
  float e=smoothstep(RIN,RIN+.8,rr)*pow(RIN/rr,1.6)*(1.-smoothstep(ROUT-3.5,ROUT,rr));
  vec2 xz=rot(uTime*v/rr*2.2)*hit.xz;                     // differential rotation
  float n=fbm(xz*1.15);
  float rings=.6+.4*sin(rr*8.5+n*7.);
  float tex=(.4+.95*n)*rings;
  float I=e*tex*pow(g,2.2)*3.2;
  vec3 c=diskRamp(clamp(.55*g+.75*e,0.,1.5));
  return vec4(c*I, clamp(e*tex*2.4,0.,.94));
}

vec3 blackHole(vec2 p, vec2 pm){
  vec2 q=rot(-ROLL)*(p-uBH)/uBHR*K;
  vec3 fwd=vec3(0.,-sin(INC),cos(INC)), up=vec3(0.,cos(INC),sin(INC)), rgt=vec3(1.,0.,0.);
  vec3 pos=-fwd*22.+rgt*q.x+up*q.y, vel=fwd;
  vec3 cr=cross(pos,vel); float h2=dot(cr,cr);
  float stepK = uLite>.5 ? .09 : .05;
  vec3 acc=vec3(0.); float alpha=0.; float fate=0.;    // 0 = trapped, 1 = escaped
  for(int i=0;i<150;i++){
    if(uLite>.5 && i>=75) break;
    float r2=dot(pos,pos), r=sqrt(r2);
    if(r<1.) break;                                    // crossed the event horizon
    if(r>30. && dot(pos,vel)>0.){ fate=1.; break; }
    if(alpha>.97) break;
    float dt=clamp(stepK*r,.012,1.6);
    vel+=-1.5*h2*pos/(r2*r2*r)*dt;                     // null geodesic in Schwarzschild
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
  vec3 bgc=vec3(0.);
  if(fate>.5){
    vec3 d=normalize(vel);
    vec2 dv=vec2(dot(d,rgt),dot(d,up));
    float ang=acos(clamp(dot(d,fwd),-1.,1.));
    vec2 sh=(length(dv)>1e-5 ? normalize(dv) : vec2(0.))*ang*(3.*uBHR);
    vec2 uv=pm+rot(ROLL)*sh;
    bgc=bg(uv)+fabric(uv,p);
  }
  return acc+(1.-alpha)*bgc;
}

void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec2 dm=p-uMouse; float em=uME*uME;
  vec2 pm=p-em*dm/(dot(dm,dm)+em*.6);           // the cursor is a small gravity well too

  vec3 col;
  float dc=length(p-uBH), region=uBHR*2.15;
  if(uBHR>.003 && dc<region){
    col=blackHole(p,pm);
    float ed=smoothstep(region*.86,region,dc);
    if(ed>0.) col=mix(col,outside(p,pm),ed);
  } else col=outside(p,pm);

  if(uBHR>.003) col+=vec3(.22,.11,.58)*exp(-max(dc-uBHR*.5,0.)/(uBHR*.6))*.14*smoothstep(uBHR*.5,uBHR*.75,dc);   // halo, never inside the shadow

  col*=1.-.38*dot(p*.85,p*.85);
  col=1.-exp(-col*1.6);
  gl_FragColor=vec4(col,1.);
}`;

  let U = {}, W = 1, H = 1, scale = 1, quality = 1;
  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  if (gl) {
    try {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uTime', 'uBH', 'uBHR', 'uMouse', 'uME', 'uLite', 'uScroll'].forEach(n => (U[n] = gl.getUniformLocation(pr, n)));
      gl.uniform1f(U.uLite, lite ? 1 : 0);
    } catch (e) {
      console.warn('Shader failed, using CSS fallback', e);
      gl = null; document.documentElement.classList.add('no-gl');
    }
  }

  function resize() {
    scale = (lite ? 0.5 : Math.min(devicePixelRatio || 1, 1) * 0.85) * quality;
    W = Math.max(2, Math.round(innerWidth * scale));
    H = Math.max(2, Math.round(innerHeight * scale));
    if (gl) { canvas.width = W; canvas.height = H; gl.viewport(0, 0, W, H); }
  }
  addEventListener('resize', resize); resize();

  // pointer
  const target = { x: S.mouse.x, y: S.mouse.y };
  function onMove(e) {
    const t = e.touches ? e.touches[0] : e;
    target.x = t.clientX; target.y = t.clientY; S.mouse.active = true; S.lastMove = performance.now();
  }
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('touchmove', onMove, { passive: true });
  addEventListener('pointerdown', e => { onMove(e); S.boost = 1; }, { passive: true });
  S.lastMove = 0;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  let tPrev = performance.now(), time = 0, curR = 0, slow = 0, ema = 16;

  function layout() {
    const w = innerWidth, h = innerHeight, portrait = w < h * 0.9;
    const base = portrait ? { x: w * 0.5, y: h * 0.25, r: Math.min(0.2, 0.36 * w / h) } : { x: w * 0.75, y: h * 0.47, r: 0.2 };
    const sy = scrollY;
    const k = clamp(1 - sy / (h * 0.95), 0, 1);
    const rr = k < 0.03 ? 0 : base.r * Math.pow(k, 0.8) * S.intro;
    curR += (rr - curR) * 0.12;
    S.bh.x = base.x; S.bh.y = base.y - sy * 0.55; S.bh.r = curR < 0.004 ? 0 : curR;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { tPrev = now; return; }
    const raw = now - tPrev;
    const dt = Math.min(0.05, raw / 1000); tPrev = now;
    time += reduce ? dt * 0.1 : dt;
    layout();

    // adaptive resolution: drop it if the GPU cannot keep up
    ema = ema * 0.95 + Math.min(raw, 100) * 0.05;
    if (gl && ema > 26 && quality > 0.55) { if (++slow > 45) { quality *= 0.85; slow = 0; resize(); } } else slow = 0;

    let tx = target.x, ty = target.y;
    if (!S.mouse.active || now - S.lastMove > 3500) {
      const t = now / 1000;
      tx = innerWidth * (0.5 + 0.28 * Math.sin(t * 0.37)); ty = innerHeight * (0.55 + 0.25 * Math.sin(t * 0.53 + 1));
    }
    const px = S.mouse.x, py = S.mouse.y;
    S.mouse.x += (tx - S.mouse.x) * Math.min(1, dt * 7);
    S.mouse.y += (ty - S.mouse.y) * Math.min(1, dt * 7);
    S.mouse.vx = (S.mouse.x - px) / Math.max(dt, 0.001); S.mouse.vy = (S.mouse.y - py) / Math.max(dt, 0.001);
    S.boost *= Math.pow(0.04, dt);

    const speed = Math.hypot(S.mouse.vx, S.mouse.vy);
    const eM = 0.03 + Math.min(speed * 0.00006, 0.025) + S.boost * 0.06;
    S.mouseE = eM;

    for (const f of S.ticks) f(now, dt);

    if (gl) {
      const w = innerWidth, h = innerHeight;
      gl.uniform2f(U.uRes, W, H);
      gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uBH, (S.bh.x - w / 2) / h, -(S.bh.y - h / 2) / h);
      gl.uniform1f(U.uBHR, S.bh.r);
      gl.uniform2f(U.uMouse, (S.mouse.x - w / 2) / h, -(S.mouse.y - h / 2) / h);
      gl.uniform1f(U.uME, eM);
      gl.uniform1f(U.uScroll, scrollY / Math.max(1, h));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }
  requestAnimationFrame(frame);
})();
