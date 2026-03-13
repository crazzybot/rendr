import { Vec3 } from './Vec3';

/**
 * A quaternion class for representing rotations in 3D space.
 * Quaternions are more efficient and stable for interpolating rotations compared to Euler angles or rotation matrices.
 */
export class Quat {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public z: number = 0,
    public w: number = 1
  ) {}

  static identity(): Quat {
    return new Quat(0, 0, 0, 1);
  }

  clone(): Quat {
    return new Quat(this.x, this.y, this.z, this.w);
  }

  copy(q: Quat): this {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  /**
   * Creates a quaternion from an axis and an angle (in radians).
   * @param axis The axis of rotation.
   * @param angle The angle of rotation (in radians).
   * @returns The resulting quaternion.
   */
  static fromAxisAngle(axis: Vec3, angle: number): Quat {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    return new Quat(
      axis.x * s,
      axis.y * s,
      axis.z * s,
      Math.cos(halfAngle)
    );
  }

  /**
   * Creates a quaternion from Euler angles (in radians).
   * @param x Roll (x-axis rotation)
   * @param y Pitch (y-axis rotation)
   * @param z Yaw (z-axis rotation)
   * @returns The resulting quaternion
   */
  static fromEuler(x: number, y: number, z: number): Quat {
    const cx = Math.cos(x / 2);
    const cy = Math.cos(y / 2);
    const cz = Math.cos(z / 2);
    const sx = Math.sin(x / 2);
    const sy = Math.sin(y / 2);
    const sz = Math.sin(z / 2);

    return new Quat(
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz
    );
  }

  /**
   * Multiplies this quaternion with another quaternion.
   * @param q The quaternion to multiply with.
   * @returns The resulting quaternion.
   */
  multiply(q: Quat): Quat {
    const ax = this.x, ay = this.y, az = this.z, aw = this.w;
    const bx = q.x, by = q.y, bz = q.z, bw = q.w;

    return new Quat(
      ax * bw + aw * bx + ay * bz - az * by,
      ay * bw + aw * by + az * bx - ax * bz,
      az * bw + aw * bz + ax * by - ay * bx,
      aw * bw - ax * bx - ay * by - az * bz
    );
  }

  /**
   * Normalizes the quaternion.
   * @returns The normalized quaternion.
   */
  normalize(): Quat {
    const len = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    if (len === 0) {
      return new Quat(0, 0, 0, 1);
    }
    return new Quat(this.x / len, this.y / len, this.z / len, this.w / len);
  }

  conjugate(): Quat {
    return new Quat(-this.x, -this.y, -this.z, this.w);
  }

  /**
   * Performs spherical linear interpolation between this quaternion and another.
   * @param q The quaternion to interpolate to.
   * @param t The interpolation parameter (0 to 1).
   * @returns The resulting quaternion.
   */
  slerp(q: Quat, t: number): Quat {
    let ax = this.x, ay = this.y, az = this.z, aw = this.w;
    let bx = q.x, by = q.y, bz = q.z, bw = q.w;

    let dot = ax * bx + ay * by + az * bz + aw * bw;

    if (dot < 0) {
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
      dot = -dot;
    }

    if (dot > 0.9995) {
      return new Quat(
        ax + t * (bx - ax),
        ay + t * (by - ay),
        az + t * (bz - az),
        aw + t * (bw - aw)
      ).normalize();
    }

    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    const ta = Math.sin((1 - t) * theta) / sinTheta;
    const tb = Math.sin(t * theta) / sinTheta;

    return new Quat(
      ax * ta + bx * tb,
      ay * ta + by * tb,
      az * ta + bz * tb,
      aw * ta + bw * tb
    );
  }

  /**
   * Converts the quaternion to Euler angles (in radians).
   * @returns The resulting Euler angles.
   */
  toEuler(): Vec3 {
    const x = this.x, y = this.y, z = this.z, w = this.w;

    const sinr_cosp = 2 * (w * x + y * z);
    const cosr_cosp = 1 - 2 * (x * x + y * y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp);

    const sinp = 2 * (w * y - z * x);
    const pitch = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);

    const siny_cosp = 2 * (w * z + x * y);
    const cosy_cosp = 1 - 2 * (y * y + z * z);
    const yaw = Math.atan2(siny_cosp, cosy_cosp);

    return new Vec3(roll, pitch, yaw);
  }
}
