import { Vec3 } from '../../src/index';
import { state } from './state';
import { genId, createMeshNode, createCompositeNode, deleteNode } from './nodes';
import { setStatus } from './ui/status';
import type { CsgLayer, PrimitiveType, EditorNode } from './types';

export function defaultLayerFor(type: PrimitiveType): CsgLayer {
  return {
    id: genId(),
    op: 'base',
    primitiveType: type,
    size: type === 'plane' ? 2 : 1,
    position: new Vec3(0, type === 'plane' ? 0 : 0.5, 0),
    rotation: Vec3.zero(),
    scale:    Vec3.one(),
  };
}

export function addScenePrimitive(type: PrimitiveType): EditorNode {
  const baseName = { cube:'Cube', sphere:'Sphere', cylinder:'Cylinder', plane:'Plane' }[type];
  const count    = [...state.nodes.values()].filter(n => n.name.startsWith(baseName)).length;
  const name     = count === 0 ? baseName : `${baseName}.${String(count + 1).padStart(3, '0')}`;
  const node     = createMeshNode(name, [defaultLayerFor(type)]);
  node.entity.transform.position = Vec3.zero();
  return node;
}

export function addComposite(): EditorNode {
  const count = [...state.nodes.values()].filter(n => n.name.startsWith('Group')).length;
  const name  = count === 0 ? 'Group' : `Group.${String(count + 1).padStart(3, '0')}`;
  return createCompositeNode(name);
}

export function deleteSelected(): void {
  for (const id of [...state.selectedIds]) deleteNode(id);
  state.selectedIds.clear();
}

export function setParent(): void {
  if (state.selectedIds.size !== 2) {
    setStatus('Select exactly 2 objects: child then parent (Ctrl+click).');
    return;
  }
  const [childId, parentId] = [...state.selectedIds];
  const childNode  = state.nodes.get(childId)!;
  const parentNode = state.nodes.get(parentId)!;
  state.scene!.removeEntity(childNode.entity);
  parentNode.entity.addChild(childNode.entity);
  setStatus(`"${childNode.name}" parented to "${parentNode.name}".`);
}

export function unparent(): void {
  for (const id of state.selectedIds) {
    const node = state.nodes.get(id);
    if (!node || !node.entity.parent) continue;
    node.entity.parent.removeChild(node.entity);
    state.scene!.addEntity(node.entity);
  }
}
