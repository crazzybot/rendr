---
description: Quick API reference for the Rendr WebGPU game framework. Covers all modules: math, core ECS, components, rendering, physics, input, resources.
---

Summarize or look up the requested part of the Rendr framework API: $ARGUMENTS

Use this reference to answer accurately. Do not fabricate methods or fields — the full API surface is listed below.

---

# Rendr Framework — Complete API Reference

## Coordinate system
Right-handed. **Forward = -Z**, Right = +X, Up = +Y. Matrices are column-major Float32Array.  
WebGPU depth range [0, 1]. Counter-clockwise winding = front face.

---

## Math

### Vec3
```ts
new Vec3(x?, y?, z?)          // defaults: 0,0,0
Vec3.zero() / .one() / .up()  // (0,0,0) / (1,1,1) / (0,1,0)
Vec3.forward()                // (0,0,-1)
Vec3.right()                  // (1,0,0)

v.add(v2)   v.sub(v2)   v.mul(s)   v.div(s)    // all return new Vec3
v.dot(v2)   v.cross(v2) v.length() v.lengthSquared()
v.normalize()               // safe — returns zero if length=0
v.distance(v2)  v.lerp(v2, t)  v.clone()
v.set(x,y,z)    v.copy(v2)     // mutating, chainable
v.toArray()     v.toFloat32Array()
```

### Vec4
```ts
new Vec4(x?, y?, z?, w?)      // defaults: 0,0,0,1  ← w=1 default
Vec4.zero()                   // (0,0,0,0)
v.set(x,y,z,w)  v.clone()  v.copy(v2)
v.toArray()     v.toFloat32Array()
```

### Quat
```ts
new Quat(x?, y?, z?, w?)      // defaults: 0,0,0,1 (identity)
Quat.identity()
Quat.fromAxisAngle(axis: Vec3, angle: number)   // angle in radians
Quat.fromEuler(x, y, z)                         // radians, roll-pitch-yaw

q.multiply(q2)     // combines rotations, returns new Quat
q.normalize()      // safe — returns identity if zero
q.conjugate()      // (-x,-y,-z, w)
q.slerp(q2, t)     // spherical lerp; linear lerp for very close quats
q.toEuler(): Vec3  // [roll, pitch, yaw] radians
q.clone()  q.copy(q2)
```

### Mat4
```ts
new Mat4(elements?)                  // 16-element Float32Array, column-major
Mat4.identity()
Mat4.translation(v: Vec3)
Mat4.rotationX/Y/Z(angle)           // radians
Mat4.scale(v: Vec3)
Mat4.fromRotationTranslationScale(q, t, s)  // efficient TRS
Mat4.perspective(fov, aspect, near, far)    // WebGPU [0,1] depth
Mat4.orthographic(l, r, b, top, near, far)
Mat4.lookAt(eye, target, up)               // view matrix

m.multiply(m2)         // new Mat4
m.transform(v: Vec3)   // homogeneous transform → Vec3
m.invert(): Mat4|null  // null if singular
m.transpose(): Mat4
m.clone()  m.copy(m2)
m.elements: Float32Array  // column-major [col0_row0, col0_row1, ...]
```

---

## Core ECS

### Component (abstract base)
```ts
entity: Entity | null   // set when added to entity
enabled: boolean        // false → onUpdate/onFixedUpdate skipped

// Optional lifecycle (implement any subset):
onAttach?(): void
onDetach?(): void
onUpdate?(dt: number): void        // dt = seconds since last frame
onFixedUpdate?(dt: number): void   // dt = fixedTimestep (default 1/60s)
onDestroy?(): void
```

### Transform (extends Component, built into every Entity)
```ts
// Properties (setters mark dirty and propagate to children):
position: Vec3   rotation: Quat   scale: Vec3
parent: Transform | null
children: Transform[]

getWorldMatrix(): Mat4    getLocalMatrix(): Mat4
setParent(parent: Transform | null): void
translate(offset: Vec3): void
rotate(q: Quat): void
lookAt(target: Vec3, up?: Vec3): void

getForward(): Vec3   // world -Z axis of this transform
getRight(): Vec3     // world +X axis
getUp(): Vec3        // world +Y axis
```

