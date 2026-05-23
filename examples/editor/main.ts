import {
  Engine, Scene, Camera, Entity, MeshRenderer,
  Geometry, Material, DirectionalLight,
  Mesh, Vec3, Vec4, Quat, Mat4,
} from '../../src/index';
import type { MeshData, ShaderSource } from '../../src/index';
import { csgUnion, csgSubtract, csgIntersect } from './CSG';

// ─── Grid Shader (world-space grid via worldPosition from BasicShader vertex) ─

const GridShader: ShaderSource = {
  vertex: `
    struct GridTransform {
      modelMatrix: mat4x4<f32>,
      viewProjectionMatrix: mat4x4<f32>,
      normalMatrix: mat3x3<f32>,
    };
    @group(0) @binding(0) var<uniform> gt: GridTransform;

    struct GVIn  { @location(0) position: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) uv: vec2<f32> };
    struct GVOut { @builtin(position) clip: vec4<f32>, @location(0) n: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) wp: vec3<f32> };

    @vertex fn vertexMain(i: GVIn) -> GVOut {
      var o: GVOut;
      let wp = gt.modelMatrix * vec4<f32>(i.position, 1.0);
      o.wp   = wp.xyz;
      o.clip = gt.viewProjectionMatrix * wp;
      o.n    = normalize(gt.normalMatrix * i.normal);
      o.uv   = i.uv;
      return o;
    }
  `,
  fragment: `
    struct GMat { color: vec4<f32>, ambient: f32, diffuse: f32, specular: f32, shininess: f32 };
    struct GLight { dir: vec3<f32>, _p1: f32, color: vec4<f32>, camPos: vec3<f32>, _p2: f32 };
    @group(0) @binding(1) var<uniform> gm: GMat;
    @group(0) @binding(2) var<uniform> gl: GLight;

    struct GFIn { @location(0) n: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) wp: vec3<f32> };

    @fragment fn fragmentMain(i: GFIn) -> @location(0) vec4<f32> {
      let p = i.wp.xz;
      let lw: f32 = 0.025;

      let fx = fract(p.x); let fz = fract(p.y);
      let minor = min(step(fx, lw) + step(1.0 - lw, fx) + step(fz, lw) + step(1.0 - lw, fz), 1.0);

      let mfx = fract(p.x / 5.0); let mfz = fract(p.y / 5.0);
      let mlw: f32 = 0.014;
      let major = min(step(mfx, mlw) + step(1.0 - mlw, mfx) + step(mfz, mlw) + step(1.0 - mlw, mfz), 1.0);

      var col = vec3<f32>(0.07, 0.07, 0.07);
      col = mix(col, vec3<f32>(0.20, 0.20, 0.20), minor);
      col = mix(col, vec3<f32>(0.32, 0.32, 0.32), major);
      return vec4<f32>(col, 1.0);
    }
  `,
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface MaterialProps {
  r: number; g: number; b: number; a: number;
  ambient: number; diffuse: number; specular: number; shininess: number;
}

interface EditorNode {
  id: string;
  name: string;
  entity: Entity;
  mesh: Mesh;
  renderer: MeshRenderer;
  material: Material;
  matProps: MaterialProps;
  meshData: MeshData;
  aabb: { min: Vec3; max: Vec3 };
}

// ─── State ───────────────────────────────────────────────────────────────────

let engine: Engine;
let scene: Scene;
let camera: Camera;
let cameraEntity: Entity;
let device: GPUDevice;
let format: GPUTextureFormat;
let canvasEl: HTMLCanvasElement;

const nodes = new Map<string, EditorNode>();
const selectedIds = new Set<string>();
let nodeCounter = 0;

// Orbit camera
let orbitTarget = new Vec3(0, 0, 0);
let orbitDist   = 14;
let orbitTheta  = Math.PI / 4;
let orbitPhi    = Math.PI / 3;

// Mouse tracking
let isLeftDown = false, isRightDown = false, isMidDown = false;
let mouseDownX = 0, mouseDownY = 0;
let lastMouseX = 0, lastMouseY = 0;
let isDragging = false;

// DOM refs
let outlinerEl: HTMLElement;
let propertiesEl: HTMLElement;
let statusEl: HTMLElement;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() { return `n${++nodeCounter}`; }

function computeAABB(positions: Float32Array): { min: Vec3; max: Vec3 } {
  let x0 =  Infinity, y0 =  Infinity, z0 =  Infinity;
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    x0 = Math.min(x0, positions[i]);   x1 = Math.max(x1, positions[i]);
    y0 = Math.min(y0, positions[i+1]); y1 = Math.max(y1, positions[i+1]);
    z0 = Math.min(z0, positions[i+2]); z1 = Math.max(z1, positions[i+2]);
  }
  return { min: new Vec3(x0, y0, z0), max: new Vec3(x1, y1, z1) };
}

