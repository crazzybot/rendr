---
description: Scaffolds a complete new Rendr demo from scratch — engine init, scene, camera, light, and starter entities. Pass the demo name and concept. Example: /rendr-new-demo orbit — planets orbiting a sun with a free-look camera
---

Create a complete new Rendr demo: $ARGUMENTS

## Steps
1. Create `example/<demo-name>/main.ts`
2. Check if `example/<demo-name>/index.html` is needed (copy from `example/racing/index.html` if it exists, adjust the title)
3. Check `vite.config.ts` or `package.json` to see if an entry needs to be registered

## Full boilerplate for main.ts
```ts
import {
  Engine, Scene, Camera, MeshRenderer, Geometry, Material,
  DirectionalLight, Vec3, Vec4, Quat, UnlitShader,
  Component, Entity,
} from '../../src/index';

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const errorDiv = document.getElementById('error') as HTMLDivElement;

  try {
    if (!navigator.gpu) throw new Error('WebGPU not supported. Use Chrome or Edge 113+.');

    const engine = new Engine({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      antialias: true,
    });
    await engine.initialize();

    const scene = new Scene('DemoName');
    engine.setScene(scene);
    const device = engine.getRenderer().getDevice()!;
    const format = engine.getRenderer().getFormat();

    // --- Light ---
    const lightEntity = scene.createEntity('Light');
    lightEntity.addComponent(new DirectionalLight(new Vec4(1, 0.95, 0.8, 1), 1.0));
    lightEntity.transform.rotation = Quat.fromEuler(-Math.PI / 4, Math.PI / 6, 0);

    // --- Ground ---
    const ground = scene.createEntity('Ground');
    const groundRenderer = new MeshRenderer();
    groundRenderer.setMesh(Geometry.createPlane(100, 100));
    groundRenderer.setMaterial(new Material(UnlitShader, { color: new Vec4(0.18, 0.38, 0.18, 1) }));
    ground.addComponent(groundRenderer);
    groundRenderer.initialize(device, format);

    // --- Camera ---
    const camEntity = scene.createEntity('Camera');
    const camera = new Camera();
    camera.setPerspective(Math.PI / 3, window.innerWidth / window.innerHeight, 0.1, 500);
    camEntity.addComponent(camera);
    camEntity.transform.position = new Vec3(0, 5, 15);
    camEntity.transform.lookAt(Vec3.zero());

    // --- Resize ---
    window.addEventListener('resize', () => {
      engine.resize(window.innerWidth, window.innerHeight);
      camera.setAspect(window.innerWidth / window.innerHeight);
    });

    engine.start();

  } catch (err) {
    console.error(err);
    if (errorDiv) {
      errorDiv.textContent = `Error: ${(err as Error).message}`;
      errorDiv.style.display = 'block';
    }
  }
}

main();
```

## Common import additions
```ts
// Physics:
import { CarPhysics } from '../../src/index';

// Custom components (same folder):
import { MyComponent } from './MyComponent';
```

## Camera patterns

### Static lookAt
```ts
camEntity.transform.position = new Vec3(0, 8, 20);
camEntity.transform.lookAt(Vec3.zero());
```

### Follow camera component
```ts
class FollowCamera extends Component {
  constructor(private target: Entity, private cam: Camera) { super(); }

  onUpdate(dt: number) {
    const pos = this.target.transform.position;
    const fwd = this.target.transform.getForward();
    this.entity!.transform.position = pos.sub(fwd.mul(8)).add(new Vec3(0, 3, 0));
    this.entity!.transform.lookAt(pos);
  }
}
camEntity.addComponent(new FollowCamera(targetEntity, camera));
```

### Orbit camera (free-look with mouse)
```ts
class OrbitCamera extends Component {
  private yaw = 0; private pitch = 0.4; private radius = 15;
  constructor(private target: Entity) { super(); }

  onUpdate(dt: number) {
    const input = (this.entity!.scene as any)?.engine?.getInput();
    if (!input) return;
    const d = input.getMouseDelta();
    if (input.isMouseButtonPressed(0)) {
      this.yaw   -= d.x * 0.005;
      this.pitch -= d.y * 0.005;
      this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
    }
    this.radius -= input.getMouseWheel() * 0.01;
    this.radius = Math.max(2, Math.min(50, this.radius));

    const x = Math.sin(this.yaw) * Math.cos(this.pitch) * this.radius;
    const y = Math.sin(this.pitch) * this.radius;
    const z = Math.cos(this.yaw) * Math.cos(this.pitch) * this.radius;

    const center = this.target.transform.position;
    this.entity!.transform.position = center.add(new Vec3(x, y, z));
    this.entity!.transform.lookAt(center);
  }
}
```

## Constraint checklist
- [ ] `renderer.initialize(device, format)` called for every MeshRenderer before `engine.start()`
- [ ] Each MeshRenderer has its own Material instance (no sharing)
- [ ] Scene has exactly one Camera entity and at most one DirectionalLight entity
- [ ] `await engine.initialize()` before anything else