### Entity
```ts
new Entity(name?)
name: string    active: boolean    scene: Scene|null
transform: Transform   // always present

addComponent<T>(c: T): T
getComponent<T>(Type): T|null          // first component of that type
getComponentsOfType<T>(Type): T[]
getComponents(): Component[]
removeComponent<T>(Type): void
hasComponent<T>(Type): boolean
destroy(): void
```

**Gotcha:** component lookup uses `constructor.name` — avoid minification that renames classes.

### Scene
```ts
new Scene(name?)
createEntity(name?): Entity         // creates + adds to scene
addEntity(e): void   removeEntity(e): void
getEntity(name): Entity|null
getEntities(): Entity[]
findEntitiesWithComponent<T>(Type): Entity[]
update(dt): void   fixedUpdate(dt): void   clear(): void
```

### Engine
```ts
new Engine({ canvas, width?, height?, antialias?, fixedTimestep? })
await engine.initialize()   // must call before start
engine.setScene(scene)
engine.start()    engine.stop()    engine.destroy()
engine.resize(w, h)
engine.getRenderer(): Renderer
engine.getInput(): InputManager
engine.getScene(): Scene|null
```
Loop: accumulator-based fixed timestep. Max frame dt clamped to 0.1s.

---

## Components

### Camera
```ts
new Camera()
setPerspective(fov, aspect, near, far): void
setOrthographic(l, r, b, top, near, far): void
setAspect(aspect): void
getProjectionMatrix(): Mat4
getViewMatrix(): Mat4
getViewProjectionMatrix(): Mat4
screenToWorld(sx, sy, sz): Vec3
```

### MeshRenderer
```ts
new MeshRenderer()
setMesh(mesh: Mesh): void
setMaterial(mat: Material): void
initialize(device: GPUDevice, format: GPUTextureFormat): void   // must call before render
isInitialized(): boolean
render(pass, camera, light?): void
```
**The Renderer collects all entities with MeshRenderer from the scene, so each entity with a MeshRenderer must be added to the scene.**

### DirectionalLight
```ts
new DirectionalLight(color?: Vec4, intensity?: number)
color: Vec4    intensity: number
getDirection(): Vec3    // entity forward * -1
getFinalColor(): Vec4   // color * intensity
```

---

## Rendering

### Geometry (all static, return Mesh)
```ts
Geometry.createCube(size?)
Geometry.createSphere(radius?, segments?, rings?)
Geometry.createPlane(width?, height?, segmentsX?, segmentsY?)
Geometry.createCylinder(radius?, height?, segments?)
Geometry.createCarBody(scale?)   // body + cabin, no wheels
Geometry.createCar(scale?)       // body + cabin + 4 wheels (single mesh)
```
All use CCW winding, include positions + normals + UVs.

### Mesh
```ts
new Mesh({ positions, normals?, uvs?, colors?, indices? })
createBuffers(device): void       // call once before rendering
getVertexBufferLayout(): GPUVertexBufferLayout
destroy(): void
vertexBuffer: GPUBuffer|null
indexBuffer: GPUBuffer|null
indexCount: number
```
Vertex data is interleaved in one buffer. Uint16Array indices if <65536 verts.

### Material
```ts
new Material(shaderSource?, {
  color?: Vec4,        // default white
  ambient?: number,    // default 0.2
  diffuse?: number,    // default 0.8
  specular?: number,   // default 0.5
  shininess?: number   // default 32
})
createPipeline(device, format, vertexLayout): void
updateUniforms(device, modelMat, vpMat, normalMat?): void
updateLightUniforms(device, lightDir, lightColor, camPos): void
setColor(c: Vec4): void
getPipeline() / getBindGroup()
destroy(): void
```

**Built-in shaders (import from src/index):**
- `undefined` / `BasicShader` — Phong lighting (ambient + diffuse + specular)
- `UnlitShader` — flat color, no lighting calculations

### MeshLoader
```ts
await MeshLoader.loadOBJ(url: string): Promise<Mesh>
MeshLoader.parseOBJ(text: string): Mesh
```

---

## Physics

