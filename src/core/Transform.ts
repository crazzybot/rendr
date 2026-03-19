import { Component } from './Component';
import { Vec3, Quat, Mat4 } from '../math';

export class Transform extends Component {
  private _position: Vec3 = Vec3.zero();
  private _rotation: Quat = Quat.identity();
  private _scale: Vec3 = Vec3.one();
  private _worldMatrix: Mat4 = Mat4.identity();
  private _localMatrix: Mat4 = Mat4.identity();
  private _dirty: boolean = true;

  public parent: Transform | null = null;
  public children: Transform[] = [];

  get position(): Vec3 {
    return this._position;
  }

  set position(value: Vec3) {
    this._position = value;
    this.markDirty();
  }

  get rotation(): Quat {
    return this._rotation;
  }

  set rotation(value: Quat) {
    this._rotation = value;
    this.markDirty();
  }

  get scale(): Vec3 {
    return this._scale;
  }

  set scale(value: Vec3) {
    this._scale = value;
    this.markDirty();
  }

  private markDirty(): void {
    this._dirty = true;
    for (const child of this.children) {
      child.markDirty();
    }
  }

  getLocalMatrix(): Mat4 {
    if (this._dirty) {
      this._localMatrix = Mat4.fromRotationTranslationScale(
        this._rotation,
        this._position,
        this._scale
      );
    }
    return this._localMatrix;
  }

  getWorldMatrix(): Mat4 {
    if (this._dirty) {
      if (this.parent) {
        this._worldMatrix = this.parent.getWorldMatrix().multiply(this.getLocalMatrix());
      } else {
        this._worldMatrix = this.getLocalMatrix();
      }
      this._dirty = false;
    }
    return this._worldMatrix;
  }

  setParent(parent: Transform | null): void {
    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      if (index !== -1) {
        this.parent.children.splice(index, 1);
      }
    }

    this.parent = parent;

    if (parent) {
      parent.children.push(this);
    }

    this.markDirty();
  }

  translate(offset: Vec3): void {
    this._position = this._position.add(offset);
    this.markDirty();
  }

  rotate(rotation: Quat): void {
    this._rotation = this._rotation.multiply(rotation);
    this.markDirty();
  }

  lookAt(target: Vec3, up: Vec3 = Vec3.up()): void {
    const m = Mat4.lookAt(this._position, target, up);

    // Convert rotation matrix to quaternion using trace method
    const trace = m.elements[0] + m.elements[5] + m.elements[10];

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      this._rotation = new Quat(
        (m.elements[6] - m.elements[9]) * s,
        (m.elements[8] - m.elements[2]) * s,
        (m.elements[1] - m.elements[4]) * s,
        0.25 / s
      );
    } else if (m.elements[0] > m.elements[5] && m.elements[0] > m.elements[10]) {
      const s = 2.0 * Math.sqrt(1.0 + m.elements[0] - m.elements[5] - m.elements[10]);
      this._rotation = new Quat(
        0.25 * s,
        (m.elements[4] + m.elements[1]) / s,
        (m.elements[8] + m.elements[2]) / s,
        (m.elements[6] - m.elements[9]) / s
      );
    } else if (m.elements[5] > m.elements[10]) {
      const s = 2.0 * Math.sqrt(1.0 + m.elements[5] - m.elements[0] - m.elements[10]);
      this._rotation = new Quat(
        (m.elements[4] + m.elements[1]) / s,
        0.25 * s,
        (m.elements[9] + m.elements[6]) / s,
        (m.elements[8] - m.elements[2]) / s
      );
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m.elements[10] - m.elements[0] - m.elements[5]);
      this._rotation = new Quat(
        (m.elements[8] + m.elements[2]) / s,
        (m.elements[9] + m.elements[6]) / s,
        0.25 * s,
        (m.elements[1] - m.elements[4]) / s
      );
    }

    this.markDirty();
  }

  /**
   * Gets the forward direction of the transform.
   * @returns The forward direction as a vector.
   */
  getForward(): Vec3 {
    const matrix = this.getWorldMatrix();
    return new Vec3(matrix.elements[8], matrix.elements[9], matrix.elements[10]).normalize();
  }

  getRight(): Vec3 {
    const matrix = this.getWorldMatrix();
    return new Vec3(matrix.elements[0], matrix.elements[1], matrix.elements[2]).normalize();
  }

  getUp(): Vec3 {
    const matrix = this.getWorldMatrix();
    return new Vec3(matrix.elements[4], matrix.elements[5], matrix.elements[6]).normalize();
  }
}
