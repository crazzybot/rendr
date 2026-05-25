import { Shader, ShaderSource, BasicShader } from './Shader';
import { Vec4 } from '../math';

export interface MaterialProperties {
  color?: Vec4;
  ambient?: number;
  diffuse?: number;
  specular?: number;
  shininess?: number;
}

export class Material {
  public shader: Shader;
  public color: Vec4;
  public ambient: number;
  public diffuse: number;
  public specular: number;
  public shininess: number;

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

    this.pipeline = null;
    this.bindGroup = null;
  }
}
