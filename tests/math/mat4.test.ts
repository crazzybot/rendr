import { describe, it, expect } from 'vitest';
import { Mat4 } from '../../src/math/Mat4';
import { Vec3 } from '../../src/math/Vec3';
import { Quat } from '../../src/math/Quat';

describe('Mat4', () => {
  it('identity matrix', () => {
    expect(Mat4.identity().elements).toEqual(new Float32Array([
      1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1
    ]));
  });

  it('translation', () => {
    const t = Mat4.translation(new Vec3(5, 6, 7));
    expect(t.elements[12]).toBe(5);
    expect(t.elements[13]).toBe(6);
    expect(t.elements[14]).toBe(7);
  });

  it('perspective produces valid matrix', () => {
    const m = Mat4.perspective(Math.PI/4, 1, 0.1, 100);
    expect(m.elements[0]).toBeGreaterThan(0);
    expect(m.elements[5]).toBeGreaterThan(0);
  });

  it('perspective projection maps near/far to 0/1 in NDC (WebGPU)', () => {
    const fov = Math.PI / 2; // 90 degrees
    const aspect = 16 / 9;
    const near = 0.1;
    const far = 1000;

    const proj = Mat4.perspective(fov, aspect, near, far);

    // In a right-handed system, camera looks towards -Z.
    // WebGPU uses depth range [0, 1] instead of OpenGL's [-1, 1]
    const ndcNear = proj.transform(new Vec3(0, 0, -near));
    const ndcFar = proj.transform(new Vec3(0, 0, -far));

    expect(ndcNear.z).toBeCloseTo(0, 6);
    expect(ndcFar.z).toBeCloseTo(1, 6);
  });

  it('perspective w component is positive for points in front of camera', () => {
    const proj = Mat4.perspective(Math.PI / 2, 1, 0.1, 100);
    const p = new Vec3(0, 0, -0.5);

    const w = proj.elements[3] * p.x + proj.elements[7] * p.y + proj.elements[11] * p.z + proj.elements[15];
    expect(w).toBeGreaterThan(0);
  });

  it('lookAt creates orthonormal basis', () => {
    const eye = new Vec3(0,0,5);
    const target = new Vec3(0,0,0);
    const up = new Vec3(0,1,0);
    const lm = Mat4.lookAt(eye, target, up);
    // check that forward vector points towards negative z
    expect(lm.elements[8]).toBeCloseTo(0, 4);
  });

  it('lookAt transforms world points into camera space', () => {
    const eye = new Vec3(1, 2, 3);
    const target = new Vec3(4, 5, 6);
    const up = new Vec3(0, 1, 0);
    const view = Mat4.lookAt(eye, target, up);

    const dist = eye.distance(target);

    const viewEye = view.transform(eye);
    expect(viewEye.x).toBeCloseTo(0, 6);
    expect(viewEye.y).toBeCloseTo(0, 6);
    expect(viewEye.z).toBeCloseTo(0, 6);

    const viewTarget = view.transform(target);
    expect(viewTarget.x).toBeCloseTo(0, 6);
    expect(viewTarget.y).toBeCloseTo(0, 6);
    expect(viewTarget.z).toBeCloseTo(-dist, 6);

    const worldUp = eye.add(up);
    const viewUp = view.transform(worldUp);
    // The up direction in world space should map to a positive y in camera space.
    expect(viewUp.y).toBeGreaterThan(0);
  });

  it('multiply and transpose/invert', () => {
    const a = Mat4.identity();
    const b = Mat4.translation(new Vec3(1, 2, 3));
    const prod = a.multiply(b);
    expect(prod.elements[12]).toBe(1);

    const inv = b.invert();
    expect(inv).not.toBeNull();
    if (inv) {
      expect(inv.elements[12]).toBe(-1);
      expect(inv.elements[13]).toBe(-2);
      expect(inv.elements[14]).toBe(-3);
      const id = b.multiply(inv);
      expect(id.elements[0]).toBeCloseTo(1);
      expect(id.elements[5]).toBeCloseTo(1);
      expect(id.elements[10]).toBeCloseTo(1);
      expect(id.elements[15]).toBeCloseTo(1);
    }

    const t = b.transpose();
    expect(t.elements[1]).toBe(b.elements[4]);
  });

  it('invert method', () => {
    // Test identity matrix inversion
    const identity = Mat4.identity();
    const invIdentity = identity.invert();
    expect(invIdentity).not.toBeNull();
    if (invIdentity) {
      expect(invIdentity.elements).toEqual(identity.elements);
    }

    // Test rotation matrix inversion
    const rotX = Mat4.rotationX(Math.PI / 4);
    const invRotX = rotX.invert();
    expect(invRotX).not.toBeNull();
    if (invRotX) {
      const product = rotX.multiply(invRotX);
      // Check diagonal elements
      expect(product.elements[0]).toBeCloseTo(1, 6);
      expect(product.elements[15]).toBeCloseTo(1, 6);
    }

    // Test scale matrix inversion
    const scale = Mat4.scale(new Vec3(2, 3, 4));
    const invScale = scale.invert();
    expect(invScale).not.toBeNull();
    if (invScale) {
      const product = scale.multiply(invScale);
      expect(product.elements[0]).toBeCloseTo(1, 6);
      expect(product.elements[5]).toBeCloseTo(1, 6);
      expect(product.elements[10]).toBeCloseTo(1, 6);
      expect(product.elements[15]).toBeCloseTo(1, 6);
      // Check that scale values are inverted
      expect(invScale.elements[0]).toBeCloseTo(0.5, 6);
      expect(invScale.elements[5]).toBeCloseTo(1/3, 6);
      expect(invScale.elements[10]).toBeCloseTo(0.25, 6);
    }

    // Test combined transformation inversion
    const combined = Mat4.fromRotationTranslationScale(
      new Quat(0, 0, 0, 1), // identity rotation
      new Vec3(1, 2, 3),
      new Vec3(2, 2, 2)
    );
    const invCombined = combined.invert();
    expect(invCombined).not.toBeNull();
    if (invCombined) {
      const product = combined.multiply(invCombined);
      expect(product.elements[0]).toBeCloseTo(1, 6);
      expect(product.elements[15]).toBeCloseTo(1, 6);
    }
  });
});