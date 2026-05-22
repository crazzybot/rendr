---
description: Creates a custom WGSL shader and wires it into a Rendr Material. Pass a description of the desired visual effect. Example: /rendr-custom-shader pulsing emissive glow based on time
---

Create a custom WGSL shader for this visual effect: $ARGUMENTS

## How shaders plug into Rendr

A `ShaderSource` is `{ vertex: string, fragment: string }` (WGSL strings). Pass it as the first argument to `Material`:

```ts
import { Material } from '../../src/index';

const myShader = {
  vertex: `/* WGSL vertex */`,
  fragment: `/* WGSL fragment */`,
};

const mat = new Material(myShader, { color: new Vec4(1, 0.5, 0, 1) });
```

## Uniform buffer layout (must match exactly)

The Material creates **3 bind group entries** at binding 0, 1, 2. Your shader MUST declare them exactly like this:

### Binding 0 — Transform uniforms (192 bytes)
```wgsl
struct Uniforms {
  modelMatrix      : mat4x4<f32>,   // 64 bytes
  viewProjMatrix   : mat4x4<f32>,   // 64 bytes
  normalMatrix     : mat3x3<f32>,   // 48 bytes (3 × vec4 padded)
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;
```

### Binding 1 — Material properties (32 bytes)
```wgsl
struct MaterialUniforms {
  color     : vec4<f32>,   // 16 bytes
  ambient   : f32,
  diffuse   : f32,
  specular  : f32,
  shininess : f32,
};
@group(0) @binding(1) var<uniform> material: MaterialUniforms;
```

### Binding 2 — Light uniforms (48 bytes)
```wgsl
struct LightUniforms {
  direction      : vec3<f32>,  // + 4-byte pad
  color          : vec4<f32>,
  cameraPosition : vec3<f32>,  // + 4-byte pad
};
@group(0) @binding(2) var<uniform> light: LightUniforms;
```

## Vertex input layout
The vertex buffer is interleaved. Attributes present depend on which are provided to Mesh:

```wgsl
struct VertexInput {
  @location(0) position : vec3<f32>,   // always present
  @location(1) normal   : vec3<f32>,   // if normals provided
  @location(2) uv       : vec2<f32>,   // if uvs provided
  @location(3) color    : vec4<f32>,   // if colors provided
};
```

## BasicShader as starting point (copy-paste to customize)
```wgsl
// VERTEX
struct Uniforms {
  modelMatrix    : mat4x4<f32>,
  viewProjMatrix : mat4x4<f32>,
  normalMatrix   : mat3x3<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexInput  { @location(0) pos: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) uv: vec2<f32> };
struct VertexOutput { @builtin(position) clip: vec4<f32>, @location(0) worldPos: vec3<f32>, @location(1) worldNormal: vec3<f32>, @location(2) uv: vec2<f32> };

@vertex fn vs(v: VertexInput) -> VertexOutput {
  let worldPos = uniforms.modelMatrix * vec4<f32>(v.pos, 1.0);
  var out: VertexOutput;
  out.clip        = uniforms.viewProjMatrix * worldPos;
  out.worldPos    = worldPos.xyz;
  out.worldNormal = normalize(uniforms.normalMatrix * v.normal);
  out.uv          = v.uv;
  return out;
}

// FRAGMENT
struct MaterialUniforms { color: vec4<f32>, ambient: f32, diffuse: f32, specular: f32, shininess: f32 };
struct LightUniforms     { direction: vec3<f32>, color: vec4<f32>, cameraPosition: vec3<f32> };
@group(0) @binding(1) var<uniform> material : MaterialUniforms;
@group(0) @binding(2) var<uniform> light    : LightUniforms;

@fragment fn fs(in: VertexOutput) -> @location(0) vec4<f32> {
  let n      = normalize(in.worldNormal);
  let l      = normalize(-light.direction);
  let v      = normalize(light.cameraPosition - in.worldPos);
  let h      = normalize(l + v);

  let diff   = max(dot(n, l), 0.0);
  let spec   = pow(max(dot(n, h), 0.0), material.shininess);

  let col    = material.color.rgb * light.color.rgb;
  let lit    = col * (material.ambient + material.diffuse * diff)
             + light.color.rgb * material.specular * spec;
  return vec4<f32>(lit, material.color.a);
}
```

## UnlitShader as starting point
```wgsl
// VERTEX (same uniforms struct, no normal needed for output)
// FRAGMENT
@fragment fn fs(in: VertexOutput) -> @location(0) vec4<f32> {
  return material.color;
}
```

## Adding extra uniforms (e.g., a time value)

Create a second bind group or — simpler — repurpose an unused material field like `shininess` as your time value:
```ts
// In a component's onUpdate:
myMaterial.shininess = performance.now() / 1000;  // seconds
// Then write it to the GPU:
const device = engine.getRenderer().getDevice()!;
myMaterial.updateUniforms(device, ...);
```

Or add a dedicated buffer by subclassing Material (advanced).

## Gotchas
- All three binding slots (0, 1, 2) must be declared in every shader — even if unused — because `createPipeline` always creates and binds all three buffers
- WGSL struct alignment follows std140 rules: vec3 is padded to 16 bytes; mat3x3 columns are vec4-padded
- Shader compilation errors appear asynchronously in the browser console (not thrown)
- `normalMatrix` in binding 0 is the transpose of the inverse of the 3×3 model matrix — use it for correct lighting under non-uniform scale
