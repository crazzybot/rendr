import { Geometry, Mat4, Quat } from '../../src/index';
import type { MeshData } from '../../src/index';
import type { CsgLayer } from './types';
import { csgUnion, csgSubtract, csgIntersect } from '../../src/index';
import { mergeCoplanarFaces } from './mesh-optimize';

export function getRawMeshData(layer: CsgLayer): MeshData {
  const s = layer.size;
  let mesh;
  switch (layer.primitiveType) {
    case 'cube':     mesh = Geometry.createCube(s); break;
    case 'sphere':   mesh = Geometry.createSphere(s * 0.5, 24, 16); break;
    case 'cylinder': mesh = Geometry.createCylinder(s * 0.5, s, 24); break;
    case 'plane':    mesh = Geometry.createPlane(s, s, 1, 1); break;
  }
  return {
    positions: mesh.positions,
    normals:   mesh.normals   ?? new Float32Array(),
    uvs:       mesh.uvs       ?? new Float32Array(),
    indices:   mesh.indices   ?? new Uint16Array(),
  };
}

export function layerMatrix(layer: CsgLayer): Mat4 {
  const rot = Quat.fromEuler(
    layer.rotation.x * Math.PI / 180,
    layer.rotation.y * Math.PI / 180,
    layer.rotation.z * Math.PI / 180,
  );
  return Mat4.fromRotationTranslationScale(rot, layer.position, layer.scale);
}

// Empty seed for the union fold — an empty BSP node passes all polygons through,
// so csgUnion(empty, I, mesh, M) == mesh transformed by M.
const EMPTY_MESH: MeshData = {
  positions: new Float32Array(0),
  normals:   new Float32Array(0),
  uvs:       new Float32Array(0),
  indices:   new Uint16Array(0),
};

export function evaluateCsgLayers(layers: CsgLayer[]): MeshData {
  if (layers.length === 0) throw new Error('No CSG layers');

  // Seed: apply the base layer's transform immediately so every subsequent
  // operation receives a fully-transformed result at identity matrix.
  const identity = Mat4.identity();
  let result = csgUnion(EMPTY_MESH, identity, getRawMeshData(layers[0]), layerMatrix(layers[0]));

  for (let i = 1; i < layers.length; i++) {
    const l = layers[i];
    const ld = getRawMeshData(l);
    const lm = layerMatrix(l);
    switch (l.op) {
      case 'union':     result = csgUnion(result, identity, ld, lm); break;
      case 'subtract':  result = csgSubtract(result, identity, ld, lm); break;
      case 'intersect': result = csgIntersect(result, identity, ld, lm); break;
    }
  }
  return mergeCoplanarFaces(result);
}
