// Maglie 3D: a real T-shirt model with the kit photos projected onto it from four sides
// (front, back, both sides), sleeve sponsors applied as decals, continuous rotation.
// Usage: <div class="kit-stage" data-kit="nera"></div>
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODEL = 'https://cdn.jsdelivr.net/gh/adrianhajdin/project_threejs_ai@main/client/public/shirt_baked.glb';
const TEX = 'assets/maglie/';
const KITS = {
  // which sleeve logo is on which side, and its aspect ratio (width / height)
  nera: { inside: 0x1a1a1a, aspA: 1.5, aspB: 1.0 },
  rosa: { inside: 0xc995a9, aspA: 1.0, aspB: 1.5 },
};
const FIT = new THREE.Vector4(0.04, 0.96, 0.04, 0.965);   // model box inside the front/back photos
const FIT_SIDE = new THREE.Vector4(0.08, 0.92, 0.04, 0.965);
const LOGO_W = 0.3;
const SPEED = 0.7;  // radians per second
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- shared model (loaded once) ----------
let modelPromise = null;
function loadModel() {
  if (!modelPromise) {
    modelPromise = new GLTFLoader().loadAsync(MODEL).then((gltf) => {
      let mesh = null;
      gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      geo.computeBoundingBox();
      const c = geo.boundingBox.getCenter(new THREE.Vector3());
      const s = geo.boundingBox.getSize(new THREE.Vector3());
      geo.translate(-c.x, -c.y, -c.z);
      geo.scale(2 / s.y, 2 / s.y, 2 / s.y);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.computeBoundingBox();
      return { geo, decals: sleeveFrames(geo) };
    });
  }
  return modelPromise;
}

// Each sleeve: up = towards the shoulder, out = away from the body, centre of its outer face.
function sleeveFrames(geo) {
  const P = geo.attributes.position, Nn = geo.attributes.normal;
  const frames = {};
  for (const side of ['A', 'B']) {
    const sgn = side === 'A' ? -1 : 1;
    const pts = [];
    for (let i = 0; i < P.count; i++) if (P.getX(i) * sgn > 0.6 && P.getY(i) > 0.05) pts.push(new THREE.Vector3().fromBufferAttribute(P, i));
    const mean = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const p of pts) {
      const d = [p.x - mean.x, p.y - mean.y, p.z - mean.z];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) c[r][k] += d[r] * d[k];
    }
    let v = new THREE.Vector3(sgn, -1, 0).normalize();
    for (let it = 0; it < 50; it++) {
      v = new THREE.Vector3(
        c[0][0] * v.x + c[0][1] * v.y + c[0][2] * v.z,
        c[1][0] * v.x + c[1][1] * v.y + c[1][2] * v.z,
        c[2][0] * v.x + c[2][1] * v.y + c[2][2] * v.z).normalize();
    }
    const U = v.clone(); if (U.x * sgn > 0) U.negate();
    const N = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), U).normalize();
    if (N.x * sgn < 0) N.negate();
    const R = new THREE.Vector3().crossVectors(N.clone().negate(), U).normalize();
    const outer = [];
    const n = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      if (P.getX(i) * sgn < 0.6 || P.getY(i) < 0.05) continue;
      n.fromBufferAttribute(Nn, i);
      if (n.dot(N) > 0.75) outer.push(new THREE.Vector3().fromBufferAttribute(P, i));
    }
    const C = outer.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / outer.length);
    C.addScaledVector(U, -0.12);
    frames[side] = { C, R, U, N };
  }
  return frames;
}

const loader = new THREE.TextureLoader();
function tex(name, renderer) {
  const t = loader.load(TEX + name);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}

