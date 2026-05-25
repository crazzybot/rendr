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
      normalMatrix: mat3x3<f32>,
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
      output.worldPosition = worldPos.xyz;
      output.normal = normalize(uniforms.normalMatrix * input.normal);
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

    struct LightUniforms {
      direction: vec3<f32>,
      _padding1: f32,
      color: vec4<f32>,
      cameraPosition: vec3<f32>,
      _padding2: f32,
    };

    @group(0) @binding(1) var<uniform> material: MaterialUniforms;
    @group(0) @binding(2) var<uniform> light: LightUniforms;
    @group(0) @binding(3) var diffuseTexture: texture_2d<f32>;
    @group(0) @binding(4) var diffuseSampler: sampler;

    struct FragmentInput {
      @location(0) normal: vec3<f32>,
      @location(1) uv: vec2<f32>,
      @location(2) worldPosition: vec3<f32>,
    };

    @fragment
    fn fragmentMain(input: FragmentInput) -> @location(0) vec4<f32> {
      let sampled = textureSample(diffuseTexture, diffuseSampler, input.uv);
      let baseColor = material.color * sampled;
      let normal = normalize(input.normal);
      let lightDir = normalize(-light.direction);

      // Ambient
      let ambient = material.ambient * baseColor.rgb * light.color.rgb;

      // Diffuse
      let diff = max(dot(normal, lightDir), 0.0);
      let diffuse = material.diffuse * diff * baseColor.rgb * light.color.rgb;

      // Specular
      let viewDir = normalize(light.cameraPosition - input.worldPosition);
      let reflectDir = reflect(-lightDir, normal);
      let spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
      let specular = material.specular * spec * light.color.rgb;

      let finalColor = ambient + diffuse + specular;
      return vec4<f32>(finalColor, baseColor.a);
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
    @group(0) @binding(3) var diffuseTexture: texture_2d<f32>;
    @group(0) @binding(4) var diffuseSampler: sampler;

    @fragment
    fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
      return material.color * textureSample(diffuseTexture, diffuseSampler, uv);
    }
  `
};
