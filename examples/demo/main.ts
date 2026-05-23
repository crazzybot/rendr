import {
  Entity,
  Engine,
  Scene,
  Camera,
  ProjectionType,
  MeshRenderer,
  Geometry,
  Material,
  Vec3,
  Vec4,
  Quat,
  UnlitShader,
  MouseButton,
  Component,
  DirectionalLight
} from '../../src/index';

class RotateComponent extends Component {
  private speed: Vec3;

  constructor(speed: Vec3) {
    super();
    this.speed = speed;
  }

  onUpdate(deltaTime: number): void {
    const rotation = Quat.fromEuler(
      this.speed.x * deltaTime,
      this.speed.y * deltaTime,
      this.speed.z * deltaTime
    );
    this.entity!.transform.rotate(rotation);
  }
}

class CameraController extends Component {
  private engine: Engine;
  private moveSpeed: number = 5;
  private lookSpeed: number = 0.002;
  private pitch: number = 0;
  private yaw: number = 0;

  constructor(engine: Engine) {
    super();
    this.engine = engine;
  }

  onAttach(): void {
    // Initialize pitch and yaw from the current camera rotation
    if (this.entity) {
      const euler = this.entity.transform.rotation.toEuler();
      this.pitch = euler.x;
      this.yaw = euler.y;
    }
    console.log('CameraController attached. Initial pitch:', this.pitch, 'Initial yaw:', this.yaw);
  }

  onUpdate(deltaTime: number): void {
    const input = this.engine.getInput();

    if (input.isMouseButtonDown(MouseButton.Left)) {
      input.requestPointerLock();
    }

    const movement = Vec3.zero();
    if (input.isKeyPressed('KeyW')) {
      movement.z += 1;
    }
    if (input.isKeyPressed('KeyS')) {
      movement.z -= 1;
    }
    if (input.isKeyPressed('KeyA')) {
      movement.x -= 1;
    }
    if (input.isKeyPressed('KeyD')) {
      movement.x += 1;
    }
    if (input.isKeyPressed('Space')) {
      movement.y += 1;
    }
    if (input.isKeyPressed('ShiftLeft')) {
      movement.y -= 1;
    }

    const entity = this.entity!;
    if (movement.lengthSquared() > 0) {
      const forward = entity.transform.getForward().mul(-1);
      const right = entity.transform.getRight();
      const up = Vec3.up();

      const moveDirection = forward.mul(movement.z)
        .add(right.mul(movement.x))
        .add(up.mul(movement.y))
        .normalize()
        .mul(this.moveSpeed * deltaTime);

      entity.transform.translate(moveDirection);
    }

    if (input.isPointerLocked()) {
      const mouseDelta = input.getMouseDelta();

      this.yaw -= mouseDelta.x * this.lookSpeed;
      this.pitch -= mouseDelta.y * this.lookSpeed;

      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));

