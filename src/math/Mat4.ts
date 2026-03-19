import { Vec3 } from './Vec3';
import { Quat } from './Quat';


/**
 * Column-major matrix class for 3D transformations. The elements are stored in a Float32Array in the following order:
 * [ m00, m10, m20, m30,
 *   m01, m11, m21, m31,
 *   m02, m12, m22, m32,
 *   m03, m13, m23, m33 ]
 *
 * This means that the first four elements represent the first column of the matrix, the next four represent the second column, and so on.
 *
 * The class provides methods for creating common transformation matrices (translation, rotation, scale), as well as perspective and orthographic projection matrices.
 * It also includes methods for multiplying matrices, transforming vectors
 */
export class Mat4 {
  public elements: Float32Array;

  constructor(elements?: Float32Array | number[]) {
    if (elements) {
      this.elements = new Float32Array(elements);
    } else {
      this.elements = new Float32Array(16);
      this.identity();
    }
  }

  static identity(): Mat4 {
    return new Mat4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  identity(): this {
    const e = this.elements;
    e[0] = 1; e[1] = 0; e[2] = 0; e[3] = 0;
    e[4] = 0; e[5] = 1; e[6] = 0; e[7] = 0;
    e[8] = 0; e[9] = 0; e[10] = 1; e[11] = 0;
    e[12] = 0; e[13] = 0; e[14] = 0; e[15] = 1;
    return this;
  }

  clone(): Mat4 {
    return new Mat4(this.elements);
  }

  copy(m: Mat4): this {
    this.elements.set(m.elements);
    return this;
  }

  multiply(m: Mat4): Mat4 {
    const result = new Mat4();
    const a = this.elements;
    const b = m.elements;
    const r = result.elements;

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        r[j * 4 + i] =
          a[0 * 4 + i] * b[j * 4 + 0] +
          a[1 * 4 + i] * b[j * 4 + 1] +
          a[2 * 4 + i] * b[j * 4 + 2] +
          a[3 * 4 + i] * b[j * 4 + 3];
      }
    }

    return result;
  }

  transform(v: Vec3): Vec3 {
    const e = this.elements;
    const x = v.x, y = v.y, z = v.z;

    // For column-major matrices: M * v where v = [x, y, z, 1]
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];

    if (w === 0) return new Vec3(0, 0, 0);

    return new Vec3(
      (e[0] * x + e[4] * y + e[8] * z + e[12]) / w,
      (e[1] * x + e[5] * y + e[9] * z + e[13]) / w,
      (e[2] * x + e[6] * y + e[10] * z + e[14]) / w
    );
  }

  static translation(v: Vec3): Mat4 {
    // Column-major, column-vector multiplication: translation is stored in the last column.
    return new Mat4([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      v.x, v.y, v.z, 1
    ]);
  }

  static rotationX(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Mat4([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1
    ]);
  }

  static rotationY(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Mat4([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }

  static rotationZ(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Mat4([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  static scale(v: Vec3): Mat4 {
    return new Mat4([
      v.x, 0, 0, 0,
      0, v.y, 0, 0,
      0, 0, v.z, 0,
      0, 0, 0, 1
    ]);
  }

  static fromRotationTranslationScale(rotation: Quat, translation: Vec3, scale: Vec3): Mat4 {
    const x = rotation.x, y = rotation.y, z = rotation.z, w = rotation.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale.x, sy = scale.y, sz = scale.z;

    // Column-major layout for right-handed coordinate system
    // Columns represent transformed basis vectors (X, Y, Z axes)
    return new Mat4([
      (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
      (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
      (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
      translation.x, translation.y, translation.z, 1
    ]);
  }

  static perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1.0 / (far - near);

    // WebGPU perspective matrix for depth range [0, 1]
    // Column-major layout: [col0, col1, col2, col3]
    // Right-handed coords: camera looks down -Z, z_view < 0 for visible objects
    return new Mat4([
      f / aspect, 0, 0, 0,                  // Column 0: X scale
      0, f, 0, 0,                            // Column 1: Y scale
      0, 0, -far * rangeInv, -1,             // Column 2: Z transform + W=-z
      0, 0, -near * far * rangeInv, 0        // Column 3: translation
    ]);
  }

  static orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    // Translation stored in the last column for column-vector multiplication.
    return new Mat4([
      -2 * lr, 0, 0, 0,
      0, -2 * bt, 0, 0,
      0, 0, 2 * nf, 0,
      (left + right) * lr, (top + bottom) * bt, (far + near) * nf, 1
    ]);
  }

  static lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    const z = eye.sub(target).normalize();
    const x = up.cross(z).normalize();
    const y = z.cross(x).normalize();

    // Column-major, column-vector multiplication: basis vectors are columns; translation is in last column.
    return new Mat4([
      x.x, y.x, z.x, 0,
      x.y, y.y, z.y, 0,
      x.z, y.z, z.z, 0,
      -x.dot(eye), -y.dot(eye), -z.dot(eye), 1
    ]);
  }

  invert(): Mat4 | null {
    const m = this.elements;
    // Check if it's affine (last row is [0,0,0,1])
    if (Math.abs(m[3]) > 1e-10 || Math.abs(m[7]) > 1e-10 || Math.abs(m[11]) > 1e-10 || Math.abs(m[15] - 1) > 1e-10) {
      // Not affine, return null for now
      return null;
    }

    // Extract 3x3 matrix R
    const r00 = m[0], r01 = m[4], r02 = m[8];
    const r10 = m[1], r11 = m[5], r12 = m[9];
    const r20 = m[2], r21 = m[6], r22 = m[10];

    // Translation t
    const tx = m[12], ty = m[13], tz = m[14];

    // Compute determinant of R
    const det = r00 * (r11 * r22 - r12 * r21) -
                r01 * (r10 * r22 - r12 * r20) +
                r02 * (r10 * r21 - r11 * r20);

    if (Math.abs(det) < 1e-10) {
      return null;
    }

    const invDet = 1.0 / det;

    // Compute R^-1 using adjugate
    const invR00 = (r11 * r22 - r12 * r21) * invDet;
    const invR01 = (r02 * r21 - r01 * r22) * invDet;
    const invR02 = (r01 * r12 - r02 * r11) * invDet;
    const invR10 = (r12 * r20 - r10 * r22) * invDet;
    const invR11 = (r00 * r22 - r02 * r20) * invDet;
    const invR12 = (r02 * r10 - r00 * r12) * invDet;
    const invR20 = (r10 * r21 - r11 * r20) * invDet;
    const invR21 = (r01 * r20 - r00 * r21) * invDet;
    const invR22 = (r00 * r11 - r01 * r10) * invDet;

    // -R^-1 * t
    let ntx = -(invR00 * tx + invR01 * ty + invR02 * tz);
    let nty = -(invR10 * tx + invR11 * ty + invR12 * tz);
    let ntz = -(invR20 * tx + invR21 * ty + invR22 * tz);

    ntx = ntx === 0 ? 0 : ntx;
    nty = nty === 0 ? 0 : nty;
    ntz = ntz === 0 ? 0 : ntz;

    return new Mat4([
      invR00, invR10, invR20, 0,
      invR01, invR11, invR21, 0,
      invR02, invR12, invR22, 0,
      ntx, nty, ntz, 1
    ]);
  }

  transpose(): Mat4 {
    const m = this.elements;
    return new Mat4([
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15]
    ]);
  }
}
