# CSG Implementation Deep Dive

Date: 2026-05-25

This document explains how the current CSG pipeline works in this repository, why the resulting triangulation can become highly fragmented, and what to change first to improve mesh quality and performance.

## 1) End-to-End Flow

High-level pipeline in [src/rendering/CSG.ts](src/rendering/CSG.ts):

1. Convert each input mesh into a list of world-space polygons.
2. Build BSP trees from those polygons.
3. Run boolean operation logic by clipping and inverting BSP nodes.
4. Collect output polygons.
5. Triangulate polygons into a new MeshData object.

Boolean entry points:
- Union: [src/rendering/CSG.ts](src/rendering/CSG.ts#L263)
- Subtract: [src/rendering/CSG.ts](src/rendering/CSG.ts#L278)
- Intersect: [src/rendering/CSG.ts](src/rendering/CSG.ts#L295)

## 2) Core Data Structures

### Vertex
Defined in [src/rendering/CSG.ts](src/rendering/CSG.ts#L16).

Stores:
- position
- normal

Key behavior:
- lerp interpolates position and normal on split edges.
- flip reverses normal direction.

Important limitation:
- UV and tangent attributes are not stored in Vertex. Any texture mapping detail from input meshes is lost during CSG reconstruction.

### Plane
Defined in [src/rendering/CSG.ts](src/rendering/CSG.ts#L33).

Key behavior:
- Plane.fromPoints builds a splitting plane from a triangle.
- splitPolygon classifies each polygon as coplanar, front, back, or spanning.
- Spanning polygons are physically cut, producing new vertices and new polygons.

This split stage is the main source of polygon growth.

### Polygon
Defined in [src/rendering/CSG.ts](src/rendering/CSG.ts#L100).

Represents a planar polygon as an ordered vertex loop and a derived plane.

### Node (BSP tree)
Defined in [src/rendering/CSG.ts](src/rendering/CSG.ts#L116).

Stores:
- splitting plane
- front child
- back child
- coplanar polygons at current node

Key methods:
- build: recursively partitions polygons using node planes at [src/rendering/CSG.ts](src/rendering/CSG.ts#L167)
- clipPolygons: removes polygons inside another BSP solid at [src/rendering/CSG.ts](src/rendering/CSG.ts#L143)
- invert: flips solid/empty classification by swapping front and back subtrees

## 3) Mesh to Polygon Conversion

Implemented in [src/rendering/CSG.ts](src/rendering/CSG.ts#L189).

Behavior:
- Input triangles are transformed into world space.
- Normals are transformed by inverse-transpose when a world matrix is provided.
- Degenerate triangles are dropped.

Implication:
- Input already arrives as triangles, so any operation starts from many small primitives.

## 4) Boolean Operation Mechanics

The union, subtract, and intersect methods follow the classic BSP CSG sequence.

Example for union in [src/rendering/CSG.ts](src/rendering/CSG.ts#L263):
1. Build trees A and B.
2. Clip A against B and B against A.
3. Invert B, clip again, invert back.
4. Merge remaining polygons from B into A.

Equivalent variations are used for subtract and intersect.

Main quality implication:
- Every clip can split polygons again.
- Split fragments are accumulated without simplification.

## 5) Polygon to Mesh Reconstruction

Implemented in [src/rendering/CSG.ts](src/rendering/CSG.ts#L230).

Current behavior:
- For each polygon, append all polygon vertices directly to output arrays.
- Triangulate with a fan from the first vertex.
- Create indices for those new per-polygon vertices.
- UVs are hardcoded to 0,0.

This is the direct cause of most output inefficiency:

1. No vertex welding
- Shared positions across adjacent polygons are duplicated.
- The output index buffer references mostly unique vertices, reducing cache efficiency.

2. No coplanar polygon merging
- Adjacent fragments that lie on the same plane remain separate polygons.
- This inflates polygon count before triangulation.

3. Fan triangulation on arbitrary split polygons
- Split polygons can become thin or irregular.
- Fan triangulation can generate long skinny triangles and poor triangle quality.

4. No post-triangulation cleanup
- No removal of near-degenerate triangles beyond the pre-CSG input filter.

## 6) Why Fragmentation Gets Severe

The current BSP build strategy chooses the first polygon plane as splitter at [src/rendering/CSG.ts](src/rendering/CSG.ts#L169).

That is simple but can be very expensive for triangle-heavy inputs:
- Poor split planes cause many spanning classifications.
- Many spanning classifications cause many new vertices.
- Repeating recursively causes rapid growth in polygon count.

In practice, two triangulated meshes with overlapping detail can explode in triangle count even when the final surface should be simple.

## 7) Priority Improvements

## Phase A: Biggest wins with moderate effort

1. Add vertex welding in polygonsToMesh output
- Quantize position and normal with tolerance.
- Reuse existing vertex indices instead of always appending.
- Benefit: strong memory and rendering efficiency gains.

2. Merge coplanar adjacent polygons before triangulation
- Group by near-equal plane equation.
- Build edge adjacency and merge loops.
- Benefit: fewer polygons and fewer final triangles.

3. Replace fan triangulation with robust polygon triangulation
- Ear clipping is a reasonable baseline for simple polygons.
- Benefit: fewer skinny triangles and better mesh quality.

## Phase B: Reduce splitting during BSP build

4. Improve BSP splitter selection
- Instead of first polygon, score candidate planes.
- Minimize spanning splits and maintain tree balance.
- Even a cheap heuristic significantly reduces polygon blow-up.

5. Add split thresholds and cleanup
- Drop fragments below area threshold.
- Remove nearly collinear vertices in polygon loops.

## Phase C: Attribute correctness and feature quality

6. Preserve UVs in CSG vertex representation
- Extend Vertex to carry UV and interpolate in lerp.
- This enables meaningful textured CSG output.

7. Optional tangent rebuild pass
- Useful if normal mapping is expected.

## 8) Suggested Refactor Order

1. Output vertex welding in polygonsToMesh.
2. Coplanar merge pass before triangulation.
3. Ear clipping triangulator for merged polygons.
4. BSP splitter heuristic.
5. UV preservation.

This order gives immediate practical gains without rewriting the entire BSP core.

## 9) Quick Instrumentation to Verify Improvements

Add counters around:
- input triangle count
- polygons after meshToPolygons
- polygons after each clip/build stage
- final polygon count before triangulation
- final vertex/index count after triangulation

Best insertion points:
- meshToPolygons at [src/rendering/CSG.ts](src/rendering/CSG.ts#L189)
- Node.build at [src/rendering/CSG.ts](src/rendering/CSG.ts#L167)
- polygonsToMesh at [src/rendering/CSG.ts](src/rendering/CSG.ts#L230)

This will quantify where the blow-up is happening for your real content.

## 10) Summary

Current CSG is a correct classic BSP implementation and is good for functionality and simplicity. The mesh quality issue you are seeing is expected from:
- recursive polygon splitting
- no coplanar merge
- no vertex welding
- fan triangulation of split polygons

The fastest path to better output is to optimize the reconstruction stage first, then improve BSP splitter selection.
