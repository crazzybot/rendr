import {
  Engine, Scene, Camera, Entity, MeshRenderer,
  Geometry, Material, DirectionalLight,
  Mesh, Vec3, Vec4, Quat, Mat4,
  csgUnion, csgSubtract, csgIntersect,
} from '../../src/index';
import type { MeshData, ShaderSource } from '../../src/index';

// ─── Grid Shader ─────────────────────────────────────────────────────────────

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
      o.wp = wp.xyz; o.clip = gt.viewProjectionMatrix * wp;
      o.n = normalize(gt.normalMatrix * i.normal); o.uv = i.uv;
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
      let p = i.wp.xz; let lw: f32 = 0.010;
      let fx = fract(p.x); let fz = fract(p.y);
      let minor = min(step(fx, lw) + step(1.0 - lw, fx) + step(fz, lw) + step(1.0 - lw, fz), 1.0);
      let mfx = fract(p.x / 5.0); let mfz = fract(p.y / 5.0); let mlw: f32 = 0.005;
      let major = min(step(mfx, mlw) + step(1.0 - mlw, mfx) + step(mfz, mlw) + step(1.0 - mlw, mfz), 1.0);
      var col = vec3<f32>(0.07, 0.07, 0.07);
      col = mix(col, vec3<f32>(0.20, 0.20, 0.20), minor);
      col = mix(col, vec3<f32>(0.32, 0.32, 0.32), major);
      return vec4<f32>(col, 1.0);
    }
  `,
};

// ─── Types ───────────────────────────────────────────────────────────────────

type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane';
type CsgOp = 'base' | 'union' | 'subtract' | 'intersect';

interface CsgLayer {
  id: string;
  op: CsgOp;
  primitiveType: PrimitiveType;
  size: number;
  position: Vec3;   // euler X Y Z in degrees for UI
  rotation: Vec3;
  scale: Vec3;
}

interface MaterialProps {
  r: number; g: number; b: number; a: number;
  ambient: number; diffuse: number; specular: number; shininess: number;
}

interface EditorNode {
  id: string;
  name: string;
  entity: Entity;
  isComposite: boolean;
  // Defined only when isComposite === false:
  mesh?: Mesh;
  renderer?: MeshRenderer;
  material?: Material;
  matProps?: MaterialProps;
  meshData?: MeshData;
  aabb?: { min: Vec3; max: Vec3 };
  csgLayers: CsgLayer[];
}

type EditorMode = 'scene' | 'mesh-edit';

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

let editorMode: EditorMode = 'scene';
let meshEditTargetId: string | null = null;
let meshEditSelectedLayerId: string | null = null;
let meshEditSavedLayers: CsgLayer[] | null = null; // snapshot for cancel

// Orbit camera
let orbitTarget = new Vec3(0, 0, 0);
let orbitDist   = 14;
let orbitTheta  = Math.PI / 4;
let orbitPhi    = Math.PI / 3;

// Mouse tracking
let isLeftDown = false, isRightDown = false, isMidDown = false;
let mouseDownX = 0, mouseDownY = 0;
let lastMouseX = 0, lastMouseY = 0;
let lastClickTime = 0;
let lastClickId: string | null = null;

// DOM refs
let outlinerEl: HTMLElement;
let outlinerHeaderEl: HTMLElement;
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

function worldAABB(node: EditorNode): { min: Vec3; max: Vec3 } | null {
  if (!node.aabb) return null;
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
      ? new Vec3((e[0]*nx + e[4]*ny + e[8]*nz  + e[12]) / w,
                 (e[1]*nx + e[5]*ny + e[9]*nz  + e[13]) / w,
                 (e[2]*nx + e[6]*ny + e[10]*nz + e[14]) / w)
      : Vec3.zero();
  }
  const near = unproj(0), far = unproj(1);
  return { o: near, d: far.sub(near).normalize() };
}

function pick(cx: number, cy: number): string | null {
  const { o, d } = mouseRay(cx, cy);
  let bestId: string | null = null, bestT = Infinity;
  for (const [id, node] of nodes) {
    if (!node.entity.active || node.isComposite) continue;
    const ab = worldAABB(node);
    if (!ab) continue;
    const t = rayAABB(o, d, ab);
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

function deepCopyLayers(layers: CsgLayer[]): CsgLayer[] {
  return layers.map(l => ({
    ...l,
    position: l.position.clone(),
    rotation: l.rotation.clone(),
    scale:    l.scale.clone(),
  }));
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

// ─── CSG Layer Evaluation ────────────────────────────────────────────────────

function getRawMeshData(layer: CsgLayer): MeshData {
  const s = layer.size;
  let mesh: Mesh;
  switch (layer.primitiveType) {
    case 'cube':     mesh = Geometry.createCube(s); break;
    case 'sphere':   mesh = Geometry.createSphere(s * 0.5, 24, 16); break;
    case 'cylinder': mesh = Geometry.createCylinder(s * 0.5, s, 24); break;
    case 'plane':    mesh = Geometry.createPlane(s, s, 1, 1); break;
  }
  return { positions: mesh.positions, normals: mesh.normals ?? new Float32Array(),
           uvs: mesh.uvs ?? new Float32Array(), indices: mesh.indices ?? new Uint16Array() };
}

function layerMatrix(layer: CsgLayer): Mat4 {
  const rot = Quat.fromEuler(
    layer.rotation.x * Math.PI / 180,
    layer.rotation.y * Math.PI / 180,
    layer.rotation.z * Math.PI / 180,
  );
  return Mat4.fromRotationTranslationScale(rot, layer.position, layer.scale);
}

function evaluateCsgLayers(layers: CsgLayer[]): MeshData {
  if (layers.length === 0) throw new Error('No CSG layers');
  let result = getRawMeshData(layers[0]);
  let resultMat = layerMatrix(layers[0]);
  for (let i = 1; i < layers.length; i++) {
    const l = layers[i];
    const ld = getRawMeshData(l);
    const lm = layerMatrix(l);
    switch (l.op) {
      case 'union':     result = csgUnion(result, resultMat, ld, lm); break;
      case 'subtract':  result = csgSubtract(result, resultMat, ld, lm); break;
      case 'intersect': result = csgIntersect(result, resultMat, ld, lm); break;
    }
    resultMat = Mat4.identity();
  }
  return result;
}

// ─── Node Management ─────────────────────────────────────────────────────────

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

function createMeshNode(name: string, layers: CsgLayer[], mp?: Partial<MaterialProps>): EditorNode {
  const id  = genId();
  const mat: MaterialProps = { ...defaultMatProps(), ...mp };
  const meshData = evaluateCsgLayers(layers);
  const mesh = new Mesh(meshData);
  const material = buildMaterial(mat);
  const entity = scene.createEntity(name);
  const renderer = new MeshRenderer();
  renderer.setMesh(mesh); renderer.setMaterial(material);
  entity.addComponent(renderer);
  renderer.initialize(device, format);
  const node: EditorNode = {
    id, name, entity, isComposite: false,
    mesh, renderer, material, matProps: mat,
    meshData, aabb: computeAABB(meshData.positions),
    csgLayers: layers,
  };
  nodes.set(id, node);
  return node;
}

function createCompositeNode(name: string): EditorNode {
  const id = genId();
  const entity = scene.createEntity(name);
  const node: EditorNode = { id, name, entity, isComposite: true, csgLayers: [] };
  nodes.set(id, node);
  return node;
}

function recomputeMesh(nodeId: string): boolean {
  const node = nodes.get(nodeId);
  if (!node || node.isComposite || !node.csgLayers.length) return false;
  let meshData: MeshData;
  try {
    meshData = evaluateCsgLayers(node.csgLayers);
  } catch (e) {
    setStatus(`CSG evaluation failed: ${(e as Error).message}`);
    return false;
  }
  if (!meshData.indices || meshData.indices.length === 0) {
    setStatus('CSG result is empty — check for non-overlapping geometry.');
    return false;
  }
  node.meshData = meshData;
  node.aabb = computeAABB(meshData.positions);
  node.material!.destroy();
  node.mesh!.destroy();
  const newMesh = new Mesh(meshData);
  const newMat  = buildMaterial(node.matProps!);
  node.renderer!.setMesh(newMesh); node.renderer!.setMaterial(newMat);
  node.mesh = newMesh; node.material = newMat;
  node.renderer!.initialize(device, format);
  return true;
}

function selectNode(id: string | null, additive: boolean) {
  if (!additive) selectedIds.clear();
  if (id !== null) {
    if (selectedIds.has(id) && additive) selectedIds.delete(id);
    else selectedIds.add(id);
  }
  refreshUI();
}

// ─── Scene Mode: Primitive / Composite Addition ───────────────────────────────

function defaultLayerFor(type: PrimitiveType): CsgLayer {
  const yOff = type === 'plane' ? 0 : 0.5;
  return {
    id: genId(),
    op: 'base',
    primitiveType: type,
    size: type === 'plane' ? 2 : 1,
    position: new Vec3(0, yOff, 0),
    rotation: Vec3.zero(),
    scale: Vec3.one(),
  };
}

function addScenePrimitive(type: PrimitiveType) {
  const baseName = { cube:'Cube', sphere:'Sphere', cylinder:'Cylinder', plane:'Plane' }[type];
  const count = [...nodes.values()].filter(n => n.name.startsWith(baseName)).length;
  const name  = count === 0 ? baseName : `${baseName}.${String(count + 1).padStart(3, '0')}`;
  const layers = [defaultLayerFor(type)];
  const node   = createMeshNode(name, layers);
  node.entity.transform.position = Vec3.zero();
  selectNode(node.id, false);
}

function addComposite() {
  const count = [...nodes.values()].filter(n => n.name.startsWith('Group')).length;
  const name  = count === 0 ? 'Group' : `Group.${String(count + 1).padStart(3, '0')}`;
  const node  = createCompositeNode(name);
  selectNode(node.id, false);
}

// ─── Scene Mode: Delete / Parent ─────────────────────────────────────────────

function deleteSelected() {
  if (editorMode === 'mesh-edit') {
    deleteMeshEditLayer();
    return;
  }
  for (const id of [...selectedIds]) {
    const node = nodes.get(id);
    if (!node) continue;
    node.entity.destroy();
    nodes.delete(id);
  }
  selectedIds.clear();
  refreshUI();
}

function setParent() {
  if (selectedIds.size !== 2) { setStatus('Select exactly 2 objects: child then parent (Ctrl+click).'); return; }
  const [childId, parentId] = [...selectedIds];
  const childNode  = nodes.get(childId)!;
  const parentNode = nodes.get(parentId)!;
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

// ─── Mesh Edit Mode ───────────────────────────────────────────────────────────

function enterMeshEditMode(nodeId: string) {
  const node = nodes.get(nodeId);
  if (!node || node.isComposite) return;

  editorMode = 'mesh-edit';
  meshEditTargetId = nodeId;
  meshEditSavedLayers = deepCopyLayers(node.csgLayers);
  meshEditSelectedLayerId = node.csgLayers[0]?.id ?? null;

  // Hide every entity except the one being edited.
  for (const [id, n] of nodes) {
    if (id !== nodeId) n.entity.active = false;
  }

  selectedIds.clear();
  document.getElementById('scene-tools')!.style.display    = 'none';
  document.getElementById('mesh-edit-tools')!.style.display = 'flex';
  document.getElementById('outliner-header')!.classList.add('me-mode');
  refreshUI();
}

function exitMeshEditMode(apply: boolean) {
  if (editorMode !== 'mesh-edit') return;

  if (!apply && meshEditTargetId && meshEditSavedLayers) {
    const node = nodes.get(meshEditTargetId);
    if (node) {
      node.csgLayers = meshEditSavedLayers;
      recomputeMesh(meshEditTargetId);
    }
  }

  // Restore all entities.
  for (const n of nodes.values()) n.entity.active = true;

  editorMode = 'scene';
  meshEditTargetId = null;
  meshEditSelectedLayerId = null;
  meshEditSavedLayers = null;

  document.getElementById('scene-tools')!.style.display    = 'flex';
  document.getElementById('mesh-edit-tools')!.style.display = 'none';
  document.getElementById('outliner-header')!.classList.remove('me-mode');
  refreshUI();
}

// ─── Mesh Edit Mode: Layer Management ────────────────────────────────────────

function addMeshEditLayer(type: PrimitiveType, op: CsgOp = 'union') {
  if (!meshEditTargetId) return;
  const node = nodes.get(meshEditTargetId);
  if (!node || node.isComposite) return;

  const layer: CsgLayer = {
    id: genId(), op,
    primitiveType: type, size: 1,
    position: Vec3.zero(),
    rotation: Vec3.zero(),
    scale: Vec3.one(),
  };
  node.csgLayers.push(layer);
  meshEditSelectedLayerId = layer.id;
  recomputeMesh(meshEditTargetId);
  refreshUI();
}

function deleteMeshEditLayer() {
  if (!meshEditTargetId || !meshEditSelectedLayerId) return;
  const node = nodes.get(meshEditTargetId);
  if (!node || node.isComposite) return;
  const idx = node.csgLayers.findIndex(l => l.id === meshEditSelectedLayerId);
  if (idx === -1) return;
  if (node.csgLayers.length === 1) { setStatus('Cannot delete the only layer.'); return; }
  if (idx === 0) node.csgLayers[1].op = 'base'; // promote next to base
  node.csgLayers.splice(idx, 1);
  meshEditSelectedLayerId = node.csgLayers[Math.min(idx, node.csgLayers.length - 1)].id;
  recomputeMesh(meshEditTargetId);
  refreshUI();
}

function updateSelectedLayer(patch: Partial<CsgLayer>) {
  if (!meshEditTargetId || !meshEditSelectedLayerId) return;
  const node = nodes.get(meshEditTargetId);
  if (!node) return;
  const layer = node.csgLayers.find(l => l.id === meshEditSelectedLayerId);
  if (!layer) return;
  Object.assign(layer, patch);
  recomputeMesh(meshEditTargetId);
  refreshUI();
}

// ─── Update Transform / Material ─────────────────────────────────────────────

function updateTransform(id: string, pos: Vec3, rotDeg: Vec3, scl: Vec3) {
  const node = nodes.get(id);
  if (!node) return;
  node.entity.transform.position = pos;
  node.entity.transform.rotation = Quat.fromEuler(
    rotDeg.x * Math.PI / 180, rotDeg.y * Math.PI / 180, rotDeg.z * Math.PI / 180);
  node.entity.transform.scale = scl;
}

function updateNodeMaterial(id: string, mp: Partial<MaterialProps>) {
  const node = nodes.get(id);
  if (!node || node.isComposite || !node.matProps) return;
  Object.assign(node.matProps, mp);
  node.material!.destroy();
  node.mesh!.destroy();
  const newMat = buildMaterial(node.matProps);
  node.renderer!.setMaterial(newMat);
  node.material = newMat;
  node.renderer!.initialize(device, format);
}

// ─── Status ───────────────────────────────────────────────────────────────────

function setStatus(msg: string) { if (statusEl) statusEl.textContent = msg; }

// ─── UI Rendering ────────────────────────────────────────────────────────────

function refreshUI() {
  renderOutliner();
  renderProperties();
  updateStatus();
}

// Scene outliner ──────────────────────────────────────────────────────────────

function renderOutliner() {
  if (editorMode === 'mesh-edit') {
    renderCsgLayerPanel();
  } else {
    renderSceneOutliner();
  }
}

function renderSceneOutliner() {
  outlinerHeaderEl.textContent = 'Scene Outliner';

  function makeRow(node: EditorNode, depth: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'tree-row' + (selectedIds.has(node.id) ? ' selected' : '');
    row.style.paddingLeft = `${8 + depth * 16}px`;
    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = node.isComposite ? '⬡' : (node.entity.children.length > 0 ? '▾' : '·');
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;
    row.append(icon, label);
    row.addEventListener('click', (e) => { selectNode(node.id, e.ctrlKey || e.metaKey); e.stopPropagation(); });
    row.addEventListener('dblclick', (e) => { e.stopPropagation(); enterMeshEditMode(node.id); });
    return row;
  }

  function renderNode(node: EditorNode, depth: number): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendChild(makeRow(node, depth));
    for (const child of node.entity.children) {
      const childNode = [...nodes.values()].find(n => n.entity === child);
      if (childNode) frag.appendChild(renderNode(childNode, depth + 1));
    }
    return frag;
  }

  outlinerEl.innerHTML = '';
  const rootNodes = [...nodes.values()].filter(n => n.entity.parent === null);
  for (const node of rootNodes) outlinerEl.appendChild(renderNode(node, 0));
}

function renderCsgLayerPanel() {
  const node = meshEditTargetId ? nodes.get(meshEditTargetId) : null;
  outlinerHeaderEl.textContent = node ? `Mesh: ${node.name}` : 'Mesh Edit';
  outlinerEl.innerHTML = '';
  if (!node || node.isComposite) return;

  const opIcon: Record<CsgOp, string> = { base:'◼', union:'⊕', subtract:'⊖', intersect:'⊗' };
  const primIcon: Record<PrimitiveType, string> = { cube:'▪', sphere:'●', cylinder:'⬟', plane:'▬' };

  node.csgLayers.forEach((layer, idx) => {
    const row = document.createElement('div');
    row.className = 'tree-row' + (layer.id === meshEditSelectedLayerId ? ' selected' : '');

    const opBadge = document.createElement('span');
    opBadge.className = 'layer-op';
    opBadge.textContent = opIcon[layer.op];
    opBadge.title = layer.op;

    const pIcon = document.createElement('span');
    pIcon.className = 'tree-icon';
    pIcon.textContent = primIcon[layer.primitiveType];

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = `${layer.primitiveType} (${layer.size}m)`;

    const badge = document.createElement('span');
    badge.className = 'layer-badge';
    badge.textContent = idx === 0 ? 'BASE' : layer.op.toUpperCase();

    row.append(opBadge, pIcon, label, badge);
    row.addEventListener('click', () => {
      meshEditSelectedLayerId = layer.id;
      refreshUI();
    });
    outlinerEl.appendChild(row);
  });
}

// Properties panel ────────────────────────────────────────────────────────────

function renderProperties() {
  if (editorMode === 'mesh-edit') {
    renderLayerProperties();
    return;
  }

  const panel = propertiesEl;
  if (selectedIds.size === 0) { panel.innerHTML = '<div class="prop-empty">Nothing selected<br><small>Click an object or double-click to edit its mesh</small></div>'; return; }
  if (selectedIds.size > 1)   { panel.innerHTML = `<div class="prop-empty">${selectedIds.size} objects selected</div>`; return; }

  const [id] = selectedIds;
  const node = nodes.get(id);
  if (!node) return;

  const { position: pos, rotation: rot, scale } = node.entity.transform;
  const euler = rot.toEuler();
  const rx = euler.x * 180 / Math.PI, ry = euler.y * 180 / Math.PI, rz = euler.z * 180 / Math.PI;

  let matHtml = '';
  if (!node.isComposite && node.matProps) {
    const mp = node.matProps;
    matHtml = `
      <div class="prop-section">
        <div class="prop-title">Material</div>
        <div class="prop-row prop-color-row"><label>Color</label>
          <input id="mc" type="color" value="${rgbToHex(mp.r, mp.g, mp.b)}"></div>
        <div class="prop-row"><label>Ambient</label>
          <input id="ma" type="range" min="0" max="1" step="0.01" value="${mp.ambient}">
          <span class="slider-val" id="ma-v">${mp.ambient.toFixed(2)}</span></div>
        <div class="prop-row"><label>Diffuse</label>
          <input id="md" type="range" min="0" max="1" step="0.01" value="${mp.diffuse}">
          <span class="slider-val" id="md-v">${mp.diffuse.toFixed(2)}</span></div>
        <div class="prop-row"><label>Specular</label>
          <input id="ms" type="range" min="0" max="1" step="0.01" value="${mp.specular}">
          <span class="slider-val" id="ms-v">${mp.specular.toFixed(2)}</span></div>
        <div class="prop-row"><label>Shininess</label>
          <input id="msh" type="range" min="1" max="128" step="1" value="${mp.shininess}">
          <span class="slider-val" id="msh-v">${mp.shininess.toFixed(0)}</span></div>
      </div>`;
  }

  panel.innerHTML = `
    <div class="prop-section">
      <div class="prop-title">${node.isComposite ? 'Composite' : 'Mesh'} · ${node.name}</div>
      <div class="prop-row"><label>Position</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="px" type="number" step="0.1" value="${pos.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="py" type="number" step="0.1" value="${pos.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="pz" type="number" step="0.1" value="${pos.z.toFixed(3)}">
        </div></div>
      <div class="prop-row"><label>Rotation</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="rx" type="number" step="1" value="${rx.toFixed(1)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="ry" type="number" step="1" value="${ry.toFixed(1)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="rz" type="number" step="1" value="${rz.toFixed(1)}">
        </div></div>
      <div class="prop-row"><label>Scale</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="sx" type="number" step="0.01" value="${scale.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="sy" type="number" step="0.01" value="${scale.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="sz" type="number" step="0.01" value="${scale.z.toFixed(3)}">
        </div></div>
    </div>${matHtml}`;

  function getTransform() {
    const gn = (pid: string) => parseFloat((document.getElementById(pid) as HTMLInputElement).value);
    return {
      pos:   new Vec3(gn('px'), gn('py'), gn('pz')),
      rot:   new Vec3(gn('rx'), gn('ry'), gn('rz')),
      scale: new Vec3(gn('sx'), gn('sy'), gn('sz')),
    };
  }
  for (const pid of ['px','py','pz','rx','ry','rz','sx','sy','sz'])
    document.getElementById(pid)?.addEventListener('change', () => { const {pos,rot,scale} = getTransform(); updateTransform(id, pos, rot, scale); });

  if (!node.isComposite) {
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
    wireSlider('ma','ma-v','ambient'); wireSlider('md','md-v','diffuse');
    wireSlider('ms','ms-v','specular'); wireSlider('msh','msh-v','shininess');
  }
}

function renderLayerProperties() {
  const panel = propertiesEl;
  const node  = meshEditTargetId ? nodes.get(meshEditTargetId) : null;
  if (!node || node.isComposite) { panel.innerHTML = '<div class="prop-empty">No mesh selected</div>'; return; }
  if (!meshEditSelectedLayerId)  { panel.innerHTML = '<div class="prop-empty">Select a layer</div>'; return; }

  const layer = node.csgLayers.find(l => l.id === meshEditSelectedLayerId);
  if (!layer) return;

  const isBase = layer.op === 'base';
  const opOptions = ['base','union','subtract','intersect']
    .map(o => `<option value="${o}" ${layer.op===o?'selected':''} ${o==='base'?'disabled':''}>${o}</option>`).join('');
  const primOptions = ['cube','sphere','cylinder','plane']
    .map(p => `<option value="${p}" ${layer.primitiveType===p?'selected':''}>${p}</option>`).join('');

  panel.innerHTML = `
    <div class="prop-section">
      <div class="prop-title">CSG Layer</div>
      <div class="prop-row"><label>Primitive</label>
        <select id="lp-prim" class="prop-select">${primOptions}</select></div>
      <div class="prop-row"><label>Size</label>
        <input class="prop-num" id="lp-size" type="number" step="0.1" min="0.01" value="${layer.size}" style="flex:1"></div>
      <div class="prop-row"><label>Operation</label>
        <select id="lp-op" class="prop-select" ${isBase?'disabled':''}>${opOptions}</select></div>
    </div>
    <div class="prop-section">
      <div class="prop-title">Layer Transform</div>
      <div class="prop-row"><label>Position</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="lp-px" type="number" step="0.1" value="${layer.position.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="lp-py" type="number" step="0.1" value="${layer.position.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="lp-pz" type="number" step="0.1" value="${layer.position.z.toFixed(3)}">
        </div></div>
      <div class="prop-row"><label>Rotation</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="lp-rx" type="number" step="1" value="${layer.rotation.x.toFixed(1)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="lp-ry" type="number" step="1" value="${layer.rotation.y.toFixed(1)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="lp-rz" type="number" step="1" value="${layer.rotation.z.toFixed(1)}">
        </div></div>
      <div class="prop-row"><label>Scale</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="lp-sx" type="number" step="0.01" value="${layer.scale.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="lp-sy" type="number" step="0.01" value="${layer.scale.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="lp-sz" type="number" step="0.01" value="${layer.scale.z.toFixed(3)}">
        </div></div>
    </div>`;

  const gn = (pid: string) => parseFloat((document.getElementById(pid) as HTMLInputElement).value);

  function patchTransform() {
    updateSelectedLayer({
      position: new Vec3(gn('lp-px'), gn('lp-py'), gn('lp-pz')),
      rotation: new Vec3(gn('lp-rx'), gn('lp-ry'), gn('lp-rz')),
      scale:    new Vec3(gn('lp-sx'), gn('lp-sy'), gn('lp-sz')),
    });
  }
  for (const pid of ['lp-px','lp-py','lp-pz','lp-rx','lp-ry','lp-rz','lp-sx','lp-sy','lp-sz'])
    document.getElementById(pid)?.addEventListener('change', patchTransform);

  document.getElementById('lp-prim')?.addEventListener('change', (e) =>
    updateSelectedLayer({ primitiveType: (e.target as HTMLSelectElement).value as PrimitiveType }));

  document.getElementById('lp-size')?.addEventListener('change', (e) =>
    updateSelectedLayer({ size: parseFloat((e.target as HTMLInputElement).value) }));

  document.getElementById('lp-op')?.addEventListener('change', (e) =>
    updateSelectedLayer({ op: (e.target as HTMLSelectElement).value as CsgOp }));
}

function updateStatus() {
  if (editorMode === 'mesh-edit') {
    const node = meshEditTargetId ? nodes.get(meshEditTargetId) : null;
    const layers = node?.csgLayers.length ?? 0;
    setStatus(`Mesh Edit: "${node?.name ?? ''}"  •  ${layers} layer${layers !== 1 ? 's' : ''}  •  Esc to exit  •  Double-click child entity to edit`);
    return;
  }
  const count = nodes.size, selCount = selectedIds.size;
  if (selCount === 0) {
    setStatus(`${count} object${count !== 1 ? 's' : ''} in scene  •  Click to select  •  Double-click to edit mesh`);
  } else if (selCount === 1) {
    const [id] = selectedIds;
    const node = nodes.get(id)!;
    if (node.isComposite) {
      setStatus(`"${node.name}" (composite)  •  Double-click a child to edit its mesh`);
    } else {
      const verts = node.meshData!.positions.length / 3;
      const tris  = (node.meshData!.indices?.length ?? 0) / 3;
      setStatus(`"${node.name}" selected  •  ${node.csgLayers.length} CSG layers  •  ${verts} verts  •  ${tris} tris  •  Double-click to edit mesh`);
    }
  } else {
    setStatus(`${selCount} objects selected  •  ${count} total`);
  }
}

// ─── Toolbar Wiring ───────────────────────────────────────────────────────────

function wireToolbar() {
  const btn = (id: string, fn: () => void) =>
    document.getElementById(id)?.addEventListener('click', fn);

  // Scene tools
  btn('btn-cube',      () => addScenePrimitive('cube'));
  btn('btn-sphere',    () => addScenePrimitive('sphere'));
  btn('btn-cylinder',  () => addScenePrimitive('cylinder'));
  btn('btn-plane',     () => addScenePrimitive('plane'));
  btn('btn-composite', () => addComposite());
  btn('btn-edit-mesh', () => {
    const [id] = selectedIds;
    if (id) enterMeshEditMode(id);
    else setStatus('Select a mesh entity to edit.');
  });
  btn('btn-parent',    () => setParent());
  btn('btn-unparent',  () => unparent());
  btn('btn-delete',    () => deleteSelected());

  // Mesh edit tools
  btn('btn-me-cube',     () => addMeshEditLayer('cube'));
  btn('btn-me-sphere',   () => addMeshEditLayer('sphere'));
  btn('btn-me-cylinder', () => addMeshEditLayer('cylinder'));
  btn('btn-me-plane',    () => addMeshEditLayer('plane'));
  btn('btn-me-sub',      () => { if (meshEditSelectedLayerId) updateSelectedLayer({ op: 'subtract' }); });
  btn('btn-me-int',      () => { if (meshEditSelectedLayerId) updateSelectedLayer({ op: 'intersect' }); });
  btn('btn-me-union',    () => { if (meshEditSelectedLayerId) updateSelectedLayer({ op: 'union' }); });
  btn('btn-me-del-layer',() => deleteMeshEditLayer());
  btn('btn-me-apply',    () => exitMeshEditMode(true));
  btn('btn-me-cancel',   () => exitMeshEditMode(false));

  // View tools (shared)
  btn('btn-frame', () => {
    if (nodes.size === 0) return;
    let cx = 0, cy = 0, cz = 0;
    for (const n of nodes.values()) { cx += n.entity.transform.position.x; cy += n.entity.transform.position.y; cz += n.entity.transform.position.z; }
    const c = 1 / nodes.size;
    orbitTarget = new Vec3(cx * c, cy * c, cz * c);
    updateOrbitCamera();
  });
  btn('btn-reset-cam', () => {
    orbitTarget = Vec3.zero(); orbitDist = 14; orbitTheta = Math.PI / 4; orbitPhi = Math.PI / 3;
    updateOrbitCamera();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
    if (e.key === 'Escape') { if (editorMode === 'mesh-edit') exitMeshEditMode(true); }
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    if (e.key === 'f' || e.key === 'F') document.getElementById('btn-frame')?.click();
  });
}

// ─── Mouse Handlers ───────────────────────────────────────────────────────────

function wireMouseEvents() {
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());

  canvasEl.addEventListener('mousedown', (e) => {
    mouseDownX = e.clientX; mouseDownY = e.clientY;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
    if (e.button === 0) isLeftDown = true;
    if (e.button === 1) { isMidDown = true; e.preventDefault(); }
    if (e.button === 2) isRightDown = true;
  });

  window.addEventListener('mouseup', (e) => {
    const dx = e.clientX - mouseDownX, dy = e.clientY - mouseDownY;
    const moved = dx*dx + dy*dy > 25;

    if (e.button === 0 && isLeftDown && !moved) {
      const id = pick(e.clientX, e.clientY);

      if (editorMode === 'mesh-edit') {
        // In mesh-edit mode: double-click on a different node enters that node's edit mode
        const now = Date.now();
        const isDouble = id !== null && id === lastClickId && (now - lastClickTime) < 350;
        if (isDouble && id !== meshEditTargetId) {
          exitMeshEditMode(true);
          enterMeshEditMode(id);
        }
        lastClickTime = now; lastClickId = id;
      } else {
        // Scene mode: single-click selects, double-click enters mesh edit
        const now = Date.now();
        const isDouble = id !== null && id === lastClickId && (now - lastClickTime) < 350;
        if (isDouble && id) {
          enterMeshEditMode(id);
        } else {
          selectNode(id, e.ctrlKey || e.metaKey);
        }
        lastClickTime = now; lastClickId = id;
      }
    }
    if (e.button === 0) isLeftDown  = false;
    if (e.button === 1) isMidDown   = false;
    if (e.button === 2) isRightDown = false;
  });

  window.addEventListener('mousemove', (e) => {
    const dx = e.clientX - lastMouseX, dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
    if (!dx && !dy) return;
    if (isLeftDown) {
      orbitTheta -= dx * 0.005;
      orbitPhi = Math.max(0.05, Math.min(Math.PI - 0.05, orbitPhi + dy * 0.005));
      updateOrbitCamera();
    } else if (isRightDown || isMidDown) {
      const right = cameraEntity.transform.getRight(), up = cameraEntity.transform.getUp();
      const speed = orbitDist * 0.0015;
      orbitTarget = orbitTarget.sub(right.mul(dx * speed)).add(up.mul(dy * speed));
      updateOrbitCamera();
    }
  });

  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbitDist = Math.max(0.5, orbitDist * (1 + e.deltaY * 0.001));
    updateOrbitCamera();
  }, { passive: false });
}

// ─── Canvas Resize ────────────────────────────────────────────────────────────

function wireResize() {
  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const w = Math.floor(width), h = Math.floor(height);
    if (w <= 0 || h <= 0) return;
    canvasEl.width = w; canvasEl.height = h;
    engine.resize(w, h); camera.setAspect(w / h);
  });
  ro.observe(canvasEl);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  canvasEl         = document.getElementById('viewport') as HTMLCanvasElement;
  outlinerEl       = document.getElementById('outliner-body') as HTMLElement;
  outlinerHeaderEl = document.getElementById('outliner-header') as HTMLElement;
  propertiesEl     = document.getElementById('properties-body') as HTMLElement;
  statusEl         = document.getElementById('statusbar') as HTMLElement;

  const errorEl = document.getElementById('error') as HTMLDivElement;

  try {
    if (!navigator.gpu) throw new Error('WebGPU not supported. Use Chrome/Edge 113+.');

    const w = canvasEl.offsetWidth || 800, h = canvasEl.offsetHeight || 600;
    canvasEl.width = w; canvasEl.height = h;

    engine = new Engine({ canvas: canvasEl, width: w, height: h, antialias: true });
    await engine.initialize();

    scene = new Scene('Editor');
    engine.setScene(scene);
    device = engine.getRenderer().getDevice()!;
    format = engine.getRenderer().getFormat();

    cameraEntity = scene.createEntity('Camera');
    camera = new Camera();
    camera.setPerspective(Math.PI / 3, w / h, 0.1, 500);
    cameraEntity.addComponent(camera);
    updateOrbitCamera();

    const lightE = scene.createEntity('Light');
    lightE.addComponent(new DirectionalLight(new Vec4(1, 0.95, 0.88, 1), 1.0));
    lightE.transform.rotation = Quat.fromEuler(-Math.PI / 4, Math.PI / 5, 0);

    const gridE = scene.createEntity('Grid');
    const gridMesh = Geometry.createPlane(100, 100, 1, 1);
    const gridMat  = new Material(GridShader, { color: new Vec4(1, 1, 1, 1) });
    const gridR    = new MeshRenderer();
    gridR.setMesh(gridMesh); gridR.setMaterial(gridMat);
    gridE.addComponent(gridR);
    gridR.initialize(device, format);

    wireToolbar(); wireMouseEvents(); wireResize();
    addScenePrimitive('cube');
    engine.start();
    refreshUI();

  } catch (err) {
    console.error(err);
    if (errorEl) { errorEl.textContent = `Error: ${(err as Error).message}`; errorEl.style.display = 'block'; }
  }
}

main();
