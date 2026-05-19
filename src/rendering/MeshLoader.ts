import { Mesh } from './Mesh';

export class MeshLoader {
  static async loadOBJ(url: string): Promise<Mesh> {
    const response = await fetch(url);
    const text = await response.text();
    return this.parseOBJ(text);
  }

  static parseOBJ(objText: string): Mesh {
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const tempPositions: number[] = [];
    const tempNormals: number[] = [];
    const tempUVs: number[] = [];

    const vertexMap = new Map<string, number>();
    let currentIndex = 0;

    const lines = objText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split(/\s+/);
      const type = parts[0];

      switch (type) {
        case 'v':
          tempPositions.push(
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          );
          break;

        case 'vn':
          tempNormals.push(
            parseFloat(parts[1]),
            parseFloat(parts[2]),
            parseFloat(parts[3])
          );
          break;

        case 'vt':
          tempUVs.push(
            parseFloat(parts[1]),
            parseFloat(parts[2])
          );
          break;

        case 'f':
          const faceVertices = parts.slice(1);
          const faceIndices: number[] = [];

          for (const vertex of faceVertices) {
            let index = vertexMap.get(vertex);

            if (index === undefined) {
              const components = vertex.split('/');
              const posIndex = parseInt(components[0]) - 1;
              const uvIndex = components[1] ? parseInt(components[1]) - 1 : -1;
              const normalIndex = components[2] ? parseInt(components[2]) - 1 : -1;

              positions.push(
                tempPositions[posIndex * 3],
                tempPositions[posIndex * 3 + 1],
                tempPositions[posIndex * 3 + 2]
              );

              if (uvIndex >= 0 && tempUVs.length > 0) {
                uvs.push(
                  tempUVs[uvIndex * 2],
                  tempUVs[uvIndex * 2 + 1]
                );
              }

              if (normalIndex >= 0 && tempNormals.length > 0) {
                normals.push(
                  tempNormals[normalIndex * 3],
                  tempNormals[normalIndex * 3 + 1],
                  tempNormals[normalIndex * 3 + 2]
                );
              }

              index = currentIndex++;
              vertexMap.set(vertex, index);
            }

            faceIndices.push(index);
          }

          // Triangulate polygon faces (if more than 3 vertices)
          for (let i = 1; i < faceIndices.length - 1; i++) {
            indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
          }
          break;
      }
    }

    // Generate normals if they weren't in the file
    if (normals.length === 0 && positions.length > 0) {
      const generatedNormals = this.generateNormals(
        new Float32Array(positions),
        new Uint32Array(indices)
      );
      normals.push(...Array.from(generatedNormals));
    }

    return new Mesh({
      positions: new Float32Array(positions),
      normals: normals.length > 0 ? new Float32Array(normals) : undefined,
      uvs: uvs.length > 0 ? new Float32Array(uvs) : undefined,
      indices: indices.length < 65536 ? new Uint16Array(indices) : new Uint32Array(indices)
    });
  }

  private static generateNormals(positions: Float32Array, indices: Uint32Array): Float32Array {
    const normals = new Float32Array(positions.length);

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;

      const v0x = positions[i0];
      const v0y = positions[i0 + 1];
      const v0z = positions[i0 + 2];

      const v1x = positions[i1];
      const v1y = positions[i1 + 1];
      const v1z = positions[i1 + 2];

      const v2x = positions[i2];
      const v2y = positions[i2 + 1];
      const v2z = positions[i2 + 2];

      const e1x = v1x - v0x;
      const e1y = v1y - v0y;
      const e1z = v1z - v0z;

      const e2x = v2x - v0x;
      const e2y = v2y - v0y;
      const e2z = v2z - v0z;

      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;

      normals[i0] += nx;
      normals[i0 + 1] += ny;
      normals[i0 + 2] += nz;

      normals[i1] += nx;
      normals[i1 + 1] += ny;
      normals[i1 + 2] += nz;

      normals[i2] += nx;
      normals[i2 + 1] += ny;
      normals[i2 + 2] += nz;
    }

    for (let i = 0; i < normals.length; i += 3) {
      const nx = normals[i];
      const ny = normals[i + 1];
      const nz = normals[i + 2];
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);

      if (length > 0) {
        normals[i] /= length;
        normals[i + 1] /= length;
        normals[i + 2] /= length;
      }
    }

    return normals;
  }
}
