# Rendr Roadmap Prioritized Implementation Plan

Date: 2026-05-25
Scope: Remaining roadmap items from README

## Priority Order (Highest to Lowest)

1. Texture support
2. glTF model loading
3. Scene serialization
4. Animation system
5. Performance profiling tools
6. Advanced lighting (point lights, spot lights, shadows)
7. Audio system
8. Post-processing effects
9. Particle system

## Why This Order

- Texture support is the minimum visual baseline for almost all real assets.
- glTF loading unlocks production-ready models and materials from DCC tools.
- Scene serialization enables reproducible worlds and editor workflows.
- Animation system becomes practical after glTF assets are in place.
- Profiling tools should exist before expensive rendering features scale up.
- Advanced lighting, post-processing, and particles are quality multipliers but rely on strong core pipelines.
- Audio improves product quality but is weakly coupled to rendering foundations and can land in parallel later.

## Execution Phases

### Phase 1: Asset Foundation (Must Have)

Includes:
- Texture support
- glTF model loading

Goal:
- Load and render textured external assets in a scene with predictable memory and lifecycle handling.

Implementation tasks:
- Add texture abstractions in rendering:
  - src/rendering/TextureLoader.ts
  - src/rendering/Sampler.ts
- Extend material system with optional texture bindings:
  - src/rendering/Material.ts
  - src/rendering/Shader.ts
- Add resource cache support for textures:
  - src/resources/ResourceManager.ts
- Add glTF loader pipeline:
  - src/rendering/GltfLoader.ts (new)
  - Map meshes, materials, textures into existing Mesh and Material classes.
- Export new modules:
  - src/rendering/index.ts
  - src/index.ts

Acceptance criteria:
- A textured glTF model renders correctly in examples.
- Texture cache prevents duplicate GPU texture uploads for same source.
- Unlit and lit textured materials both work.

Estimated effort:
- 6 to 9 days

Risks:
- WGSL binding layout growth and shader variant complexity.
- glTF edge cases (multiple primitives, missing tangents, material variants).

---

### Phase 2: World Persistence and Motion (Must Have)

Includes:
- Scene serialization
- Animation system

Goal:
- Save and reload game scenes and run asset-driven animation clips.

Implementation tasks:
- Scene serializer/deserializer:
  - src/core/SceneSerializer.ts (new)
  - Serialize entity hierarchy, transforms, component configs, mesh/material references.
- Add stable component serialization contract:
  - src/core/Component.ts (optional methods such as serialize and deserialize)
- Animation runtime:
  - src/animation/AnimationClip.ts
  - src/animation/AnimationPlayer.ts
  - src/animation/Animator.ts
- Integrate with glTF animation channels where present.
- Add editor/example save and load flow:
  - examples/editor/main.ts or related editor wiring files

Acceptance criteria:
- Scene can round-trip save to JSON and restore without hierarchy or transform loss.
- At least transform animation clips play deterministically.
- glTF animation playback supported for a sample model.

Estimated effort:
- 7 to 10 days

Risks:
- Component versioning and backward compatibility for saved scenes.
- Animation blending scope creep.

---

### Phase 3: Stability and Performance Guardrails (High)

Includes:
- Performance profiling tools

Goal:
- Make performance regressions visible before adding expensive visual effects.

Implementation tasks:
- Frame timing instrumentation:
  - CPU frame time, update time, render time, fixed update time.
- GPU timing support where available.
- Lightweight profiler API and overlay:
  - src/debug/Profiler.ts
  - examples shared profiler overlay utility
- Add benchmark scenes and thresholds.

Acceptance criteria:
- Profiling data visible in demo and racing example.
- Can detect regressions by comparing baseline metrics.

Estimated effort:
- 3 to 5 days

Risks:
- Browser limitations for reliable GPU timings.

---

### Phase 4: Visual Quality Core (High)

Includes:
- Advanced lighting

Goal:
- Support multi-light scenes with practical realism.

Implementation tasks:
- Add PointLight and SpotLight components:
  - src/components/PointLight.ts
  - src/components/SpotLight.ts
  - src/components/index.ts
- Expand renderer light collection and uniform uploads:
  - src/rendering/Renderer.ts
  - src/rendering/Material.ts
  - src/rendering/Shader.ts
- Implement shadow mapping in stages:
  - Stage A: directional shadow map
  - Stage B: point/spot shadows (optional in initial milestone)

Acceptance criteria:
- Multiple dynamic lights affect objects correctly.
- Directional shadows render with configurable quality.

Estimated effort:
- 6 to 10 days

Risks:
- Uniform buffer limits and light count constraints.
- Shadow acne and peter-panning quality issues.

---

### Phase 5: Experience Layer (Medium)

Includes:
- Audio system
- Post-processing effects
- Particle system

Goal:
- Add production-level feel and feedback.

Implementation tasks:
- Audio manager and channels:
  - src/audio/AudioManager.ts
  - one-shot and looping APIs
  - listener updates from camera
- Post-processing framework:
  - src/rendering/post/RenderTarget.ts
  - src/rendering/post/PostProcessPass.ts
  - initial passes: bloom, tone mapping, vignette
- Particle system:
  - src/particles/ParticleEmitter.ts
  - CPU simulation first, GPU simulation optional later

Acceptance criteria:
- Racing example has working engine plus collision audio.
- At least one post effect enabled with toggle controls.
- Particle emitter supports burst and looping modes.

Estimated effort:
- 8 to 12 days

Risks:
- Overdraw and fill-rate cost from particles and post effects.
- Audio context lifecycle differences across browsers.

## Suggested Milestones

- M1: Textured glTF demo scene runs smoothly.
- M2: Scene save and load plus animation playback in editor and demo.
- M3: Profiler baseline established and documented.
- M4: Multi-light plus directional shadows in sample scene.
- M5: Audio plus post-processing plus particles integrated in racing demo.

## Recommended Delivery Strategy

- Use short vertical slices: one feature plus one demo update plus one test pass.
- After each phase, update README implementation status and roadmap checkboxes.
- Gate each phase on build success and at least one runnable example.

## Parallel Work Opportunities

- Audio system can run in parallel with advanced lighting.
- Profiling instrumentation can start while Phase 2 is under development.
- Particle editor tooling can proceed while post-processing core is implemented.

## Definition of Done Per Roadmap Item

For each item, require all of the following:
- Public API exported through src/index.ts
- At least one example using the feature
- Basic test coverage or validation script
- README and dev-docs status updated
- No new TypeScript errors and build passes
