// Post-CSG coplanar merge.
//
// Problem: the BSP algorithm splits every polygon it encounters at every
// splitting plane, leaving flat surfaces (e.g. cube faces) covered in
// hundreds of tiny triangles that are all on the same geometric plane.
//
// Fix: group triangles by plane, split each plane group into connected
// components (regions that share edges), and re-triangulate each component
// with a centroid fan.  A rectangular cube face that was fragmented into 80
// BSP triangles becomes 4 triangles; a cube face with a circular notch (from
// a sphere) gets as many triangles as its boundary has vertices.
import { Vec3 } from '../../src/index';
import type { MeshData } from '../../src/index';

const POS_Q   = 1e4; // quantisation for vertex positions  (0.1 mm at 1 m scale)
const PLANE_Q = 1e4; // quantisation for plane normal + d

// ─── helpers ─────────────────────────────────────────────────────────────────

function posKey(pos: Float32Array, i: number): string {
  return `${Math.round(pos[i*3]*POS_Q)},${Math.round(pos[i*3+1]*POS_Q)},${Math.round(pos[i*3+2]*POS_Q)}`;
}

// Use the STORED vertex normal (averaged across the triangle's three vertices)
// rather than the cross-product, so axis-aligned cube faces always produce
// exact keys regardless of floating-point drift in tiny BSP sub-triangles.
function planeKeyFromNormals(
  pos: Float32Array, nrm: Float32Array, idx: Uint16Array | Uint32Array, t: number
): string | null {
  const i0 = idx[t*3], i1 = idx[t*3+1], i2 = idx[t*3+2];

  const nx = (nrm[i0*3] + nrm[i1*3] + nrm[i2*3]) / 3;
  const ny = (nrm[i0*3+1] + nrm[i1*3+1] + nrm[i2*3+1]) / 3;
  const nz = (nrm[i0*3+2] + nrm[i1*3+2] + nrm[i2*3+2]) / 3;
  const len = Math.sqrt(nx*nx + ny*ny + nz*nz);
  if (len < 1e-8) return null;

  const nnx = nx / len, nny = ny / len, nnz = nz / len;
  const d = nnx * pos[i0*3] + nny * pos[i0*3+1] + nnz * pos[i0*3+2];

  return `${Math.round(nnx*PLANE_Q)},${Math.round(nny*PLANE_Q)},${Math.round(nnz*PLANE_Q)},${Math.round(d*PLANE_Q)}`;
}

// ─── public API ──────────────────────────────────────────────────────────────

