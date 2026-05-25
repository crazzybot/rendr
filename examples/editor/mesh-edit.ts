import { Vec3, Quat, Mesh, MeshRenderer, Material, Vec4, UnlitShader } from '../../src/index';
import { state } from './state';
import { genId, recomputeMesh, deepCopyLayers } from './nodes';
import { setStatus } from './ui/status';
import { WireframeShader } from './shaders';
import type { CsgLayer, CsgOp, PrimitiveType } from './types';
import type { MeshData } from '../../src/index';

// ─── Wireframe overlay ───────────────────────────────────────────────────────

function buildWireframeIndices(src: MeshData): Uint16Array | Uint32Array {
  const idx = src.indices;
  if (!idx) return new Uint16Array();
  const lines: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    lines.push(a, b, b, c, c, a);
  }
  return lines.length < 65536 ? new Uint16Array(lines) : new Uint32Array(lines);
}

function destroyWireframe(): void {
  if (state.wireframeEntity) {
    state.wireframeEntity.destroy();
    state.wireframeEntity = null;
  }
}

function createWireframe(): void {
  destroyWireframe();
  const node = state.meshEditTargetId ? state.nodes.get(state.meshEditTargetId) : null;
  if (!node?.meshData) return;

  const wireIndices = buildWireframeIndices(node.meshData);
  const wireMesh = new Mesh({
    positions: node.meshData.positions,
    normals:   node.meshData.normals   ?? new Float32Array(),
    uvs:       node.meshData.uvs       ?? new Float32Array(),
    indices:   wireIndices,
  });
  const wireMat    = new Material(WireframeShader, { color: new Vec4(0.18, 0.85, 0.48, 1) }, 'line-list');
  const wireEntity = state.scene!.createEntity('__wireframe__');
  const wireR      = new MeshRenderer();
  wireR.setMesh(wireMesh);
  wireR.setMaterial(wireMat);
  wireEntity.addComponent(wireR);
  wireR.initialize(state.device!, state.format);
  state.wireframeEntity = wireEntity;
}

export function toggleWireframe(): void {
  state.wireframeEnabled = !state.wireframeEnabled;
  if (state.wireframeEnabled) createWireframe();
  else                        destroyWireframe();
}

// Called by anything inside mesh-edit that changes the mesh geometry.
function recomputeTarget(): void {
  if (!state.meshEditTargetId) return;
  recomputeMesh(state.meshEditTargetId);
  if (state.wireframeEnabled) createWireframe();
}

export function enterMeshEditMode(nodeId: string): void {
  const node = state.nodes.get(nodeId);
  if (!node || node.isComposite) return;

  // Strip the entity's scene transform so layers are edited at the origin.
  const t = node.entity.transform;
  state.meshEditSavedTransform = {
    position: t.position.clone(),
    rotation: t.rotation.clone(),
    scale:    t.scale.clone(),
  };
  t.position = Vec3.zero();
  t.rotation = Quat.identity();
  t.scale    = Vec3.one();

  state.editorMode              = 'mesh-edit';
  state.meshEditTargetId        = nodeId;
  state.meshEditSavedLayers     = deepCopyLayers(node.csgLayers);
  state.meshEditSelectedLayerId = node.csgLayers[0]?.id ?? null;
  state.selectedIds.clear();

  for (const [id, n] of state.nodes) {
    if (id !== nodeId) n.entity.active = false;
  }

  document.getElementById('scene-tools')!.style.display    = 'none';
  document.getElementById('mesh-edit-tools')!.style.display = 'flex';
  document.getElementById('outliner-header')!.classList.add('me-mode');
}

export function exitMeshEditMode(apply: boolean): void {
  if (state.editorMode !== 'mesh-edit') return;

  if (!apply && state.meshEditTargetId && state.meshEditSavedLayers) {
    const node = state.nodes.get(state.meshEditTargetId);
    if (node) {
      node.csgLayers = state.meshEditSavedLayers;
      recomputeMesh(state.meshEditTargetId); // wireframe is about to be destroyed anyway
    }
  }

  // Always tear down wireframe before leaving.
  destroyWireframe();
  state.wireframeEnabled = false;
  document.getElementById('btn-me-wireframe')?.classList.remove('active');

  // Restore the entity's scene transform.
  if (state.meshEditTargetId && state.meshEditSavedTransform) {
    const node = state.nodes.get(state.meshEditTargetId);
    if (node) {
      const t = node.entity.transform;
      t.position = state.meshEditSavedTransform.position;
      t.rotation = state.meshEditSavedTransform.rotation;
      t.scale    = state.meshEditSavedTransform.scale;
    }
  }

  for (const n of state.nodes.values()) n.entity.active = true;

  state.editorMode              = 'scene';
  state.meshEditTargetId        = null;
  state.meshEditSelectedLayerId = null;
  state.meshEditSavedLayers     = null;
  state.meshEditSavedTransform  = null;

  document.getElementById('scene-tools')!.style.display    = 'flex';
  document.getElementById('mesh-edit-tools')!.style.display = 'none';
  document.getElementById('outliner-header')!.classList.remove('me-mode');
}

export function addMeshEditLayer(type: PrimitiveType, op: CsgOp = 'union'): void {
  if (!state.meshEditTargetId) return;
  const node = state.nodes.get(state.meshEditTargetId);
  if (!node || node.isComposite) return;

  const layer: CsgLayer = {
    id: genId(), op, primitiveType: type, size: 1,
    position: Vec3.zero(), rotation: Vec3.zero(), scale: Vec3.one(),
  };
  node.csgLayers.push(layer);
  state.meshEditSelectedLayerId = layer.id;
  recomputeTarget();
}

export function deleteMeshEditLayer(): void {
  if (!state.meshEditTargetId || !state.meshEditSelectedLayerId) return;
  const node = state.nodes.get(state.meshEditTargetId);
  if (!node || node.isComposite) return;

  const idx = node.csgLayers.findIndex(l => l.id === state.meshEditSelectedLayerId);
  if (idx === -1) return;
  if (node.csgLayers.length === 1) { setStatus('Cannot delete the only layer.'); return; }
  if (idx === 0) node.csgLayers[1].op = 'base';
  node.csgLayers.splice(idx, 1);
  state.meshEditSelectedLayerId = node.csgLayers[Math.min(idx, node.csgLayers.length - 1)].id;
  recomputeTarget();
}

export function updateSelectedLayer(patch: Partial<CsgLayer>): void {
  if (!state.meshEditTargetId || !state.meshEditSelectedLayerId) return;
  const node = state.nodes.get(state.meshEditTargetId);
  if (!node) return;
  const layer = node.csgLayers.find(l => l.id === state.meshEditSelectedLayerId);
  if (!layer) return;
  Object.assign(layer, patch);
  recomputeTarget();
}