function worldAABB(node: EditorNode): { min: Vec3; max: Vec3 } {
  const wm = node.entity.transform.getWorldMatrix();
  const { min: mn, max: mx } = node.aabb;
  const corners = [
    [mn.x, mn.y, mn.z], [mx.x, mn.y, mn.z], [mn.x, mx.y, mn.z], [mx.x, mx.y, mn.z],
    [mn.x, mn.y, mx.z], [mx.x, mn.y, mx.z], [mn.x, mx.y, mx.z], [mx.x, mx.y, mx.z],
  ].map(([x,y,z]) => wm.transform(new Vec3(x, y, z)));

  let rmin = corners[0].clone(), rmax = corners[0].clone();
  for (const c of corners.slice(1)) {
    rmin = new Vec3(Math.min(rmin.x, c.x), Math.min(rmin.y, c.y), Math.min(rmin.z, c.z));
    rmax = new Vec3(Math.max(rmax.x, c.x), Math.max(rmax.y, c.y), Math.max(rmax.z, c.z));
  }
  return { min: rmin, max: rmax };
}

function rayAABB(o: Vec3, d: Vec3, ab: { min: Vec3; max: Vec3 }): number {
  let tmin = -Infinity, tmax = Infinity;
  for (const a of ['x', 'y', 'z'] as const) {
    const inv = 1 / d[a];
    const t1 = (ab.min[a] - o[a]) * inv;
    const t2 = (ab.max[a] - o[a]) * inv;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  return tmax >= tmin && tmax >= 0 ? (tmin >= 0 ? tmin : tmax) : -1;
}

function mouseRay(cx: number, cy: number): { o: Vec3; d: Vec3 } {
  const rect = canvasEl.getBoundingClientRect();
  const nx = ((cx - rect.left) / rect.width)  * 2 - 1;
  const ny = (1 - (cy - rect.top) / rect.height) * 2 - 1;
  const iv = camera.getViewProjectionMatrix().invert();
  if (!iv) return { o: cameraEntity.transform.position.clone(), d: Vec3.forward() };
  const e = iv.elements;
  function unproj(nz: number): Vec3 {
    const w = e[3]*nx + e[7]*ny + e[11]*nz + e[15];
    return w !== 0
      ? new Vec3(
          (e[0]*nx + e[4]*ny + e[8]*nz  + e[12]) / w,
          (e[1]*nx + e[5]*ny + e[9]*nz  + e[13]) / w,
          (e[2]*nx + e[6]*ny + e[10]*nz + e[14]) / w,
        )
      : Vec3.zero();
  }
  const near = unproj(0), far = unproj(1);
  return { o: near, d: far.sub(near).normalize() };
}

function pick(cx: number, cy: number): string | null {
  const { o, d } = mouseRay(cx, cy);
  let bestId: string | null = null, bestT = Infinity;
  for (const [id, node] of nodes) {
    if (!node.entity.active) continue;
    const t = rayAABB(o, d, worldAABB(node));
    if (t > 0 && t < bestT) { bestT = t; bestId = id; }
  }
  return bestId;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255)/255, (n >> 8 & 255)/255, (n & 255)/255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r,g,b].map(v => Math.round(v*255).toString(16).padStart(2,'0')).join('');
}

