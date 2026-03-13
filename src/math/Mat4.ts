import { Vec3 } from './Vec3';
import { Quat } from './Quat';


/**
 * Row-major matrix class for 3D transformations. The elements are stored in a Float32Array in the following order:
 * [ m00, m01, m02, m03,
 *   m10, m11, m12, m13,
 *   m20, m21, m22, m23,
 *   m30, m31, m32, m33 ]
 *
 * This means that the first four elements represent the first row of the matrix, the next four represent the second row, and so on.
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
        r[i * 4 + j] =
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }

    return result;
  }

  transform(v: Vec3): Vec3 {
    const e = this.elements;
    const x = v.x, y = v.y, z = v.z;

    // For row-major matrices: M * v where v = [x, y, z, 1]
    const w = e[12] * x + e[13] * y + e[14] * z + e[15];

    if (w === 0) return new Vec3(0, 0, 0);

    return new Vec3(
      (e[0] * x + e[1] * y + e[2] * z + e[3]) / w,
      (e[4] * x + e[5] * y + e[6] * z + e[7]) / w,
      (e[8] * x + e[9] * y + e[10] * z + e[11]) / w
    );
  }

  static translation(v: Vec3): Mat4 {
    // Row-major, column-vector multiplication: translation is stored in the last column.
    return new Mat4([
      1, 0, 0, v.x,
      0, 1, 0, v.y,
      0, 0, 1, v.z,
      0, 0, 0, 1
    ]);
  }

  static rotationX(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Mat4([
      1, 0, 0, 0,
      0, c, -s, 0,
      0, s, c, 0,
      0, 0, 0, 1
    ]);
  }

  static rotationY(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Mat4([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }

  static rotationZ(angle: number): Mat4 {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return new Mat4([
      c, -s, 0, 0,
      s, c, 0, 0,
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

    // Translation stored in the last column for column-vector multiplication.
    return new Mat4([
      (1 - (yy + zz)) * sx, (xy - wz) * sy, (xz + wy) * sz, translation.x,
      (xy + wz) * sx, (1 - (xx + zz)) * sy, (yz + wx) * sz, translation.y,
      (xz - wy) * sx, (yz - wx) * sy, (1 - (xx + yy)) * sz, translation.z,
      0, 0, 0, 1
    ]);
  }

  static perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1.0 / (far - near);

    return new Mat4([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, -(far + near) * rangeInv, -2 * far * near * rangeInv,
      0, 0, -1, 0
    ]);
  }

  static orthographic(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    // Translation stored in the last column for column-vector multiplication.
    return new Mat4([
      -2 * lr, 0, 0, (left + right) * lr,
      0, -2 * bt, 0, (top + bottom) * bt,
      0, 0, 2 * nf, (far + near) * nf,
      0, 0, 0, 1
    ]);
  }

  static lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
    const z = eye.sub(target).normalize();
    const x = up.cross(z).normalize();
    const y = z.cross(x).normalize();

    // Row-major, column-vector multiplication: basis vectors are rows; translation is in last column.
    return new Mat4([
      x.x, x.y, x.z, -x.dot(eye),
      y.x, y.y, y.z, -y.dot(eye),
      z.x, z.y, z.z, -z.dot(eye),
      0, 0, 0, 1
    ]);
  }

  invert(): Mat4 | null {
    const m = this.elements;
    const result = new Mat4();
    const r = result.elements;

    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];

    const b00 = a00 * a11 - a01 * a10;
    const b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11;
    const b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30;
    const b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31;
    const b11 = a22 * a33 - a23 * a32;

    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (Math.abs(det) < 1e-10) {
      return null;
    }

    det = 1.0 / det;

    r[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    r[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    r[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    r[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    r[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    r[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    r[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    r[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    r[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    r[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    r[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    r[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    r[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    r[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    r[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    r[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return result;
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
