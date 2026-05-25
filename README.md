# Rendr

A robust, modern 3D game framework built on WebGPU for creating high-performance browser-based games.

## Features

- **Modern WebGPU Renderer**: High-performance graphics rendering using the latest WebGPU API
- **Entity Component System**: Flexible architecture for game object management
- **Fixed Timestep Simulation**: Deterministic `onFixedUpdate` loop for simulation/physics work
- **Complete Math Library**: Vec3, Vec4, Mat4, and Quaternion implementations
- **Camera System**: Perspective and orthographic projection support
- **Built-in Geometries**: Cube, Sphere, Plane, and Cylinder primitives
- **Material System**: Customizable shaders and materials with lighting support
- **Physics Module (Early)**: `RigidBody` and arcade-style `CarPhysics` components
- **Model Import**: OBJ loading via `MeshLoader`
- **CSG Operations**: Union / subtract / intersect helpers for mesh workflows
- **Input Management**: Comprehensive keyboard, mouse, and pointer lock support
- **Resource Management**: Centralized asset management system
- **TypeScript**: Full TypeScript support with type definitions

## Browser Support

WebGPU is supported in:
- Chrome/Edge 113+
- Firefox (behind flag)
- Safari (experimental)

Check [caniuse.com/webgpu](https://caniuse.com/webgpu) for current browser support.

## Installation

```bash
npm install
```

## Quick Start

```bash
npm run dev
```

Open your browser to `http://localhost:3000` to see the demo.

## Basic Usage

```typescript
import {
  Engine,
  Scene,
  Camera,
  MeshRenderer,
  Geometry,
  Material,
  Vec3,
  Vec4
} from 'rendr';

// Create engine
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const engine = new Engine({
  canvas,
  width: 800,
  height: 600
});

await engine.initialize();

// Create scene
const scene = new Scene('MainScene');
engine.setScene(scene);

// Create camera
const cameraEntity = scene.createEntity('Camera');
const camera = new Camera();
camera.setPerspective(Math.PI / 4, 800 / 600, 0.1, 1000);
cameraEntity.addComponent(camera);
cameraEntity.transform.position = new Vec3(0, 0, 5);

// Create a cube
const cube = scene.createEntity('Cube');
const cubeMesh = Geometry.createCube(1);
const material = new Material(undefined, {
  color: new Vec4(1, 0.5, 0.3, 1)
});

const meshRenderer = new MeshRenderer();
meshRenderer.setMesh(cubeMesh);
meshRenderer.setMaterial(material);
cube.addComponent(meshRenderer);

const device = engine.getRenderer().getDevice()!;
const format = engine.getRenderer().getFormat();
meshRenderer.initialize(device, format);

// Start the engine
engine.start();
```

## Core Concepts

### Entity Component System

The framework uses an Entity Component System (ECS) architecture:

```typescript
// Create an entity
const entity = scene.createEntity('MyEntity');

// Position the entity
entity.transform.position = new Vec3(1, 2, 3);
entity.transform.rotation = Quat.fromEuler(0, Math.PI / 4, 0);

// Add components
const meshRenderer = new MeshRenderer();
entity.addComponent(meshRenderer);

// Get components
const renderer = entity.getComponent(MeshRenderer);
```

### Transforms

Every entity has a transform component for position, rotation, and scale:

```typescript
// Position
entity.transform.position = new Vec3(0, 1, 0);
entity.transform.translate(new Vec3(1, 0, 0));

// Rotation
entity.transform.rotation = Quat.fromAxisAngle(Vec3.up(), Math.PI / 2);
entity.transform.rotate(Quat.fromEuler(0.1, 0.2, 0));

// Scale
entity.transform.scale = new Vec3(2, 2, 2);

// Look at target
entity.transform.lookAt(new Vec3(0, 0, 0), Vec3.up());
```

### Entity Hierarchy

Entities can be nested into parent-child trees. Only the root entity is added to the scene; children are managed through the parent.

```typescript
// Create root entity and add to scene
const car = scene.createEntity('Car');

// Create child entities — do NOT add to scene
const wheel = new Entity('Wheel');
wheel.transform.position = new Vec3(1, 0, 1); // local offset
car.addChild(wheel); // wires transform hierarchy + propagates scene reference

// Children are updated and rendered automatically through the parent
// car.update() cascades to wheel, scene.findEntitiesWithComponent() searches recursively

// Detach a child (does not destroy it)
car.removeChild(wheel);
```

### Geometries

Built-in primitive shapes:

```typescript
// Cube
const cube = Geometry.createCube(size);

// Sphere
const sphere = Geometry.createSphere(radius, segments, rings);

// Plane
const plane = Geometry.createPlane(width, height, segmentsX, segmentsY);

// Cylinder
const cylinder = Geometry.createCylinder(radius, height, segments);
```

### Materials and Shaders

Create custom materials with different shaders:

```typescript
import { Material, BasicShader, UnlitShader, Vec4 } from 'rendr';

// Basic lit material
const material = new Material(BasicShader, {
  color: new Vec4(1, 0, 0, 1),
  ambient: 0.3,
  diffuse: 0.7,
  specular: 0.5,
  shininess: 32
});

// Unlit material
const unlitMaterial = new Material(UnlitShader, {
  color: new Vec4(0, 1, 0, 1)
});

// Custom shader
const customShader: ShaderSource = {
  vertex: `/* WGSL vertex shader code */`,
  fragment: `/* WGSL fragment shader code */`
};

const customMaterial = new Material(customShader);
```

### Input Handling

Access keyboard and mouse input:

```typescript
const input = engine.getInput();

// Keyboard
if (input.isKeyPressed('KeyW')) {
  // W key is held down
}

if (input.isKeyDown('Space')) {
  // Space was just pressed this frame
}

// Mouse
if (input.isMouseButtonPressed(MouseButton.Left)) {
  // Left mouse button is held down
}

const mousePos = input.getMousePosition();
const mouseDelta = input.getMouseDelta();
const mouseWheel = input.getMouseWheel();

// Pointer lock for FPS controls
input.requestPointerLock();
if (input.isPointerLocked()) {
  // Handle camera rotation
}
```

### Camera

Configure camera projection and view:

```typescript
const camera = new Camera();

// Perspective projection
camera.setPerspective(
  Math.PI / 4,  // FOV
  16 / 9,       // Aspect ratio
  0.1,          // Near plane
  1000          // Far plane
);

// Orthographic projection
camera.setOrthographic(-10, 10, -10, 10, 0.1, 1000);

// Screen to world conversion
const worldPos = camera.screenToWorld(screenX, screenY, depth);
```

### Resource Management

Centralized resource management:

```typescript
import { ResourceManager } from 'rendr';

const resources = ResourceManager.getInstance();

// Register resources
resources.registerMesh('cube', cubeMesh);
resources.registerMaterial('red', redMaterial);

// Retrieve resources
const mesh = resources.getMesh('cube');
const material = resources.getMaterial('red');

// Clean up
resources.unregisterMesh('cube');
resources.clear(); // Clear all resources
```

## Architecture

```
src/
├── core/           # Core engine components (Engine, Scene, Entity, Component)
├── math/           # Math utilities (Vec3, Vec4, Mat4, Quat)
├── rendering/      # Rendering system (Renderer, Mesh, Material, Shader)
├── components/     # Built-in components (Camera, MeshRenderer)
├── physics/        # Physics components (RigidBody, CarPhysics)
├── input/          # Input handling (InputManager)
└── resources/      # Resource management (ResourceManager)
```

## Custom Components

Create custom components by extending the Component class:

```typescript
import { Component } from 'rendr';

export class RotateComponent extends Component {
  public speed: number = 1;

  onUpdate(deltaTime: number): void {
    if (this.entity) {
      const rotation = Quat.fromEuler(0, this.speed * deltaTime, 0);
      this.entity.transform.rotate(rotation);
    }
  }

  onDestroy(): void {
    // Cleanup
  }
}

// Use it
const rotator = new RotateComponent();
rotator.speed = 2;
entity.addComponent(rotator);
```

## Performance Tips

1. **Object Pooling**: Reuse entities and components instead of creating/destroying
2. **Batch Rendering**: Group objects with the same material
3. **LOD System**: Implement level-of-detail for distant objects
4. **Frustum Culling**: Only render objects visible to the camera
5. **Update Optimization**: Only update active/visible entities

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Examples

Check the `examples/` directory for more comprehensive examples:

- Basic scene setup
- Camera controls
- Custom components
- Material usage
- Input handling
- Racing prototype (`examples/racing.html`)
- Scene editor prototype (`examples/editor.html`)
- Textured glTF prototype (`examples/textured-gltf.html`)

## Implementation Status (May 2026)

Detailed execution plan: [dev-docs/roadmap-prioritized-implementation-plan.md](dev-docs/roadmap-prioritized-implementation-plan.md)

Implemented and usable now:

- Core ECS (entities, components, transform hierarchy)
- WebGPU renderer with directional-light shading
- Fixed timestep engine loop (`fixedTimestep` + `onFixedUpdate`)
- Physics foundation (`RigidBody`, arcade `CarPhysics`)
- Racing prototype with keyboard controls, wheel animation, and follow camera logic
- OBJ mesh loading (`MeshLoader.parseOBJ` / `MeshLoader.loadOBJ`)
- CSG helpers (`csgUnion`, `csgSubtract`, `csgIntersect`)
- Texture pipeline foundation (`TextureLoader`, `Sampler`, texture-aware material/shader bindings)
- Baseline glTF loader (`GltfLoader`) for uri-based `.gltf` assets

Not implemented yet (or only partially implemented):

- Collision system (AABB/collider/response)
- Texture/sampler pipeline integration (implemented; advanced material maps pending)
- Gamepad input support
- Audio manager
- Point lights, shadows, and post-processing
- Scene serialization
- glTF loading (baseline implemented; broader spec support pending)
- Profiling tools

## API Documentation

### Engine

- `constructor(config: EngineConfig)`
- `initialize(): Promise<void>`
- `start(): void`
- `stop(): void`
- `setScene(scene: Scene): void`
- `getRenderer(): Renderer`
- `getInput(): InputManager`
- `resize(width: number, height: number): void`

### Scene

- `createEntity(name?: string): Entity` — creates a root entity and adds it to the scene
- `addEntity(entity: Entity): void` — only accepts root entities (no parent); silently ignores children
- `removeEntity(entity: Entity): void`
- `getEntity(name: string): Entity | null`
- `findEntitiesWithComponent<T>(type): Entity[]` — searches the full entity tree recursively

### Entity

- `addComponent<T extends Component>(component: T): T`
- `getComponent<T extends Component>(type): T | null`
- `removeComponent<T extends Component>(type): void`
- `hasComponent<T extends Component>(type): boolean`
- `addChild(child: Entity): void` — attach a child; wires transform hierarchy and propagates scene reference
- `removeChild(child: Entity): void` — detach a child without destroying it
- `parent: Entity | null` — read-only hierarchy link
- `children: Entity[]` — direct children

## Contributing

Contributions are welcome. Please ensure code follows the existing style and includes appropriate tests.

## License

MIT License

## Roadmap

- [ ] Texture support
- [ ] Advanced lighting (point lights, spot lights, shadows)
- [ ] Post-processing effects
- [ ] Particle system
- [x] Physics integration (fixed timestep + `RigidBody` + `CarPhysics`)
- [ ] Animation system
- [ ] Audio system
- [ ] Scene serialization
- [ ] glTF model loading
- [ ] Performance profiling tools