// ─── Orbit Camera ────────────────────────────────────────────────────────────

function updateOrbitCamera() {
  const sp = Math.sin(orbitPhi), cp = Math.cos(orbitPhi);
  const st = Math.sin(orbitTheta), ct = Math.cos(orbitTheta);
  cameraEntity.transform.position = new Vec3(
    orbitTarget.x + orbitDist * sp * st,
    orbitTarget.y + orbitDist * cp,
    orbitTarget.z + orbitDist * sp * ct,
  );
  cameraEntity.transform.lookAt(orbitTarget);
}

// ─── Node management ─────────────────────────────────────────────────────────

function defaultMatProps(): MaterialProps {
  return { r: 0.72, g: 0.72, b: 0.72, a: 1, ambient: 0.2, diffuse: 0.8, specular: 0.5, shininess: 32 };
}

function buildMaterial(mp: MaterialProps): Material {
  return new Material(undefined, {
    color: new Vec4(mp.r, mp.g, mp.b, mp.a),
    ambient: mp.ambient, diffuse: mp.diffuse,
    specular: mp.specular, shininess: mp.shininess,
  });
}

function createNode(name: string, meshData: MeshData, mp?: Partial<MaterialProps>): EditorNode {
  const id  = genId();
  const mat: MaterialProps = { ...defaultMatProps(), ...mp };
  const mesh = new Mesh(meshData);
  const material = buildMaterial(mat);
  const entity = scene.createEntity(name);
  const renderer = new MeshRenderer();
  renderer.setMesh(mesh);
  renderer.setMaterial(material);
  entity.addComponent(renderer);
  renderer.initialize(device, format);

  const node: EditorNode = {
    id, name, entity, mesh, renderer, material, matProps: mat,
    meshData, aabb: computeAABB(meshData.positions),
  };
  nodes.set(id, node);
  return node;
}

function selectNode(id: string | null, additive: boolean) {
  if (!additive) selectedIds.clear();
  if (id !== null) {
    if (selectedIds.has(id) && additive) selectedIds.delete(id);
    else selectedIds.add(id);
  }
  refreshUI();
}

// ─── Primitive Addition ───────────────────────────────────────────────────────

