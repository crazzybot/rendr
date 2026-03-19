import { Component } from '../core/Component';
import { Vec3 } from '../math/Vec3';
import { Vec4 } from '../math/Vec4';

/**
 * Directional light component that simulates parallel light rays (like sunlight)
 * The direction is determined by the entity's transform forward vector
 */
export class DirectionalLight extends Component {
  private _color: Vec4;
  private _intensity: number;

  constructor(color: Vec4 = new Vec4(1, 1, 1, 1), intensity: number = 1.0) {
    super();
    this._color = color;
    this._intensity = intensity;
  }

  get color(): Vec4 {
    return this._color;
  }

  set color(value: Vec4) {
    this._color = value;
  }

  get intensity(): number {
    return this._intensity;
  }

  set intensity(value: number) {
    this._intensity = value;
  }

  /**
   * Get the light direction in world space
   * The direction is the forward vector of the entity's transform
   */
  getDirection(): Vec3 {
    if (!this.entity) {
      return new Vec3(0, -1, 0); // Default downward direction
    }
    // Get forward vector from transform and negate it
    // (forward is -Z, but for lighting we want the direction light travels)
    return this.entity.transform.getForward().mul(-1);
  }

  /**
   * Get the final light color multiplied by intensity
   */
  getFinalColor(): Vec4 {
    return new Vec4(
      this._color.x * this._intensity,
      this._color.y * this._intensity,
      this._color.z * this._intensity,
      this._color.w
    );
  }
}