      const rotation = Quat.fromEuler(this.pitch, this.yaw, 0);
      entity.transform.rotation = rotation;
    }

    if (input.isKeyDown('Escape')) {
      input.exitPointerLock();
    }
  }
}

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const errorDiv = document.getElementById('error') as HTMLDivElement;

  if (!canvas) {
    console.error('Canvas not found');
    return;
  }

  try {
    if (!navigator.gpu) {
      throw new Error('WebGPU is not supported in your browser. Please use Chrome/Edge 113+ or another WebGPU-compatible browser.');
    }

    const engine = new Engine({
      canvas: canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      antialias: true
    });

    await engine.initialize();

    const scene = new Scene('MainScene');
    engine.setScene(scene);
    const device = engine.getRenderer().getDevice();
    const format = engine.getRenderer().getFormat();

    if (!device) {
      throw new Error('Failed to get GPU device');
    }

    const cameraEntity = scene.createEntity('Camera');
    const camera = new Camera();

    camera.setPerspective(Math.PI / 4, window.innerWidth / window.innerHeight, 0.1, 1000);
    // camera.setOrthographic(-10, 10, -10, 10, 0.1, 1000);
    cameraEntity.addComponent(camera);
    cameraEntity.transform.position = new Vec3(0, 2, 4);
    // cameraEntity.transform.lookAt(Vec3.zero(), Vec3.up());
    cameraEntity.transform.lookAt(Vec3.zero(), Vec3.up());


    const cameraController = new CameraController(engine);
    cameraEntity.addComponent(cameraController);

    // Create a directional light
    const lightEntity = scene.createEntity('DirectionalLight');
    const dirLight = new DirectionalLight(new Vec4(1, 1, 1, 1), 1.0);
    lightEntity.addComponent(dirLight);
    lightEntity.transform.rotation = Quat.fromEuler(-Math.PI / 4, Math.PI / 4, 0);

    const cube1 = scene.createEntity('Cube1');
    const cubeMesh = Geometry.createCube(1);
    const cubeMaterial = new Material(undefined, {
      color: new Vec4(1, 0.3, 0.3, 1),
      ambient: 0.3,
      diffuse: 0.7
    });
    const cubeRenderer = new MeshRenderer();
    cubeRenderer.setMesh(cubeMesh);
    cubeRenderer.setMaterial(cubeMaterial);
    cube1.addComponent(cubeRenderer);
    cube1.transform.position = new Vec3(-2, 0, 0);
    cubeRenderer.initialize(device, format);

    const rotateComp1 = new RotateComponent(new Vec3(0, 1, 0.5));
    cube1.addComponent(rotateComp1);

    const sphere = scene.createEntity('Sphere');
    const sphereMesh = Geometry.createSphere(0.8, 32, 16);
    const sphereMaterial = new Material(undefined, {
      color: new Vec4(0.3, 1, 0.3, 1),
      ambient: 0.3,
      diffuse: 0.7
    });
    const sphereRenderer = new MeshRenderer();
    sphereRenderer.setMesh(sphereMesh);
    sphereRenderer.setMaterial(sphereMaterial);
    sphere.addComponent(sphereRenderer);
    sphere.transform.position = new Vec3(2, 0, 0);
    sphereRenderer.initialize(device, format);

    const rotateComp2 = new RotateComponent(new Vec3(1, 0, 0.5));
    sphere.addComponent(rotateComp2);

    const plane = scene.createEntity('Plane');
    const planeMesh = Geometry.createPlane(10, 10, 10, 10);
    const planeMaterial = new Material(UnlitShader, {
      color: new Vec4(0.2, 0.2, 0.2, 1)
    });
    const planeRenderer = new MeshRenderer();
    planeRenderer.setMesh(planeMesh);
    planeRenderer.setMaterial(planeMaterial);
    plane.addComponent(planeRenderer);
    plane.transform.position = new Vec3(0, -1, 0);
    planeRenderer.initialize(device, format);

    const cylinder = scene.createEntity('Cylinder');
    const cylinderMesh = Geometry.createCylinder(0.5, 1, 32);
    const cylinderMaterial = new Material(undefined, {
      color: new Vec4(0.3, 0.3, 1, 1),
      ambient: 0.3,
      diffuse: 0.7
    });
    const cylinderRenderer = new MeshRenderer();
    cylinderRenderer.setMesh(cylinderMesh);
    cylinderRenderer.setMaterial(cylinderMaterial);
    cylinder.addComponent(cylinderRenderer);
    cylinder.transform.position = new Vec3(0, 0, -3);
    cylinderRenderer.initialize(device, format);

    const rotateComp3 = new RotateComponent(new Vec3(0.5, 1, 0));
    cylinder.addComponent(rotateComp3);

    const car = scene.createEntity('Car');
    const carMesh = Geometry.createCar(0.5);
    const carMaterial = new Material(undefined, {
      color: new Vec4(0.8, 0.2, 0.2, 1),
      ambient: 0.3,
      diffuse: 0.7
    });
    const carRenderer = new MeshRenderer();
    carRenderer.setMesh(carMesh);
    carRenderer.setMaterial(carMaterial);
    car.addComponent(carRenderer);
    car.transform.position = new Vec3(0, 0, 3);
    carRenderer.initialize(device, format);

    const rotateComp4 = new RotateComponent(new Vec3(0, 1, 0));
    car.addComponent(rotateComp4);

    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      engine.resize(width, height);
      camera.setAspect(width / height);
    });

    console.log('Scene entities:', scene.getEntities().length);
    console.log('Camera found:', scene.findEntitiesWithComponent(Camera).length);
    console.log('MeshRenderers found:', scene.findEntitiesWithComponent(MeshRenderer).length);

    // const meshRenderers = scene.findEntitiesWithComponent(MeshRenderer);
    // meshRenderers.forEach((entity, index) => {
    //   const renderer = entity.getComponent(MeshRenderer);
    //   console.log(`MeshRenderer ${index} (${entity.name}):`, {
    //     hasMesh: !!renderer?.mesh,
    //     hasMaterial: !!renderer?.material,
    //     enabled: renderer?.enabled,
    //     hasVertexBuffer: !!renderer?.mesh?.vertexBuffer,
    //     hasIndexBuffer: !!renderer?.mesh?.indexBuffer,
    //     indexCount: renderer?.mesh?.indexCount
    //   });
    // });
    engine.start();

    console.log('Rendr initialized successfully!');

  } catch (error) {
    console.error('Error initializing engine:', error);
    errorDiv.textContent = `Error: ${(error as Error).message}`;
    errorDiv.style.display = 'block';
  }
}

main();
