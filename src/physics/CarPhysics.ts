import { Vec3 } from '../math/Vec3';
import { Quat } from '../math/Quat';
import { RigidBody } from './RigidBody';

export class CarPhysics extends RigidBody {
  // Tuning
  public engineForce: number = 15;       // m/s² at full throttle
  public brakeForce: number = 25;        // m/s² braking deceleration
  public maxSpeed: number = 20;          // m/s forward
  public maxReverseSpeed: number = 8;    // m/s reverse
  public lateralFriction: number = 10;   // sideways velocity damping rate
  public rollingFriction: number = 2;    // forward deceleration with no throttle input
  public steeringSpeed: number = 1.8;    // max yaw rate (rad/s) at full speed
  public groundY: number = 0;

  // Inputs — set each frame by a controller component
  public throttleInput: number = 0;   // -1 (reverse) to 1 (forward)
  public brakeInput: number = 0;      // 0 to 1
  public steeringInput: number = 0;   // -1 (left) to 1 (right)

  constructor() {
    super();
    this.useGravity = false; // grounded via constraint, not gravity
    this.drag = 1.5;         // air resistance
  }

  get speed(): number {
    return this.velocity.length();
  }

  get forwardSpeed(): number {
    if (!this.entity) return 0;
    return this.velocity.dot(this.entity.transform.getForward());
  }

  override onFixedUpdate(dt: number): void {
    if (this.isKinematic || !this.entity) return;

    const transform = this.entity.transform;
    const forward = transform.getForward();
    const right = transform.getRight();
    const fwdSpeed = this.velocity.dot(forward);

    // Consume any externally applied forces (e.g. collision impulses)
    if (this.accumulatedForce.lengthSquared() > 0) {
      this.velocity = this.velocity.add(this.accumulatedForce.div(this.mass).mul(dt));
      this.accumulatedForce = Vec3.zero();
    }

    // --- Longitudinal dynamics ---
    let longAccel = 0;
    if (this.brakeInput > 0.01) {
      // Braking opposes current forward motion
      longAccel = -Math.sign(fwdSpeed) * this.brakeForce * this.brakeInput;
    } else if (Math.abs(this.throttleInput) > 0.01) {
      if (this.throttleInput > 0 && fwdSpeed < this.maxSpeed) {
        longAccel = this.throttleInput * this.engineForce;
      } else if (this.throttleInput < 0 && fwdSpeed > -this.maxReverseSpeed) {
        longAccel = this.throttleInput * this.engineForce;
      }
    } else {
      // Rolling friction — gentle deceleration when no input
      longAccel = -fwdSpeed * this.rollingFriction;
    }
    this.velocity = this.velocity.add(forward.mul(longAccel * dt));

    // --- Lateral friction (prevent sideways sliding) ---
    const lateralSpeed = this.velocity.dot(right);
    const lateralDamp = Math.min(this.lateralFriction * dt, 1.0);
    this.velocity = this.velocity.sub(right.mul(lateralSpeed * lateralDamp));

    // --- Air drag ---
    this.velocity = this.velocity.mul(1 / (1 + this.drag * dt));

    // --- Steering ---
    // Yaw rate scales with speed so the car doesn't spin on the spot.
    // Negated: positive rotation around +Y is CCW from above; we want D = clockwise = right.
    const speedFraction = Math.min(Math.abs(fwdSpeed) / this.maxSpeed, 1.0);
    const yawRate = -this.steeringInput * this.steeringSpeed * speedFraction;
    // Invert yaw direction when reversing so steering feels natural
    const yawDelta = yawRate * dt * (fwdSpeed < 0 ? -1 : 1);
    if (Math.abs(yawDelta) > 0.0001) {
      const steerQuat = Quat.fromAxisAngle(Vec3.up(), yawDelta);
      transform.rotation = steerQuat.multiply(transform.rotation).normalize();
    }

    // --- Integrate position, clamp to ground plane ---
    const newPos = transform.position.add(this.velocity.mul(dt));
    transform.position = new Vec3(newPos.x, this.groundY, newPos.z);
  }
}