function addPrimitive(type: 'cube' | 'sphere' | 'cylinder' | 'plane') {
  const specs: Record<string, [string, MeshData]> = {
    cube:     ['Cube',     Geometry.createCube(1)],
    sphere:   ['Sphere',   Geometry.createSphere(0.5, 24, 16)],
    cylinder: ['Cylinder', Geometry.createCylinder(0.5, 1, 24)],
    plane:    ['Plane',    Geometry.createPlane(2, 2, 1, 1)],
  };
  const [baseName, meshData] = specs[type];
  const count = [...nodes.values()].filter(n => n.name.startsWith(baseName)).length;
  const name  = count === 0 ? baseName : `${baseName}.${String(count + 1).padStart(3, '0')}`;
  const node  = createNode(name, meshData);
  node.entity.transform.position = new Vec3(0, type === 'plane' ? 0 : 0.5, 0);
  selectNode(node.id, false);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

function deleteSelected() {
  for (const id of [...selectedIds]) {
    const node = nodes.get(id);
    if (!node) continue;
    node.entity.destroy();
    nodes.delete(id);
  }
  selectedIds.clear();
  refreshUI();
}

// ─── CSG Operations ──────────────────────────────────────────────────────────

function applyCSG(op: 'union' | 'subtract' | 'intersect') {
  if (selectedIds.size !== 2) {
    setStatus('Select exactly 2 objects for a CSG operation.');
    return;
  }
  const [idA, idB] = [...selectedIds];
  const nA = nodes.get(idA)!, nB = nodes.get(idB)!;

  const matA = nA.entity.transform.getWorldMatrix();
  const matB = nB.entity.transform.getWorldMatrix();

  let result: MeshData;
  try {
    if (op === 'union')     result = csgUnion(nA.meshData, matA, nB.meshData, matB);
    else if (op === 'subtract') result = csgSubtract(nA.meshData, matA, nB.meshData, matB);
    else                    result = csgIntersect(nA.meshData, matA, nB.meshData, matB);
  } catch (e) {
    setStatus(`CSG failed: ${(e as Error).message}`);
    return;
  }

  if (!result.indices || result.indices.length === 0) {
    setStatus('CSG produced an empty mesh — no overlap or fully consumed geometry.');
    return;
  }

  const opLabel = { union: 'Union', subtract: 'Subtract', intersect: 'Intersect' }[op];
  const newName = `${opLabel}(${nA.name}, ${nB.name})`;

  // Remove source entities
  nA.entity.destroy(); nodes.delete(idA);
  nB.entity.destroy(); nodes.delete(idB);
  selectedIds.clear();

  // Create result node; result mesh is already in world space, so position at origin
  const resultNode = createNode(newName, result, { ...nA.matProps });
  resultNode.entity.transform.position = Vec3.zero();
  resultNode.entity.transform.rotation = Quat.identity();
  resultNode.entity.transform.scale    = Vec3.one();
  selectNode(resultNode.id, false);
}

// ─── Set Parent / Unparent ───────────────────────────────────────────────────

function setParent() {
  if (selectedIds.size !== 2) { setStatus('Select exactly 2 objects: child then parent (Ctrl+click).'); return; }
  const [childId, parentId] = [...selectedIds];
  const childNode  = nodes.get(childId)!;
  const parentNode = nodes.get(parentId)!;

  // Remove child from scene root list first
  scene.removeEntity(childNode.entity);
  parentNode.entity.addChild(childNode.entity);
  setStatus(`"${childNode.name}" parented to "${parentNode.name}".`);
  refreshUI();
}

function unparent() {
  for (const id of selectedIds) {
    const node = nodes.get(id);
    if (!node || !node.entity.parent) continue;
    node.entity.parent.removeChild(node.entity);
    scene.addEntity(node.entity);
  }
  refreshUI();
}

// ─── Update Transform / Material ─────────────────────────────────────────────

function updateTransform(id: string, pos: Vec3, rotDeg: Vec3, scale: Vec3) {
  const node = nodes.get(id);
  if (!node) return;
  node.entity.transform.position = pos;
  node.entity.transform.rotation = Quat.fromEuler(
    rotDeg.x * Math.PI / 180,
    rotDeg.y * Math.PI / 180,
    rotDeg.z * Math.PI / 180,
  );
  node.entity.transform.scale = scale;
}

function updateNodeMaterial(id: string, mp: Partial<MaterialProps>) {
  const node = nodes.get(id);
  if (!node) return;
  Object.assign(node.matProps, mp);

  // Destroy old GPU resources, recreate material + mesh buffers
  node.material.destroy();
  node.mesh.destroy();
  const newMat = buildMaterial(node.matProps);
  node.renderer.setMaterial(newMat);
  node.material = newMat;
  node.renderer.initialize(device, format);
}

// ─── Status Bar ──────────────────────────────────────────────────────────────

function setStatus(msg: string) {
  if (statusEl) statusEl.textContent = msg;
}

// ─── UI Rendering ────────────────────────────────────────────────────────────

function refreshUI() {
  renderOutliner();
  renderProperties();
  updateStatus();
}

function renderOutliner() {
  const sel = selectedIds;
  const root = outlinerEl;

  function makeRow(node: EditorNode, depth: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'tree-row' + (sel.has(node.id) ? ' selected' : '');
    row.style.paddingLeft = `${8 + depth * 16}px`;

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = node.entity.children.length > 0 ? '▾' : '·';

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;

    row.appendChild(icon);
    row.appendChild(label);

    row.addEventListener('click', (e) => {
      selectNode(node.id, e.ctrlKey || e.metaKey);
      e.stopPropagation();
    });

    return row;
  }

  function renderNode(node: EditorNode, depth: number): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendChild(makeRow(node, depth));
    for (const child of node.entity.children) {
      // Find the EditorNode for this child entity
      const childNode = [...nodes.values()].find(n => n.entity === child);
      if (childNode) frag.appendChild(renderNode(childNode, depth + 1));
    }
    return frag;
  }

  root.innerHTML = '';
  // Only render root-level nodes (no parent entity)
  const rootNodes = [...nodes.values()].filter(n => n.entity.parent === null);
  for (const node of rootNodes) root.appendChild(renderNode(node, 0));
}

