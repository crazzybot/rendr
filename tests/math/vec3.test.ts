import { describe, it, expect } from 'vitest';
import { Vec3 } from '../../src/math/Vec3';

describe('Vec3', () => {
  it('should create zero and one vectors', () => {
    expect(Vec3.zero()).toEqual({ x: 0, y: 0, z: 0 });
    expect(Vec3.one()).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('performs basic arithmetic', () => {
    const a = new Vec3(1, 2, 3);
    const b = new Vec3(4, 5, 6);

    expect(a.add(b)).toEqual(new Vec3(5, 7, 9));
    expect(a.sub(b)).toEqual(new Vec3(-3, -3, -3));
    expect(a.mul(2)).toEqual(new Vec3(2, 4, 6));
    expect(b.div(2)).toEqual(new Vec3(2, 2.5, 3));
  });

  it('handles dot, cross, length, normalize', () => {
    const a = new Vec3(1, 0, 0);
    const b = new Vec3(0, 1, 0);
    expect(a.dot(b)).toBe(0);
    expect(a.cross(b)).toEqual(new Vec3(0, 0, 1));

    const c = new Vec3(3, 4, 0);
    expect(c.length()).toBe(5);
    expect(c.normalize()).toEqual(new Vec3(0.6, 0.8, 0));
  });

  it('computes distance and lerp', () => {
    const a = new Vec3(0, 0, 0);
    const b = new Vec3(0, 0, 10);
    expect(a.distance(b)).toBe(10);

    expect(a.lerp(b, 0.5)).toEqual(new Vec3(0, 0, 5));
  });
});