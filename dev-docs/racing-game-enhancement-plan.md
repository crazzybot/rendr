# Rendr Framework — Enhancement & Fix Plan
## Goal: Car Racing Game Foundation

---

## 1. Existing Bugs to Fix First

These issues will cause subtle, hard-to-debug failures as the codebase grows. Fix them before building new features.

| # | Status | Issue | File | Fix applied |
|---|---|---|---|---|
| B1 | ✅ Done | `MeshRenderer.initialize()` must be called manually | `src/rendering/Renderer.ts` | Renderer auto-calls `initialize(device, format)` before first draw; added `isInitialized()` accessor |
| B2 | ✅ Done | One component per type per entity (keyed by class name) | `src/core/Entity.ts` | Storage changed to `Map<string, Component[]>`; added `getComponentsOfType<T>()` |
| B3 | ✅ Done | No `deltaTime` clamping — tab switch causes huge spikes | `src/core/Engine.ts` | `dt = Math.min((now - last) / 1000, 0.1)` |
| B4 | ✅ Done | Normal matrix wrong under non-uniform scale | `src/rendering/Shader.ts`, `Material.ts`, `MeshRenderer.ts` | MeshRenderer computes `transpose(inverse(model))` each frame; uploaded as `mat3x3` uniform; buffer expanded 128 → 192 bytes |
| B5 | ✅ Done | `Camera.onUpdate` marks VP dirty every frame | `src/components/Camera.ts`, `src/core/Transform.ts` | Added `get isDirty()` on Transform; Camera only invalidates when transform is actually dirty |
| B6 | ✅ Done | `Mat4.invert()` fails on non-affine matrices | `src/math/Mat4.ts` | Replaced affine-only fast path with full general 4×4 cofactor inverse |

**Also cleaned up** during Phase 1: removed all `renderLoggedOnce` debug scaffolding from `Renderer.ts` and `MeshRenderer.ts`, and the `console.log` calls from `Material.createPipeline`.

---

## 2. Recommended Build Order

Each phase produces a testable milestone. Later phases depend on earlier ones.

---

### Phase 1 — Stabilization ✅ Complete

Apply all bug fixes from the table above. Add `deltaTime` clamping to the engine loop and normal-matrix correction to the shader. These are low-risk, isolated changes.

**Deliverable:** Existing demo still works; non-uniform scale renders correctly.

---

### Phase 2 — Fixed Timestep Engine Loop ✅ Complete

**Why:** Physics must run at a constant rate regardless of render framerate. Non-deterministic deltaTime causes cars to tunnel through walls on slow frames and behave differently across machines.

**Changes to `Engine.ts`:**
- Add a `fixedTimestep` property (default `1/60` seconds).
- Accumulate unspent time each frame; step the physics tick in fixed increments until the accumulator is drained.
- Pass an `alpha` interpolation factor to the renderer for render-time state blending.

```
accumulator += deltaTime
while accumulator >= fixedTimestep:
    physicsUpdate(fixedTimestep)
    accumulator -= fixedTimestep
render(alpha = accumulator / fixedTimestep)
```

**Changes to `Component.ts`:** Add `onFixedUpdate?(fixedDeltaTime: number): void` lifecycle hook.

**Deliverable:** A separate `onFixedUpdate(dt)` lifecycle hook on `Component`.

---

### Phase 3 — Arcade Car Physics

**Why:** Core gameplay. Without a physics model the car cannot drive.

**New file: `src/physics/CarPhysics.ts`** (Component)

Minimum viable arcade model using suspension raycasts:
- Four ray casts downward from wheel hub positions to detect ground contact distance.
- Apply spring force along each ray hit normal (suspension).
- Engine force applied to rear-wheel positions along the car's forward vector.
- Friction / grip: lateral velocity damping at each wheel contact point.
- Steering: rotate front wheel direction by a steering angle derived from input.
- Drag: velocity scaled by a drag coefficient each tick.

**New file: `src/physics/RaycastResult.ts`** — hit point, normal, distance, entity.

**Changes to `Engine.ts`:** Wire `onFixedUpdate` into the physics component.

**Deliverable:** A car that accelerates, steers, brakes, and reacts to gravity.

---

### Phase 4 — Collision Detection

**Why:** Without collision the car drives through walls and other vehicles.

**New files in `src/physics/`:**

- `AABB.ts` — axis-aligned bounding box with `intersects(other)`, `containsPoint(Vec3)`.
- `Collider.ts` — Component wrapping an AABB, auto-computed from mesh bounds or set manually.
- `CollisionSystem.ts` — Scene-level system, called in fixed update. Broadphase: sort-and-sweep or brute-force for small object counts. Narrowphase: AABB overlap. Emits collision events to involved entities.

**Collision response:** Impulse-based positional correction for car-vs-wall. Car-vs-car can use simple push-apart at first.

**Tags on Entity** (minor core change): Add a `tags: Set<string>` to Entity for collision filtering (e.g. `"car"`, `"wall"`, `"checkpoint"`).

**Deliverable:** Car bounces off track walls and other cars.

---

### Phase 5 — Texture Mapping

**Why:** A track is unreadable without surface textures. Car identity is impossible without a livery.

**New files in `src/rendering/`:**

- `TextureLoader.ts` — `loadTexture(url, device): Promise<GPUTexture>` using `fetch` + `createImageBitmap` + `copyExternalImageToTexture`.
- `Sampler.ts` — thin wrapper around `GPUSampler` with common presets (linear+repeat, nearest+clamp).

**Changes to `Material.ts`:**
- Add optional `diffuseTexture: GPUTexture | null`.
- Extend bind group layout with binding 3 (texture) and binding 4 (sampler) when a texture is provided.

