export interface MeshData {
  positions: Float32Array;
  normals?: Float32Array;
  uvs?: Float32Array;
  colors?: Float32Array;
  indices?: Uint16Array | Uint32Array;
}

/**
 * Mesh class represents the geometry of a 3D object, including vertex data and index data.
 * It provides methods to create GPU buffers for rendering and to define the vertex buffer layout.
 * The Mesh class is designed to be flexible, allowing for optional normals, UVs, and colors.
 */
export class Mesh {
  public positions: Float32Array; // Required vertex positions for the mesh
  public normals?: Float32Array; // Optional normals for lighting calculations
  public uvs?: Float32Array; // Optional UV coordinates for texturing
  public colors?: Float32Array; // Optional vertex colors for coloring the mesh without textures
  public indices?: Uint16Array | Uint32Array;

  public vertexBuffer: GPUBuffer | null = null;
  public indexBuffer: GPUBuffer | null = null;
  public indexCount: number = 0;

  constructor(data: MeshData) {
    this.positions = data.positions;
    this.normals = data.normals;
    this.uvs = data.uvs;
    this.colors = data.colors;
    this.indices = data.indices;

    if (this.indices) {
      this.indexCount = this.indices.length;
    }
  }

  createBuffers(device: GPUDevice): void {
    const vertexData: number[] = [];

    const vertexCount = this.positions.length / 3;

    for (let i = 0; i < vertexCount; i++) {
      vertexData.push(
        this.positions[i * 3],
        this.positions[i * 3 + 1],
        this.positions[i * 3 + 2]
      );

      if (this.normals) {
        vertexData.push(
          this.normals[i * 3],
          this.normals[i * 3 + 1],
          this.normals[i * 3 + 2]
        );
      }

      if (this.uvs) {
        vertexData.push(
          this.uvs[i * 2],
          this.uvs[i * 2 + 1]
        );
      }

      if (this.colors) {
        vertexData.push(
          this.colors[i * 4],
          this.colors[i * 4 + 1],
          this.colors[i * 4 + 2],
          this.colors[i * 4 + 3]
        );
      }
    }

    const vertexArray = new Float32Array(vertexData);

    this.vertexBuffer = device.createBuffer({
      size: vertexArray.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexArray);
    this.vertexBuffer.unmap();

    if (this.indices) {
      this.indexBuffer = device.createBuffer({
        size: this.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true
      });

      if (this.indices instanceof Uint16Array) {
        new Uint16Array(this.indexBuffer.getMappedRange()).set(this.indices);
      } else {
        new Uint32Array(this.indexBuffer.getMappedRange()).set(this.indices);
      }

      this.indexBuffer.unmap();
    }
  }

  getVertexBufferLayout(): GPUVertexBufferLayout {
    const attributes: GPUVertexAttribute[] = [];
    let offset = 0;
    let location = 0;

    attributes.push({
      shaderLocation: location++,
      offset: offset,
      format: 'float32x3'
    });
    offset += 12;

    if (this.normals) {
      attributes.push({
        shaderLocation: location++,
        offset: offset,
        format: 'float32x3'
      });
      offset += 12;
    }

    if (this.uvs) {
      attributes.push({
        shaderLocation: location++,
        offset: offset,
        format: 'float32x2'
      });
      offset += 8;
    }

    if (this.colors) {
      attributes.push({
        shaderLocation: location++,
        offset: offset,
        format: 'float32x4'
      });
      offset += 16;
    }

    return {
      arrayStride: offset,
      attributes: attributes
    };
  }

  destroy(): void {
    if (this.vertexBuffer) {
      this.vertexBuffer.destroy();
      this.vertexBuffer = null;
    }

    if (this.indexBuffer) {
      this.indexBuffer.destroy();
      this.indexBuffer = null;
    }
  }
}
