import { Mesh } from '../rendering/Mesh';
import { Material } from '../rendering/Material';
import { Shader, ShaderSource } from '../rendering/Shader';

export class ResourceManager {
  private static instance: ResourceManager | null = null;

  private meshes: Map<string, Mesh> = new Map();
  private materials: Map<string, Material> = new Map();
  private shaders: Map<string, Shader> = new Map();
  private textures: Map<string, GPUTexture> = new Map();
  private samplers: Map<string, GPUSampler> = new Map();

  private constructor() {}

  static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  registerMesh(name: string, mesh: Mesh): void {
    if (this.meshes.has(name)) {
      console.warn(`Mesh ${name} already exists, overwriting`);
      const existingMesh = this.meshes.get(name);
      existingMesh?.destroy();
    }
    this.meshes.set(name, mesh);
  }

  getMesh(name: string): Mesh | null {
    return this.meshes.get(name) || null;
  }

  unregisterMesh(name: string): void {
    const mesh = this.meshes.get(name);
    if (mesh) {
      mesh.destroy();
      this.meshes.delete(name);
    }
  }

  registerMaterial(name: string, material: Material): void {
    if (this.materials.has(name)) {
      console.warn(`Material ${name} already exists, overwriting`);
      const existingMaterial = this.materials.get(name);
      existingMaterial?.destroy();
    }
    this.materials.set(name, material);
  }

  getMaterial(name: string): Material | null {
    return this.materials.get(name) || null;
  }

  unregisterMaterial(name: string): void {
    const material = this.materials.get(name);
    if (material) {
      material.destroy();
      this.materials.delete(name);
    }
  }

  registerShader(name: string, shader: Shader): void {
    if (this.shaders.has(name)) {
      console.warn(`Shader ${name} already exists, overwriting`);
      const existingShader = this.shaders.get(name);
      existingShader?.destroy();
    }
    this.shaders.set(name, shader);
  }

  getShader(name: string): Shader | null {
    return this.shaders.get(name) || null;
  }

  unregisterShader(name: string): void {
    const shader = this.shaders.get(name);
    if (shader) {
      shader.destroy();
      this.shaders.delete(name);
    }
  }

  registerTexture(name: string, texture: GPUTexture): void {
    if (this.textures.has(name)) {
      console.warn(`Texture ${name} already exists, overwriting`);
      this.textures.get(name)?.destroy();
    }
    this.textures.set(name, texture);
  }

  getTexture(name: string): GPUTexture | null {
    return this.textures.get(name) || null;
  }

  unregisterTexture(name: string): void {
    const texture = this.textures.get(name);
    if (texture) {
      texture.destroy();
      this.textures.delete(name);
    }
  }

  registerSampler(name: string, sampler: GPUSampler): void {
    if (this.samplers.has(name)) {
      console.warn(`Sampler ${name} already exists, overwriting`);
    }
    this.samplers.set(name, sampler);
  }

  getSampler(name: string): GPUSampler | null {
    return this.samplers.get(name) || null;
  }

  unregisterSampler(name: string): void {
    this.samplers.delete(name);
  }

  clear(): void {
    for (const mesh of this.meshes.values()) {
      mesh.destroy();
    }
    this.meshes.clear();

    for (const material of this.materials.values()) {
      material.destroy();
    }
    this.materials.clear();

    for (const shader of this.shaders.values()) {
      shader.destroy();
    }
    this.shaders.clear();

    for (const texture of this.textures.values()) {
      texture.destroy();
    }
    this.textures.clear();

    this.samplers.clear();
  }
}
