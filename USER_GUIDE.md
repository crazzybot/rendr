# WebGPU Game Framework - User Guide

A comprehensive guide to building 3D games for the web using the WebGPU Game Framework.

## Table of Contents

1. [Introduction](#introduction)
2. [Installation & Setup](#installation--setup)
3. [Core Concepts](#core-concepts)
4. [Getting Started](#getting-started)
5. [Working with Entities](#working-with-entities)
6. [Transforms & Positioning](#transforms--positioning)
7. [Rendering](#rendering)
8. [Camera System](#camera-system)
9. [Input Handling](#input-handling)
10. [Math Library](#math-library)
11. [Resource Management](#resource-management)
12. [Advanced Topics](#advanced-topics)
13. [Best Practices](#best-practices)

---

## Introduction

The WebGPU Game Framework is a modern, TypeScript-based 3D game framework designed for browsers. It leverages the cutting-edge WebGPU API for high-performance graphics rendering while providing a straightforward Entity Component System (ECS) architecture for managing game objects.

### Key Features

- **WebGPU Rendering**: Modern GPU-accelerated graphics
- **Entity Component System**: Flexible object-oriented architecture
- **Complete Math Library**: Vec3, Vec4, Mat4, Quaternion
- **Built-in Geometries**: Cubes, spheres, planes, cylinders
- **Material System**: Customizable materials with multiple shader types
- **Input Management**: Full keyboard, mouse, and pointer lock support
- **TypeScript Support**: Complete type definitions for excellent IDE support

### Browser Requirements

WebGPU support is required:
- **Chrome/Edge**: 113+
- **Firefox**: Experimental (behind flag)
- **Safari**: Limited support

Check [caniuse.com/webgpu](https://caniuse.com/webgpu) for current browser support status.

---

## Installation & Setup

### Prerequisites

- Node.js 16+ and npm
- A modern browser with WebGPU support

### Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

3. **Build for Production**
   ```bash
   npm run build
   ```

4. **Type Check**
   ```bash
   npm run type-check
   ```

### Project Structure

```
src/
├── core/          # Core engine (Engine, Scene, Entity, Component)
├── components/    # Built-in components (Camera, MeshRenderer)
├── rendering/     # Graphics system (Renderer, Material, Shader, Geometry)
├── input/         # Input management (InputManager)
├── math/          # Mathematics utilities (Vec3, Vec4, Mat4, Quat)
└── resources/     # Resource management system
```

---

## Core Concepts

### Entity Component System (ECS)

The framework uses ECS architecture composed of three main parts:

1. **Entity**: A container for components (e.g., a game object like a player or tree)
2. **Component**: Data and behavior containers attached to entities
3. **System**: Logic that operates on components (built into the framework)

This architecture is very flexible and efficient for game development.

### Example ECS Flow

```typescript
// Create entity (container)
const player = scene.createEntity('Player');

// Add components (behavior/data)
const renderer = new MeshRenderer();
player.addComponent(renderer);

const controller = new PlayerController();
player.addComponent(controller);
```

---

## Getting Started

### Minimal Example

Here's the simplest way to create a game:

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
} from 'webgpu-game-framework';

async function main() {
  // 1. Get canvas and create engine
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const engine = new Engine({
    canvas,
    width: 800,
    height: 600
  });

  // 2. Initialize graphics
  await engine.initialize();

  // 3. Create scene
  const scene = new Scene('MainScene');
  engine.setScene(scene);

  // 4. Create camera
  const cameraEntity = scene.createEntity('Camera');
  const camera = new Camera();
  camera.setPerspective(Math.PI / 4, 800 / 600, 0.1, 1000);
  cameraEntity.addComponent(camera);
  cameraEntity.transform.position = new Vec3(0, 0, 5);

  // 5. Create a cube
  const cube = scene.createEntity('Cube');
  const cubeMesh = Geometry.createCube(1);
  const material = new Material(undefined, {
    color: new Vec4(1, 0.5, 0.3, 1)
  });

  const renderer = new MeshRenderer();
  renderer.setMesh(cubeMesh);
  renderer.setMaterial(material);
  cube.addComponent(renderer);

  // 6. Initialize and start
  const device = engine.getRenderer().getDevice()!;
  const format = engine.getRenderer().getFormat();
  renderer.initialize(device, format);

  engine.start();
}

main().catch(console.error);
```

### HTML Setup

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>My WebGPU Game</title>
  <style>
    body { margin: 0; }
    canvas { display: block; width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script type="module" src="./src/main.ts"></script>
</body>
</html>
```

---

## Working with Entities

### Creating Entities

Entities are created from a scene:

```typescript
const scene = engine.getScene()!;
const entity = scene.createEntity('MyEntity');
```

### Adding Components

Components provide functionality to entities:

```typescript
const meshRenderer = new MeshRenderer();
entity.addComponent(meshRenderer);
```

### Getting Components

Retrieve components from an entity:

```typescript
const renderer = entity.getComponent(MeshRenderer);
if (renderer) {
  // Use the renderer
}
```

### Checking for Components

```typescript
if (entity.hasComponent(MeshRenderer)) {
  console.log('Entity has a renderer');
}
```

### Removing Components

```typescript
entity.removeComponent(MeshRenderer);
```

### Entity Properties

```typescript
entity.name = 'Player';
entity.active = true;  // Toggle entity active state
entity.scene;          // Reference to parent scene
entity.transform;      // Built-in transform component
```

### Creating Custom Components

```typescript
import { Component } from 'webgpu-game-framework';

class HealthComponent extends Component {
  public maxHealth: number = 100;
  public currentHealth: number = 100;

  onAttach(): void {
    console.log('Health component attached');
  }

  onUpdate(deltaTime: number): void {
    // Called every frame
  }

  onDetach(): void {
    console.log('Health component detached');
  }

  takeDamage(amount: number): void {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
  }
}

// Use it
const entity = scene.createEntity('Enemy');
const health = new HealthComponent();
entity.addComponent(health);
```

---

## Transforms & Positioning

Every entity has a `transform` component that controls position, rotation, and scale.

### Position

```typescript
// Set absolute position
entity.transform.position = new Vec3(5, 2, 0);

// Get current position
const pos = entity.transform.position;

// Move relative to current position
entity.transform.translate(new Vec3(1, 0, 0));
```

### Rotation

```typescript
import { Quat, Vec3 } from 'webgpu-game-framework';

// Rotate using quaternion (Euler angles in radians)
entity.transform.rotation = Quat.fromEuler(
  Math.PI / 4,  // pitch (x-axis)
  Math.PI / 2,  // yaw (y-axis)
  0             // roll (z-axis)
);

// Rotate incrementally
const rotation = Quat.fromAxisAngle(Vec3.up(), Math.PI / 4);
entity.transform.rotate(rotation);

// Get rotation as quaternion
const quat = entity.transform.rotation;
```

### Scale

```typescript
// Uniform scale
entity.transform.scale = new Vec3(2, 2, 2);

// Non-uniform scale
entity.transform.scale = new Vec3(1, 2, 0.5);

// Get current scale
const scale = entity.transform.scale;
```

### Directional Vectors

Get the axes of the transform:

```typescript
const forward = entity.transform.getForward();   // -Z direction
const right = entity.transform.getRight();       // +X direction
const up = entity.transform.getUp();             // +Y direction
```

### Look At

Point an entity towards a target:

```typescript
entity.transform.lookAt(
  new Vec3(0, 0, 0),    // target position
  Vec3.up()             // up vector
);
```

### Parent-Child Relationships

Create a transform hierarchy:

```typescript
const parent = scene.createEntity('Parent');
const child = scene.createEntity('Child');

// Make child relative to parent
child.transform.setParent(parent.transform);

// Now child's position/rotation is relative to parent
child.transform.position = new Vec3(1, 0, 0);  // 1 unit offset from parent
```

---

## Rendering

### Rendering Pipeline

To render geometry, you need:
1. A **Geometry** (mesh data)
2. A **Material** (appearance/shader)
3. A **MeshRenderer** (component on entity)

### Geometries

Built-in primitive shapes:

```typescript
import { Geometry } from 'webgpu-game-framework';

// Cube
const cubeMesh = Geometry.createCube(size);

// Sphere
const sphereMesh = Geometry.createSphere(
  radius,      // radius
  segments,    // horizontal segments
  rings        // vertical rings
);

// Plane
const planeMesh = Geometry.createPlane(
  width,       // width
  height,      // height
  segmentsX,   // x divisions
  segmentsY    // y divisions
);

// Cylinder
const cylMesh = Geometry.createCylinder(
  radius,      // radius
  height,      // height
  segments     // angular segments
);
```

### Materials and Shaders

Create materials with different shaders:

```typescript
import {
  Material,
  BasicShader,
  UnlitShader,
  Vec4
} from 'webgpu-game-framework';

// Basic lit material (Phong shading)
const material = new Material(BasicShader, {
  color: new Vec4(1, 0, 0, 1),     // red
  ambient: 0.3,
  diffuse: 0.7,
  specular: 0.5,
  shininess: 32
});

// Unlit material (no lighting)
const unlitMaterial = new Material(UnlitShader, {
  color: new Vec4(0, 1, 0, 1)      // green
});
```

### Shader Types

- **BasicShader**: Phong lighting model with diffuse, specular, and ambient
- **UnlitShader**: Simple solid color, no lighting

### MeshRenderer Component

```typescript
import { MeshRenderer } from 'webgpu-game-framework';

const entity = scene.createEntity('Model');

const renderer = new MeshRenderer();
renderer.setMesh(Geometry.createCube(1));
renderer.setMaterial(new Material(UnlitShader, {
  color: new Vec4(1, 0.5, 0.3, 1)
}));

entity.addComponent(renderer);

// Initialize renderer (required before rendering)
const device = engine.getRenderer().getDevice()!;
const format = engine.getRenderer().getFormat();
renderer.initialize(device, format);
```

### Rendering Example

```typescript
async function setupScene() {
  const scene = new Scene('GameScene');
  engine.setScene(scene);

  // Create camera
  const cameraEntity = scene.createEntity('Camera');
  const camera = new Camera();
  camera.setPerspective(Math.PI / 4, 800 / 600, 0.1, 1000);
  cameraEntity.addComponent(camera);
  cameraEntity.transform.position = new Vec3(0, 2, 5);

  // Create multiple cubes with different colors
  const colors = [
    new Vec4(1, 0, 0, 1),  // red
    new Vec4(0, 1, 0, 1),  // green
    new Vec4(0, 0, 1, 1)   // blue
  ];

  for (let i = 0; i < 3; i++) {
    const entity = scene.createEntity(`Cube${i}`);
    entity.transform.position = new Vec3(i * 2 - 2, 0, 0);

    const renderer = new MeshRenderer();
    renderer.setMesh(Geometry.createCube(0.8));
    renderer.setMaterial(new Material(UnlitShader, {
      color: colors[i]
    }));

    entity.addComponent(renderer);

    const device = engine.getRenderer().getDevice()!;
    const format = engine.getRenderer().getFormat();
    renderer.initialize(device, format);
  }
}

// In your main function
await setupScene();
engine.start();
```

---

## Camera System

### Camera Component

Cameras define the viewpoint for rendering:

```typescript
import { Camera, ProjectionType } from 'webgpu-game-framework';

const entity = scene.createEntity('Camera');
const camera = new Camera();

entity.addComponent(camera);
```

### Perspective Camera

```typescript
camera.setPerspective(
  Math.PI / 4,    // fov in radians
  800 / 600,      // aspect ratio (width/height)
  0.1,            // near clipping plane
  1000            // far clipping plane
);
```

### Orthographic Camera

```typescript
camera.setOrthographic(
  -10,     // left
  10,      // right
  10,      // top
  -10,     // bottom
  0.1,     // near
  1000     // far
);
```

### Setting Active Camera

The framework renders from the first camera it finds. Position it appropriately:

```typescript
const cameraEntity = scene.createEntity('Camera');
const camera = new Camera();
camera.setPerspective(Math.PI / 4, 800 / 600, 0.1, 1000);
cameraEntity.addComponent(camera);

// Position the camera
cameraEntity.transform.position = new Vec3(0, 2, 5);
cameraEntity.transform.lookAt(new Vec3(0, 0, 0), Vec3.up());
```

### First-Person Camera Controller

```typescript
import { Component, Vec3, Quat } from 'webgpu-game-framework';
import { MouseButton } from 'webgpu-game-framework';

class FPSCamera extends Component {
  private moveSpeed = 5;
  private lookSpeed = 0.002;
  private pitch = 0;
  private yaw = 0;

  onUpdate(deltaTime: number): void {
    const input = this.entity!.scene!.engine.getInput();

    // Movement
    const movement = Vec3.zero();
    if (input.isKeyPressed('KeyW')) movement.z -= 1;
    if (input.isKeyPressed('KeyS')) movement.z += 1;
    if (input.isKeyPressed('KeyA')) movement.x -= 1;
    if (input.isKeyPressed('KeyD')) movement.x += 1;

    if (movement.lengthSquared() > 0) {
      const moveVec = movement.normalize().mul(this.moveSpeed * deltaTime);
      this.entity!.transform.translate(moveVec);
    }

    // Looking
    if (input.isMouseButtonDown(MouseButton.Left)) {
      input.requestPointerLock();
    }

    if (input.isPointerLocked()) {
      const delta = input.getMouseDelta();
      this.yaw -= delta.x * this.lookSpeed;
      this.pitch -= delta.y * this.lookSpeed;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));

      this.entity!.transform.rotation = Quat.fromEuler(this.pitch, this.yaw, 0);
    }

    if (input.isKeyDown('Escape')) {
      input.exitPointerLock();
    }
  }
}
```

---

## Input Handling

### Keyboard Input

```typescript
const input = engine.getInput();

// Key held down (continuous)
if (input.isKeyPressed('KeyW')) {
  // Move forward
}

// Key just went down (single frame)
if (input.isKeyDown('Space')) {
  // Jump
}
```

### Common Key Codes

- `KeyW`, `KeyA`, `KeyS`, `KeyD` - WASD
- `Space` - spacebar
- `ShiftLeft`, `ShiftRight` - shift keys
- `ControlLeft`, `ControlRight` - control keys
- `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` - arrow keys
- `Enter` - enter key
- `Escape` - escape key

### Mouse Input

```typescript
import { MouseButton } from 'webgpu-game-framework';

// Mouse button
if (input.isMouseButtonDown(MouseButton.Left)) {
  input.requestPointerLock();  // Lock cursor to canvas
}

if (input.isMouseButtonPressed(MouseButton.Left)) {
  // Left mouse held
}

if (input.isMouseButtonPressed(MouseButton.Right)) {
  // Right mouse held
}

// Mouse position
const mousePos = input.getMousePosition();
const mouseDelta = input.getMouseDelta();

console.log(`Mouse at: ${mousePos.x}, ${mousePos.y}`);
console.log(`Delta: ${mouseDelta.x}, ${mouseDelta.y}`);
```

### Pointer Lock (Fullscreen Input)

```typescript
const input = engine.getInput();

// Request pointer lock
input.requestPointerLock();

// Check if locked
if (input.isPointerLocked()) {
  const delta = input.getMouseDelta();
  // Handle camera rotation
}

// Exit pointer lock
input.exitPointerLock();
```

### Complete Input Example

```typescript
class PlayerController extends Component {
  private speed = 10;
  private sensitivity = 0.3;

  onUpdate(deltaTime: number): void {
    const input = this.entity!.scene!.engine.getInput();

    // Get movement direction
    const forward = this.entity!.transform.getForward().mul(-1);
    const right = this.entity!.transform.getRight();

    let moveDirection = Vec3.zero();
    if (input.isKeyPressed('KeyW')) moveDirection = moveDirection.add(forward);
    if (input.isKeyPressed('KeyS')) moveDirection = moveDirection.add(forward.mul(-1));
    if (input.isKeyPressed('KeyD')) moveDirection = moveDirection.add(right);
    if (input.isKeyPressed('KeyA')) moveDirection = moveDirection.add(right.mul(-1));

    if (moveDirection.lengthSquared() > 0) {
      const movement = moveDirection.normalize().mul(this.speed * deltaTime);
      this.entity!.transform.translate(movement);
    }

    // Handle mouse look
    if (input.isMouseButtonPressed(MouseButton.Left)) {
      const delta = input.getMouseDelta();
      // Rotate camera based on delta
    }
  }
}
```

---

## Math Library

### Vector Classes

#### Vec3 (3D Vector)

```typescript
import { Vec3 } from 'webgpu-game-framework';

// Creation
const v = new Vec3(1, 2, 3);
const zero = Vec3.zero();
const one = Vec3.one();
const up = Vec3.up();      // (0, 1, 0)
const down = Vec3.down();  // (0, -1, 0)
const right = Vec3.right(); // (1, 0, 0)
const left = Vec3.left();  // (-1, 0, 0)
const forward = Vec3.forward(); // (0, 0, -1)

// Operations
const sum = v.add(new Vec3(1, 1, 1));
const diff = v.sub(new Vec3(1, 1, 1));
const scaled = v.mul(2);
const divided = v.div(2);
const normalized = v.normalize();

// Properties
const length = v.length();
const lengthSq = v.lengthSquared();
const dot = v.dot(new Vec3(1, 0, 0));
const cross = v.cross(new Vec3(0, 1, 0));

// Access components
const x = v.x;
const y = v.y;
const z = v.z;
```

#### Vec4 (4D Vector)

```typescript
import { Vec4 } from 'webgpu-game-framework';

// Often used for colors
const color = new Vec4(1, 0.5, 0.3, 1);  // RGBA
const white = new Vec4(1, 1, 1, 1);
const transparent = new Vec4(1, 1, 1, 0);

// Vector operations (same as Vec3)
const sum = color.add(white);
```

#### Mat4 (4x4 Matrix)

```typescript
import { Mat4 } from 'webgpu-game-framework';

// Creation
const identity = Mat4.identity();
const zero = Mat4.zero();

// Transformations
const translation = Mat4.translation(new Vec3(1, 2, 3));
const scaling = Mat4.scaling(new Vec3(2, 2, 2));
const rotation = Mat4.rotationQuat(Quat.fromEuler(0, Math.PI / 4, 0));

// Projections
const perspective = Mat4.perspective(
  Math.PI / 4,    // fov
  16 / 9,         // aspect
  0.1,            // near
  1000            // far
);

const ortho = Mat4.orthographic(
  -10, 10,        // left, right
  -10, 10,        // top, bottom
  0.1, 1000       // near, far
);

// Operations
const product = translation.mul(scaling);
const inverse = matrix.invert();
const transposed = matrix.transpose();

// View matrix (camera)
const view = Mat4.lookAt(
  new Vec3(0, 0, 5),      // camera position
  new Vec3(0, 0, 0),      // target
  Vec3.up()               // up vector
);
```

#### Quaternion (Rotation)

```typescript
import { Quat, Vec3 } from 'webgpu-game-framework';

// Creation from Euler angles (radians)
const q = Quat.fromEuler(
  Math.PI / 4,   // pitch
  Math.PI / 2,   // yaw
  0              // roll
);

// From axis-angle
const axisQ = Quat.fromAxisAngle(Vec3.up(), Math.PI / 4);

// Identity rotation
const identity = Quat.identity();

// Operations
const q1 = Quat.fromEuler(0.1, 0, 0);
const q2 = Quat.fromEuler(0, 0.1, 0);
const combined = q1.mul(q2);  // Combine rotations
const conjugate = q.conjugate();
const normalized = q.normalize();

// Access components
const x = q.x;
const y = q.y;
const z = q.z;
const w = q.w;
```

### Common Math Patterns

```typescript
// Distance between two points
const distance = pos1.sub(pos2).length();

// Normalized direction
const direction = target.sub(current).normalize();

// Move towards target
const movement = direction.mul(speed * deltaTime);

// Interpolate between two values
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
```

---

## Resource Management

The framework includes a resource management system for loading and caching assets.

### ResourceManager

```typescript
import { ResourceManager } from 'webgpu-game-framework';

const resourceManager = new ResourceManager();

// Resources are typically managed centrally
// Access via engine or create your own instance
```

### Best Practices

1. **Reuse Geometries**: Create geometry once, use for multiple renderers
   ```typescript
   const cubeMesh = Geometry.createCube(1);
   
   for (let i = 0; i < 100; i++) {
     const entity = scene.createEntity(`Cube${i}`);
     const renderer = new MeshRenderer();
     renderer.setMesh(cubeMesh);  // Reuse
     entity.addComponent(renderer);
   }
   ```

2. **Reuse Materials**: Share materials across entities with same appearance
   ```typescript
   const material = new Material(UnlitShader, {
     color: new Vec4(1, 0, 0, 1)
   });
   
   // Use material on many entities
   renderer1.setMaterial(material);
   renderer2.setMaterial(material);
   ```

3. **Initialize Once**: Initialize renderers once after setup
   ```typescript
   const device = engine.getRenderer().getDevice()!;
   const format = engine.getRenderer().getFormat();
   renderer.initialize(device, format);
   ```

---

## Advanced Topics

### Custom Components with Lifecycle

Components support full lifecycle hooks:

```typescript
class PlayerComponent extends Component {
  public health = 100;

  onAttach(): void {
    // Called when component is added to entity
    console.log('Player spawned');
  }

  onUpdate(deltaTime: number): void {
    // Called every frame
  }

  onDetach(): void {
    // Called when component is removed
    console.log('Player removed');
  }

  onDestroy(): void {
    // Called when entity is destroyed
    console.log('Player destroyed');
  }
}
```

### Multi-Component Systems

Build complex behavior with multiple components:

```typescript
// Velocity component
class VelocityComponent extends Component {
  public velocity = Vec3.zero();

  onUpdate(deltaTime: number): void {
    this.entity!.transform.translate(this.velocity.mul(deltaTime));
  }
}

// Physics component
class PhysicsComponent extends Component {
  private gravity = -9.81;

  onUpdate(deltaTime: number): void {
    const velocity = this.entity!.getComponent(VelocityComponent)!;
    velocity.velocity.y += this.gravity * deltaTime;
  }
}

// Collision component
class CollisionComponent extends Component {
  public radius = 1;

  checkCollision(other: Entity): boolean {
    const dist = this.entity!.transform.position
      .sub(other.transform.position).length();
    return dist < this.radius + (other.getComponent(CollisionComponent)?.radius || 0);
  }
}

// Usage
const entity = scene.createEntity('Ball');
entity.addComponent(new VelocityComponent());
entity.addComponent(new PhysicsComponent());
entity.addComponent(new CollisionComponent());
```

### Scene Management

```typescript
// Create scenes for different levels
const mainScene = new Scene('MainMenu');
const gameScene = new Scene('Level1');
const pauseScene = new Scene('PauseMenu');

// Switch scenes
engine.setScene(gameScene);

// Access current scene
const currentScene = engine.getScene();
```

### Hierarchy and Parenting

Build object hierarchies:

```typescript
// Create a parent
const vehicle = scene.createEntity('Vehicle');

// Create wheels as children
for (let i = 0; i < 4; i++) {
  const wheel = scene.createEntity(`Wheel${i}`);
  wheel.transform.setParent(vehicle.transform);
  wheel.transform.position = new Vec3(i * 0.5, 0, 0);
}

// Moving parent moves all children
vehicle.transform.translate(new Vec3(5, 0, 0));
// All wheels move with it
```

### Performance Optimization

```typescript
// Disable entities you don't need
entity.active = false;  // Won't be updated or rendered

// Reuse components instead of creating new ones
const pool = [];
for (let i = 0; i < 100; i++) {
  pool.push(scene.createEntity(`Instance${i}`));
}

// When needed
const instance = pool[0];
instance.active = true;
```

---

## Best Practices

### 1. Initialize Everything Properly

```typescript
async function initializeGame() {
  const engine = new Engine({ canvas, width: 800, height: 600 });
  await engine.initialize();  // Wait for GPU initialization
  
  const scene = new Scene('Game');
  engine.setScene(scene);
  
  // Setup scene...
  
  engine.start();  // Start render loop
}
```

### 2. Use Meaningful Names

```typescript
// Good
const playerEntity = scene.createEntity('Player');
const backgroundMusic = new AudioComponent();

// Avoid
const e = scene.createEntity('e1');
const c = new AudioComponent();
```

### 3. Component Separation

Keep components focused on single responsibilities:

```typescript
// Good - separate concerns
entity.addComponent(new MovementComponent());
entity.addComponent(new InputComponent());
entity.addComponent(new AnimationComponent());

// Avoid - too much in one component
class PlayerComponent extends Component {
  // Movement, input, animation, health, inventory, dialogue...
}
```

### 4. Cache Frequently Used Data

```typescript
class CameraFollower extends Component {
  private targetCamera: Camera | null = null;

  onAttach(): void {
    // Cache camera reference
    this.targetCamera = this.entity!.scene!
      .createEntity('temp')
      .getComponent(Camera);
  }

  onUpdate(): void {
    // Use cached reference
    if (this.targetCamera) {
      // Update based on camera
    }
  }
}
```

### 5. Handle Cleanup

```typescript
class GameManager extends Component {
  onDetach(): void {
    // Clean up resources
    console.log('Cleaning up game resources');
  }
}
```

### 6. Organize Code by Feature

```
src/
├── game/
│   ├── Player.ts        // Player entity and components
│   ├── Enemy.ts         // Enemy systems
│   ├── World.ts         // World management
│   └── UI.ts            // UI management
├── systems/
│   ├── Physics.ts
│   ├── Audio.ts
│   └── Input.ts
└── utils/
    ├── Math.ts
    └── Debug.ts
```

### 7. Error Handling

```typescript
try {
  await engine.initialize();
  // Setup scene
  engine.start();
} catch (error) {
  console.error('Game initialization failed:', error);
  // Show error to user
  showErrorMessage('Failed to initialize game. WebGPU may not be supported.');
}
```

### 8. Frame Rate Independence

Always use `deltaTime`:

```typescript
// Good - frame rate independent
component.position.x += velocity * deltaTime;

// Bad - frame rate dependent
component.position.x += 5;  // 5 units per frame
```

### 9. Testing Geometries

Verify your scene with simple shapes first:

```typescript
// Start with basic geometry
const testCube = Geometry.createCube(1);
const renderer = new MeshRenderer();
renderer.setMesh(testCube);
renderer.setMaterial(new Material(UnlitShader, {
  color: new Vec4(1, 0, 0, 1)
}));
```

### 10. Debug Visualization

Add visual debug helpers:

```typescript
class DebugVisualizer {
  static drawAxis(entity: Entity, scale = 1) {
    // Draw X, Y, Z axes from entity
  }

  static drawBounds(entity: Entity) {
    // Draw bounding box
  }

  static drawVector(origin: Entity, direction: Vec3, color: Vec4) {
    // Draw direction vector
  }
}
```

---

## Troubleshooting

### WebGPU Not Available
- Check browser support: [caniuse.com/webgpu](https://caniuse.com/webgpu)
- Update your browser to the latest version
- For Firefox, enable the flag: `dom.webgpu.enabled` in about:config

### Nothing Rendering
1. Check camera is created and positioned
2. Verify MeshRenderer is initialized: `renderer.initialize(device, format)`
3. Ensure materials are set: `renderer.setMaterial(material)`
4. Check mesh is set: `renderer.setMesh(geometry)`

### Performance Issues
- Use `entity.active = false` to disable unused entities
- Reuse geometries and materials
- Limit the number of entities with MeshRenderers
- Profile with browser DevTools

### Type Errors
- Run `npm run type-check` to find TypeScript issues
- Ensure all imports are correct
- Check component initializations

---

## Examples

See the [example/demo.ts](../example/demo.ts) file for a complete working example including:
- Scene setup
- Multiple objects
- Camera controller
- Input handling
- Animation

---

## Resources

- [WebGPU Specification](https://gpuweb.github.io/gpuweb/)
- [MDN WebGPU Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/)

---

## License

MIT License - See LICENSE file for details

