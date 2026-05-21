import { Component } from '../core/Component';
import { Mat4, Vec3 } from '../math';

export enum ProjectionType {
  Perspective,
  Orthographic
}

export class Camera extends Component {
  public projectionType: ProjectionType = ProjectionType.Perspective;

  public fov: number = Math.PI / 4;
  public aspect: number = 16 / 9;
  public near: number = 0.1;
  public far: number = 1000;

  public left: number = -10;
  public right: number = 10;
  public bottom: number = -10;
  public top: number = 10;

  private _projectionMatrix: Mat4 | null = null;
  private _viewMatrix: Mat4 | null = null;
  private _viewProjectionMatrix: Mat4 | null = null;
  private _dirty: boolean = true;

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.markDirty();
  }

  /**
   * Sets the camera's perspective projection.
   * @param fov Field of view in radians 
   * @param aspect Aspect ratio (width / height)
   * @param near Near clipping plane distance
   * @param far Far clipping plane distance
   */
  setPerspective(fov: number, aspect: number, near: number, far: number): void {
    this.projectionType = ProjectionType.Perspective;
    this.fov = fov;
    this.aspect = aspect;
    this.near = near;
    this.far = far;
    this.markDirty();
  }

  setOrthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): void {
    this.projectionType = ProjectionType.Orthographic;
    this.left = left;
    this.right = right;
    this.bottom = bottom;
    this.top = top;
    this.near = near;
    this.far = far;
    this.markDirty();
  }

  private markDirty(): void {
    this._dirty = true;
    this._projectionMatrix = null;
    this._viewMatrix = null;
    this._viewProjectionMatrix = null;
  }

  getProjectionMatrix(): Mat4 {
    if (!this._projectionMatrix || this._dirty) {
      if (this.projectionType === ProjectionType.Perspective) {
        this._projectionMatrix = Mat4.perspective(this.fov, this.aspect, this.near, this.far);
      } else {
        this._projectionMatrix = Mat4.orthographic(
          this.left, this.right, this.bottom, this.top, this.near, this.far
        );
      }
    }
    return this._projectionMatrix;
  }

  getViewMatrix(): Mat4 {
    const transformDirty = this.entity?.transform.isDirty ?? false;
    if (!this._viewMatrix || this._dirty || transformDirty) {
      if (this.entity) {
        const worldMatrix = this.entity.transform.getWorldMatrix();
        const inverted = worldMatrix.invert();
        this._viewMatrix = inverted ?? Mat4.identity();
      } else {
        this._viewMatrix = Mat4.identity();
      }
    }
    return this._viewMatrix;
  }

  getViewProjectionMatrix(): Mat4 {
    const transformDirty = this.entity?.transform.isDirty ?? false;
    if (!this._viewProjectionMatrix || this._dirty || transformDirty) {
      this._viewProjectionMatrix = this.getProjectionMatrix().multiply(this.getViewMatrix());
      this._dirty = false;
    }
    return this._viewProjectionMatrix;
  }

  screenToWorld(screenX: number, screenY: number, screenZ: number): Vec3 {
    const clipX = (screenX / window.innerWidth) * 2 - 1;
    const clipY = (1 - screenY / window.innerHeight) * 2 - 1;
    const clipZ = screenZ * 2 - 1;

    const invViewProj = this.getViewProjectionMatrix().invert();
    if (!invViewProj) return Vec3.zero();

    const clipPos = new Float32Array([clipX, clipY, clipZ, 1]);
    const worldPos = new Float32Array(4);

    for (let i = 0; i < 4; i++) {
      worldPos[i] =
        invViewProj.elements[i * 4 + 0] * clipPos[0] +
        invViewProj.elements[i * 4 + 1] * clipPos[1] +
        invViewProj.elements[i * 4 + 2] * clipPos[2] +
        invViewProj.elements[i * 4 + 3] * clipPos[3];
    }

    if (worldPos[3] !== 0) {
      return new Vec3(
        worldPos[0] / worldPos[3],
        worldPos[1] / worldPos[3],
        worldPos[2] / worldPos[3]
      );
    }

    return Vec3.zero();
  }

  onUpdate(): void {
    if (this.entity && this.entity.transform.isDirty) {
      this.markDirty();
    }
  }
}
