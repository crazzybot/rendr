import { Vec4 } from '../math';
import { Material } from './Material';
import { Mesh } from './Mesh';
import { Sampler } from './Sampler';
import { TextureLoader } from './TextureLoader';

interface GltfBuffer {
  uri?: string;
  byteLength: number;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4';
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
}

interface GltfMesh {
  name?: string;
  primitives: GltfPrimitive[];
}

interface GltfImage {
  uri?: string;
}

interface GltfSampler {
  magFilter?: number;
  minFilter?: number;
  wrapS?: number;
  wrapT?: number;
}

interface GltfTexture {
  sampler?: number;
  source?: number;
}

interface GltfPbrMetallicRoughness {
  baseColorFactor?: [number, number, number, number];
  baseColorTexture?: { index: number };
}

interface GltfMaterial {
  pbrMetallicRoughness?: GltfPbrMetallicRoughness;
}

interface GltfDocument {
  buffers?: GltfBuffer[];
  bufferViews?: GltfBufferView[];
  accessors?: GltfAccessor[];
  meshes?: GltfMesh[];
  images?: GltfImage[];
  samplers?: GltfSampler[];
  textures?: GltfTexture[];
  materials?: GltfMaterial[];
}

export interface GltfPrimitiveResult {
  mesh: Mesh;
  material: Material;
  meshName?: string;
}

export interface GltfLoadResult {
  primitives: GltfPrimitiveResult[];
  textures: GPUTexture[];
  samplers: GPUSampler[];
}

