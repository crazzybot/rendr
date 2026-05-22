---
description: Adds or modifies physics on a Rendr entity. Covers RigidBody, CarPhysics, custom forces, and collision impulses. Example: /rendr-physics make the boxes bounce when hit
---

Add or modify physics for this scenario: $ARGUMENTS

## RigidBody — generic physics
```ts
import { RigidBody } from '../../src/index';

const rb = new RigidBody();
rb.mass = 1.0;
rb.drag = 0.1;           // velocity * (1 / (1 + drag*dt)) per frame
rb.useGravity = true;    // adds -9.81 m/s² on Y each fixedUpdate
rb.gravityScale = 1.0;
rb.isKinematic = false;  // true = ignores all forces (position driven manually)

entity.addComponent(rb);

// Apply forces from other components:
rb.applyForce(new Vec3(0, 100, 0));    // applied over the next fixedUpdate
rb.applyImpulse(new Vec3(0, 10, 0));   // instant velocity change
```

## CarPhysics — vehicle physics
```ts
import { CarPhysics } from '../../src/index';

const physics = new CarPhysics();
// Tuning (all public fields, change after construction):
physics.engineForce    = 15;   // m/s² at full throttle
physics.brakeForce     = 25;   // m/s² braking
physics.maxSpeed       = 20;   // m/s forward cap
physics.maxReverseSpeed = 8;
physics.lateralFriction = 10;  // sideways damping (prevents sliding)
physics.rollingFriction = 1;   // coast-to-stop rate
physics.steeringSpeed  = 1.8;  // max yaw rate (rad/s) at full speed
physics.groundY        = 0;    // ground plane Y (position clamped here)

entity.addComponent(physics);

// Each frame, a controller sets these inputs:
physics.throttleInput  = 1;   // -1 to 1
physics.brakeInput     = 0;   // 0 to 1
physics.steeringInput  = 0;   // -1 (left) to 1 (right)

// Read-only derived:
physics.speed          // velocity magnitude
physics.forwardSpeed   // velocity dot forward
```

## Custom controller component pattern
```ts
import { Component, CarPhysics, Engine } from '../../src/index';

export class MyController extends Component {
  constructor(private engine: Engine) { super(); }

  onUpdate(_dt: number): void {
    const input = this.engine.getInput();
    const physics = this.entity!.getComponent(CarPhysics)!;

    physics.throttleInput =
      (input.isKeyPressed('KeyW') ? 1 : 0) -
      (input.isKeyPressed('KeyS') ? 1 : 0);
    physics.brakeInput = input.isKeyPressed('Space') ? 1 : 0;
    physics.steeringInput =
      (input.isKeyPressed('KeyD') ? 1 : 0) -
      (input.isKeyPressed('KeyA') ? 1 : 0);
  }
}
```

## Custom physics component (extends Component directly)
```ts
import { Component, Vec3 } from '../../src/index';

export class Bobbing extends Component {
  private time = 0;
  private baseY = 0;
  public amplitude = 0.5;
  public frequency = 1.0;

  onAttach(): void {
    this.baseY = this.entity!.transform.position.y;
  }

  onFixedUpdate(dt: number): void {
    this.time += dt;
    const pos = this.entity!.transform.position;
    this.entity!.transform.position = new Vec3(
      pos.x,
      this.baseY + Math.sin(this.time * this.frequency * Math.PI * 2) * this.amplitude,
      pos.z
    );
  }
}
```

## Applying external forces to CarPhysics (e.g., collision)
```ts
// From another component that detected a collision:
const physics = carEntity.getComponent(CarPhysics)!;
const knockback = new Vec3(5, 2, 0);
physics.applyImpulse(knockback);
// CarPhysics consumes accumulatedForce in its onFixedUpdate
```

## Physics model notes
- **RigidBody** integration: `accel = force/mass`, `vel += accel*dt`, `vel *= 1/(1+drag*dt)`, `pos += vel*dt`
- **CarPhysics** overrides onFixedUpdate entirely (doesn't call RigidBody's). It clamps Y to `groundY` and adds lateral friction. `useGravity` is false.
- Steering yaw rate = `steeringInput * steeringSpeed * (|fwdSpeed| / maxSpeed)` — no spinning at zero speed
- Steering is inverted when reversing so controls feel natural
- Fixed timestep runs at `engine.fixedTimestep` (default 1/60s = 0.0167s). Multiple steps per frame if frame is slow.
