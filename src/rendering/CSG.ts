// CSG.ts — Constructive Solid Geometry via BSP trees.
// Adapted from the algorithm by Evan Wallace (csg.js, MIT License).
import { Vec3, Mat4 } from '../math';
import type { MeshData } from './Mesh';

// ─── Constants ───────────────────────────────────────────────────────────────

const EPS = 1e-5;
const COPLANAR = 0;
const FRONT = 1;
const BACK = 2;
const SPANNING = 3;

// ─── Vertex ──────────────────────────────────────────────────────────────────

class Vertex {
  constructor(public pos: Vec3, public normal: Vec3) {}

  clone(): Vertex { return new Vertex(this.pos.clone(), this.normal.clone()); }

  flip(): Vertex { return new Vertex(this.pos.clone(), this.normal.mul(-1)); }

  lerp(o: Vertex, t: number): Vertex {
    return new Vertex(
      this.pos.lerp(o.pos, t),
      this.normal.lerp(o.normal, t).normalize()
    );
  }
}

// ─── Plane ───────────────────────────────────────────────────────────────────

class Plane {
  constructor(public normal: Vec3, public w: number) {}

  static fromPoints(a: Vec3, b: Vec3, c: Vec3): Plane {
    const n = b.sub(a).cross(c.sub(a)).normalize();
    return new Plane(n, n.dot(a));
  }

  clone(): Plane { return new Plane(this.normal.clone(), this.w); }

  flip(): Plane { return new Plane(this.normal.mul(-1), -this.w); }

  splitPolygon(
    poly: Polygon,
    coplanarFront: Polygon[], coplanarBack: Polygon[],
    front: Polygon[], back: Polygon[]
  ): void {
    let polyType = 0;
    const types: number[] = [];

    for (const v of poly.vertices) {
      const t = this.normal.dot(v.pos) - this.w;
      const type = t < -EPS ? BACK : t > EPS ? FRONT : COPLANAR;
      polyType |= type;
      types.push(type);
    }

    switch (polyType) {
      case COPLANAR:
        (this.normal.dot(poly.plane.normal) > 0 ? coplanarFront : coplanarBack).push(poly);
        break;
      case FRONT:
        front.push(poly);
        break;
      case BACK:
        back.push(poly);
        break;
      case SPANNING: {
        const f: Vertex[] = [];
        const b: Vertex[] = [];
        const n = poly.vertices.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const ti = types[i], tj = types[j];
          const vi = poly.vertices[i], vj = poly.vertices[j];
          if (ti !== BACK)  f.push(vi);
          if (ti !== FRONT) b.push(vi);
          if ((ti | tj) === SPANNING) {
            const denom = this.normal.dot(vj.pos.sub(vi.pos));
            if (Math.abs(denom) > EPS) {
              const t = (this.w - this.normal.dot(vi.pos)) / denom;
              const v = vi.lerp(vj, t);
              f.push(v);
              b.push(v.clone());
            }
          }
        }
        if (f.length >= 3) front.push(new Polygon(f));
        if (b.length >= 3) back.push(new Polygon(b));
        break;
      }
    }
  }
}

// ─── Polygon ─────────────────────────────────────────────────────────────────

class Polygon {
  public plane: Plane;

  constructor(public vertices: Vertex[]) {
    this.plane = Plane.fromPoints(vertices[0].pos, vertices[1].pos, vertices[2].pos);
  }

  clone(): Polygon { return new Polygon(this.vertices.map(v => v.clone())); }

  flip(): Polygon {
    return new Polygon([...this.vertices].reverse().map(v => v.flip()));
  }
}

// ─── BSP Node ────────────────────────────────────────────────────────────────

class Node {
  private plane: Plane | null = null;
  private front: Node | null = null;
  private back: Node | null = null;
  private polygons: Polygon[] = [];

  constructor(polygons?: Polygon[]) {
    if (polygons && polygons.length) this.build(polygons);
  }

  clone(): Node {
    const n = new Node();
    n.plane = this.plane?.clone() ?? null;
    n.front = this.front?.clone() ?? null;
    n.back  = this.back?.clone()  ?? null;
    n.polygons = this.polygons.map(p => p.clone());
    return n;
  }

  invert(): void {
    this.polygons = this.polygons.map(p => p.flip());
    this.plane = this.plane?.flip() ?? null;
    this.front?.invert();
    this.back?.invert();
    [this.front, this.back] = [this.back, this.front];
  }

  clipPolygons(polygons: Polygon[]): Polygon[] {
    if (!this.plane) return polygons.slice();
    let f: Polygon[] = [], b: Polygon[] = [];
    for (const p of polygons) this.plane.splitPolygon(p, f, b, f, b);
    if (this.front) f = this.front.clipPolygons(f);
    // no front child → polygons are outside the solid, keep them
    if (this.back)  b = this.back.clipPolygons(b);
    else             b = []; // no back child → polygons are inside the solid, discard
    return [...f, ...b];
  }

  clipTo(bsp: Node): void {
    this.polygons = bsp.clipPolygons(this.polygons);
    this.front?.clipTo(bsp);
    this.back?.clipTo(bsp);
  }

  allPolygons(): Polygon[] {
    let ps = this.polygons.slice();
    if (this.front) ps = ps.concat(this.front.allPolygons());
    if (this.back)  ps = ps.concat(this.back.allPolygons());
    return ps;
  }

