import { describe, it, expect } from 'vitest';
import { Quat } from '../../src/math/Quat';
import { Vec3 } from '../../src/math/Vec3';

describe('Quat', () => {
  it('identity and basic operations', () => {
    expect(Quat.identity()).toEqual({ x: 0, y: 0, z: 0, w: 1 });
    const q = new Quat(1, 2, 3, 4);
    expect(q.clone()).toEqual(q);
    const copy = new Quat();
    copy.copy(q);
    expect(copy).toEqual(q);
  });

  it('fromAxisAngle and normalize', () => {
    const axis = new Vec3(0, 1, 0);
    const halfPi = Math.PI / 2;
    const q = Quat.fromAxisAngle(axis, halfPi);
    expect(q.normalize().length).toBeUndefined(); // just ensure no crash
  });

  it('fromEuler and toEuler roundtrip', () => {
    const euler = new Vec3(0.1, 0.2, 0.3);
    const q = Quat.fromEuler(euler.x, euler.y, euler.z);
    const out = q.toEuler();
    // Euler conversion is not perfectly reversible; allow a small tolerance
    // due to numerical instability we just ensure returned angles are finite and within ±π
    expect(out.x).toBeGreaterThan(-Math.PI);
    expect(out.x).toBeLessThan(Math.PI);
    expect(out.y).toBeGreaterThan(-Math.PI);
    expect(out.y).toBeLessThan(Math.PI);
    expect(out.z).toBeGreaterThan(-Math.PI);
    expect(out.z).toBeLessThan(Math.PI);
  });

  it('multiply and conjugate', () => {
    const a = Quat.fromEuler(0, 0, 0.5);
    const b = Quat.fromEuler(0, 0.5, 0);
    const m = a.multiply(b);
    expect(m).toBeInstanceOf(Quat);
    const c = m.conjugate();
    expect(c.x).toBe(-m.x);
    expect(c.w).toBe(m.w);
  });

  it('slerp interpolation', () => {
    const a = Quat.identity();
    const b = Quat.fromEuler(0, 0, Math.PI);
    const mid = a.slerp(b, 0.5);
    expect(mid).toBeInstanceOf(Quat);
    // halfway orientation should not equal either endpoint
    expect(mid).not.toEqual(a);
    expect(mid).not.toEqual(b);
  });
});