function renderProperties() {
  const panel = propertiesEl;

  if (selectedIds.size === 0) {
    panel.innerHTML = '<div class="prop-empty">Nothing selected</div>';
    return;
  }
  if (selectedIds.size > 1) {
    panel.innerHTML = `<div class="prop-empty">${selectedIds.size} objects selected</div>`;
    return;
  }

  const [id] = selectedIds;
  const node = nodes.get(id);
  if (!node) return;

  const { position: pos, rotation: rot, scale } = node.entity.transform;
  const euler = rot.toEuler(); // Vec3: [roll, pitch, yaw] radians
  const rx = euler.x * 180 / Math.PI;
  const ry = euler.y * 180 / Math.PI;
  const rz = euler.z * 180 / Math.PI;
  const mp = node.matProps;

  panel.innerHTML = `
    <div class="prop-section">
      <div class="prop-title">Transform</div>
      <div class="prop-row">
        <label>Position</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="px" type="number" step="0.1" value="${pos.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="py" type="number" step="0.1" value="${pos.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="pz" type="number" step="0.1" value="${pos.z.toFixed(3)}">
        </div>
      </div>
      <div class="prop-row">
        <label>Rotation</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="rx" type="number" step="1" value="${rx.toFixed(1)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="ry" type="number" step="1" value="${ry.toFixed(1)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="rz" type="number" step="1" value="${rz.toFixed(1)}">
        </div>
      </div>
      <div class="prop-row">
        <label>Scale</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="sx" type="number" step="0.01" value="${scale.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="sy" type="number" step="0.01" value="${scale.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="sz" type="number" step="0.01" value="${scale.z.toFixed(3)}">
        </div>
      </div>
    </div>

    <div class="prop-section">
      <div class="prop-title">Material</div>
      <div class="prop-row prop-color-row">
        <label>Color</label>
        <input id="mc" type="color" value="${rgbToHex(mp.r, mp.g, mp.b)}">
      </div>
      <div class="prop-row">
        <label>Ambient</label>
        <input id="ma" type="range" min="0" max="1" step="0.01" value="${mp.ambient}">
        <span class="slider-val" id="ma-v">${mp.ambient.toFixed(2)}</span>
      </div>
      <div class="prop-row">
        <label>Diffuse</label>
        <input id="md" type="range" min="0" max="1" step="0.01" value="${mp.diffuse}">
        <span class="slider-val" id="md-v">${mp.diffuse.toFixed(2)}</span>
      </div>
      <div class="prop-row">
        <label>Specular</label>
        <input id="ms" type="range" min="0" max="1" step="0.01" value="${mp.specular}">
        <span class="slider-val" id="ms-v">${mp.specular.toFixed(2)}</span>
      </div>
      <div class="prop-row">
        <label>Shininess</label>
        <input id="msh" type="range" min="1" max="128" step="1" value="${mp.shininess}">
        <span class="slider-val" id="msh-v">${mp.shininess.toFixed(0)}</span>
      </div>
    </div>
  `;

  // Wire transform inputs
  function getTransform() {
    return {
      pos: new Vec3(
        parseFloat((document.getElementById('px') as HTMLInputElement).value),
        parseFloat((document.getElementById('py') as HTMLInputElement).value),
        parseFloat((document.getElementById('pz') as HTMLInputElement).value),
      ),
      rot: new Vec3(
        parseFloat((document.getElementById('rx') as HTMLInputElement).value),
        parseFloat((document.getElementById('ry') as HTMLInputElement).value),
        parseFloat((document.getElementById('rz') as HTMLInputElement).value),
      ),
      scale: new Vec3(
        parseFloat((document.getElementById('sx') as HTMLInputElement).value),
        parseFloat((document.getElementById('sy') as HTMLInputElement).value),
        parseFloat((document.getElementById('sz') as HTMLInputElement).value),
      ),
    };
  }

  for (const pid of ['px','py','pz','rx','ry','rz','sx','sy','sz']) {
    document.getElementById(pid)?.addEventListener('change', () => {
      const { pos, rot, scale } = getTransform();
      updateTransform(id, pos, rot, scale);
    });
  }

  // Wire material inputs
  document.getElementById('mc')?.addEventListener('input', (e) => {
    const [r,g,b] = hexToRgb((e.target as HTMLInputElement).value);
    updateNodeMaterial(id, { r, g, b });
  });

  function wireSlider(inputId: string, valId: string, key: keyof MaterialProps) {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const valEl = document.getElementById(valId);
    input?.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (valEl) valEl.textContent = v.toFixed(key === 'shininess' ? 0 : 2);
      updateNodeMaterial(id, { [key]: v } as Partial<MaterialProps>);
    });
  }
  wireSlider('ma',  'ma-v',  'ambient');
  wireSlider('md',  'md-v',  'diffuse');
  wireSlider('ms',  'ms-v',  'specular');
  wireSlider('msh', 'msh-v', 'shininess');
}

