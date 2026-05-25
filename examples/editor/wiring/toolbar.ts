import { state } from '../state';
import { addScenePrimitive, addComposite, deleteSelected, setParent, unparent } from '../scene-ops';
import { enterMeshEditMode, exitMeshEditMode, addMeshEditLayer, deleteMeshEditLayer, updateSelectedLayer, toggleWireframe } from '../mesh-edit';
import { selectNode } from '../nodes';
import { updateOrbitCamera } from '../camera';
import { refreshUI } from '../ui/refresh';
import { setStatus } from '../ui/status';

function btn(id: string, fn: () => void): void {
  document.getElementById(id)?.addEventListener('click', fn);
}

export function wireToolbar(): void {
  // Scene tools
  btn('btn-cube',      () => { addScenePrimitive('cube');     selectNode(null, false); refreshUI(); });
  btn('btn-sphere',    () => { addScenePrimitive('sphere');   selectNode(null, false); refreshUI(); });
  btn('btn-cylinder',  () => { addScenePrimitive('cylinder'); selectNode(null, false); refreshUI(); });
  btn('btn-plane',     () => { addScenePrimitive('plane');    selectNode(null, false); refreshUI(); });
  btn('btn-composite', () => { addComposite(); refreshUI(); });

  btn('btn-edit-mesh', () => {
    const [id] = state.selectedIds;
    if (id) { enterMeshEditMode(id); refreshUI(); }
    else setStatus('Select a mesh entity to edit.');
  });

  btn('btn-parent',   () => { setParent();  refreshUI(); });
  btn('btn-unparent', () => { unparent();   refreshUI(); });
  btn('btn-delete',   () => {
    if (state.editorMode === 'mesh-edit') { deleteMeshEditLayer(); refreshUI(); }
    else { deleteSelected(); refreshUI(); }
  });

  // Mesh edit tools
  btn('btn-me-cube',     () => { addMeshEditLayer('cube');     refreshUI(); });
  btn('btn-me-sphere',   () => { addMeshEditLayer('sphere');   refreshUI(); });
  btn('btn-me-cylinder', () => { addMeshEditLayer('cylinder'); refreshUI(); });
  btn('btn-me-plane',    () => { addMeshEditLayer('plane');    refreshUI(); });

  btn('btn-me-wireframe', () => {
    toggleWireframe();
    document.getElementById('btn-me-wireframe')?.classList.toggle('active', state.wireframeEnabled);
  });

  btn('btn-me-union',     () => { updateSelectedLayer({ op: 'union' });     refreshUI(); });
  btn('btn-me-sub',       () => { updateSelectedLayer({ op: 'subtract' });  refreshUI(); });
  btn('btn-me-int',       () => { updateSelectedLayer({ op: 'intersect' }); refreshUI(); });
  btn('btn-me-del-layer', () => { deleteMeshEditLayer(); refreshUI(); });
  btn('btn-me-apply',     () => { exitMeshEditMode(true);  refreshUI(); });
  btn('btn-me-cancel',    () => { exitMeshEditMode(false); refreshUI(); });

  // View (always visible)
  btn('btn-frame', () => {
    if (state.nodes.size === 0) return;
    let cx = 0, cy = 0, cz = 0;
    for (const n of state.nodes.values()) {
      cx += n.entity.transform.position.x;
      cy += n.entity.transform.position.y;
      cz += n.entity.transform.position.z;
    }
    const c = 1 / state.nodes.size;
    state.orbitTarget.set(cx * c, cy * c, cz * c);
    updateOrbitCamera();
  });
  btn('btn-reset-cam', () => {
    state.orbitTarget.set(0, 0, 0);
    state.orbitDist   = 14;
    state.orbitTheta  = Math.PI / 4;
    state.orbitPhi    = Math.PI / 3;
    updateOrbitCamera();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'SELECT') return;
    if (e.key === 'Escape') {
      if (state.editorMode === 'mesh-edit') { exitMeshEditMode(true); refreshUI(); }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.editorMode === 'mesh-edit') { deleteMeshEditLayer(); refreshUI(); }
      else { deleteSelected(); refreshUI(); }
    }
    if (e.key === 'f' || e.key === 'F') document.getElementById('btn-frame')?.click();
  });
}
