import { describe, it, expect } from 'vitest';
import { Vec4 } from '../../src/math/Vec4';

describe('Vec4', () => {
  it('should default to w=1 and zero initializer', () => {
    const v = new Vec4();
    expect(v).toEqual({ x: 0, y: 0, z: 0, w: 1 });
  });

  it('toArray and toFloat32Array', () => {
    const v = new Vec4(1, 2, 3, 4);
    expect(v.toArray()).toEqual([1, 2, 3, 4]);
    expect(v.toFloat32Array()).toEqual(new Float32Array([1, 2, 3, 4]));
  });

  it('clone and set operate correctly', () => {
    const v = new Vec4(1, 2, 3, 4);
    const c = v.clone();
    expect(c).toEqual(v);
    v.set(5, 6, 7, 8);
    expect(v).toEqual({ x: 5, y: 6, z: 7, w: 8 });
  });
});