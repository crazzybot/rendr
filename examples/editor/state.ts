import { Vec3 } from '../../src/index';
import type { Engine, Scene, Camera, Entity, Quat } from '../../src/index';
import type { EditorNode, EditorMode, CsgLayer } from './types';

export interface SavedTransform {
  position: Vec3;
  rotation: Quat;
  scale:    Vec3;
}

export const state = {
  // Engine / GPU
  engine:       null as Engine | null,
  scene:        null as Scene  | null,
  camera:       null as Camera | null,
  cameraEntity: null as Entity | null,
  device:       null as GPUDevice | null,
  format:       'bgra8unorm' as GPUTextureFormat,
  canvasEl:     null as HTMLCanvasElement | null,

  // Scene graph
  nodes:      new Map<string, EditorNode>(),
  selectedIds: new Set<string>(),
  nodeCounter: 0,

  // Mode
  editorMode:              'scene' as EditorMode,
  meshEditTargetId:        null as string | null,
  meshEditSelectedLayerId: null as string | null,
  meshEditSavedLayers:     null as CsgLayer[] | null,
  meshEditSavedTransform:  null as SavedTransform | null,
  wireframeEnabled:        false,
  wireframeEntity:         null as Entity | null,

  // Orbit camera
  orbitTarget: new Vec3(0, 0, 0),
  orbitDist:   14,
  orbitTheta:  Math.PI / 4,
  orbitPhi:    Math.PI / 3,

  // Mouse
  isLeftDown:  false,
  isRightDown: false,
  isMidDown:   false,
  mouseDownX:  0,
  mouseDownY:  0,
  lastMouseX:  0,
  lastMouseY:  0,
  lastClickTime: 0,
  lastClickId:   null as string | null,

  // DOM refs (set in main before engine.start)
  outlinerEl:       null as HTMLElement | null,
  outlinerHeaderEl: null as HTMLElement | null,
  propertiesEl:     null as HTMLElement | null,
  statusEl:         null as HTMLElement | null,
};
