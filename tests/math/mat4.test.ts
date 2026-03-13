import { describe, it, expect } from 'vitest';
import { Mat4 } from '../../src/math/Mat4';
import { Vec3 } from '../../src/math/Vec3';

describe('Mat4', () => {
  it('identity matrix', () => {
    expect(Mat4.identity().elements).toEqual(new Float32Array([
      1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1
    ]));
  });

  it('translation', () => {
    const t = Mat4.translation(new Vec3(5, 6, 7));
    expect(t.elements[3]).toBe(5);
    expect(t.elements[7]).toBe(6);
    expect(t.elements[11]).toBe(7);
  });

  it('perspective produces valid matrix', () => {
    const m = Mat4.perspective(Math.PI/4, 1, 0.1, 100);
    expect(m.elements[0]).toBeGreaterThan(0);
    expect(m.elements[5]).toBeGreaterThan(0);
  });

  it('perspective projection maps near/far to -1/1 in NDC', () => {
    const fov = Math.PI / 2; // 90 degrees
    const aspect = 16 / 9;
    const near = 0.1;
    const far = 1000;

    const proj = Mat4.perspective(fov, aspect, near, far);

    // In a right-handed system, camera looks towards -Z.
    const ndcNear = proj.transform(new Vec3(0, 0, -near));
    const ndcFar = proj.transform(new Vec3(0, 0, -far));

    expect(ndcNear.z).toBeCloseTo(-1, 6);
    expect(ndcFar.z).toBeCloseTo(1, 6);
  });

  it('perspective w component is positive for points in front of camera', () => {
    const proj = Mat4.perspective(Math.PI / 2, 1, 0.1, 100);
    const p = new Vec3(0, 0, -0.5);

    const w = proj.elements[12] * p.x + proj.elements[13] * p.y + proj.elements[14] * p.z + proj.elements[15];
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
    expect(prod.elements[3]).toBe(1);

    const inv = b.invert();
    expect(inv).not.toBeNull();
    if (inv) {
      const id = b.multiply(inv);
      expect(id.elements[0]).toBeCloseTo(1);
      expect(id.elements[15]).toBeCloseTo(1);
    }

    const t = b.transpose();
    expect(t.elements[1]).toBe(b.elements[4]);
  });
});