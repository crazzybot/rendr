import {
  Engine, Scene, Camera, DirectionalLight,
  Geometry, Material, MeshRenderer,
  Vec4, Quat,
} from '../../src/index';
import { state } from './state';
import { GridShader } from './shaders';
import { updateOrbitCamera } from './camera';
import { addScenePrimitive } from './scene-ops';
import { selectNode } from './nodes';
import { wireToolbar } from './wiring/toolbar';
import { wireMouseEvents } from './wiring/mouse';
import { wireResize } from './wiring/resize';
import { refreshUI } from './ui/refresh';

async function main(): Promise<void> {
  state.canvasEl         = document.getElementById('viewport')      as HTMLCanvasElement;
  state.outlinerEl       = document.getElementById('outliner-body') as HTMLElement;
  state.outlinerHeaderEl = document.getElementById('outliner-header') as HTMLElement;
  state.propertiesEl     = document.getElementById('properties-body') as HTMLElement;
  state.statusEl         = document.getElementById('statusbar')     as HTMLElement;

  const errorEl = document.getElementById('error') as HTMLDivElement;

  try {
    if (!navigator.gpu) throw new Error('WebGPU not supported. Use Chrome/Edge 113+.');

    const w = state.canvasEl.offsetWidth  || 800;
    const h = state.canvasEl.offsetHeight || 600;
    state.canvasEl.width  = w;
    state.canvasEl.height = h;

    state.engine = new Engine({ canvas: state.canvasEl, width: w, height: h, antialias: true });
    await state.engine.initialize();

    state.scene  = new Scene('Editor');
    state.engine.setScene(state.scene);
    state.device = state.engine.getRenderer().getDevice()!;
    state.format = state.engine.getRenderer().getFormat();

    state.cameraEntity = state.scene.createEntity('Camera');
    state.camera       = new Camera();
    state.camera.setPerspective(Math.PI / 3, w / h, 0.1, 500);
    state.cameraEntity.addComponent(state.camera);
    updateOrbitCamera();

    const lightE = state.scene.createEntity('Light');
    lightE.addComponent(new DirectionalLight(new Vec4(1, 0.95, 0.88, 1), 1.0));
    lightE.transform.rotation = Quat.fromEuler(-Math.PI / 4, Math.PI / 5, 0);

    const gridE   = state.scene.createEntity('Grid');
    const gridMat = new Material(GridShader, { color: new Vec4(1, 1, 1, 1) });
    const gridR   = new MeshRenderer();
    gridR.setMesh(Geometry.createPlane(100, 100, 1, 1));
    gridR.setMaterial(gridMat);
    gridE.addComponent(gridR);
    gridR.initialize(state.device, state.format);

    wireToolbar();
    wireMouseEvents();
    wireResize();

    const first = addScenePrimitive('cube');
    selectNode(first.id, false);

    state.engine.start();
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
