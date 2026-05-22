---
description: Adds a renderable entity to an existing Rendr scene. Pass a description of what to add. Example: /rendr-add-entity red spinning cube at position (5, 1, -3)
---

Add a renderable entity to the Rendr scene as described: $ARGUMENTS

Read the target scene file first to understand the existing `scene`, `device`, `format` variables, then insert the new entity code at the appropriate location (after obstacles/ground, before camera setup, or wherever it fits contextually).

## Pattern for a renderable entity
```ts
const myEntity = scene.createEntity('MyEntity');

// Geometry — pick one:
const mesh = Geometry.createCube(1);
const mesh = Geometry.createSphere(0.5, 16, 8);
const mesh = Geometry.createPlane(10, 10);
const mesh = Geometry.createCylinder(0.4, 1.0, 16);

// Material
const mat = new Material(undefined, {          // undefined = BasicShader (Phong)
  color: new Vec4(r, g, b, 1),
  ambient: 0.3,
  diffuse: 0.8,
  specular: 0.4,
  shininess: 32,
});
// For flat/unlit surfaces: new Material(UnlitShader, { color: ... })

// MeshRenderer — must call initialize before engine.start()
const renderer = new MeshRenderer();
renderer.setMesh(mesh);
renderer.setMaterial(mat);
myEntity.addComponent(renderer);
renderer.initialize(device, format);   // ← required

// Transform
myEntity.transform.position = new Vec3(x, y, z);
myEntity.transform.rotation = Quat.fromAxisAngle(Vec3.up(), angle);
myEntity.transform.scale = new Vec3(sx, sy, sz);
```

## Child entities (follow a parent)
```ts
childEntity.transform.setParent(parentEntity.transform);
// Set local position AFTER setParent — it stays local, not converted
childEntity.transform.position = new Vec3(localX, localY, localZ);
// childEntity must still be added to scene via scene.createEntity/addEntity
```

## Constraint reminders
- Every MeshRenderer needs its own Material instance (GPU uniform buffers are per-instance)
- `renderer.initialize(device, format)` must be called before `engine.start()`
- Y=0 is the ground plane; body bottom at Y=0.5 if using createCar geometry
- Scale applies to the mesh in local space; for a 2×1×4 box use `scale = new Vec3(2,1,4)` on a `createCube(1)`
