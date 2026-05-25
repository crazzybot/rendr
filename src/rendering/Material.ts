import { Shader, ShaderSource, BasicShader } from './Shader';
import { Sampler } from './Sampler';
import { TextureLoader } from './TextureLoader';
import { Vec4 } from '../math';

export interface MaterialProperties {
  color?: Vec4;
  ambient?: number;
  diffuse?: number;
  specular?: number;
  shininess?: number;
  diffuseTexture?: GPUTexture | null;
  sampler?: GPUSampler | null;
}

export class Material {
  private static readonly defaultWhiteTextureByDevice = new WeakMap<GPUDevice, GPUTexture>();
  private static readonly defaultSamplerByDevice = new WeakMap<GPUDevice, GPUSampler>();

  public shader: Shader;
  public color: Vec4;
  public ambient: number;
  public diffuse: number;
  public specular: number;
  public shininess: number;
  public diffuseTexture: GPUTexture | null;
  public sampler: GPUSampler | null;

  private pipeline: GPURenderPipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private materialBuffer: GPUBuffer | null = null;
  private lightBuffer: GPUBuffer | null = null;

  public topology: GPUPrimitiveTopology;

  constructor(shaderSource?: ShaderSource, properties?: MaterialProperties, topology: GPUPrimitiveTopology = 'triangle-list') {
    this.shader = new Shader(shaderSource || BasicShader);
    this.color = properties?.color || new Vec4(1, 1, 1, 1);
    this.ambient = properties?.ambient ?? 0.2;
    this.diffuse = properties?.diffuse ?? 0.8;
    this.specular = properties?.specular ?? 0.5;
    this.shininess = properties?.shininess ?? 32.0;
    this.diffuseTexture = properties?.diffuseTexture ?? null;
    this.sampler = properties?.sampler ?? null;
    this.topology = topology;
  }

  createPipeline(
    device: GPUDevice,
    format: GPUTextureFormat,
    vertexBufferLayout: GPUVertexBufferLayout
  ): void {
    this.shader.compile(device);

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' }
        },
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' }
        }
      ]
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });

    // 64 (modelMatrix) + 64 (viewProjectionMatrix) + 48 (normalMatrix mat3x3 with column padding) + 16 (pad to 192)
    this.uniformBuffer = device.createBuffer({
      size: 192,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.materialBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.lightBuffer = device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.updateMaterialBuffer(device);

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer }
        },
        {
          binding: 1,
          resource: { buffer: this.materialBuffer }
        },
        {
          binding: 2,
          resource: { buffer: this.lightBuffer }
        },
        {
          binding: 3,
          resource: this.getOrCreateTextureView(device)
        },
        {
          binding: 4,
          resource: this.getOrCreateSampler(device)
        }
      ]
    });

    this.pipeline = device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: this.shader.getShaderModule()!,
        entryPoint: 'vertexMain',
        buffers: [vertexBufferLayout]
      },
      fragment: {
        module: this.shader.getShaderModule()!,
        entryPoint: 'fragmentMain',
        targets: [{ format: format }]
      },
      primitive: {
        topology: this.topology,
        cullMode: this.topology === 'triangle-list' ? 'back' : 'none'
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus'
      }
    });
  }

  private updateMaterialBuffer(device: GPUDevice): void {
    if (!this.materialBuffer) return;

    const materialData = new Float32Array([
      this.color.x, this.color.y, this.color.z, this.color.w,
      this.ambient, this.diffuse, this.specular, this.shininess
    ]);

    device.queue.writeBuffer(this.materialBuffer, 0, materialData);
  }

  updateUniforms(
    device: GPUDevice,
    modelMatrix: Float32Array,
    viewProjectionMatrix: Float32Array,
    normalMatrix: Float32Array | null = null
  ): void {
    if (!this.uniformBuffer) return;

    // 48 floats = 192 bytes: [0..15] model, [16..31] VP, [32..43] normalMatrix (mat3x3 with col padding), [44..47] pad
    const uniformData = new Float32Array(48);
    uniformData.set(modelMatrix, 0);
    uniformData.set(viewProjectionMatrix, 16);
    if (normalMatrix) {
      uniformData.set(normalMatrix, 32);
    }

    device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  updateLightUniforms(
    device: GPUDevice,
    lightDirection: Float32Array,
    lightColor: Float32Array,
    cameraPosition: Float32Array
  ): void {
    if (!this.lightBuffer) return;

    const lightData = new Float32Array(12);
    lightData.set(lightDirection, 0);
    lightData.set(lightColor, 4);
    lightData.set(cameraPosition, 8);

    device.queue.writeBuffer(this.lightBuffer, 0, lightData);
  }

  setColor(color: Vec4): void {
    this.color = color;
  }

  setDiffuseTexture(texture: GPUTexture | null, sampler: GPUSampler | null = null): void {
    this.diffuseTexture = texture;
    if (sampler) {
      this.sampler = sampler;
    }
  }

  private getOrCreateTextureView(device: GPUDevice): GPUTextureView {
    const texture = this.diffuseTexture ?? Material.getDefaultWhiteTexture(device);
    return texture.createView();
  }

  private getOrCreateSampler(device: GPUDevice): GPUSampler {
    if (this.sampler) return this.sampler;

    let fallback = Material.defaultSamplerByDevice.get(device);
    if (!fallback) {
      fallback = Sampler.createLinearRepeat(device);
      Material.defaultSamplerByDevice.set(device, fallback);
    }
    return fallback;
  }

  private static getDefaultWhiteTexture(device: GPUDevice): GPUTexture {
    let texture = this.defaultWhiteTextureByDevice.get(device);
    if (!texture) {
      texture = TextureLoader.createSolidColorTexture(device);
      this.defaultWhiteTextureByDevice.set(device, texture);
    }
    return texture;
  }

  getPipeline(): GPURenderPipeline | null {
    return this.pipeline;
  }

  getBindGroup(): GPUBindGroup | null {
    return this.bindGroup;
  }

  destroy(): void {
    this.shader.destroy();

    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }

    if (this.materialBuffer) {
      this.materialBuffer.destroy();
      this.materialBuffer = null;
    }

    if (this.lightBuffer) {
      this.lightBuffer.destroy();
      this.lightBuffer = null;
    }

    this.diffuseTexture = null;
    this.sampler = null;

    this.pipeline = null;
    this.bindGroup = null;
  }
}
