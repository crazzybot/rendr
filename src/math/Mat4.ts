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
    // Right-handed coordinate system: camera looks down -Z
    const z = eye.sub(target).normalize();  // Forward (camera looks opposite to this)
    const x = up.cross(z).normalize();       // Right
    const y = z.cross(x).normalize();        // Up (orthogonal to forward and right)

    // View matrix: inverse of camera transform
    // Column-major layout: columns are the basis vectors
    return new Mat4([
      x.x, y.x, z.x, 0,
      x.y, y.y, z.y, 0,
      x.z, y.z, z.z, 0,
      -x.dot(eye), -y.dot(eye), -z.dot(eye), 1
    ]);
  }

  invert(): Mat4 | null {
    const e = this.elements;

    // Cofactors for row 0 (used for det and result col 0)
    const c00 =  e[5]*(e[10]*e[15]-e[14]*e[11]) - e[9]*(e[6]*e[15]-e[14]*e[7]) + e[13]*(e[6]*e[11]-e[10]*e[7]);
    const c01 = -(e[1]*(e[10]*e[15]-e[14]*e[11]) - e[9]*(e[2]*e[15]-e[14]*e[3]) + e[13]*(e[2]*e[11]-e[10]*e[3]));
    const c02 =  e[1]*(e[6] *e[15]-e[14]*e[7])  - e[5]*(e[2]*e[15]-e[14]*e[3]) + e[13]*(e[2]*e[7] -e[6] *e[3]);
    const c03 = -(e[1]*(e[6] *e[11]-e[10]*e[7])  - e[5]*(e[2]*e[11]-e[10]*e[3]) + e[9] *(e[2]*e[7] -e[6] *e[3]));

    const det = e[0]*c00 + e[4]*c01 + e[8]*c02 + e[12]*c03;
    if (Math.abs(det) < 1e-10) return null;
    const inv = 1.0 / det;

    // Remaining cofactors
    const c10 = -(e[4]*(e[10]*e[15]-e[14]*e[11]) - e[8]*(e[6]*e[15]-e[14]*e[7]) + e[12]*(e[6]*e[11]-e[10]*e[7]));
    const c11 =  e[0]*(e[10]*e[15]-e[14]*e[11]) - e[8]*(e[2]*e[15]-e[14]*e[3]) + e[12]*(e[2]*e[11]-e[10]*e[3]);
    const c12 = -(e[0]*(e[6] *e[15]-e[14]*e[7])  - e[4]*(e[2]*e[15]-e[14]*e[3]) + e[12]*(e[2]*e[7] -e[6] *e[3]));
    const c13 =  e[0]*(e[6] *e[11]-e[10]*e[7])  - e[4]*(e[2]*e[11]-e[10]*e[3]) + e[8] *(e[2]*e[7] -e[6] *e[3]);

    const c20 =  e[4]*(e[9]*e[15]-e[13]*e[11]) - e[8]*(e[5]*e[15]-e[13]*e[7]) + e[12]*(e[5]*e[11]-e[9]*e[7]);
    const c21 = -(e[0]*(e[9]*e[15]-e[13]*e[11]) - e[8]*(e[1]*e[15]-e[13]*e[3]) + e[12]*(e[1]*e[11]-e[9]*e[3]));
    const c22 =  e[0]*(e[5]*e[15]-e[13]*e[7])  - e[4]*(e[1]*e[15]-e[13]*e[3]) + e[12]*(e[1]*e[7] -e[5]*e[3]);
    const c23 = -(e[0]*(e[5]*e[11]-e[9] *e[7])  - e[4]*(e[1]*e[11]-e[9] *e[3]) + e[8] *(e[1]*e[7] -e[5]*e[3]));

    const c30 = -(e[4]*(e[9]*e[14]-e[13]*e[10]) - e[8]*(e[5]*e[14]-e[13]*e[6]) + e[12]*(e[5]*e[10]-e[9]*e[6]));
    const c31 =  e[0]*(e[9]*e[14]-e[13]*e[10]) - e[8]*(e[1]*e[14]-e[13]*e[2]) + e[12]*(e[1]*e[10]-e[9]*e[2]);
    const c32 = -(e[0]*(e[5]*e[14]-e[13]*e[6])  - e[4]*(e[1]*e[14]-e[13]*e[2]) + e[12]*(e[1]*e[6] -e[5]*e[2]));
    const c33 =  e[0]*(e[5]*e[10]-e[9] *e[6])  - e[4]*(e[1]*e[10]-e[9] *e[2]) + e[8] *(e[1]*e[6] -e[5]*e[2]);

    // result[col*4+row] = cofactor(row=col, col=row) / det
    return new Mat4([
      c00*inv, c01*inv, c02*inv, c03*inv,
      c10*inv, c11*inv, c12*inv, c13*inv,
      c20*inv, c21*inv, c22*inv, c23*inv,
      c30*inv, c31*inv, c32*inv, c33*inv,
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
