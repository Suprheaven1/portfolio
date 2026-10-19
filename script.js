const canvas = document.getElementById('vortexCanvas');
const gl = canvas.getContext('webgl');
if (!gl) alert('WebGL non supporté sur ce navigateur.');

let state = {
  time: 0,
  intensity: 0,
  swirl: 0,
  liquid: 0,
  freeze: 0,
  centerX: 0.18,
  centerY: 0.50
};

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

const vertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main(){
  vUv = aPosition * .5 + .5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const fragment = `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform float uIntensity;
uniform float uSwirl;
uniform float uLiquid;
uniform float uFreeze;
uniform vec2 uCenter;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v=0.0, a=.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p*=2.05; a*=.5; }
  return v;
}

void main(){
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x/uResolution.y, 1.0);
  vec2 p = (uv - uCenter) * aspect;
  float r = length(p) + 0.0001;
  float a = atan(p.y, p.x);

  float t = uTime * (1.0 - uFreeze * .82);
  float pulse = sin(uTime * 2.6) * .08 + sin(uTime * 5.1) * .025;

  // Fullscreen vortex: stronger near center but material extends across whole screen.
  float swirl = uSwirl * (1.6 / (r + .18));
  float warpedAngle = a + swirl + t * (1.4 + uIntensity * 1.8) + pulse;
  // IMPORTANT: tout ce qui nourrit le noise reste en coordonnées cartésiennes
  // périodiques (q / p). On évite d'utiliser directement l'angle dans le noise,
  // sinon atan() crée une coupure visible sur l'axe gauche du vortex.
  float flow = warpedAngle * 3.0 - r * 15.0;

  vec2 q = vec2(cos(warpedAngle), sin(warpedAngle)) * r;
  float liquidNoise = fbm(q * 5.4 + vec2(t * .55, -t * .42));
  float fine = fbm(q * 13.0 + vec2(-t * .35, t * .28));
  float ribbons = fbm(q * 2.2 + p * 0.9 + vec2(t * .22, -t * .18));

  float bands = sin(flow + liquidNoise * 5.4 + fine * 2.2 + ribbons * 3.1);
  float metal = smoothstep(-.18, .88, bands);
  float sharp = pow(abs(bands), 4.2);

  // central hole / deep pull
  float hole = smoothstep(.25, .03, r);
  float pull = smoothstep(1.25, .05, r);

  vec3 black = vec3(.005, .004, .005);
  vec3 burgundy = vec3(.22, .0, .045);
  vec3 silver = vec3(.92, .90, .86);
  vec3 white = vec3(1.0);

  vec3 col = mix(black, burgundy, metal * .55);
  col = mix(col, silver, smoothstep(.58, .95, metal) * (0.75 + liquidNoise*.35));
  col += white * sharp * .35;
  col *= .25 + pull * 1.15;
  col = mix(col, vec3(0.0), hole * .86);

  // reflets bordeaux, sans coordonnées angulaires non périodiques
  float redStreak = smoothstep(.82,.98, fbm(q*11.0 + vec2(t*.7, -t*.31))) * smoothstep(.05,1.3,r);
  col += burgundy * redStreak * .65;

  // vignette and fade in
  float vign = smoothstep(1.25,.15,length(uv-.5));
  col *= .45 + vign*.9;
  col *= uIntensity;

  gl_FragColor = vec4(col, 1.0);
}`;

function compile(type, source){
  const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
  return s;
}
const program = gl.createProgram();
gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
gl.linkProgram(program);
gl.useProgram(program);

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
const pos = gl.getAttribLocation(program, 'aPosition');
gl.enableVertexAttribArray(pos);
gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

const U = name => gl.getUniformLocation(program, name);
const uniforms = { res:U('uResolution'), time:U('uTime'), intensity:U('uIntensity'), swirl:U('uSwirl'), liquid:U('uLiquid'), freeze:U('uFreeze'), center:U('uCenter') };

function render(ms){
  state.time = ms * .001;
  gl.uniform2f(uniforms.res, canvas.width, canvas.height);
  gl.uniform1f(uniforms.time, state.time);
  gl.uniform1f(uniforms.intensity, state.intensity);
  gl.uniform1f(uniforms.swirl, state.swirl);
  gl.uniform1f(uniforms.liquid, state.liquid);
  gl.uniform1f(uniforms.freeze, state.freeze);
  gl.uniform2f(uniforms.center, state.centerX, state.centerY);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

document.body.classList.add('locked');
const viewButton = document.getElementById('viewButton');
const menu = document.getElementById('portalMenu');
const heroTitle = document.getElementById('heroTitle');
const stormLayer = document.querySelector('.storm-layer');
const clouds = [...document.querySelectorAll('.cloud')];

function splitHeroTitleLetters(){
  heroTitle.querySelectorAll('.title-line').forEach(line => {
    const text = line.textContent;
    line.textContent = '';
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.style.setProperty('--i', i);
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      span.dataset.char = span.textContent;
      span.setAttribute('aria-hidden', 'true');
      line.appendChild(span);
    });
  });
}
splitHeroTitleLetters();

