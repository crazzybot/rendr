export interface ShaderSource {
  vertex: string;
  fragment: string;
}

export class Shader {
  public source: ShaderSource;
  private shaderModule: GPUShaderModule | null = null;

  constructor(source: ShaderSource) {
    this.source = source;
  }

  compile(device: GPUDevice): void {
    const code = `
      ${this.source.vertex}
      ${this.source.fragment}
    `;

    this.shaderModule = device.createShaderModule({
      code: code
    });

    this.shaderModule.getCompilationInfo().then((info) => {
      for (const message of info.messages) {
        if (message.type === 'error') {
          console.error('Shader compilation error:', message.message, 'at line', message.lineNum);
        } else if (message.type === 'warning') {
          console.warn('Shader compilation warning:', message.message, 'at line', message.lineNum);
        }
      }
    });
  }

  getShaderModule(): GPUShaderModule | null {
    return this.shaderModule;
  }

  destroy(): void {
    this.shaderModule = null;
  }
}

export const BasicShader: ShaderSource = {
  vertex: `
    struct Uniforms {
      modelMatrix: mat4x4<f32>,
      viewProjectionMatrix: mat4x4<f32>,
    };

    @group(0) @binding(0) var<uniform> uniforms: Uniforms;

    struct VertexInput {
      @location(0) position: vec3<f32>,
      @location(1) normal: vec3<f32>,
      @location(2) uv: vec2<f32>,
    };

    struct VertexOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) normal: vec3<f32>,
      @location(1) uv: vec2<f32>,
      @location(2) worldPosition: vec3<f32>,
    };

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
      var output: VertexOutput;

      let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
      output.position = uniforms.viewProjectionMatrix * worldPos;
      // output.position = worldPos;
      output.worldPosition = worldPos.xyz;
      output.normal = (uniforms.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
      output.uv = input.uv;

      return output;
    }
  `,
  fragment: `
    struct MaterialUniforms {
      color: vec4<f32>,
      ambient: f32,
      diffuse: f32,
      specular: f32,
      shininess: f32,
    };

    @group(0) @binding(1) var<uniform> material: MaterialUniforms;

    struct FragmentInput {
      @location(0) normal: vec3<f32>,
      @location(1) uv: vec2<f32>,
      @location(2) worldPosition: vec3<f32>,
    };

    @fragment
    fn fragmentMain(input: FragmentInput) -> @location(0) vec4<f32> {
      // Simple unlit color for now
      return material.color;
    }
  `
};

export const UnlitShader: ShaderSource = {
  vertex: `
    struct Uniforms {
      modelMatrix: mat4x4<f32>,
      viewProjectionMatrix: mat4x4<f32>,
    };

    @group(0) @binding(0) var<uniform> uniforms: Uniforms;

    struct VertexInput {
      @location(0) position: vec3<f32>,
      @location(1) normal: vec3<f32>,
      @location(2) uv: vec2<f32>,
    };

    struct VertexOutput {
      @builtin(position) position: vec4<f32>,
      @location(0) uv: vec2<f32>,
    };

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
      var output: VertexOutput;

      let worldPos = uniforms.modelMatrix * vec4<f32>(input.position, 1.0);
      output.position = uniforms.viewProjectionMatrix * worldPos;
      output.uv = input.uv;

      return output;
    }
  `,
  fragment: `
    struct MaterialUniforms {
      color: vec4<f32>,
      ambient: f32,
      diffuse: f32,
      specular: f32,
      shininess: f32,
    };

    @group(0) @binding(1) var<uniform> material: MaterialUniforms;

    @fragment
    fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
      return material.color;
    }
  `
};
