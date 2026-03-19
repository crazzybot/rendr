import { Scene } from '../core/Scene';
import { Camera } from '../components/Camera';
import { MeshRenderer } from '../components/MeshRenderer';
import { DirectionalLight } from '../components/DirectionalLight';

export interface RendererConfig {
  antialias?: boolean;
  powerPreference?: 'low-power' | 'high-performance';
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext | null = null;
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';
  private depthTexture: GPUTexture | null = null;
  private config: RendererConfig;
  private renderLoggedOnce: boolean = false;

  constructor(canvas: HTMLCanvasElement, config: RendererConfig = {}) {
    this.canvas = canvas;
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser');
    }

    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: this.config.powerPreference || 'high-performance'
    });

    if (!this.adapter) {
      throw new Error('Failed to get GPU adapter');
    }

    this.device = await this.adapter.requestDevice();

    if (!this.device) {
      throw new Error('Failed to get GPU device');
    }

    this.device.addEventListener('uncapturederror', (event: any) => {
      console.error('WebGPU uncaptured error:', event.error);
    });

    this.context = this.canvas.getContext('webgpu');

    if (!this.context) {
      throw new Error('Failed to get WebGPU context');
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque'
    });

    this.createDepthTexture();
  }

  private createDepthTexture(): void {
    if (!this.device) return;

    if (this.depthTexture) {
      this.depthTexture.destroy();
    }

    this.depthTexture = this.device.createTexture({
      size: {
        width: this.canvas.width,
        height: this.canvas.height
      },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  render(scene: Scene): void {
    if (!this.device || !this.context) {
      console.error('Renderer: No device or context');
      return;
    }

    if (!this.renderLoggedOnce) {
      console.log('Render function called');
      this.renderLoggedOnce = true;
    }

    const cameraEntities = scene.findEntitiesWithComponent(Camera);
    if (cameraEntities.length === 0) {
      console.warn('No camera found in scene');
      return;
    }

    const camera = cameraEntities[0].getComponent(Camera);
    if (!camera) {
      console.error('Camera component not found');
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: this.depthTexture!.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    };

    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

    // Find the first active directional light in the scene
    const lightEntities = scene.findEntitiesWithComponent(DirectionalLight);
    const light = lightEntities.length > 0 ? lightEntities[0].getComponent(DirectionalLight) || undefined : undefined;

    const meshRenderers = scene.findEntitiesWithComponent(MeshRenderer);
    let renderedCount = 0;
    for (const entity of meshRenderers) {
      const meshRenderer = entity.getComponent(MeshRenderer);
      if (meshRenderer && meshRenderer.enabled) {
        meshRenderer.render(passEncoder, camera, light);
        renderedCount++;
      }
    }

    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  resize(width: number, height: number): void {
    this.createDepthTexture();
  }

  getDevice(): GPUDevice | null {
    return this.device;
  }

  getFormat(): GPUTextureFormat {
    return this.format;
  }

  destroy(): void {
    if (this.depthTexture) {
      this.depthTexture.destroy();
      this.depthTexture = null;
    }

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }
}