// Utilise les dimensions de mise en page : les oscillations ne déplacent pas l'ancrage.
function syncCloudBackdrop() {
  stormLayer.style.setProperty('--title-left', heroTitle.offsetLeft + 'px');
  stormLayer.style.setProperty('--title-top', heroTitle.offsetTop + 'px');
  stormLayer.style.setProperty('--title-width', heroTitle.offsetWidth + 'px');
  stormLayer.style.setProperty('--title-height', heroTitle.offsetHeight + 'px');
}
syncCloudBackdrop();
new ResizeObserver(syncCloudBackdrop).observe(heroTitle);
window.addEventListener('resize', syncCloudBackdrop);
document.fonts.ready.then(syncCloudBackdrop);

let floatingStarted = false;
function startFloatingMotion() {
  if (floatingStarted) return;
  floatingStarted = true;
  // Deux couches distinctes : entrée sur .nav-item, oscillation sur .btn-float.
  document.querySelectorAll('.btn-float').forEach((button, i) => {
    const amplitude = 30; // 60 px de trajet vertical total.
    const direction = i % 2 ? -1 : 1;
    gsap.fromTo(button,
      { x: -12 * direction, y: -amplitude, rotation: -3 * direction },
      { x: 12 * direction, y: amplitude, rotation: 3 * direction,
        duration: 2.1 + i * .16, ease: 'sine.inOut', repeat: -1, yoyo: true,
        delay: -i * .65 }
    );
  });
  document.querySelectorAll('.cloud-drift').forEach((cloud, i) => {
    const direction = i % 2 ? -1 : 1;
    gsap.fromTo(cloud,
      { x: -17 * direction, y: -22.5, rotation: -1.8 * direction },
      { x: 17 * direction, y: 22.5, rotation: 1.8 * direction,
        duration: 2.8 + i * .22, ease: 'sine.inOut', repeat: -1, yoyo: true,
        delay: -i * .8 }
    );
  });
}

function startCloudLightning(){
  const triggerFlash = cloud => {
    if (cloud.classList.contains('flash-hit')) return;
    const light = cloud.querySelector('.cloud-flash');
    light.addEventListener('animationend', () => cloud.classList.remove('flash-hit'), { once: true });
    cloud.classList.add('flash-hit');
  };

  const loop = () => {
    const cloud = clouds[Math.floor(Math.random() * clouds.length)];
    if (cloud) triggerFlash(cloud);
    setTimeout(loop, gsap.utils.random(650, 1900));
  };

  setTimeout(loop, 800);
}

function startElectricTitleFlicker(){
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lines = [...heroTitle.querySelectorAll('.title-line')];
  const pulse = () => {
    // Un petit groupe contigu s'allume ; les lettres restent nettes et en place.
    const line = lines[Math.floor(Math.random() * lines.length)];
    const letters = [...line.querySelectorAll('.char')];
    const first = Math.floor(Math.random() * letters.length);
    const group = letters.slice(first, first + gsap.utils.random(2, 4, 1));
    const flash = gsap.timeline();
    flash.to(group, { '--spark': 1, duration: .045, stagger: .018, ease: 'power2.out' })
      .to(group, { '--spark': .12, duration: .065, ease: 'power1.in' })
      .to(group, { '--spark': .85, duration: .035, stagger: .012, ease: 'power2.out' })
      .to(group, { '--spark': 0, duration: .26, ease: 'power2.out' });
    setTimeout(pulse, gsap.utils.random(1700, 4200));
  };
  setTimeout(pulse, 1200);
}


