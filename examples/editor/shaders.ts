import type { ShaderSource } from '../../src/index';

// Wireframe overlay shader.
// Vertex stage inflates positions by 0.005 along the surface normal so the
// line-list sits just above the solid mesh and avoids z-fighting.
export const WireframeShader: ShaderSource = {
  vertex: `
    struct WireUniforms {
      modelMatrix: mat4x4<f32>,
      viewProjectionMatrix: mat4x4<f32>,
      normalMatrix: mat3x3<f32>,
    };
    @group(0) @binding(0) var<uniform> wu: WireUniforms;
    struct WVIn  { @location(0) position: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) uv: vec2<f32> };
    struct WVOut { @builtin(position) clip: vec4<f32>, @location(0) n: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) wp: vec3<f32> };
    @vertex fn vertexMain(i: WVIn) -> WVOut {
      var o: WVOut;
      let inflated = i.position + i.normal * 0.005;
      let wp = wu.modelMatrix * vec4<f32>(inflated, 1.0);
      o.wp = wp.xyz; o.clip = wu.viewProjectionMatrix * wp;
      o.n = normalize(wu.normalMatrix * i.normal); o.uv = i.uv;
      return o;
    }
  `,
  fragment: `
    struct WireMat { color: vec4<f32>, ambient: f32, diffuse: f32, specular: f32, shininess: f32 };
    struct WireLight { dir: vec3<f32>, _p1: f32, color: vec4<f32>, camPos: vec3<f32>, _p2: f32 };
    @group(0) @binding(1) var<uniform> wmat: WireMat;
    @group(0) @binding(2) var<uniform> wlgt: WireLight;
    struct WFIn { @location(0) n: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) wp: vec3<f32> };
    @fragment fn fragmentMain(i: WFIn) -> @location(0) vec4<f32> {
      return wmat.color;
    }
  `,
};

export const GridShader: ShaderSource = {
  vertex: `
    struct GridTransform {
      modelMatrix: mat4x4<f32>,
      viewProjectionMatrix: mat4x4<f32>,
      normalMatrix: mat3x3<f32>,
    };
    @group(0) @binding(0) var<uniform> gt: GridTransform;
    struct GVIn  { @location(0) position: vec3<f32>, @location(1) normal: vec3<f32>, @location(2) uv: vec2<f32> };
    struct GVOut { @builtin(position) clip: vec4<f32>, @location(0) n: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) wp: vec3<f32> };
    @vertex fn vertexMain(i: GVIn) -> GVOut {
      var o: GVOut;
      let wp = gt.modelMatrix * vec4<f32>(i.position, 1.0);
      o.wp = wp.xyz; o.clip = gt.viewProjectionMatrix * wp;
      o.n = normalize(gt.normalMatrix * i.normal); o.uv = i.uv;
      return o;
    }
  `,
  fragment: `
    struct GMat { color: vec4<f32>, ambient: f32, diffuse: f32, specular: f32, shininess: f32 };
    struct GLight { dir: vec3<f32>, _p1: f32, color: vec4<f32>, camPos: vec3<f32>, _p2: f32 };
    @group(0) @binding(1) var<uniform> gm: GMat;
    @group(0) @binding(2) var<uniform> gl: GLight;
    struct GFIn { @location(0) n: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) wp: vec3<f32> };
    @fragment fn fragmentMain(i: GFIn) -> @location(0) vec4<f32> {
      let p = i.wp.xz; let lw: f32 = 0.010;
      let fx = fract(p.x); let fz = fract(p.y);
      let minor = min(step(fx, lw) + step(1.0 - lw, fx) + step(fz, lw) + step(1.0 - lw, fz), 1.0);
      let mfx = fract(p.x / 5.0); let mfz = fract(p.y / 5.0); let mlw: f32 = 0.005;
      let major = min(step(mfx, mlw) + step(1.0 - mlw, mfx) + step(mfz, mlw) + step(1.0 - mlw, mfz), 1.0);
      var col = vec3<f32>(0.07, 0.07, 0.07);
      col = mix(col, vec3<f32>(0.20, 0.20, 0.20), minor);
      col = mix(col, vec3<f32>(0.32, 0.32, 0.32), major);
      return vec4<f32>(col, 1.0);
    }
  `,
};
