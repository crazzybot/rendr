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
  private initialized: boolean = false;

  setMesh(mesh: Mesh): void {
    this.mesh = mesh;
    this.initialized = false;
  }

  setMaterial(material: Material): void {
    this.material = material;
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  initialize(device: GPUDevice, format: GPUTextureFormat): void {
    if (this.initialized || !this.mesh || !this.material) return;

    this.device = device;

    this.mesh.createBuffers(device);
    this.material.createPipeline(device, format, this.mesh.getVertexBufferLayout());

    this.initialized = true;
  }

  render(passEncoder: GPURenderPassEncoder, camera: Camera, light?: DirectionalLight): void {
    if (!this.initialized || !this.mesh || !this.material || !this.entity || !this.device) return;

    const pipeline = this.material.getPipeline();
    const bindGroup = this.material.getBindGroup();
    if (!pipeline || !bindGroup) return;

    const modelMatrix = this.entity.transform.getWorldMatrix();
    const viewProjectionMatrix = camera.getViewProjectionMatrix();

    // Normal matrix = transpose(inverse(model 3x3)) — correct under non-uniform scale.
    // Packed as WGSL mat3x3: 3 columns × 4 floats (vec3 padded to vec4 alignment).
    let normalMatrix: Float32Array | null = null;
    const invModel = modelMatrix.invert();
    if (invModel) {
      const e = invModel.elements;
      normalMatrix = new Float32Array([
        e[0], e[4], e[8],  0,
        e[1], e[5], e[9],  0,
        e[2], e[6], e[10], 0,
      ]);
    }

    this.material.updateUniforms(
      this.device,
      modelMatrix.elements,
      viewProjectionMatrix.elements,
      normalMatrix
    );

    if (light) {
      const lightDir = light.getDirection();
      const lightColor = light.getFinalColor();
      const cameraPos = camera.entity?.transform.position ?? new Vec3(0, 0, 0);

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
