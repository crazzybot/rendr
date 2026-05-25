import {
  Camera,
  Component,
  DirectionalLight,
  Entity,
  Engine,
  GltfLoader,
  Material,
  MeshRenderer,
  Quat,
  Scene,
  Vec3,
  Vec4,
  Geometry,
  UnlitShader,
} from '../../src/index';

class RotateY extends Component {
  public speed: number = 0.5;

  onUpdate(dt: number): void {
    const q = Quat.fromEuler(0, this.speed * dt, 0);
    this.entity?.transform.rotate(q);
  }
}

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const status = document.getElementById('status') as HTMLDivElement;
  const errorDiv = document.getElementById('error') as HTMLDivElement;

  try {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in this browser. Use Chrome/Edge 113+ with WebGPU enabled.');
    }

    const engine = new Engine({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      antialias: true,
    });

    await engine.initialize();

    const scene = new Scene('TexturedGltfScene');
    engine.setScene(scene);

    const lightEntity = scene.createEntity('Sun');
    lightEntity.addComponent(new DirectionalLight(new Vec4(1, 1, 1, 1), 1.2));
    lightEntity.transform.rotation = Quat.fromEuler(-Math.PI / 3, Math.PI / 7, 0);

    const cameraEntity = scene.createEntity('Camera');
    const camera = new Camera();
    camera.setPerspective(Math.PI / 3, window.innerWidth / window.innerHeight, 0.1, 100);
    cameraEntity.addComponent(camera);
    cameraEntity.transform.position = new Vec3(0, 2.4, 4.5);
    cameraEntity.transform.lookAt(new Vec3(0, 0.5, 0));

    const ground = scene.createEntity('Ground');
    const groundRenderer = new MeshRenderer();
    groundRenderer.setMesh(Geometry.createPlane(8, 8, 1, 1));
    groundRenderer.setMaterial(new Material(UnlitShader, {
      color: new Vec4(0.16, 0.19, 0.24, 1),
    }));
    ground.addComponent(groundRenderer);
    ground.transform.position = new Vec3(0, -0.01, 0);

    const gltfUrl = new URL('../assets/textured-quad.gltf', import.meta.url).toString();
    const result = await GltfLoader.load(gltfUrl, engine.getRenderer().getDevice()!);

    if (result.primitives.length === 0) {
      throw new Error('glTF loaded but no renderable primitives were found.');
    }

    const root = scene.createEntity('GltfRoot');
    root.transform.position = new Vec3(0, 0.7, 0);
    root.transform.scale = new Vec3(1.5, 1.5, 1.5);
    root.addComponent(new RotateY());

    for (let i = 0; i < result.primitives.length; i++) {
      const part = result.primitives[i];
      const child = new Entity(part.meshName ?? `MeshPart_${i}`);
      const mr = new MeshRenderer();
      mr.setMesh(part.mesh);
      mr.setMaterial(part.material);
      child.addComponent(mr);
      root.addChild(child);
    }

    status.textContent = `Loaded ${result.primitives.length} primitive(s) with texture + sampler bindings.`;

    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      engine.resize(w, h);
      camera.setAspect(w / h);
    });

    engine.start();
  } catch (error) {
    console.error(error);
    errorDiv.textContent = `Error: ${(error as Error).message}`;
    errorDiv.style.display = 'block';
    if (status) {
      status.textContent = 'Failed to load demo.';
      status.style.color = '#ffb8b8';
    }
  }
}

main();
