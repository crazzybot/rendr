import { Mesh, MeshData } from './Mesh';

export class Geometry {
  static createCube(size: number = 1): Mesh {
    const s = size / 2;

    const positions = new Float32Array([
      // front face
      -s, -s,  s,  s, -s,  s,  s,  s,  s, -s,  s,  s,
      // back face
      -s, -s, -s, -s,  s, -s,  s,  s, -s,  s, -s, -s,
      // left face
      -s, -s, -s, -s, -s,  s, -s,  s,  s, -s,  s, -s,
      // right face
       s, -s,  s,  s, -s, -s,  s,  s, -s,  s,  s,  s,
      // top face
      -s,  s,  s,  s,  s,  s,  s,  s, -s, -s,  s, -s,
      // bottom face
      -s, -s, -s,  s, -s, -s,  s, -s,  s, -s, -s,  s
    ]);

    const normals = new Float32Array([
      // front face
       0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
       // back face
       0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,       
        // left face
      -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0,
        // right face
       1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
        // top face
       0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,
        // bottom face
       0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,
       
    ]);

    /**
     * UVs are optional, but can be useful for texturing the cube. 
     * Here we assign UVs for each face. Each face gets a full 0-1 UV range, 
     * which allows for simple texturing. If you want to use a texture atlas, 
     * you would adjust these UVs accordingly. For a cube, we have 6 faces, and each 
     * face has 4 vertices, so we need 24 UV coordinates.
     * The UVs are arranged in a way that each face can be textured independently.
     * If you don't need UVs, you can simply omit this array and the Mesh will work without it.
     * The same applies to normals; if you don't need them, you can omit the normals array.
     * This design allows for flexibility in how you use the Mesh class, depending on your needs.
     */
    const uvs = new Float32Array([
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1,
      0, 0, 1, 0, 1, 1, 0, 1
    ]);

    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
      12, 13, 14, 12, 14, 15,
      16, 17, 18, 16, 18, 19,
      20, 21, 22, 20, 22, 23
    ]);

    return new Mesh({ 
      positions, 
      normals, 
      uvs, 
      indices 
    });
  }

  static createSphere(radius: number = 1, segments: number = 32, rings: number = 16): Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let ring = 0; ring <= rings; ring++) {
      const phi = (ring / rings) * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      for (let segment = 0; segment <= segments; segment++) {
        const theta = (segment / segments) * Math.PI * 2;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        const x = cosTheta * sinPhi;
        const y = cosPhi;
        const z = sinTheta * sinPhi;

        positions.push(x * radius, y * radius, z * radius);
        normals.push(x, y, z);
        uvs.push(segment / segments, ring / rings);
      }
    }

    for (let ring = 0; ring < rings; ring++) {
      for (let segment = 0; segment < segments; segment++) {
        const a = ring * (segments + 1) + segment;
        const b = a + segments + 1;

        // Counter-clockwise winding for WebGPU
        indices.push(a, a + 1, b);
        indices.push(b, a + 1, b + 1);
      }
    }

    return new Mesh({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices)
    });
  }

  static createPlane(width: number = 1, height: number = 1, segmentsX: number = 1, segmentsY: number = 1): Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    for (let y = 0; y <= segmentsY; y++) {
      for (let x = 0; x <= segmentsX; x++) {
        const u = x / segmentsX;
        const v = y / segmentsY;

        positions.push(
          (u - 0.5) * width,
          0,
          (v - 0.5) * height
        );

        normals.push(0, 1, 0);
        uvs.push(u, v);
      }
    }

    for (let y = 0; y < segmentsY; y++) {
      for (let x = 0; x < segmentsX; x++) {
        const a = y * (segmentsX + 1) + x;
        const b = a + segmentsX + 1;

        // Counter-clockwise winding when viewed from above (normal points up)
        indices.push(a, b, a + 1);
        indices.push(a + 1, b, b + 1);
      }
    }

    return new Mesh({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices)
    });
  }

  static createCylinder(radius: number = 1, height: number = 2, segments: number = 32): Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const halfHeight = height / 2;

    // Side surface
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      positions.push(cosTheta * radius, -halfHeight, sinTheta * radius);
      normals.push(cosTheta, 0, sinTheta);
      uvs.push(i / segments, 0);

      positions.push(cosTheta * radius, halfHeight, sinTheta * radius);
      normals.push(cosTheta, 0, sinTheta);
      uvs.push(i / segments, 1);
    }

    // Side surface indices
    for (let i = 0; i < segments; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;

      // Counter-clockwise winding when viewed from outside the cylinder
      indices.push(a, b, c);
      indices.push(c, b, d);
    }

    // Bottom cap (y = -halfHeight, normal pointing down)
    const bottomCenterIndex = positions.length / 3;
    positions.push(0, -halfHeight, 0);
    normals.push(0, -1, 0);
    uvs.push(0.5, 0.5);

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      positions.push(cosTheta * radius, -halfHeight, sinTheta * radius);
      normals.push(0, -1, 0);
      uvs.push(cosTheta * 0.5 + 0.5, sinTheta * 0.5 + 0.5);
    }

    for (let i = 0; i < segments; i++) {
      // Counter-clockwise when viewed from below (looking up at bottom cap)
      indices.push(bottomCenterIndex, bottomCenterIndex + i + 1, bottomCenterIndex + i + 2);
    }

    // Top cap (y = halfHeight, normal pointing up)
    const topCenterIndex = positions.length / 3;
    positions.push(0, halfHeight, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);

    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);

      positions.push(cosTheta * radius, halfHeight, sinTheta * radius);
      normals.push(0, 1, 0);
      uvs.push(cosTheta * 0.5 + 0.5, sinTheta * 0.5 + 0.5);
    }

    for (let i = 0; i < segments; i++) {
      // Counter-clockwise when viewed from above (looking down at top cap)
      indices.push(topCenterIndex, topCenterIndex + i + 2, topCenterIndex + i + 1);
    }

    return new Mesh({
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint16Array(indices)
    });
  }
}