function launch(){
  viewButton.disabled = true;
  canvas.style.opacity = 1;

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' }});

  tl.to(viewButton, { opacity: 0, scale: .86, filter: 'blur(10px)', duration: .38 }, 0);

  // Le vortex démarre pile avec les mains.
  tl.to(state, { intensity: 1, swirl: 2.7, liquid: 1, duration: 1.45, ease: 'power2.inOut' }, .10);
  tl.to(state, { swirl: .75, freeze: .78, duration: 1.05, ease: 'power3.out' }, 1.65);
  tl.to(state, { swirl: .38, freeze: .92, duration: .65, ease: 'sine.out' }, 2.65);

  // Mains : geste de déclenchement.
  tl.to('.hand-left', {
    opacity: 1, x: '25vw', y: '-22vh', scale: 1.18, rotate: -12, filter: 'blur(.6px) drop-shadow(0 30px 50px rgba(0,0,0,.8))', duration: .92, ease: 'power4.out'
  }, .10);
  tl.to('.hand-right', {
    opacity: 1, x: '43vw', y: '10vh', scale: 1.05, rotate: 10, filter: 'blur(.4px) drop-shadow(0 30px 50px rgba(0,0,0,.8))', duration: .88, ease: 'power4.out'
  }, .13);
  tl.to('.hand-left', { opacity: 0, scale: '+=.10', x: '+=5vw', filter: 'blur(14px)', duration: .75, ease: 'power2.inOut' }, 1.75);
  tl.to('.hand-right', { opacity: 0, scale: '+=.10', x: '+=4vw', filter: 'blur(14px)', duration: .75, ease: 'power2.inOut' }, 1.78);

  // Les nuages arrivent de directions différentes et se regroupent autour du titre.
  tl.to(stormLayer, { opacity: 1, duration: .1 }, 2.04);
  const cloudFrom = [
    { x: '-20vw', y: '-16vh', scale: .72 },
    { x: '14vw', y: '-18vh', scale: .8 },
    { x: '-24vw', y: '2vh', scale: .7 },
    { x: '18vw', y: '0vh', scale: .74 },
    { x: '-14vw', y: '16vh', scale: .78 },
    { x: '20vw', y: '20vh', scale: .82 },
    { x: '-6vw', y: '-22vh', scale: .68 }
  ];
  clouds.forEach((cloud, i) => {
    const from = cloudFrom[i % cloudFrom.length];
    tl.fromTo(cloud,
      { opacity: 0, x: from.x, y: from.y, scale: from.scale, filter: 'blur(18px)' },
      { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(.35px)', duration: 1.3, ease: 'expo.out' },
      2.10 + i * .06
    );
  });

  tl.to(menu, { opacity: 1, duration: .1 }, 2.62);

  // Titre : arrivée lente et électrique depuis le haut.
  tl.set(heroTitle, { opacity: 1, y: -122, x: -10, filter: 'blur(12px)' }, 2.16);
  tl.set('.title-line', { opacity: 0, y: -96, filter: 'blur(12px)' }, 2.16);

  tl.to(heroTitle, {
    y: 0,
    x: 0,
    filter: 'blur(0px)',
    duration: 1.7,
    ease: 'expo.out'
  }, 2.22);

  tl.to('.title-line', {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    duration: 1.25,
    stagger: .18,
    ease: 'expo.out'
  }, 2.34);

  // L'impulsion d'entrée éclaire les glyphes sans les décaler ni les flouter.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tl.to('.hero-title .char', { '--spark': .9, duration: .08, stagger: .012 }, 3.32);
    tl.to('.hero-title .char', { '--spark': 0, duration: .25, stagger: .012 }, 3.78);
  }

  // Les flottements démarrent après toutes les entrées, sur des couches séparées.
  tl.call(() => {
    document.body.classList.remove('locked');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.add('is-floating'));
    heroTitle.classList.add('is-fixed');
    stormLayer.classList.add('is-live');
    startFloatingMotion();
    startElectricTitleFlicker();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) startCloudLightning();
  }, null, 4.25);

  // Entrée des boutons : ils glissent depuis le flux de métal liquide.
  tl.to('.nav-item', {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: 'none',
    stagger: .09,
    duration: .92,
    ease: 'expo.out'
  }, 2.90);
}

viewButton.addEventListener('click', () => {
  viewButton.disabled = true;
  // Les métriques des polices sont prêtes avant l'entrée du titre.
  document.fonts.ready.then(launch);
}, { once: true });
