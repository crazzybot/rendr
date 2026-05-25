import { state } from '../state';

export function setStatus(msg: string): void {
  if (state.statusEl) state.statusEl.textContent = msg;
}

export function updateStatus(): void {
  if (state.editorMode === 'mesh-edit') {
    const node = state.meshEditTargetId ? state.nodes.get(state.meshEditTargetId) : null;
    const layers = node?.csgLayers.length ?? 0;
    setStatus(`Mesh Edit: "${node?.name ?? ''}"  •  ${layers} layer${layers !== 1 ? 's' : ''}  •  Esc to exit`);
    return;
  }
  const count = state.nodes.size, selCount = state.selectedIds.size;
  if (selCount === 0) {
    setStatus(`${count} object${count !== 1 ? 's' : ''} in scene  •  Click to select  •  Double-click to edit mesh`);
  } else if (selCount === 1) {
    const [id] = state.selectedIds;
    const node = state.nodes.get(id)!;
    if (node.isComposite) {
      setStatus(`"${node.name}" (composite)  •  Double-click a child to edit its mesh`);
    } else {
      const verts = node.meshData!.positions.length / 3;
      const tris  = (node.meshData!.indices?.length ?? 0) / 3;
      setStatus(`"${node.name}"  •  ${node.csgLayers.length} CSG layers  •  ${verts} verts  •  ${tris} tris  •  Double-click to edit mesh`);
    }
  } else {
    setStatus(`${selCount} objects selected  •  ${count} total`);
  }
}