function updateStatus() {
  const count = nodes.size;
  const selCount = selectedIds.size;
  if (selCount === 0) {
    setStatus(`${count} object${count !== 1 ? 's' : ''} in scene  •  Click to select`);
  } else if (selCount === 1) {
    const [id] = selectedIds;
    const node = nodes.get(id)!;
    const verts = node.meshData.positions.length / 3;
    const tris  = (node.meshData.indices?.length ?? 0) / 3;
    setStatus(`"${node.name}" selected  •  ${verts} verts  •  ${tris} tris`);
  } else {
    setStatus(`${selCount} objects selected  •  ${count} total`);
  }
}

// ─── Toolbar Wiring ──────────────────────────────────────────────────────────

function wireToolbar() {
  const btn = (id: string, fn: () => void) =>
    document.getElementById(id)?.addEventListener('click', fn);

  btn('btn-cube',      () => addPrimitive('cube'));
  btn('btn-sphere',    () => addPrimitive('sphere'));
  btn('btn-cylinder',  () => addPrimitive('cylinder'));
  btn('btn-plane',     () => addPrimitive('plane'));

  btn('btn-union',     () => applyCSG('union'));
  btn('btn-subtract',  () => applyCSG('subtract'));
  btn('btn-intersect', () => applyCSG('intersect'));

  btn('btn-parent',    () => setParent());
  btn('btn-unparent',  () => unparent());
  btn('btn-delete',    () => deleteSelected());

  btn('btn-frame',     () => {
    if (nodes.size === 0) return;
    // Frame all: set orbit target to average position
    let cx = 0, cy = 0, cz = 0;
    for (const n of nodes.values()) {
      cx += n.entity.transform.position.x;
      cy += n.entity.transform.position.y;
      cz += n.entity.transform.position.z;
    }
    const c = 1 / nodes.size;
    orbitTarget = new Vec3(cx * c, cy * c, cz * c);
    updateOrbitCamera();
  });
  btn('btn-reset-cam', () => {
    orbitTarget = Vec3.zero();
    orbitDist   = 14;
    orbitTheta  = Math.PI / 4;
    orbitPhi    = Math.PI / 3;
    updateOrbitCamera();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    if (e.key === 'f' || e.key === 'F') document.getElementById('btn-frame')?.click();
  });
}

// ─── Mouse Handlers ──────────────────────────────────────────────────────────