const FRAG_HEAD = /* glsl */ `
  varying vec3 vObjPos; varying vec3 vObjNormal;
  uniform sampler2D tFront, tBack, tSideA, tSideB, dF, dB, dA, dS, logoA, logoB;
  uniform vec3 bbMin, bbMax, inside;
  uniform vec4 fitF, fitS;
  uniform vec3 decA_C, decA_R, decA_U, decA_N, decB_C, decB_R, decB_U, decB_N;
  uniform vec2 decA_S, decB_S;
  vec2 fitUV(vec2 t, vec4 f) { return vec2(mix(f.x, f.y, t.x), 1.0 - mix(f.z, f.w, 1.0 - t.y)); }
  float vis(sampler2D d, vec2 uv, float z) { return smoothstep(0.024, 0.006, z - texture2D(d, uv).r); }
  vec4 decal(sampler2D t, vec3 p, vec3 n, vec3 C, vec3 R, vec3 U, vec3 N, vec2 S, float side) {
    if (p.x * side < 0.5) return vec4(0.0);
    vec3 d = p - C;
    vec2 uv = vec2(dot(d, R) / S.x + 0.5, dot(d, U) / S.y + 0.5);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || abs(dot(d, N)) > 0.2) return vec4(0.0);
    vec4 c = texture2D(t, uv);
    return vec4(c.rgb, c.a * smoothstep(0.05, 0.35, dot(n, N)));
  }
`;
const FRAG_BODY = /* glsl */ `
  vec3 sz = bbMax - bbMin;
  vec3 p = vObjPos;
  vec3 q = (p - bbMin) / sz;
  vec3 n = normalize(vObjNormal);
  vec3 cF = texture2D(tFront, fitUV(q.xy, fitF)).rgb;
  vec3 cB = texture2D(tBack, fitUV(vec2(1.0 - q.x, q.y), fitF)).rgb;
  vec3 cA = texture2D(tSideA, fitUV(vec2(q.z, q.y), fitS)).rgb;
  vec3 cS = texture2D(tSideB, fitUV(vec2(1.0 - q.z, q.y), fitS)).rgb;
  float wF = pow(max(n.z, 0.0), 12.0), wB = pow(max(-n.z, 0.0), 12.0);
  float wA = pow(max(-n.x, 0.0), 12.0), wS = pow(max(n.x, 0.0), 12.0);
  const float NEAR = 0.01;
  wF *= 0.02 + 0.98 * vis(dF, q.xy, (bbMax.z + 1.0 - p.z - NEAR) / (sz.z + 2.0 - NEAR));
  wB *= 0.02 + 0.98 * vis(dB, vec2(1.0 - q.x, q.y), (p.z - bbMin.z + 1.0 - NEAR) / (sz.z + 2.0 - NEAR));
  wA *= 0.02 + 0.98 * vis(dA, vec2(q.z, q.y), (p.x - bbMin.x + 1.0 - NEAR) / (sz.x + 2.0 - NEAR));
  wS *= 0.02 + 0.98 * vis(dS, vec2(1.0 - q.z, q.y), (bbMax.x + 1.0 - p.x - NEAR) / (sz.x + 2.0 - NEAR));
  float sleeve = smoothstep(0.44, 0.56, abs(p.x)) * smoothstep(-0.05, 0.15, p.y);
  wA *= 1.0 + 40.0 * sleeve; wS *= 1.0 + 40.0 * sleeve;
  vec3 col = (cF * wF + cB * wB + cA * wA + cS * wS) / (wF + wB + wA + wS + 1e-6);
  col = pow(col, vec3(1.08));
  vec4 la = decal(logoA, p, n, decA_C, decA_R, decA_U, decA_N, decA_S, -1.0);
  vec4 lb = decal(logoB, p, n, decB_C, decB_R, decB_U, decB_N, decB_S, 1.0);
  col = mix(col, la.rgb * 0.92, la.a);
  col = mix(col, lb.rgb * 0.92, lb.a);
  if (!gl_FrontFacing) col = inside * 0.55;
  diffuseColor.rgb = col;
`;

class JerseyViewer {
  constructor(stage, kitName) {
    this.stage = stage;
    const kit = KITS[kitName];
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    const lights = [[1.0, 2, 2.5, 4], [0.9, -3, 2, -3], [0.6, 3.5, 1, -2.5], [0.25, -3, -1, 3]];
    for (const [i, x, y, z] of lights) { const l = new THREE.DirectionalLight(0xffffff, i); l.position.set(x, y, z); scene.add(l); }
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 0.12, 4.9);
    this.camera.lookAt(0, 0.05, 0);

