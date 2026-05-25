import { Mesh, MeshRenderer, Material, Vec4, Quat } from '../../src/index';
import { state } from './state';
import { evaluateCsgLayers } from './csg';
import { computeAABB } from './math-utils';
import { setStatus } from './ui/status';
import type { EditorNode, MaterialProps, CsgLayer } from './types';

export function genId(): string { return `n${++state.nodeCounter}`; }

export function deepCopyLayers(layers: CsgLayer[]): CsgLayer[] {
  return layers.map(l => ({
    ...l,
    position: l.position.clone(),
    rotation: l.rotation.clone(),
    scale:    l.scale.clone(),
  }));
}

export function defaultMatProps(): MaterialProps {
  return { r: 0.72, g: 0.72, b: 0.72, a: 1, ambient: 0.2, diffuse: 0.8, specular: 0.5, shininess: 32 };
}

export function buildMaterial(mp: MaterialProps): Material {
  return new Material(undefined, {
    color: new Vec4(mp.r, mp.g, mp.b, mp.a),
    ambient: mp.ambient, diffuse: mp.diffuse,
    specular: mp.specular, shininess: mp.shininess,
  });
}

export function createMeshNode(name: string, layers: CsgLayer[], mp?: Partial<MaterialProps>): EditorNode {
  const id  = genId();
  const mat: MaterialProps = { ...defaultMatProps(), ...mp };
  const meshData = evaluateCsgLayers(layers);
  const mesh     = new Mesh(meshData);
  const material = buildMaterial(mat);
  const entity   = state.scene!.createEntity(name);
  const renderer = new MeshRenderer();
  renderer.setMesh(mesh); renderer.setMaterial(material);
  entity.addComponent(renderer);
  renderer.initialize(state.device!, state.format);
  const node: EditorNode = {
    id, name, entity, isComposite: false,
    mesh, renderer, material, matProps: mat,
    meshData, aabb: computeAABB(meshData.positions),
    csgLayers: layers,
  };
  state.nodes.set(id, node);
  return node;
}

export function createCompositeNode(name: string): EditorNode {
  const id     = genId();
  const entity = state.scene!.createEntity(name);
  const node: EditorNode = { id, name, entity, isComposite: true, csgLayers: [] };
  state.nodes.set(id, node);
  return node;
}

export function recomputeMesh(nodeId: string): boolean {
  const node = state.nodes.get(nodeId);
  if (!node || node.isComposite || !node.csgLayers.length) return false;
  let meshData;
  try { meshData = evaluateCsgLayers(node.csgLayers); }
  catch (e) { setStatus(`CSG failed: ${(e as Error).message}`); return false; }
  if (!meshData.indices || meshData.indices.length === 0) {
    setStatus('CSG result is empty — check for non-overlapping geometry.');
    return false;
  }
  node.meshData = meshData;
  node.aabb     = computeAABB(meshData.positions);
  node.material!.destroy();
  node.mesh!.destroy();
  const newMesh = new Mesh(meshData);
  const newMat  = buildMaterial(node.matProps!);
  node.renderer!.setMesh(newMesh); node.renderer!.setMaterial(newMat);
  node.mesh = newMesh; node.material = newMat;
  node.renderer!.initialize(state.device!, state.format);
  return true;
}

export function selectNode(id: string | null, additive: boolean): void {
  if (!additive) state.selectedIds.clear();
  if (id !== null) {
    if (state.selectedIds.has(id) && additive) state.selectedIds.delete(id);
    else state.selectedIds.add(id);
  }
}

export function updateTransform(id: string, pos: import('../../src/index').Vec3, rotDeg: import('../../src/index').Vec3, scl: import('../../src/index').Vec3): void {
  const node = state.nodes.get(id);
  if (!node) return;
  node.entity.transform.position = pos;
  node.entity.transform.rotation = Quat.fromEuler(
    rotDeg.x * Math.PI / 180, rotDeg.y * Math.PI / 180, rotDeg.z * Math.PI / 180);
  node.entity.transform.scale = scl;
}

export function updateNodeMaterial(id: string, mp: Partial<MaterialProps>): void {
  const node = state.nodes.get(id);
  if (!node || node.isComposite || !node.matProps) return;
  Object.assign(node.matProps, mp);
  node.material!.destroy();
  node.mesh!.destroy();
  const newMat = buildMaterial(node.matProps);
  node.renderer!.setMaterial(newMat);
  node.material = newMat;
  node.renderer!.initialize(state.device!, state.format);
}

export function deleteNode(id: string): void {
  const node = state.nodes.get(id);
  if (!node) return;
  node.entity.destroy();
  state.nodes.delete(id);
  state.selectedIds.delete(id);
}