**Changes to `Shader.ts` — `BasicShader`:**
- If texture is bound, multiply diffuse by `textureSample(diffuseTex, sampler, uv)`.
- Guard with a shader variant flag or a separate `TexturedShader`.

**Changes to `ResourceManager.ts`:** Add texture cache.

**Deliverable:** Track plane and car body can display PNG textures.

---

### Phase 6 — Follow Camera

**Why:** The free-fly camera is for development. A racing game needs a camera that tracks the car.

**New file: `src/components/CameraFollow.ts`** (Component, attaches to the Camera entity)

```
target: Entity          // the car
offset: Vec3            // e.g. (0, 3, -8) — behind and above
positionLag: number     // lerp factor for position smoothing
rotationLag: number     // slerp factor for rotation smoothing
lookAheadDistance: number  // offset camera aim point forward along car velocity
```

Per-frame: compute desired position = `target.worldPosition + target.worldRotation * offset`, lerp current position toward desired, then `lookAt(target.worldPosition + velocity * lookAheadDistance)`.

**Deliverable:** Camera smoothly follows the car through corners.

---

### Phase 7 — Gamepad / Controller Input

**Why:** Analog input is essential for a racing game. Digital keyboard steering produces on/off inputs; analog sticks and triggers allow precise control.

**Changes to `src/input/InputManager.ts`:**
- Poll `navigator.getGamepads()` each frame in `update()`.
- Expose `getAxis(gamepadIndex, axisIndex): number` and `getButton(gamepadIndex, buttonIndex): boolean`.
- Map standard layout indices to named actions: `steer`, `throttle`, `brake`, `handbrake`.

**Deliverable:** Driving with a connected controller works out of the box.

---

### Phase 8 — Audio

**Why:** Engine sound, tire screech, and music communicate speed and drama.

**New file: `src/audio/AudioManager.ts`**

Thin wrapper around the Web Audio API `AudioContext`:
- `loadSound(url): Promise<AudioBuffer>` — fetch + decodeAudioData.
- `playOneShot(buffer, volume, pan)` — fire-and-forget for collision impacts.
- `playLooping(buffer): AudioBufferSourceNode` — for engine sound, returns node for pitch control.
- `setListenerPosition(pos: Vec3)` — for 3D spatial audio.

**Racing game integration:**
- Engine sound: loop with `playbackRate` driven by car RPM (speed / gearRatio).
- Tire screech: `playOneShot` when lateral slip exceeds a threshold.

**Deliverable:** Engine sound and collision audio.

---

### Phase 9 — HTML HUD

**Why:** Speedometer, lap counter, and position are essential race feedback.

**Approach:** HTML/CSS overlay (not WebGPU 2D rendering — that is far more complex and not justified here).

**New file: `src/ui/HUD.ts`:**
- Creates and manages a `div` overlay over the canvas.
- Exposes typed update methods: `setSpeed(kmh)`, `setLap(current, total)`, `setPosition(n)`, `setTimer(seconds)`.
- Uses CSS Grid for layout; themed with minimal styling.

**Deliverable:** On-screen racing HUD updating in real time.

---

### Phase 10 — Point Lights (Headlights)

**Why:** Car headlights are a key visual element, especially for indoor or night tracks.

**Changes to `src/rendering/Shader.ts` — `BasicShader`:**
- Extend `LightUniforms` to include an array of point lights: `position (vec3) + color (vec3) + range (f32)`, up to 4–8 lights.
- Fragment: accumulate point light contribution with distance attenuation (`1 / (1 + kl*d + kq*d²)`).

**Changes to `src/components/DirectionalLight.ts`:** Add a sibling `PointLight.ts` component.

**Changes to `Renderer.ts`:** Collect point lights from scene and upload to the light uniform buffer.

**Deliverable:** Car entities can have two forward-facing point light children that illuminate the track.

---

### Phase 11 — Skybox

**Why:** The dark gray clear color gives no sense of environment.

**New file: `src/rendering/Skybox.ts`:**
- A cube-map texture (6 PNG faces or an equirectangular panorama converted at load time).
- Rendered in a separate pass before the main scene, with depth write disabled and depth compare set to `always`, using a full-screen triangle with an inverse VP transform.

**Changes to `Renderer.ts`:** Accept an optional `Skybox` and render it first.

**Deliverable:** Sky and horizon visible around the track.

---

## 3. Lower-Priority Enhancements (Post-MVP)

| Feature | Benefit | Complexity |
|---|---|---|
| Frustum culling | Performance on complex tracks | Medium |
| Instanced rendering | Repeated track objects (barriers, trees) | Medium |
| Shadow mapping | Ground truth lighting | High |
| MSAA | Edge quality | Low (Renderer change only) |
| Wheel spin / steering animation | Visual fidelity | Low (Transform math) |
| Checkpoint & lap logic | Full race flow | Low (game logic only) |
| PBR shading | Material quality | High |
| Motion blur post-process | Speed sensation | High |

---

## 4. Summary Timeline

```
Phase 1  — Bug fixes        ✅ Complete
Phase 2  — Fixed timestep   ✅ Complete
Phase 3  — Car physics            (3–5 days)
Phase 4  — Collision detection    (2–3 days)
Phase 5  — Texture mapping        (2 days)
Phase 6  — Follow camera          (1 day)
────────────────────────────────────────────
           Drivable game           ~2 weeks

Phase 7  — Gamepad input          (1 day)
Phase 8  — Audio                  (1–2 days)
Phase 9  — HUD                    (1 day)
Phase 10 — Point lights           (1 day)
Phase 11 — Skybox                 (2 days)
────────────────────────────────────────────
           Shippable demo          ~3–4 weeks
```
