import { Vec3 } from '../../src/index';
import { state } from './state';
import { getRawMeshData, layerMatrix } from './csg';
import type { EditorNode } from './types';

export function computeAABB(positions: Float32Array): { min: Vec3; max: Vec3 } {
  let x0 =  Infinity, y0 =  Infinity, z0 =  Infinity;
  let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    x0 = Math.min(x0, positions[i]);   x1 = Math.max(x1, positions[i]);
    y0 = Math.min(y0, positions[i+1]); y1 = Math.max(y1, positions[i+1]);
    z0 = Math.min(z0, positions[i+2]); z1 = Math.max(z1, positions[i+2]);
  }
  return { min: new Vec3(x0, y0, z0), max: new Vec3(x1, y1, z1) };
}

export function worldAABB(node: EditorNode): { min: Vec3; max: Vec3 } | null {
  if (!node.aabb) return null;
  const wm = node.entity.transform.getWorldMatrix();
  const { min: mn, max: mx } = node.aabb;
  const corners = [
    [mn.x, mn.y, mn.z], [mx.x, mn.y, mn.z], [mn.x, mx.y, mn.z], [mx.x, mx.y, mn.z],
    [mn.x, mn.y, mx.z], [mx.x, mn.y, mx.z], [mn.x, mx.y, mx.z], [mx.x, mx.y, mx.z],
  ].map(([x,y,z]) => wm.transform(new Vec3(x!, y!, z!)));
  let rmin = corners[0].clone(), rmax = corners[0].clone();
  for (const c of corners.slice(1)) {
    rmin = new Vec3(Math.min(rmin.x, c.x), Math.min(rmin.y, c.y), Math.min(rmin.z, c.z));
    rmax = new Vec3(Math.max(rmax.x, c.x), Math.max(rmax.y, c.y), Math.max(rmax.z, c.z));
  }
  return { min: rmin, max: rmax };
}

export function rayAABB(o: Vec3, d: Vec3, ab: { min: Vec3; max: Vec3 }): number {
  let tmin = -Infinity, tmax = Infinity;
  for (const a of ['x', 'y', 'z'] as const) {
    const inv = 1 / d[a];
    const t1 = (ab.min[a] - o[a]) * inv;
    const t2 = (ab.max[a] - o[a]) * inv;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  return tmax >= tmin && tmax >= 0 ? (tmin >= 0 ? tmin : tmax) : -1;
}

export function mouseRay(cx: number, cy: number): { o: Vec3; d: Vec3 } {
  const canvas = state.canvasEl!;
  const rect = canvas.getBoundingClientRect();
  const nx = ((cx - rect.left) / rect.width)  * 2 - 1;
  const ny = (1 - (cy - rect.top) / rect.height) * 2 - 1;
  const iv = state.camera!.getViewProjectionMatrix().invert();
  if (!iv) return { o: state.cameraEntity!.transform.position.clone(), d: Vec3.forward() };
  const e = iv.elements;
  function unproj(nz: number): Vec3 {
    const w = e[3]*nx + e[7]*ny + e[11]*nz + e[15];
    return w !== 0
      ? new Vec3((e[0]*nx + e[4]*ny + e[8]*nz  + e[12]) / w,
                 (e[1]*nx + e[5]*ny + e[9]*nz  + e[13]) / w,
                 (e[2]*nx + e[6]*ny + e[10]*nz + e[14]) / w)
      : Vec3.zero();
  }
  return { o: unproj(0), d: unproj(1).sub(unproj(0)).normalize() };
}

export function pick(cx: number, cy: number): string | null {
  const { o, d } = mouseRay(cx, cy);
  let bestId: string | null = null, bestT = Infinity;
  for (const [id, node] of state.nodes) {
    if (!node.entity.active || node.isComposite) continue;
    const ab = worldAABB(node);
    if (!ab) continue;
    const t = rayAABB(o, d, ab);
    if (t > 0 && t < bestT) { bestT = t; bestId = id; }
  }
  return bestId;
}

// Möller–Trumbore ray-triangle intersection. Returns t > 0 on hit, -1 otherwise.
function rayTriangle(o: Vec3, d: Vec3, v0: Vec3, v1: Vec3, v2: Vec3): number {
  const e1 = v1.sub(v0), e2 = v2.sub(v0);
  const h  = d.cross(e2);
  const a  = e1.dot(h);
  if (Math.abs(a) < 1e-7) return -1;
  const f = 1 / a;
  const s = o.sub(v0);
  const u = f * s.dot(h);
  if (u < 0 || u > 1) return -1;
  const q = s.cross(e1);
  const v = f * d.dot(q);
  if (v < 0 || u + v > 1) return -1;
  const t = f * e2.dot(q);
  return t > 1e-5 ? t : -1;
}

// In mesh-edit mode: pick the CSG layer whose primitive geometry the ray hits first.
export function pickLayer(cx: number, cy: number): string | null {
  const { o, d } = mouseRay(cx, cy);
  const node = state.meshEditTargetId ? state.nodes.get(state.meshEditTargetId) : null;
  if (!node || node.isComposite) return null;

  let bestLayerId: string | null = null;
  let bestT = Infinity;

  for (const layer of node.csgLayers) {
    const md  = getRawMeshData(layer);
    const mat = layerMatrix(layer);
    const pos = md.positions;
    const idx = md.indices;
    const triCount = idx ? idx.length / 3 : pos.length / 9;

    for (let i = 0; i < triCount; i++) {
      const i0 = idx ? idx[i*3]   : i*3;
      const i1 = idx ? idx[i*3+1] : i*3+1;
      const i2 = idx ? idx[i*3+2] : i*3+2;
      const v0 = mat.transform(new Vec3(pos[i0*3], pos[i0*3+1], pos[i0*3+2]));
      const v1 = mat.transform(new Vec3(pos[i1*3], pos[i1*3+1], pos[i1*3+2]));
      const v2 = mat.transform(new Vec3(pos[i2*3], pos[i2*3+1], pos[i2*3+2]));
      const t  = rayTriangle(o, d, v0, v1, v2);
      if (t > 0 && t < bestT) { bestT = t; bestLayerId = layer.id; }
    }
  }
  return bestLayerId;
}
