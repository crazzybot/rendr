import { state } from '../state';
import { pick, pickLayer } from '../math-utils';
import { selectNode } from '../nodes';
import { enterMeshEditMode, exitMeshEditMode } from '../mesh-edit';
import { updateOrbitCamera } from '../camera';
import { refreshUI } from '../ui/refresh';

export function wireMouseEvents(): void {
  const canvas = state.canvasEl!;

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    state.mouseDownX = e.clientX; state.mouseDownY = e.clientY;
    state.lastMouseX = e.clientX; state.lastMouseY = e.clientY;
    if (e.button === 0) state.isLeftDown  = true;
    if (e.button === 1) { state.isMidDown = true; e.preventDefault(); }
    if (e.button === 2) state.isRightDown = true;
  });

  window.addEventListener('mouseup', (e) => {
    const dx = e.clientX - state.mouseDownX, dy = e.clientY - state.mouseDownY;
    const moved = dx*dx + dy*dy > 25;

    if (e.button === 0 && state.isLeftDown && !moved) {
      const id  = pick(e.clientX, e.clientY);
      const now = Date.now();
      const isDouble = id !== null && id === state.lastClickId && (now - state.lastClickTime) < 350;

      if (state.editorMode === 'mesh-edit') {
        if (isDouble && id && id !== state.meshEditTargetId) {
          // Double-click a different entity → switch edit target.
          exitMeshEditMode(true);
          enterMeshEditMode(id);
          refreshUI();
        } else if (!isDouble) {
          // Single click → pick whichever layer primitive the ray hits.
          const layerId = pickLayer(e.clientX, e.clientY);
          if (layerId !== null) {
            state.meshEditSelectedLayerId = layerId;
            refreshUI();
          }
        }
      } else {
        if (isDouble && id) {
          enterMeshEditMode(id);
          refreshUI();
        } else {
          selectNode(id, e.ctrlKey || e.metaKey);
          refreshUI();
        }
      }
      state.lastClickTime = now;
      state.lastClickId   = id;
    }

    if (e.button === 0) state.isLeftDown  = false;
    if (e.button === 1) state.isMidDown   = false;
    if (e.button === 2) state.isRightDown = false;
  });

  window.addEventListener('mousemove', (e) => {
    const dx = e.clientX - state.lastMouseX;
    const dy = e.clientY - state.lastMouseY;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
    if (!dx && !dy) return;

    if (state.isLeftDown) {
      state.orbitTheta -= dx * 0.005;
      state.orbitPhi    = Math.max(0.05, Math.min(Math.PI - 0.05, state.orbitPhi + dy * 0.005));
      updateOrbitCamera();
    } else if (state.isRightDown || state.isMidDown) {
      const right = state.cameraEntity!.transform.getRight();
      const up    = state.cameraEntity!.transform.getUp();
      const speed = state.orbitDist * 0.0015;
      state.orbitTarget = state.orbitTarget.sub(right.mul(dx * speed)).add(up.mul(dy * speed));
      updateOrbitCamera();
    }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.orbitDist = Math.max(0.5, state.orbitDist * (1 + e.deltaY * 0.001));
    updateOrbitCamera();
  }, { passive: false });
}
