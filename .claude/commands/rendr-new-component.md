---
description: Creates a new Rendr framework Component class. Pass the component name and describe its behavior. Example: /rendr-new-component SpinComponent — rotates the entity around Y at a configurable speed
---

Create a new TypeScript Component class for the Rendr framework with this description: $ARGUMENTS

## Rules
- Extends `Component` from `../../src/index` (adjust relative path for file location)
- Only implement lifecycle hooks that are actually needed for the described behavior
- Use `this.entity!.transform` to read/mutate position/rotation/scale
- Access sibling components via `this.entity!.getComponent(SomeType)`
- No constructor parameters for data that should be public fields
- Do not add error handling for "entity is null" inside hooks — that case cannot occur if the component is attached

## Component lifecycle hooks (implement only what's needed)
```
onAttach(): void           // component was added to an entity
onDetach(): void           // component was removed
onUpdate(dt: number)       // called every frame (variable dt, seconds)
onFixedUpdate(dt: number)  // called at 60 Hz fixed timestep (dt ≈ 0.0167s)
onDestroy(): void          // entity.destroy() was called
```

## Frequently used APIs from the framework
```ts
// Transform
this.entity!.transform.position        // Vec3 get/set (setter marks dirty)
this.entity!.transform.rotation        // Quat get/set
this.entity!.transform.scale           // Vec3 get/set
this.entity!.transform.translate(v)    // adds offset
this.entity!.transform.rotate(q)       // applies rotation
this.entity!.transform.getForward()    // world -Z direction
this.entity!.transform.getRight()      // world +X direction

// Rotation helpers
Quat.fromAxisAngle(Vec3.up(), angle)   // rotate around Y
Quat.fromAxisAngle(new Vec3(1,0,0), angle)  // rotate around X

// Get sibling component
const physics = this.entity!.getComponent(CarPhysics)
```

## Template
```ts
import { Component, Vec3, Quat } from '../../src/index';

export class MyComponent extends Component {
  public someField: number = 1.0;

  onUpdate(dt: number): void {
    // frame logic here
  }
}
```

Place the file in the same directory as the closest demo or in `src/components/` if it's generic enough to be part of the framework.
After generating the file, show the full implementation and explain how to attach it to an entity.
