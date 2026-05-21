import { Component } from '../core/Component';
import { Vec3 } from '../math/Vec3';

export class RigidBody extends Component {
  public velocity: Vec3 = Vec3.zero();
  public mass: number = 1;
  public drag: number = 0.1;
  public useGravity: boolean = true;
  public gravityScale: number = 1;
  public isKinematic: boolean = false;

  protected static readonly GRAVITY = -9.81;
  protected accumulatedForce: Vec3 = Vec3.zero();

  applyForce(force: Vec3): void {
    this.accumulatedForce = this.accumulatedForce.add(force);
  }

  applyImpulse(impulse: Vec3): void {
    this.velocity = this.velocity.add(impulse.div(this.mass));
  }

  onFixedUpdate(dt: number): void {
    if (this.isKinematic || !this.entity) return;

    const transform = this.entity.transform;

    if (this.useGravity) {
      this.accumulatedForce = this.accumulatedForce.add(
        new Vec3(0, RigidBody.GRAVITY * this.gravityScale * this.mass, 0)
      );
    }

    const accel = this.accumulatedForce.div(this.mass);
    this.velocity = this.velocity.add(accel.mul(dt));
    this.velocity = this.velocity.mul(1 / (1 + this.drag * dt));
    transform.position = transform.position.add(this.velocity.mul(dt));

    this.accumulatedForce = Vec3.zero();
  }
}
