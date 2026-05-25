import { state } from '../state';
import { selectNode } from '../nodes';
import { enterMeshEditMode } from '../mesh-edit';
import type { EditorNode, CsgOp, PrimitiveType } from '../types';

export function renderOutliner(): void {
  if (state.editorMode === 'mesh-edit') renderCsgLayerPanel();
  else                                   renderSceneOutliner();
}

function renderSceneOutliner(): void {
  state.outlinerHeaderEl!.textContent = 'Scene Outliner';

  function makeRow(node: EditorNode, depth: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'tree-row' + (state.selectedIds.has(node.id) ? ' selected' : '');
    row.style.paddingLeft = `${8 + depth * 16}px`;

    const icon = document.createElement('span');
    icon.className = 'tree-icon';
    icon.textContent = node.isComposite ? '⬡' : (node.entity.children.length > 0 ? '▾' : '·');

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = node.name;

    row.append(icon, label);
    row.addEventListener('click', (e) => {
      selectNode(node.id, e.ctrlKey || e.metaKey);
      e.stopPropagation();
      import('./refresh').then(m => m.refreshUI());
    });
    row.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      enterMeshEditMode(node.id);
      import('./refresh').then(m => m.refreshUI());
    });
    return row;
  }

  function renderNode(node: EditorNode, depth: number): DocumentFragment {
    const frag = document.createDocumentFragment();
    frag.appendChild(makeRow(node, depth));
    for (const child of node.entity.children) {
      const childNode = [...state.nodes.values()].find(n => n.entity === child);
      if (childNode) frag.appendChild(renderNode(childNode, depth + 1));
    }
    return frag;
  }

  state.outlinerEl!.innerHTML = '';
  const rootNodes = [...state.nodes.values()].filter(n => n.entity.parent === null);
  for (const node of rootNodes) state.outlinerEl!.appendChild(renderNode(node, 0));
}

function renderCsgLayerPanel(): void {
  const node = state.meshEditTargetId ? state.nodes.get(state.meshEditTargetId) : null;
  state.outlinerHeaderEl!.textContent = node ? `Mesh: ${node.name}` : 'Mesh Edit';
  state.outlinerEl!.innerHTML = '';
  if (!node || node.isComposite) return;

  const opIcon: Record<CsgOp, string>         = { base:'◼', union:'⊕', subtract:'⊖', intersect:'⊗' };
  const primIcon: Record<PrimitiveType, string> = { cube:'▪', sphere:'●', cylinder:'⬟', plane:'▬' };

  for (const layer of node.csgLayers) {
    const row = document.createElement('div');
    row.className = 'tree-row' + (layer.id === state.meshEditSelectedLayerId ? ' selected' : '');

    const opBadge = document.createElement('span');
    opBadge.className = 'layer-op';
    opBadge.textContent = opIcon[layer.op];

    const pIcon = document.createElement('span');
    pIcon.className = 'tree-icon';
    pIcon.textContent = primIcon[layer.primitiveType];

    const label = document.createElement('span');
    label.className = 'tree-label';
    label.textContent = `${layer.primitiveType} (${layer.size}m)`;

    const badge = document.createElement('span');
    badge.className = 'layer-badge';
    badge.textContent = layer.op === 'base' ? 'BASE' : layer.op.toUpperCase();

    row.append(opBadge, pIcon, label, badge);
    row.addEventListener('click', () => {
      state.meshEditSelectedLayerId = layer.id;
      import('./refresh').then(m => m.refreshUI());
    });
    state.outlinerEl!.appendChild(row);
  }
}
