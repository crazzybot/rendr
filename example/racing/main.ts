import {
  Engine,
  Scene,
  Camera,
  MeshRenderer,
  Geometry,
  Material,
  DirectionalLight,
  Vec3,
  Vec4,
  Quat,
  UnlitShader,
  Component,
  Entity,
  CarPhysics,
} from '../../src/index';
import { CarController } from './CarController';

// Simple follow camera — no lag, just hard-follow for now (Phase 6 adds smoothing)
class FollowCamera extends Component {
  private target: Entity;
  private camera: Camera;

  constructor(target: Entity, camera: Camera) {
    super();
    this.target = target;
    this.camera = camera;
  }

  onUpdate(_dt: number): void {
    const carPos = this.target.transform.position;
    const carForward = this.target.transform.getForward();

    const desiredPos = carPos
      .sub(carForward.mul(8))
      .add(new Vec3(0, 3, 0));

    this.entity!.transform.position = desiredPos;
    this.entity!.transform.lookAt(carPos.add(new Vec3(0, 0.5, 0)));
  }
}

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const errorDiv = document.getElementById('error') as HTMLDivElement;
  const speedEl = document.getElementById('speed') as HTMLElement;

  try {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported. Use Chrome or Edge 113+.');
    }

    const engine = new Engine({
      canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      antialias: true,
    });

    await engine.initialize();

    const scene = new Scene('Racing');
    engine.setScene(scene);

    const device = engine.getRenderer().getDevice()!;
    const format = engine.getRenderer().getFormat();

    // --- Directional light ---
    const lightEntity = scene.createEntity('DirectionalLight');
    lightEntity.addComponent(new DirectionalLight(new Vec4(1, 0.95, 0.8, 1), 1.0));
    lightEntity.transform.rotation = Quat.fromEuler(-Math.PI / 4, Math.PI / 6, 0);

    // --- Ground plane ---
    const ground = scene.createEntity('Ground');
    const groundMesh = Geometry.createPlane(100, 100, 1, 1);
    const groundMat = new Material(UnlitShader, { color: new Vec4(0.18, 0.38, 0.18, 1) });
    const groundRenderer = new MeshRenderer();
    groundRenderer.setMesh(groundMesh);
    groundRenderer.setMaterial(groundMat);
    ground.addComponent(groundRenderer);
    groundRenderer.initialize(device, format);

    // --- Obstacle boxes ---
    const obstacleData: [Vec3, Vec3][] = [
      [new Vec3(10, 0, 12),  new Vec3(3, 1.5, 1)],
      [new Vec3(-12, 0, 18), new Vec3(1, 1.5, 3)],
      [new Vec3(18, 0, -6),  new Vec3(1, 1.5, 3)],
      [new Vec3(-8, 0, -14), new Vec3(3, 1.5, 1)],
      [new Vec3(0, 0, 22),   new Vec3(4, 1.5, 1)],
      [new Vec3(-20, 0, 0),  new Vec3(1, 1.5, 4)],
    ];

    for (let i = 0; i < obstacleData.length; i++) {
      const [pos, scl] = obstacleData[i];
      const box = scene.createEntity(`Obstacle${i}`);
      const boxMesh = Geometry.createCube(1);
      const boxMat = new Material(undefined, {
        color: new Vec4(0.75, 0.32, 0.1, 1),
        ambient: 0.3,
        diffuse: 0.7,
      });
      const boxRenderer = new MeshRenderer();
      boxRenderer.setMesh(boxMesh);
      boxRenderer.setMaterial(boxMat);
      box.addComponent(boxRenderer);
      box.transform.position = new Vec3(pos.x, scl.y / 2, pos.z);
      box.transform.scale = scl;
      boxRenderer.initialize(device, format);
    }

    // --- Car ---
    const carEntity = scene.createEntity('Car');
    const carMesh = Geometry.createCar(1);
    const carMat = new Material(undefined, {
      color: new Vec4(0.9, 0.12, 0.12, 1),
      ambient: 0.3,
      diffuse: 0.8,
    });
    const carRenderer = new MeshRenderer();
    carRenderer.setMesh(carMesh);
    carRenderer.setMaterial(carMat);
    carEntity.addComponent(carRenderer);
    carEntity.transform.position = new Vec3(0, 0, 0);
    // Rotate 180° so the car faces -Z: camera sits at +Z, lookAt cross product
    // produces correct right=+X (the formula flips when camera looks toward +Z).
    carEntity.transform.rotation = Quat.fromAxisAngle(Vec3.up(), Math.PI);
    carRenderer.initialize(device, format);

    const carPhysics = new CarPhysics();
    carEntity.addComponent(carPhysics);

    const carController = new CarController(engine);
    carEntity.addComponent(carController);

    // --- Camera ---
    const cameraEntity = scene.createEntity('Camera');
    const camera = new Camera();
    camera.setPerspective(Math.PI / 3, window.innerWidth / window.innerHeight, 0.1, 500);
    cameraEntity.addComponent(camera);
    cameraEntity.addComponent(new FollowCamera(carEntity, camera));

    // --- Resize ---
    window.addEventListener('resize', () => {
      engine.resize(window.innerWidth, window.innerHeight);
      camera.setAspect(window.innerWidth / window.innerHeight);
    });

    // --- HUD ---
    const updateHUD = () => {
      if (speedEl) {
        speedEl.textContent = `${(carPhysics.speed * 3.6).toFixed(0)} km/h`;
      }
      requestAnimationFrame(updateHUD);
    };
    requestAnimationFrame(updateHUD);

    engine.start();

  } catch (error) {
    console.error(error);
    if (errorDiv) {
      errorDiv.textContent = `Error: ${(error as Error).message}`;
      errorDiv.style.display = 'block';
    }
  }
}

main();