function wireMouseEvents() {
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

  canvasEl.addEventListener('mousedown', (e) => {
    mouseDownX = e.clientX; mouseDownY = e.clientY;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
    isDragging = false;
    if (e.button === 0) isLeftDown = true;
    if (e.button === 1) { isMidDown = true; e.preventDefault(); }
    if (e.button === 2) isRightDown = true;
  });

  window.addEventListener('mouseup', (e) => {
    const dx = e.clientX - mouseDownX, dy = e.clientY - mouseDownY;
    const moved = dx*dx + dy*dy > 25;

    if (e.button === 0 && isLeftDown && !moved) {
      // Click — pick entity
      const id = pick(e.clientX, e.clientY);
      selectNode(id, e.ctrlKey || e.metaKey);
    }
    if (e.button === 0) isLeftDown  = false;
    if (e.button === 1) isMidDown   = false;
    if (e.button === 2) isRightDown = false;
    isDragging = false;
  });

  window.addEventListener('mousemove', (e) => {
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    if (!dx && !dy) return;
    isDragging = true;

    if (isLeftDown) {
      // Orbit
      orbitTheta -= dx * 0.005;
      orbitPhi    = Math.max(0.05, Math.min(Math.PI - 0.05, orbitPhi + dy * 0.005));
      updateOrbitCamera();
    } else if (isRightDown || isMidDown) {
      // Pan in view plane
      const right = cameraEntity.transform.getRight();
      const up    = cameraEntity.transform.getUp();
      const speed = orbitDist * 0.0015;
      orbitTarget = orbitTarget
        .sub(right.mul(dx * speed))
        .add(up.mul(dy * speed));
      updateOrbitCamera();
    }
  });

  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbitDist = Math.max(0.5, orbitDist * (1 + e.deltaY * 0.001));
    updateOrbitCamera();
  }, { passive: false });
}

// ─── Canvas Resize ───────────────────────────────────────────────────────────

function wireResize() {
  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const w = Math.floor(width), h = Math.floor(height);
    if (w <= 0 || h <= 0) return;
    canvasEl.width  = w;
    canvasEl.height = h;
    engine.resize(w, h);
    camera.setAspect(w / h);
  });
  ro.observe(canvasEl);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  canvasEl     = document.getElementById('viewport') as HTMLCanvasElement;
  outlinerEl   = document.getElementById('outliner-body') as HTMLElement;
  propertiesEl = document.getElementById('properties-body') as HTMLElement;
  statusEl     = document.getElementById('statusbar') as HTMLElement;

  const errorEl = document.getElementById('error') as HTMLDivElement;

  try {
    if (!navigator.gpu) throw new Error('WebGPU not supported. Use Chrome/Edge 113+.');

    const w = canvasEl.offsetWidth  || 800;
    const h = canvasEl.offsetHeight || 600;
    canvasEl.width  = w;
    canvasEl.height = h;

    engine = new Engine({ canvas: canvasEl, width: w, height: h, antialias: true });
    await engine.initialize();

    scene = new Scene('Editor');
    engine.setScene(scene);

    device = engine.getRenderer().getDevice()!;
    format = engine.getRenderer().getFormat();

    // Camera
    cameraEntity = scene.createEntity('Camera');
    camera = new Camera();
    camera.setPerspective(Math.PI / 3, w / h, 0.1, 500);
    cameraEntity.addComponent(camera);
    updateOrbitCamera();

    // Directional light
    const lightE = scene.createEntity('Light');
    lightE.addComponent(new DirectionalLight(new Vec4(1, 0.95, 0.88, 1), 1.0));
    lightE.transform.rotation = Quat.fromEuler(-Math.PI / 4, Math.PI / 5, 0);

    // Grid ground plane
    const gridE  = scene.createEntity('Grid');
    const gridMesh = Geometry.createPlane(100, 100, 1, 1);
    const gridMat  = new Material(GridShader, { color: new Vec4(1, 1, 1, 1) });
    const gridR    = new MeshRenderer();
    gridR.setMesh(gridMesh);
    gridR.setMaterial(gridMat);
    gridE.addComponent(gridR);
    gridR.initialize(device, format);

    // Wire UI
    wireToolbar();
    wireMouseEvents();
    wireResize();

    // Add a default cube so the viewport is never empty
    addPrimitive('cube');

    engine.start();
    refreshUI();

  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.textContent = `Error: ${(err as Error).message}`;
      errorEl.style.display = 'block';
    }
  }
}

main();