### RigidBody (extends Component)
```ts
velocity: Vec3   mass: number = 1   drag: number = 0.1
useGravity: boolean = true   gravityScale: number = 1
isKinematic: boolean = false

applyForce(f: Vec3): void    // applied next fixedUpdate
applyImpulse(i: Vec3): void  // instant velocity change
```

### CarPhysics (extends RigidBody)
```ts
// Tuning:
engineForce: number = 15     // m/s² at full throttle
brakeForce: number = 25      // m/s² deceleration
maxSpeed: number = 20        // m/s forward cap
maxReverseSpeed: number = 8
lateralFriction: number = 10 // sideways damping rate
rollingFriction: number = 1  // coast deceleration
steeringSpeed: number = 1.8  // max yaw rate (rad/s)
groundY: number = 0          // ground plane Y

// Inputs (set by controller each frame):
throttleInput: number   // -1 to 1
brakeInput: number      // 0 to 1
steeringInput: number   // -1 (left) to 1 (right)

// Derived:
speed: number           // velocity magnitude
forwardSpeed: number    // velocity dot forward

// Uses useGravity=false, drag=0.3. Position clamped to groundY each frame.
```

---

## Input

### InputManager (get via engine.getInput())
```ts
// Key state (code = KeyboardEvent.code, e.g. 'KeyW', 'Space', 'ArrowUp'):
isKeyPressed(code): boolean  // held
isKeyDown(code): boolean     // pressed this frame
isKeyUp(code): boolean       // released this frame

// Mouse buttons (MouseButton.Left=0, Middle=1, Right=2):
isMouseButtonPressed(btn): boolean
isMouseButtonDown(btn): boolean
isMouseButtonUp(btn): boolean

// Mouse position / movement:
getMousePosition(): Vec3   // canvas coords, z=0
getMouseDelta(): Vec3      // movement this frame, z=0

// Wheel:
getMouseWheel(): number    // deltaY this frame (cleared each frame)

// Pointer lock:
requestPointerLock(): void
exitPointerLock(): void
isPointerLocked(): boolean
```

---

## Resources (singleton cache)

```ts
const rm = ResourceManager.getInstance()
rm.registerMesh(name, mesh)      rm.getMesh(name): Mesh|null
rm.registerMaterial(name, mat)   rm.getMaterial(name): Material|null
rm.registerShader(name, shader)  rm.getShader(name): Shader|null
rm.unregisterMesh/Material/Shader(name): void   // also destroys
rm.clear(): void
```

---

## Typical scene setup pattern
```ts
const engine = new Engine({ canvas, width, height, antialias: true });
await engine.initialize();
const scene = new Scene('MyScene');
engine.setScene(scene);
const device = engine.getRenderer().getDevice()!;
const format = engine.getRenderer().getFormat();

// Camera (required for rendering)
const camEntity = scene.createEntity('Camera');
const camera = new Camera();
camera.setPerspective(Math.PI / 3, innerWidth / innerHeight, 0.1, 500);
camEntity.addComponent(camera);

// Light (optional; objects render unlit without one)
const lightEntity = scene.createEntity('Light');
lightEntity.addComponent(new DirectionalLight(new Vec4(1,1,1,1), 1.0));
lightEntity.transform.rotation = Quat.fromEuler(-Math.PI/4, Math.PI/6, 0);

// Renderable entity
const box = scene.createEntity('Box');
const mr = new MeshRenderer();
mr.setMesh(Geometry.createCube(1));
mr.setMaterial(new Material(undefined, { color: new Vec4(0.8,0.2,0.2,1) }));
box.addComponent(mr);
mr.initialize(device, format);  // ← required before engine.start()

engine.start();
```

## Important constraints
- Call `mr.initialize(device, format)` on every MeshRenderer **before** `engine.start()`
- Each `Material` instance has its own GPU uniform buffers — **do not share** a Material across multiple MeshRenderers
- Transform `position`/`rotation`/`scale` setters mark the dirty flag and cascade to children
- `setParent()` does not convert the local position to world — set local position explicitly after parenting
- `getComponent()` returns the **first** component of that type; use `getComponentsOfType()` for multiples
- The Renderer finds the first `Camera` and first `DirectionalLight` in the scene; add exactly one of each per scene
