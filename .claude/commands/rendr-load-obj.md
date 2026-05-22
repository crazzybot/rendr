---
description: Loads an OBJ file into a Rendr scene as a renderable entity. Pass the OBJ URL/path and optional material description. Example: /rendr-load-obj /assets/spaceship.obj — metallic blue material
---

Load an OBJ model and add it to the scene: $ARGUMENTS

## MeshLoader API
```ts
import { MeshLoader } from '../../src/index';

// Async fetch + parse:
const mesh = await MeshLoader.loadOBJ('/assets/model.obj');

// Or parse from a string you already have:
const mesh = MeshLoader.parseOBJ(objText);
```

## Full entity setup
```ts
// Call before engine.start(), or after if initializing dynamically:
const mesh = await MeshLoader.loadOBJ('/assets/model.obj');

const modelEntity = scene.createEntity('Model');
const renderer = new MeshRenderer();
renderer.setMesh(mesh);
renderer.setMaterial(new Material(undefined, {
  color: new Vec4(0.7, 0.7, 0.8, 1),
  ambient: 0.3,
  diffuse: 0.8,
  specular: 0.6,
  shininess: 32,
}));
modelEntity.addComponent(renderer);
renderer.initialize(device, format);

modelEntity.transform.position = new Vec3(0, 0, 0);
modelEntity.transform.scale    = new Vec3(1, 1, 1);
```

## Loading after engine.start() (async)
If the OBJ needs to be loaded after the engine is running, `initialize()` still works — it's idempotent on the Mesh side. Add the entity to the scene and it'll appear on the next render frame:

```ts
// Anywhere after engine.start():
const mesh = await MeshLoader.loadOBJ(url);
const entity = scene.createEntity('LateModel');
const renderer = new MeshRenderer();
renderer.setMesh(mesh);
renderer.setMaterial(new Material(undefined, { color: new Vec4(1,1,1,1) }));
entity.addComponent(renderer);
renderer.initialize(device, format);
// No special registration needed — scene already has the entity
```

## OBJ parsing notes
- Supported: `v` (positions), `vn` (normals), `vt` (UVs), `f` (faces using `v/vt/vn` syntax)
- Polygon faces are triangulated automatically
- Normals are generated if not present in the file (accumulated per vertex, then normalized)
- Duplicate vertices (same v/vt/vn combo) are deduplicated
- Uses Uint16Array indices if <65536 unique vertices; Uint32Array otherwise
- Materials from `.mtl` files are **not** parsed — apply a Material manually

## Coordinate system note
OBJ files use a right-handed coordinate system with Y-up — same as Rendr. No axis flip needed.
If a model appears upside down or facing the wrong way, use `transform.rotation`:
```ts
modelEntity.transform.rotation = Quat.fromAxisAngle(Vec3.up(), Math.PI); // flip 180°
```