export function mergeCoplanarFaces(data: MeshData): MeshData {
  const pos = data.positions;
  const nrm = data.normals ?? new Float32Array(data.positions.length);
  const uvs = data.uvs    ?? new Float32Array((data.positions.length / 3) * 2);
  const idx  = data.indices;
  if (!idx || idx.length === 0) return data;

  const triCount = idx.length / 3;

  // ── 1. Group triangles by plane ──────────────────────────────────────────

  const trisByPlane = new Map<string, number[]>();
  for (let t = 0; t < triCount; t++) {
    const key = planeKeyFromNormals(pos, nrm, idx, t);
    if (!key) continue;
    let g = trisByPlane.get(key);
    if (!g) { g = []; trisByPlane.set(key, g); }
    g.push(t);
  }

  // ── 2. Per plane group: find components, merge each ──────────────────────

  const outPos: number[] = [];
  const outNrm: number[] = [];
  const outUvs: number[] = [];
  const outIdx: number[] = [];

  function copyTri(t: number): void {
    const base = outPos.length / 3;
    for (let k = 0; k < 3; k++) {
      const vi = idx![t*3+k];
      outPos.push(pos[vi*3], pos[vi*3+1], pos[vi*3+2]);
      outNrm.push(nrm[vi*3], nrm[vi*3+1], nrm[vi*3+2]);
      outUvs.push(uvs[vi*2], uvs[vi*2+1]);
    }
    outIdx.push(base, base+1, base+2);
  }

  for (const [, tris] of trisByPlane) {
    if (tris.length < 3) { tris.forEach(copyTri); continue; }

    // Face normal from the first triangle's stored normals.
    const fi0 = idx[tris[0]*3];
    const faceNormal = new Vec3(nrm[fi0*3], nrm[fi0*3+1], nrm[fi0*3+2]).normalize();

    // ── 2a. Build edge → triangle adjacency ─────────────────────────────

    // triKeys[i] = [posKey(v0), posKey(v1), posKey(v2)] for tris[i]
    const triKeys: [string, string, string][] = tris.map(t => [
      posKey(pos, idx[t*3]),
      posKey(pos, idx[t*3+1]),
      posKey(pos, idx[t*3+2]),
    ]);

    // undirected edge key → list of local triangle indices
    const edgeToLocalTris = new Map<string, number[]>();
    for (let li = 0; li < tris.length; li++) {
      const ks = triKeys[li];
      for (let k = 0; k < 3; k++) {
        const a = ks[k], b = ks[(k+1)%3];
        const uek = a < b ? `${a}|${b}` : `${b}|${a}`;
        let arr = edgeToLocalTris.get(uek);
        if (!arr) { arr = []; edgeToLocalTris.set(uek, arr); }
        arr.push(li);
      }
    }

    // ── 2b. Connected components via BFS ────────────────────────────────

    // adjacent local triangle indices
    const adj: number[][] = tris.map(() => []);
    for (const [, liArr] of edgeToLocalTris) {
      if (liArr.length === 2) {
        adj[liArr[0]].push(liArr[1]);
        adj[liArr[1]].push(liArr[0]);
      }
    }

    const visited = new Uint8Array(tris.length);
    const components: number[][] = [];
    for (let start = 0; start < tris.length; start++) {
      if (visited[start]) continue;
      const comp: number[] = [];
      const queue = [start]; visited[start] = 1;
      while (queue.length) {
        const cur = queue.shift()!;
        comp.push(cur);
        for (const nb of adj[cur]) {
          if (!visited[nb]) { visited[nb] = 1; queue.push(nb); }
        }
      }
      components.push(comp);
    }

    // ── 2c. Merge each component independently ───────────────────────────

    for (const comp of components) {
      const compTris = comp.map(li => tris[li]);
      const compKeys = comp.map(li => triKeys[li]);

      if (compTris.length < 3) { compTris.forEach(copyTri); continue; }

      // Collect vertex data + directed edge count for this component.
      const vertData = new Map<string, { pos: Vec3; uv: [number,number] }>();
      const dirEdgeCount = new Map<string, number>();

      for (let ci = 0; ci < comp.length; ci++) {
        const t = compTris[ci];
        const ks = compKeys[ci];
        for (let k = 0; k < 3; k++) {
          const vi = idx![t*3+k];
          if (!vertData.has(ks[k])) {
            vertData.set(ks[k], {
              pos: new Vec3(pos[vi*3], pos[vi*3+1], pos[vi*3+2]),
              uv:  [uvs[vi*2], uvs[vi*2+1]],
            });
          }
          const ek = `${ks[k]}|${ks[(k+1)%3]}`;
          dirEdgeCount.set(ek, (dirEdgeCount.get(ek) ?? 0) + 1);
        }
      }

      // Boundary = directed edge whose reverse is absent.
      const boundary = new Map<string, string>(); // from → to (Map, so last-write wins for non-manifold)
      for (const ek of dirEdgeCount.keys()) {
        const sep = ek.indexOf('|');
        const a = ek.slice(0, sep), b = ek.slice(sep + 1);
        if (!dirEdgeCount.has(`${b}|${a}`)) boundary.set(a, b);
      }

      if (boundary.size < 3) { compTris.forEach(copyTri); continue; }

      // Trace exactly ONE boundary loop (a connected component should have one).
      const remaining = new Set(boundary.keys());
      const start = remaining.values().next().value!;
      const loop: string[] = [start];
      remaining.delete(start);
      let cur = boundary.get(start);
      while (cur && cur !== start && remaining.has(cur)) {
        loop.push(cur); remaining.delete(cur); cur = boundary.get(cur);
      }

      // If the loop doesn't close or is smaller than 3, fall back.
      if (loop.length < 3 || remaining.size > 0) { compTris.forEach(copyTri); continue; }

      // Only replace if the fan reduces triangle count.
      if (loop.length >= compTris.length) { compTris.forEach(copyTri); continue; }

      // Centroid fan triangulation.
      const verts = loop.map(k => vertData.get(k)!);
      let cx = 0, cy = 0, cz = 0;
      for (const v of verts) { cx += v.pos.x; cy += v.pos.y; cz += v.pos.z; }
      cx /= verts.length; cy /= verts.length; cz /= verts.length;

      // Fan is only valid when the centroid is inside the polygon (i.e. polygon is
      // convex w.r.t. the centroid).  For non-convex merged faces the centroid can
      // fall outside, flipping some triangle normals and creating visible holes.
      const centroidPos = new Vec3(cx, cy, cz);
      let fanIsValid = true;
      for (let i = 0; i < verts.length; i++) {
        const e0 = verts[i].pos.sub(centroidPos);
        const e1 = verts[(i + 1) % verts.length].pos.sub(centroidPos);
        if (e0.cross(e1).dot(faceNormal) < 0) { fanIsValid = false; break; }
      }
      if (!fanIsValid) { compTris.forEach(copyTri); continue; }

      const cIdx = outPos.length / 3;
      outPos.push(cx, cy, cz);
      outNrm.push(faceNormal.x, faceNormal.y, faceNormal.z);
      outUvs.push(0.5, 0.5);

      const loopBase = outPos.length / 3;
      for (const v of verts) {
        outPos.push(v.pos.x, v.pos.y, v.pos.z);
        outNrm.push(faceNormal.x, faceNormal.y, faceNormal.z);
        outUvs.push(v.uv[0], v.uv[1]);
      }
      for (let i = 0; i < verts.length; i++) {
        outIdx.push(cIdx, loopBase + i, loopBase + (i+1) % verts.length);
      }
    }
  }

  const vertCount = outPos.length / 3;
  return {
    positions: new Float32Array(outPos),
    normals:   new Float32Array(outNrm),
    uvs:       new Float32Array(outUvs),
    indices:   vertCount < 65536 ? new Uint16Array(outIdx) : new Uint32Array(outIdx),
  };
}