  build(polygons: Polygon[]): void {
    if (!polygons.length) return;
    if (!this.plane) this.plane = polygons[0].plane.clone();
    const f: Polygon[] = [], b: Polygon[] = [];
    for (const p of polygons)
      this.plane.splitPolygon(p, this.polygons, this.polygons, f, b);
    if (f.length) { if (!this.front) this.front = new Node(); this.front.build(f); }
    if (b.length) { if (!this.back)  this.back  = new Node(); this.back.build(b);  }
  }
}

// ─── Mesh ↔ Polygons ─────────────────────────────────────────────────────────

function transformNormal3x3(n: Vec3, m: Mat4): Vec3 {
  const e = m.elements;
  return new Vec3(
    e[0]*n.x + e[4]*n.y + e[8]*n.z,
    e[1]*n.x + e[5]*n.y + e[9]*n.z,
    e[2]*n.x + e[6]*n.y + e[10]*n.z,
  ).normalize();
}

function meshToPolygons(data: MeshData, worldMat?: Mat4): Polygon[] {
  const pos  = data.positions;
  const nrm  = data.normals;
  const idx  = data.indices;
  const wm   = worldMat ?? Mat4.identity();
  const nm   = worldMat ? (worldMat.invert()?.transpose() ?? Mat4.identity()) : Mat4.identity();
  const out: Polygon[] = [];

  const triCount = idx ? idx.length / 3 : pos.length / 9;

  for (let t = 0; t < triCount; t++) {
    const i0 = idx ? idx[t*3]   : t*3;
    const i1 = idx ? idx[t*3+1] : t*3+1;
    const i2 = idx ? idx[t*3+2] : t*3+2;

    const wp0 = wm.transform(new Vec3(pos[i0*3], pos[i0*3+1], pos[i0*3+2]));
    const wp1 = wm.transform(new Vec3(pos[i1*3], pos[i1*3+1], pos[i1*3+2]));
    const wp2 = wm.transform(new Vec3(pos[i2*3], pos[i2*3+1], pos[i2*3+2]));

    // Skip degenerate triangles.
    if (wp1.sub(wp0).cross(wp2.sub(wp0)).length() < EPS) continue;

    let n0: Vec3, n1: Vec3, n2: Vec3;
    if (nrm) {
      n0 = transformNormal3x3(new Vec3(nrm[i0*3], nrm[i0*3+1], nrm[i0*3+2]), nm);
      n1 = transformNormal3x3(new Vec3(nrm[i1*3], nrm[i1*3+1], nrm[i1*3+2]), nm);
      n2 = transformNormal3x3(new Vec3(nrm[i2*3], nrm[i2*3+1], nrm[i2*3+2]), nm);
    } else {
      const fn = wp1.sub(wp0).cross(wp2.sub(wp0)).normalize();
      n0 = n1 = n2 = fn;
    }

    out.push(new Polygon([
      new Vertex(wp0, n0),
      new Vertex(wp1, n1),
      new Vertex(wp2, n2),
    ]));
  }
  return out;
}

function polygonsToMesh(polys: Polygon[]): MeshData {
  const positions: number[] = [];
  const normals:   number[] = [];
  const uvs:       number[] = [];
  const indices:   number[] = [];

  for (const poly of polys) {
    const n = poly.vertices.length;
    if (n < 3) continue;
    const base = positions.length / 3;
    for (const v of poly.vertices) {
      positions.push(v.pos.x, v.pos.y, v.pos.z);
      normals.push(v.normal.x, v.normal.y, v.normal.z);
      uvs.push(0, 0);
    }
    for (let i = 1; i < n - 1; i++) {
      indices.push(base, base + i, base + i + 1);
    }
  }

  const vertexCount = positions.length / 3;
  return {
    positions: new Float32Array(positions),
    normals:   new Float32Array(normals),
    uvs:       new Float32Array(uvs),
    indices:   vertexCount < 65536
      ? new Uint16Array(indices)
      : new Uint32Array(indices),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function csgUnion(
  dataA: MeshData, matA: Mat4,
  dataB: MeshData, matB: Mat4
): MeshData {
  const A = new Node(meshToPolygons(dataA, matA));
  const B = new Node(meshToPolygons(dataB, matB));
  A.clipTo(B);
  B.clipTo(A);
  B.invert();
  B.clipTo(A);
  B.invert();
  A.build(B.allPolygons());
  return polygonsToMesh(A.allPolygons());
}

export function csgSubtract(
  dataA: MeshData, matA: Mat4,
  dataB: MeshData, matB: Mat4
): MeshData {
  const A = new Node(meshToPolygons(dataA, matA));
  const B = new Node(meshToPolygons(dataB, matB));
  A.invert();
  A.clipTo(B);
  B.clipTo(A);
  B.invert();
  B.clipTo(A);
  B.invert();
  A.build(B.allPolygons());
  A.invert();
  return polygonsToMesh(A.allPolygons());
}

export function csgIntersect(
  dataA: MeshData, matA: Mat4,
  dataB: MeshData, matB: Mat4
): MeshData {
  const A = new Node(meshToPolygons(dataA, matA));
  const B = new Node(meshToPolygons(dataB, matB));
  A.invert();
  B.clipTo(A);
  B.invert();
  A.clipTo(B);
  B.clipTo(A);
  A.build(B.allPolygons());
  A.invert();
  return polygonsToMesh(A.allPolygons());
}