    this.uniforms = {
      tFront: { value: tex(`${kitName}-front.jpg`, renderer) },
      tBack: { value: tex(`${kitName}-back.jpg`, renderer) },
      tSideA: { value: tex(`${kitName}-sideA.jpg`, renderer) },
      tSideB: { value: tex(`${kitName}-sideB.jpg`, renderer) },
      logoA: { value: tex(`${kitName}-sideA-logo.png`, renderer) },
      logoB: { value: tex(`${kitName}-sideB-logo.png`, renderer) },
      dF: { value: null }, dB: { value: null }, dA: { value: null }, dS: { value: null },
      bbMin: { value: new THREE.Vector3() }, bbMax: { value: new THREE.Vector3() },
      inside: { value: new THREE.Color(kit.inside) },
      fitF: { value: FIT }, fitS: { value: FIT_SIDE },
      decA_S: { value: new THREE.Vector2(LOGO_W * (kit.aspA > 1.2 ? 1.15 : 0.85), 0) },
      decB_S: { value: new THREE.Vector2(LOGO_W * (kit.aspB > 1.2 ? 1.15 : 0.85), 0) },
    };
    this.uniforms.decA_S.value.y = this.uniforms.decA_S.value.x / kit.aspA;
    this.uniforms.decB_S.value.y = this.uniforms.decB_S.value.x / kit.aspB;
    for (const s of ['A', 'B']) for (const k of ['C', 'R', 'U', 'N']) this.uniforms[`dec${s}_${k}`] = { value: new THREE.Vector3() };

    const material = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;\nvObjNormal = normal;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
        .replace('#include <map_fragment>', FRAG_BODY);
    };
    this.material = material;
    this.group = new THREE.Group();
    this.group.rotation.y = reduceMotion ? 0.45 : (kitName === 'rosa' ? Math.PI / 2 : 0);
    scene.add(this.group);

    this.visible = false;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(stage);
    new ResizeObserver(() => this.resize()).observe(stage);
    this.resize();

    loadModel().then(({ geo, decals }) => {
      this.uniforms.bbMin.value.copy(geo.boundingBox.min);
      this.uniforms.bbMax.value.copy(geo.boundingBox.max);
      for (const s of ['A', 'B']) for (const k of ['C', 'R', 'U', 'N']) this.uniforms[`dec${s}_${k}`].value.copy(decals[s][k]);
      this.bakeVisibility(geo);
      this.group.add(new THREE.Mesh(geo, material));
      stage.classList.add('is-ready');
      this.start();
    }).catch(() => stage.classList.add('is-error'));
  }

  // Depth of the shirt from the four photo directions, so each photo only paints what it sees.
  bakeVisibility(geo) {
    const mn = geo.boundingBox.min, mx = geo.boundingBox.max, sz = geo.boundingBox.getSize(new THREE.Vector3());
    const dscene = new THREE.Scene();
    dscene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false })));
    const views = {
      dF: { pos: [0, 0, mx.z + 1], lrtb: [mn.x, mx.x, mx.y, mn.y], far: sz.z + 2 },
      dB: { pos: [0, 0, mn.z - 1], lrtb: [-mx.x, -mn.x, mx.y, mn.y], far: sz.z + 2 },
      dA: { pos: [mn.x - 1, 0, 0], lrtb: [mn.z, mx.z, mx.y, mn.y], far: sz.x + 2 },
      dS: { pos: [mx.x + 1, 0, 0], lrtb: [-mx.z, -mn.z, mx.y, mn.y], far: sz.x + 2 },
    };
    for (const [name, v] of Object.entries(views)) {
      const rt = new THREE.WebGLRenderTarget(1024, 1024);
      rt.depthTexture = new THREE.DepthTexture(1024, 1024);
      rt.depthTexture.type = THREE.FloatType;
      const cam = new THREE.OrthographicCamera(...v.lrtb, 0.01, v.far);
      cam.position.set(...v.pos);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      this.renderer.setRenderTarget(rt);
      this.renderer.clear();
      this.renderer.render(dscene, cam);
      this.uniforms[name].value = rt.depthTexture;
    }
    this.renderer.setRenderTarget(null);
  }

  resize() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the whole shirt in frame on narrow cards
    this.camera.position.z = Math.max(4.9, 4.9 * 0.8 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    const clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!this.visible) return;
      if (!reduceMotion) this.group.rotation.y += dt * SPEED;
      this.renderer.render(this.scene, this.camera);
    });
  }
}

document.querySelectorAll('.kit-stage[data-kit]').forEach((el) => new JerseyViewer(el, el.dataset.kit));
