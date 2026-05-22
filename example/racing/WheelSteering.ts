import { Component, Transform, CarPhysics, Vec3, Quat } from '../../src/index';

export class WheelSteering extends Component {
  private frontLeft: Transform;
  private frontRight: Transform;
  private rearLeft: Transform;
  private rearRight: Transform;

  public maxAngle: number = Math.PI / 6; // 30° max wheel turn

  private steerAngle = 0;
  private rollAngle = 0;
  private readonly steerSpeed = 6.0;
  private readonly wheelRadius = 0.4;
  private readonly baseRot: Quat;

  constructor(fl: Transform, fr: Transform, rl: Transform, rr: Transform) {
    super();
    this.frontLeft = fl;
    this.frontRight = fr;
    this.rearLeft = rl;
    this.rearRight = rr;
    // Lay the Y-axis cylinder on its side so the axle runs along local X
    this.baseRot = Quat.fromAxisAngle(new Vec3(0, 0, 1), Math.PI / 2);
  }

  onUpdate(dt: number): void {
    const physics = this.entity!.getComponent(CarPhysics);
    if (!physics) return;

    // Smooth steering angle — steeringInput is discrete (-1/0/1 from keyboard)
    const targetSteer = -physics.steeringInput * this.maxAngle;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(this.steerSpeed * dt, 1.0);

    // Accumulate roll from forward speed
    this.rollAngle = (this.rollAngle + (physics.forwardSpeed / this.wheelRadius) * dt) % (Math.PI * 2);

    const rollRot = Quat.fromAxisAngle(new Vec3(1, 0, 0), this.rollAngle);
    const baseRollRot = rollRot.multiply(this.baseRot);

    const steerRot = Quat.fromAxisAngle(Vec3.up(), this.steerAngle);
    const frontRot = steerRot.multiply(baseRollRot);

    this.frontLeft.rotation = frontRot;
    this.frontRight.rotation = frontRot;
    this.rearLeft.rotation = baseRollRot;
    this.rearRight.rotation = baseRollRot;
  }
}
