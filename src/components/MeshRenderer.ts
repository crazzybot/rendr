import { Component } from '../core/Component';
import { Mesh } from '../rendering/Mesh';
import { Material } from '../rendering/Material';
import { Camera } from './Camera';
import { DirectionalLight } from './DirectionalLight';
import { Vec3 } from '../math/Vec3';

export class MeshRenderer extends Component {
  public mesh: Mesh | null = null;
  public material: Material | null = null;

  private device: GPUDevice | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';
  private initialized: boolean = false;
  private renderLoggedOnce: boolean = false;

  setMesh(mesh: Mesh): void {
    this.mesh = mesh;
    this.initialized = false;
  }

  setMaterial(material: Material): void {
    this.material = material;
    this.initialized = false;
  }

  initialize(device: GPUDevice, format: GPUTextureFormat): void {
    if (this.initialized || !this.mesh || !this.material) return;

    this.device = device;
    this.format = format;

    this.mesh.createBuffers(device);
    this.material.createPipeline(device, format, this.mesh.getVertexBufferLayout());

    this.initialized = true;
  }

  render(passEncoder: GPURenderPassEncoder, camera: Camera, light?: DirectionalLight): void {
    if (!this.initialized || !this.mesh || !this.material || !this.entity || !this.device) {
      if (!this.renderLoggedOnce) {
        console.log('MeshRenderer render early return:', {
          initialized: this.initialized,
          hasMesh: !!this.mesh,
          hasMaterial: !!this.material,
          hasEntity: !!this.entity,
          hasDevice: !!this.device
        });
        this.renderLoggedOnce = true;
      }
      return;
    }

    const pipeline = this.material.getPipeline();
    const bindGroup = this.material.getBindGroup();

    if (!pipeline || !bindGroup) {
      if (!this.renderLoggedOnce) {
        console.log('MeshRenderer missing pipeline or bindGroup:', { pipeline: !!pipeline, bindGroup: !!bindGroup });
        this.renderLoggedOnce = true;
      }
      return;
    }

    if (!this.renderLoggedOnce) {
      console.log('MeshRenderer.render executing draw call for', this.entity.name);
      this.renderLoggedOnce = true;
    }

    const modelMatrix = this.entity.transform.getWorldMatrix();
    const viewProjectionMatrix = camera.getViewProjectionMatrix();

    // Transpose in JS before sending to GPU
    this.material.updateUniforms(
      this.device,
      modelMatrix.elements,
      viewProjectionMatrix.elements
    );

    // Update light uniforms if a light is provided
    if (light) {
      const lightDir = light.getDirection();
      const lightColor = light.getFinalColor();
      const cameraPos = camera.entity?.transform.position || new Vec3(0, 0, 0);

      this.material.updateLightUniforms(
        this.device,
        new Float32Array([lightDir.x, lightDir.y, lightDir.z]),
        new Float32Array([lightColor.x, lightColor.y, lightColor.z, lightColor.w]),
        new Float32Array([cameraPos.x, cameraPos.y, cameraPos.z])
      );
    }

    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);

    if (this.mesh.vertexBuffer) {
      passEncoder.setVertexBuffer(0, this.mesh.vertexBuffer);
    }

    if (this.mesh.indexBuffer && this.mesh.indices) {
      passEncoder.setIndexBuffer(
        this.mesh.indexBuffer,
        this.mesh.indices instanceof Uint16Array ? 'uint16' : 'uint32'
      );
      passEncoder.drawIndexed(this.mesh.indexCount);
    } else {
      passEncoder.draw(this.mesh.positions.length / 3);
    }
  }

  onDestroy(): void {
    if (this.mesh) {
      this.mesh.destroy();
    }

    if (this.material) {
      this.material.destroy();
    }
  }
}