export class GltfLoader {
  static async load(url: string, device: GPUDevice): Promise<GltfLoadResult> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load glTF: ${url}`);
    }

    const gltf = (await response.json()) as GltfDocument;
    const baseUrl = new URL('.', url).toString();

    const buffers = await this.loadBuffers(gltf, baseUrl);
    const textures = await this.loadTextures(gltf, baseUrl, device);
    const samplers = this.loadSamplers(gltf, device);

    const primitives: GltfPrimitiveResult[] = [];
    for (const mesh of gltf.meshes ?? []) {
      for (const primitive of mesh.primitives) {
        if (primitive.mode !== undefined && primitive.mode !== 4) {
          continue;
        }

        const meshData = this.createMeshFromPrimitive(gltf, buffers, primitive);
        if (!meshData) continue;

        const material = this.createMaterialForPrimitive(gltf, primitive, textures, samplers);
        primitives.push({ mesh: meshData, material, meshName: mesh.name });
      }
    }

    return { primitives, textures, samplers };
  }

  private static async loadBuffers(gltf: GltfDocument, baseUrl: string): Promise<ArrayBuffer[]> {
    const buffers: ArrayBuffer[] = [];
    for (const buffer of gltf.buffers ?? []) {
      if (!buffer.uri) {
        throw new Error('Only uri-based .gltf buffers are supported in this loader');
      }
      const resolved = new URL(buffer.uri, baseUrl).toString();
      const response = await fetch(resolved);
      if (!response.ok) {
        throw new Error(`Failed to load glTF buffer: ${resolved}`);
      }
      buffers.push(await response.arrayBuffer());
    }
    return buffers;
  }

  private static async loadTextures(
    gltf: GltfDocument,
    baseUrl: string,
    device: GPUDevice
  ): Promise<GPUTexture[]> {
    const textures: GPUTexture[] = [];
    for (const image of gltf.images ?? []) {
      if (!image.uri) {
        throw new Error('Only uri-based glTF images are supported in this loader');
      }
      const resolved = new URL(image.uri, baseUrl).toString();
      textures.push(await TextureLoader.loadTexture(resolved, device));
    }
    return textures;
  }

  private static loadSamplers(gltf: GltfDocument, device: GPUDevice): GPUSampler[] {
    const gltfSamplers = gltf.samplers ?? [];
    if (gltfSamplers.length === 0) {
      return [Sampler.createLinearRepeat(device)];
    }
    return gltfSamplers.map(s => Sampler.fromGltf(device, s));
  }

  private static createMeshFromPrimitive(
    gltf: GltfDocument,
    buffers: ArrayBuffer[],
    primitive: GltfPrimitive
  ): Mesh | null {
    const positionAccessorIndex = primitive.attributes.POSITION;
    if (positionAccessorIndex === undefined) {
      return null;
    }

    const positions = this.readAccessorAsFloat32(gltf, buffers, positionAccessorIndex);
    const vertexCount = positions.length / 3;

    let normals: Float32Array | undefined;
    const normalAccessorIndex = primitive.attributes.NORMAL;
    if (normalAccessorIndex !== undefined) {
      normals = this.readAccessorAsFloat32(gltf, buffers, normalAccessorIndex);
    }

    let uvs: Float32Array | undefined;
    const uvAccessorIndex = primitive.attributes.TEXCOORD_0;
    if (uvAccessorIndex !== undefined) {
      uvs = this.readAccessorAsFloat32(gltf, buffers, uvAccessorIndex);
    }

    const indices =
      primitive.indices !== undefined
        ? this.readIndicesAccessor(gltf, buffers, primitive.indices)
        : undefined;

    if (!normals) {
      normals = this.generateNormals(positions, indices);
    }

    if (!uvs) {
      uvs = new Float32Array(vertexCount * 2);
    }

    return new Mesh({ positions, normals, uvs, indices });
  }

  private static createMaterialForPrimitive(
    gltf: GltfDocument,
    primitive: GltfPrimitive,
    textures: GPUTexture[],
    samplers: GPUSampler[]
  ): Material {
    if (primitive.material === undefined || !gltf.materials?.[primitive.material]) {
      return new Material();
    }

    const srcMaterial = gltf.materials[primitive.material];
    const pbr = srcMaterial.pbrMetallicRoughness;
    const baseColor = pbr?.baseColorFactor ?? [1, 1, 1, 1];

    const material = new Material(undefined, {
      color: new Vec4(baseColor[0], baseColor[1], baseColor[2], baseColor[3]),
    });

    const baseColorTextureIndex = pbr?.baseColorTexture?.index;
    if (baseColorTextureIndex !== undefined && gltf.textures?.[baseColorTextureIndex]) {
      const textureDef = gltf.textures[baseColorTextureIndex];
      const texture =
        textureDef.source !== undefined ? textures[textureDef.source] ?? null : null;
      const sampler =
        textureDef.sampler !== undefined
          ? samplers[textureDef.sampler] ?? null
          : samplers[0] ?? null;
      material.setDiffuseTexture(texture, sampler);
    }

    return material;
  }

  private static readAccessorAsFloat32(
    gltf: GltfDocument,
    buffers: ArrayBuffer[],
    accessorIndex: number
  ): Float32Array {
    const accessor = gltf.accessors?.[accessorIndex];
    if (!accessor || accessor.bufferView === undefined) {
      throw new Error(`Invalid glTF accessor at index ${accessorIndex}`);
    }

    const bufferView = gltf.bufferViews?.[accessor.bufferView];
    if (!bufferView) {
      throw new Error(`Missing bufferView for accessor ${accessorIndex}`);
    }

    const buffer = buffers[bufferView.buffer];
    if (!buffer) {
      throw new Error(`Missing buffer ${bufferView.buffer} for accessor ${accessorIndex}`);
    }

    const componentSize = this.getComponentSize(accessor.componentType);
    const componentsPerElement = this.getComponentsPerType(accessor.type);
    const elementSize = componentSize * componentsPerElement;
    const stride = bufferView.byteStride ?? elementSize;
    const baseOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

    const view = new DataView(buffer);
    const output = new Float32Array(accessor.count * componentsPerElement);

    for (let i = 0; i < accessor.count; i++) {
      const elementOffset = baseOffset + i * stride;
      for (let c = 0; c < componentsPerElement; c++) {
        const value = this.readComponent(view, accessor.componentType, elementOffset + c * componentSize);
        output[i * componentsPerElement + c] = accessor.normalized
          ? this.normalizeComponent(value, accessor.componentType)
          : value;
      }
    }

    return output;
  }

  private static readIndicesAccessor(
    gltf: GltfDocument,
    buffers: ArrayBuffer[],
    accessorIndex: number
  ): Uint16Array | Uint32Array {
    const accessor = gltf.accessors?.[accessorIndex];
    if (!accessor || accessor.bufferView === undefined) {
      throw new Error(`Invalid index accessor at index ${accessorIndex}`);
    }

    const bufferView = gltf.bufferViews?.[accessor.bufferView];
    if (!bufferView) {
      throw new Error(`Missing bufferView for accessor ${accessorIndex}`);
    }

    const buffer = buffers[bufferView.buffer];
    if (!buffer) {
      throw new Error(`Missing buffer ${bufferView.buffer} for accessor ${accessorIndex}`);
    }

    const componentSize = this.getComponentSize(accessor.componentType);
    const stride = bufferView.byteStride ?? componentSize;
    const baseOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const view = new DataView(buffer);

    if (accessor.componentType === 5125) {
      const output = new Uint32Array(accessor.count);
      for (let i = 0; i < accessor.count; i++) {
        output[i] = view.getUint32(baseOffset + i * stride, true);
      }
      return output;
    }

    const output = new Uint16Array(accessor.count);
    for (let i = 0; i < accessor.count; i++) {
      const offset = baseOffset + i * stride;
      switch (accessor.componentType) {
        case 5121:
          output[i] = view.getUint8(offset);
          break;
        case 5123:
          output[i] = view.getUint16(offset, true);
          break;
        default:
          throw new Error(`Unsupported glTF index component type: ${accessor.componentType}`);
      }
    }
    return output;
  }

  private static generateNormals(
    positions: Float32Array,
    indices?: Uint16Array | Uint32Array
  ): Float32Array {
    const normals = new Float32Array(positions.length);

    const triangleCount = indices ? indices.length / 3 : positions.length / 9;
    for (let t = 0; t < triangleCount; t++) {
      const i0 = indices ? indices[t * 3] : t * 3;
      const i1 = indices ? indices[t * 3 + 1] : t * 3 + 1;
      const i2 = indices ? indices[t * 3 + 2] : t * 3 + 2;

      const ax = positions[i0 * 3];
      const ay = positions[i0 * 3 + 1];
      const az = positions[i0 * 3 + 2];
      const bx = positions[i1 * 3];
      const by = positions[i1 * 3 + 1];
      const bz = positions[i1 * 3 + 2];
      const cx = positions[i2 * 3];
      const cy = positions[i2 * 3 + 1];
      const cz = positions[i2 * 3 + 2];

      const abx = bx - ax;
      const aby = by - ay;
      const abz = bz - az;
      const acx = cx - ax;
      const acy = cy - ay;
      const acz = cz - az;

      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;

      normals[i0 * 3] += nx;
      normals[i0 * 3 + 1] += ny;
      normals[i0 * 3 + 2] += nz;
      normals[i1 * 3] += nx;
      normals[i1 * 3 + 1] += ny;
      normals[i1 * 3 + 2] += nz;
      normals[i2 * 3] += nx;
      normals[i2 * 3 + 1] += ny;
      normals[i2 * 3 + 2] += nz;
    }

    for (let i = 0; i < normals.length; i += 3) {
      const nx = normals[i];
      const ny = normals[i + 1];
      const nz = normals[i + 2];
      const len = Math.hypot(nx, ny, nz);
      if (len > 0) {
        normals[i] = nx / len;
        normals[i + 1] = ny / len;
        normals[i + 2] = nz / len;
      }
    }

    return normals;
  }

  private static getComponentsPerType(type: GltfAccessor['type']): number {
    switch (type) {
      case 'SCALAR':
        return 1;
      case 'VEC2':
        return 2;
      case 'VEC3':
        return 3;
      case 'VEC4':
        return 4;
      default:
        return 1;
    }
  }

  private static getComponentSize(componentType: number): number {
    switch (componentType) {
      case 5120:
      case 5121:
        return 1;
      case 5122:
      case 5123:
        return 2;
      case 5125:
      case 5126:
        return 4;
      default:
        throw new Error(`Unsupported glTF component type: ${componentType}`);
    }
  }

  private static readComponent(view: DataView, componentType: number, byteOffset: number): number {
    switch (componentType) {
      case 5120:
        return view.getInt8(byteOffset);
      case 5121:
        return view.getUint8(byteOffset);
      case 5122:
        return view.getInt16(byteOffset, true);
      case 5123:
        return view.getUint16(byteOffset, true);
      case 5125:
        return view.getUint32(byteOffset, true);
      case 5126:
        return view.getFloat32(byteOffset, true);
      default:
        throw new Error(`Unsupported glTF component type: ${componentType}`);
    }
  }

  private static normalizeComponent(value: number, componentType: number): number {
    switch (componentType) {
      case 5120:
        return Math.max(value / 127, -1);
      case 5121:
        return value / 255;
      case 5122:
        return Math.max(value / 32767, -1);
      case 5123:
        return value / 65535;
      default:
        return value;
    }
  }
}
