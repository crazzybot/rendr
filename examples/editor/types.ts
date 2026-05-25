import type { Entity, Mesh, MeshRenderer, Material } from '../../src/index';
import type { MeshData } from '../../src/index';
import type { Vec3 } from '../../src/index';

export type PrimitiveType = 'cube' | 'sphere' | 'cylinder' | 'plane';
export type CsgOp        = 'base' | 'union' | 'subtract' | 'intersect';
export type EditorMode   = 'scene' | 'mesh-edit';

export interface CsgLayer {
  id: string;
  op: CsgOp;
  primitiveType: PrimitiveType;
  size: number;
  position: Vec3;
  rotation: Vec3; // euler degrees XYZ
  scale: Vec3;
}

export interface MaterialProps {
  r: number; g: number; b: number; a: number;
  ambient: number; diffuse: number; specular: number; shininess: number;
}

export interface EditorNode {
  id: string;
  name: string;
  entity: Entity;
  isComposite: boolean;
  // Defined only when isComposite === false:
  mesh?: Mesh;
  renderer?: MeshRenderer;
  material?: Material;
  matProps?: MaterialProps;
  meshData?: MeshData;
  aabb?: { min: Vec3; max: Vec3 };
  csgLayers: CsgLayer[];
}
