# Game Development Introduction

A comprehensive guide to understanding core game development concepts, principles, and techniques. This introduction covers the fundamental knowledge needed to build modern 3D games.

## Table of Contents

1. [What is Game Development?](#what-is-game-development)
2. [Core Principles](#core-principles)
3. [The Game Loop](#the-game-loop)
4. [3D Mathematics](#3d-mathematics)
5. [Entity Component System (ECS)](#entity-component-system-ecs)
6. [Graphics & Rendering](#graphics--rendering)
7. [User Interaction & Input](#user-interaction--input)
8. [Game Scenes & State](#game-scenes--state)
9. [Performance Optimization](#performance-optimization)
10. [Common Game Patterns](#common-game-patterns)
11. [Debugging & Testing](#debugging--testing)

---

## What is Game Development?

Game development is the process of creating interactive entertainment experiences. Modern game development involves:

- **Programming**: Writing code that defines game logic and behavior
- **Graphics**: Rendering 2D/3D visuals to the screen
- **Audio**: Playing sound effects and music
- **Design**: Defining gameplay mechanics and user experience
- **Art**: Creating models, textures, and animations
- **Project Management**: Organizing teams and resources

Game development is **systems thinking**: you're building interconnected systems that work together to create a cohesive experience.

### Why WebGPU for Game Development?

WebGPU offers:
- **GPU Acceleration**: Direct access to graphics hardware
- **Platform Independence**: Works in any modern browser
- **Modern API**: Built on decades of graphics API experience
- **Safety**: Type-safe graphics programming
- **Performance**: Near-native graphics performance

---

## Core Principles

### 1. **Separation of Concerns**

Keep different systems independent and focused:

```
Input System → Updates Entity State → Rendering System
```

Each system has a single responsibility:
- **Input System**: Handles user input
- **Physics System**: Handles movement and collisions
- **Rendering System**: Draws entities to screen

### 2. **Data-Oriented Design**

Organize code around data rather than just objects:

```typescript
// Object-Oriented (less efficient)
class Entity {
  position: Vec3;
  velocity: Vec3;
  mesh: Mesh;
  material: Material;
  // ...many methods
}

// Data-Oriented (more efficient)
class PositionComponent { position: Vec3; }
class VelocityComponent { velocity: Vec3; }
class RenderComponent { mesh: Mesh; material: Material; }
// Systems operate on components
```

### 3. **Event-Driven Architecture**

Use events for loose coupling between systems:

```typescript
// Instead of direct coupling:
playerEntity.getComponent(Health).takeDamage(10);
UISystem.updateHealthBar();

// Use events:
eventBus.emit('playerDamaged', { amount: 10 });
eventBus.on('playerDamaged', (data) => {
  UISystem.updateHealthBar();
  AudioSystem.playHurtSound();
});
```

### 4. **Composition Over Inheritance**

Build entities by composing components rather than inheritance:

```typescript
// Inheritance (rigid)
class Player extends LivingEntity {
  // Code duplication if enemies also need this
}

// Composition (flexible)
const player = new Entity('Player');
player.addComponent(new Health());
player.addComponent(new Physics());
player.addComponent(new Renderer());
player.addComponent(new Input());
// Exactly what we need, nothing more
```

### 5. **Immutability Where Possible**

Avoid unexpected state changes:

```typescript
// Bad - modified in place
const pos = entity.transform.position;
pos.x = 5;  // Unexpected side effect

// Good - returns new object
const newPos = entity.transform.position.add(new Vec3(1, 0, 0));
entity.transform.position = newPos;
```

### 6. **Fail Fast**

Catch errors early rather than silently failing:

```typescript
// Good - explicit checks
if (!entity.hasComponent(Renderer)) {
  throw new Error('Entity must have Renderer component');
}

// Also good - use types
const renderer: MeshRenderer = entity.getComponent(MeshRenderer)!;
```

---

## The Game Loop

The core of every game is the **game loop** - a cycle that runs repeatedly:

```
1. Handle Input
2. Update Game State
3. Render Frame
4. Sleep until next frame
```

### Frame Rate Independence

Games should run at different speeds on different hardware. Use **delta time** (time since last frame):

```typescript
let lastTime = performance.now();

function gameLoop() {
  const currentTime = performance.now();
  const deltaTime = (currentTime - lastTime) / 1000;  // in seconds
  lastTime = currentTime;

  // Use deltaTime for all movement
  entity.position += velocity * deltaTime;
  
  requestAnimationFrame(gameLoop);
}
```

**Without deltaTime:**
- Fast computer: Object moves 10 units per frame = 600 units/sec at 60fps
- Slow computer: Object moves 10 units per frame = 200 units/sec at 20fps
- **Result**: Game plays at different speeds ❌

**With deltaTime:**
- Fast computer: Object moves (velocity * 1/60) units = 100 units/sec
- Slow computer: Object moves (velocity * 1/20) units = 100 units/sec
- **Result**: Game plays at same speed ✓

### The Update Order

Typical game loop order matters:

```
1. Input    -> Read keyboard/mouse
2. Update   -> Move things, physics, logic
3. Render   -> Draw to screen

Common trap: Update after render sees stale input
```

---

## 3D Mathematics

3D graphics require mathematical operations. Understanding these is critical.

### Coordinate Systems

**Right-handed coordinate system** (industry standard):

```
       +Y (up)
       |
       |
    ---*--- +X (right)
      /
     /
   +Z (forward/towards camera)
```

Position in 3D space: `(x, y, z)`

### Vectors

A vector represents direction and magnitude:

```typescript
// Position vector
const position = new Vec3(1, 2, 3);

// Direction (normalized = length 1)
const direction = Vec3.forward();  // (0, 0, -1)

// Velocity (direction with magnitude)
const velocity = direction.mul(5);  // Move 5 units forward per unit time
```

#### Vector Operations

```typescript
// Addition - combine movements
const totalMovement = movement1.add(movement2);

// Scalar multiplication - change speed
const faster = velocity.mul(2);

// Magnitude/Length - distance from origin
const distance = vector.length();

// Normalization - get direction only (length becomes 1)
const direction = vector.normalize();

// Dot product - angle between vectors
const similarity = vec1.dot(vec2);  // 1 = same direction, -1 = opposite

// Cross product - perpendicular direction
const perpendicular = forward.cross(right);  // get up direction
```

#### Common Vector Patterns

```typescript
// Distance between two points
const distance = point1.sub(point2).length();

// Direction from A to B
const direction = pointB.sub(pointA).normalize();

// Move from A towards B
const step = direction.mul(speed * deltaTime);

// Reflect a vector off a surface
const reflected = incoming.sub(normal.mul(2 * incoming.dot(normal)));

// Interpolate between two positions
const lerp = (a: Vec3, b: Vec3, t: number) => 
  a.mul(1 - t).add(b.mul(t));
```

### Matrices

Matrices represent transformations (rotation, scale, translation):

```typescript
// Identity matrix (no transformation)
const identity = Mat4.identity();

// Translation (move position)
const move = Mat4.translation(new Vec3(1, 2, 3));

// Scaling (change size)
const scale = Mat4.scaling(new Vec3(2, 2, 2));

// Rotation (turn around axis)
const rotate = Mat4.rotationY(Math.PI / 4);

// Combine transformations
const combined = translate.mul(rotate).mul(scale);

// Transform a point
const newPoint = combined.transformPoint(originalPoint);
```

### Quaternions

Quaternions represent rotations more elegantly than Euler angles:

```typescript
// From Euler angles (pitch, yaw, roll)
const rotation = Quat.fromEuler(
  Math.PI / 4,  // pitch (rotate around X)
  Math.PI / 2,  // yaw (rotate around Y)
  0             // roll (rotate around Z)
);

// From axis-angle (rotate around specific axis)
const rotation = Quat.fromAxisAngle(Vec3.up(), Math.PI / 4);

// Combine rotations
const combined = rotation1.mul(rotation2);

// Rotate a vector
const rotated = rotation.transformVector(originalVector);

// Spherical interpolation (smooth rotation between two angles)
const smoothRotation = Quat.slerp(start, end, 0.5);  // halfway
```

**Why Quaternions?**
- No gimbal lock (rotation singularities)
- Smooth interpolation
- Efficient combining of rotations
- Standard in modern graphics

### Projection

Converting 3D world space to 2D screen space:

```typescript
// Perspective projection (what we see in reality)
const perspective = Mat4.perspective(
  Math.PI / 4,    // field of view
  800 / 600,      // aspect ratio
  0.1,            // near plane (closest objects)
  1000            // far plane (farthest objects)
);

// Orthographic projection (like looking at a flat blueprint)
const ortho = Mat4.orthographic(
  -10, 10,        // left, right
  10, -10,        // top, bottom
  0.1, 1000       // near, far
);
```

### View Matrix

The camera's position and orientation:

```typescript
// Create view matrix from camera properties
const cameraPos = new Vec3(0, 2, 5);
const targetPos = new Vec3(0, 0, 0);
const upDir = Vec3.up();

const view = Mat4.lookAt(cameraPos, targetPos, upDir);
```

---

## Entity Component System (ECS)

ECS is an architectural pattern for managing game objects. It separates **structure** (entities and components) from **behavior** (systems).

### Core Concepts

**Entity**: An object in your game (player, enemy, item, etc.)
```typescript
const player = scene.createEntity('Player');
const enemy = scene.createEntity('Enemy');
```

**Component**: Data and/or behavior attached to an entity
```typescript
class Position extends Component {
  x = 0;
  y = 0;
  z = 0;
}

class Health extends Component {
  maxHealth = 100;
  currentHealth = 100;
}

class Renderer extends Component {
  mesh: Mesh;
  material: Material;
}
```

**System**: Logic that operates on components
```typescript
class HealthSystem {
  update(entities: Entity[]) {
    for (const entity of entities) {
      const health = entity.getComponent(Health);
      if (health && health.currentHealth <= 0) {
        // Handle death
      }
    }
  }
}
```

### Traditional OOP vs ECS

**Traditional OOP (Inheritance Tree)**
```
Entity
├── LivingEntity
│   ├── Player
│   │   ├── Mage
│   │   └── Warrior
│   └── Enemy
│       ├── Orc
│       └── Dragon
└── Item
```

**Problems:**
- Code duplication (Mage and Warrior both need different abilities)
- Rigid hierarchy (can't mix features)
- Difficult to change behavior at runtime

**ECS (Composition)**
```
Player Entity:
  ├── Transform
  ├── Health
  ├── Renderer
  ├── Mage Abilities
  └── Input Controller

Enemy Entity:
  ├── Transform
  ├── Health
  ├── Renderer
  ├── AI Controller
  └── Damage on Collision
```

**Benefits:**
- Flexible composition
- No code duplication
- Easy to create variations
- Behavior can be added/removed at runtime

### ECS Example: Player with Multiple Behaviors

```typescript
// Create player entity
const player = scene.createEntity('Player');

// Add components for different behaviors
player.addComponent(new Transform());       // Position/rotation
player.addComponent(new Health(100));       // Health system
player.addComponent(new Physics());         // Movement and gravity
player.addComponent(new InputController()); // Responds to input
player.addComponent(new Renderer());        // Renders to screen
player.addComponent(new Animation());       // Handles animation
player.addComponent(new Audio());           // Plays sounds
player.addComponent(new Inventory());       // Carries items

// Same player, but different composition = different behavior
```

### Data Flow in ECS

```
Input System
    ↓
    → Updates InputComponent on Player
    ↓
Physics System
    ↓
    → Updates Transform based on Physics
    ↓
Collision System
    ↓
    → Updates Health if collision with hazard
    ↓
Renderer System
    ↓
    → Draws all Renderers at current Transform
```

### Component Communication

Components on the same entity communicate:

```typescript
class PlayerController extends Component {
  onUpdate(deltaTime: number) {
    const input = this.entity.getComponent(InputComponent);
    const physics = this.entity.getComponent(Physics);
    
    if (input.isKeyPressed('Space')) {
      physics.applyForce(Vec3.up().mul(100));
    }
  }
}
```

### Scene Graph vs ECS

**Scene Graphs** (transform hierarchies):
```
Root
├── Player
│   ├── Head
│   ├── Body
│   ├── LeftArm
│   └── RightArm
└── Weapon
    ├── Blade
    └── Handle
```

**ECS maintains relationships** but separately from components:
```typescript
// In our framework, setParent maintains hierarchy
child.transform.setParent(parent.transform);
```

---

## Graphics & Rendering

### Rendering Pipeline

```
3D Model Data
    ↓
Vertex Shader (processes each vertex)
    ↓
Rasterization (converts triangles to pixels)
    ↓
Fragment Shader (processes each pixel)
    ↓
Output (rendered frame on screen)
```

### Shaders

Shaders are programs that run on the GPU:

**Vertex Shader**: Transforms vertex positions
```glsl
// Input: vertex position
// Output: transformed position on screen
vec4 vertexShader(vec3 position, mat4 transform) {
  return transform * vec4(position, 1.0);
}
```

**Fragment Shader**: Determines pixel color
```glsl
// Input: pixel position
// Output: pixel color
vec4 fragmentShader(vec3 position) {
  return vec4(1.0, 0.5, 0.3, 1.0);  // Orange color
}
```

### Materials

A material combines:
- **Geometry**: What shape to render
- **Shader**: How to render it
- **Uniforms**: Constants used by shader (colors, textures, etc.)

```typescript
const material = new Material(BasicShader, {
  color: new Vec4(1, 0, 0, 1),        // Red
  ambient: 0.3,                        // Ambient lighting amount
  diffuse: 0.7,                        // Diffuse lighting amount
  specular: 0.5,                       // Shiny reflection
  shininess: 32                        // Shine strength
});
```

### Lighting Models

**Ambient Lighting**: Overall light level
```
final_color = baseColor * ambientLight
```

**Diffuse Lighting**: Light scattered from rough surfaces
```
final_color = baseColor * max(0, dot(normal, lightDir))
```

**Specular Lighting**: Shiny reflections
```
specular = pow(max(0, dot(viewDir, reflectDir)), shininess)
```

**Combined (Phong Shading):**
```
final_color = baseColor * (ambient + diffuse * shadowness)
            + lightColor * specular
```

### Coordinates Spaces

Understanding coordinate spaces is crucial:

1. **Local Space**: Relative to the object
2. **World Space**: Relative to the game world
3. **View Space**: Relative to the camera
4. **Screen Space**: Relative to the screen (2D)

```typescript
// Transformations between spaces
worldPos = localToWorldMatrix * localPos
viewPos = viewMatrix * worldPos
screenPos = projectionMatrix * viewPos
```

---

## User Interaction & Input

### Input Types

**Discrete Input**: On/off states
```typescript
const isKeyPressed = input.isKeyPressed('KeyW');    // true or false
const isMouseDown = input.isMouseButtonDown(MouseButton.Left);
```

**Continuous Input**: Values over time
```typescript
const mouseDelta = input.getMouseDelta();   // (x: number, y: number)
const mousePos = input.getMousePosition();  // (x: number, y: number)
```

### Input Processing

```
Raw Input
    ↓
Normalize (map to game actions)
    ↓
Update Game State
    ↓
Effects
```

### Example: Movement System

```typescript
class MovementController extends Component {
  private speed = 5;

  onUpdate(deltaTime: number) {
    const input = this.getInputSystem();
    const physics = this.entity.getComponent(Physics);

    // Read input
    let moveDirection = Vec3.zero();
    if (input.isKeyPressed('KeyW')) moveDirection.z -= 1;
    if (input.isKeyPressed('KeyS')) moveDirection.z += 1;
    if (input.isKeyPressed('KeyA')) moveDirection.x -= 1;
    if (input.isKeyPressed('KeyD')) moveDirection.x += 1;

    // Normalize direction
    if (moveDirection.lengthSquared() > 0) {
      moveDirection = moveDirection.normalize();
    }

    // Apply movement
    const velocity = moveDirection.mul(this.speed);
    physics.setVelocity(velocity);
  }
}
```

### Example: Mouse Look

```typescript
class CameraController extends Component {
  private pitch = 0;
  private yaw = 0;
  private sensitivity = 0.003;

  onUpdate(deltaTime: number) {
    const input = this.getInputSystem();

    if (input.isPointerLocked()) {
      const delta = input.getMouseDelta();
      
      this.yaw -= delta.x * this.sensitivity;
      this.pitch -= delta.y * this.sensitivity;
      
      // Clamp pitch to avoid flipping
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));

      // Apply rotation
      this.entity.transform.rotation = Quat.fromEuler(
        this.pitch, this.yaw, 0
      );
    }
  }
}
```

### Pointer Lock (Full Screen Control)

Fullscreen input control for games:

```typescript
// Request pointer lock
input.requestPointerLock();

// While locked:
// - Cursor is hidden
// - Mouse moves infinitely (no bounds)
// - Mouse delta values are perfect for camera control

// Check lock status
if (input.isPointerLocked()) {
  const delta = input.getMouseDelta();
  rotateCamera(delta);
}

// Exit pointer lock
input.exitPointerLock();
```

---

## Game Scenes & State

### Scene Management

A **scene** is a collection of entities (level, menu, loading screen):

```typescript
// Create scenes
const mainMenuScene = new Scene('MainMenu');
const levelScene = new Scene('Level1');
const pauseScene = new Scene('PauseScene');

// Switch scenes
engine.setScene(levelScene);
```

### State Machines

Games have states - track and handle state transitions:

```typescript
enum GameState {
  Menu,
  Playing,
  Paused,
  GameOver
}

class GameManager {
  private currentState = GameState.Menu;

  update() {
    switch (this.currentState) {
      case GameState.Menu:
        this.updateMenu();
        break;
      case GameState.Playing:
        this.updateGameplay();
        break;
      case GameState.Paused:
        this.updatePausedMenu();
        break;
    }
  }

  setState(newState: GameState) {
    this.onStateExit(this.currentState);
    this.currentState = newState;
    this.onStateEnter(newState);
  }
}
```

### Object Pooling

Reuse objects instead of creating/destroying them:

```typescript
class BulletPool {
  private pool: Bullet[] = [];
  private active: Bullet[] = [];

  getBullet(): Bullet {
    let bullet: Bullet;
    if (this.pool.length > 0) {
      bullet = this.pool.pop()!;
    } else {
      bullet = new Bullet();
    }
    this.active.push(bullet);
    return bullet;
  }

  returnBullet(bullet: Bullet) {
    this.active.splice(this.active.indexOf(bullet), 1);
    this.pool.push(bullet);
  }

  updateAll(deltaTime: number) {
    for (const bullet of this.active) {
      bullet.update(deltaTime);
      if (bullet.isDead()) {
        this.returnBullet(bullet);
      }
    }
  }
}
```

---

## Performance Optimization

### Profiling First

Always profile before optimizing - don't guess!

```typescript
// Measure frame time
const startTime = performance.now();
// ... code to measure ...
const endTime = performance.now();
console.log(`Took ${endTime - startTime}ms`);
```

### Common Performance Issues

**1. Too many draw calls**
```typescript
// Bad: 1000 separate draw calls
for (const entity of entities) {
  renderer.drawEntity(entity);
}

// Better: Batch similar objects
const meshGroups = groupByMesh(entities);
for (const group of meshGroups) {
  renderer.drawInstances(group);
}
```

**2. Unnecessary updates**
```typescript
// Bad: Update everything every frame
for (const entity of entities) {
  entity.update(deltaTime);
}

// Better: Only update active entities
for (const entity of activeEntities) {
  entity.update(deltaTime);
}
```

**3. Memory allocations**
```typescript
// Bad: Creates new vec3 every frame
for (let i = 0; i < 1000; i++) {
  const pos = entity[i].transform.position.add(new Vec3(1, 0, 0));
}

// Better: Reuse temporary
const tempVec = new Vec3();
for (let i = 0; i < 1000; i++) {
  tempVec.set(1, 0, 0);
  entity[i].transform.position.add(tempVec);
}
```

**4. Expensive calculations**
```typescript
// Bad: Distance calculated every frame (sqrt is expensive)
if (player.distance(enemy) < 10) { }

// Better: Use squared distance
if (player.distanceSquared(enemy) < 100) { }
```

### Optimization Techniques

**Level of Detail (LOD)**
```typescript
// Render detailed geometry when close
const distance = camera.distance(entity);
if (distance < 10) {
  renderer.setMesh(detailedMesh);
} else if (distance < 100) {
  renderer.setMesh(mediumMesh);
} else {
  renderer.setMesh(simpleMesh);
}
```

**Frustum Culling**
```typescript
// Don't render objects outside camera view
for (const entity of entities) {
  if (camera.frustum.contains(entity.bounds)) {
    renderer.render(entity);
  }
}
```

**Spatial Indexing**
```typescript
// Find nearby objects quickly
const quadtree = new Quadtree();
for (const entity of entities) {
  quadtree.insert(entity);
}

// Query nearby
const nearby = quadtree.query(region);
```

---

## Common Game Patterns

### Behavior Trees

Hierarchical decision making:

```typescript
interface BehaviorNode {
  execute(): 'success' | 'failure' | 'running';
}

class Sequence implements BehaviorNode {
  children: BehaviorNode[];
  currentIndex = 0;

  execute() {
    while (this.currentIndex < this.children.length) {
      const result = this.children[this.currentIndex].execute();
      if (result !== 'success') {
        return result;
      }
      this.currentIndex++;
    }
    return 'success';
  }
}

class Selector implements BehaviorNode {
  children: BehaviorNode[];

  execute() {
    for (const child of this.children) {
      if (child.execute() === 'success') {
        return 'success';
      }
    }
    return 'failure';
  }
}

// Usage: AI patrol, then attack if player nearby
const aiTree = new Sequence([
  new Patrol(),
  new Selector([
    new AttackIfPlayerNearby(),
    new ReturnToPatrolPath()
  ])
]);
```

### Finite State Machines

Simple state management:

```typescript
interface State {
  onEnter?(): void;
  onUpdate(deltaTime: number): void;
  onExit?(): void;
}

class PlayerIdleState implements State {
  onEnter() { console.log('Idle'); }
  onUpdate() { /* ... */ }
}

class PlayerRunState implements State {
  onEnter() { console.log('Running'); }
  onUpdate() { /* ... */ }
}

class StateMachine {
  private currentState: State | null = null;

  setState(newState: State) {
    this.currentState?.onExit?.();
    this.currentState = newState;
    newState.onEnter?.();
  }

  update(deltaTime: number) {
    this.currentState?.onUpdate(deltaTime);
  }
}
```

### Observer Pattern

Loose coupling with events:

```typescript
class EventBus {
  private listeners: Map<string, Function[]> = new Map();

  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
}

// Usage
const eventBus = new EventBus();
eventBus.subscribe('playerDamaged', (damage) => {
  UISystem.updateHealth(damage);
});

// Later
eventBus.emit('playerDamaged', { amount: 10 });
```

### Tweening (Smooth Animation)

Interpolate values over time:

```typescript
class Tween {
  private elapsed = 0;

  constructor(
    private from: number,
    private to: number,
    private duration: number,
    private onUpdate: (value: number) => void
  ) {}

  update(deltaTime: number) {
    this.elapsed += deltaTime;
    const progress = Math.min(this.elapsed / this.duration, 1);
    
    // Linear interpolation
    const value = this.from + (this.to - this.from) * progress;
    this.onUpdate(value);

    return progress === 1;  // Finished?
  }
}

// Usage: Fade out over 2 seconds
const tween = new Tween(1, 0, 2, (alpha) => {
  entity.setOpacity(alpha);
});
```

---

## Debugging & Testing

### Debug Rendering

Visualize invisible systems:

```typescript
class DebugRenderer {
  renderBounds(entity: Entity) {
    // Draw bounding box around entity
  }

  renderColliders(entity: Entity) {
    // Draw collision shapes
  }

  renderPhysicsVectors(entity: Entity) {
    // Draw velocity and acceleration vectors
  }

  renderHierarchy(entity: Entity, depth = 0) {
    // Draw parent-child relationships
  }
}
```

### Logging Strategies

```typescript
// Level-based logging
enum LogLevel { Error, Warn, Info, Debug }

class Logger {
  log(level: LogLevel, message: string) {
    if (level <= LogLevel.Warn) {
      console.error(message);
    }
  }
}

// Context-based logging
logger.info('Player', 'Health increased to 100');
logger.info('Physics', 'Collision detected between A and B');
logger.info('Rendering', 'Frame time: 16.67ms');
```

### Common Debugging Issues

**Issue: Nothing renders**
1. Camera exists and has position?
2. Geometry is set on renderer?
3. Material is set on renderer?
4. Renderer is initialized?

**Issue: Jittery movement**
1. Using deltaTime?
2. Frame rate consistent?
3. Physics updates between rendering?

**Issue: Memory leak**
1. Entities being destroyed when no longer used?
2. Event listeners being removed?
3. Textures being unloaded?

### Unit Testing Game Code

```typescript
// Test component behavior
describe('HealthComponent', () => {
  it('should reduce health when damaged', () => {
    const health = new HealthComponent();
    health.currentHealth = 100;
    health.takeDamage(25);
    expect(health.currentHealth).toBe(75);
  });

  it('should not go below zero', () => {
    const health = new HealthComponent();
    health.currentHealth = 10;
    health.takeDamage(50);
    expect(health.currentHealth).toBe(0);
  });
});

// Test math utilities
describe('Vec3', () => {
  it('should calculate distance correctly', () => {
    const a = new Vec3(0, 0, 0);
    const b = new Vec3(3, 4, 0);
    expect(a.distance(b)).toBe(5);
  });
});
```

---

## Summary: The Grand Picture

Modern game development is about:

1. **Architecture**: Using ECS and systems thinking
2. **Mathematics**: Understanding vectors, matrices, and transforms
3. **Graphics**: Rendering via shaders and materials
4. **Input**: Responding to user interaction
5. **Performance**: Profiling and optimizing the right things
6. **Patterns**: Using proven design patterns
7. **Debugging**: Visualizing and testing

These fundamentals apply whether you're building a WebGPU game, using Unity, Unreal, or any other engine.

---

## Next Steps

1. **Study Rendr**: Review the USER_GUIDE.md to see these concepts applied
2. **Build Small Projects**: Create simple games to reinforce concepts
3. **Study Other Engines**: Compare frameworks to deepen understanding
4. **Join Communities**: Learn from other developers and share knowledge

---

## Resources

### 3D Math
- [Essential Mathematics for Games](https://www.mathcentre.ac.uk/)
- [Khan Academy - Linear Algebra](https://www.khanacademy.org/math/linear-algebra)

### Game Development
- [Game Programming Patterns](https://gameprogrammingpatterns.com/)
- [Real-Time Rendering](https://www.realtimerendering.com/)

### WebGPU
- [WebGPU Specification](https://gpuweb.github.io/gpuweb/)
- [MDN WebGPU Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)

### Performance
- [High-Performance JavaScript](https://www.oreilly.com/library/view/high-performance-javascript/9781449338702/)

