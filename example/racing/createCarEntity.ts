import {
  Scene,
  Entity,
  MeshRenderer,
  Geometry,
  Material,
  Vec3,
  Vec4,
  Quat,
  CarPhysics,
  Engine,
} from '../../src/index';
import { CarController } from './CarController';
import { WheelSteering } from './WheelSteering';

export interface CarEntityResult {
  car: Entity;
  physics: CarPhysics;
}

// Shared car dimensions — must match Geometry.createCarBody constants.
const HALF_BODY_WIDTH = 1.0;
const HALF_BODY_LENGTH = 2.0;
const WHEEL_RADIUS = 0.4;
const WHEEL_WIDTH = 0.3;
const WHEEL_OFFSET_X = HALF_BODY_WIDTH + WHEEL_WIDTH / 2;  // flush outer side
const FRONT_Z = HALF_BODY_LENGTH * 0.6;
const REAR_Z = -HALF_BODY_LENGTH * 0.6;

const WHEEL_DEFS = [
  { name: 'WheelFL', x: -WHEEL_OFFSET_X, z: FRONT_Z },
  { name: 'WheelFR', x:  WHEEL_OFFSET_X, z: FRONT_Z },
  { name: 'WheelRL', x: -WHEEL_OFFSET_X, z: REAR_Z },
  { name: 'WheelRR', x:  WHEEL_OFFSET_X, z: REAR_Z },
];

export function createCarEntity(
  scene: Scene,
  device: GPUDevice,
  format: GPUTextureFormat,
  engine: Engine,
): CarEntityResult {
  // --- Car root entity (body + cabin mesh, red) ---
  const car = scene.createEntity('Car');

  const bodyRenderer = new MeshRenderer();
  bodyRenderer.setMesh(Geometry.createCarBody(1));
  bodyRenderer.setMaterial(new Material(undefined, {
    color: new Vec4(0.9, 0.12, 0.12, 1),
    ambient: 0.3,
    diffuse: 0.8,
    specular: 0.4,
    shininess: 24,
  }));
  car.addComponent(bodyRenderer);
  // Face -Z in world so follow-camera cross product gives correct right = +X
  car.transform.rotation = Quat.fromAxisAngle(Vec3.up(), Math.PI);
  bodyRenderer.initialize(device, format);

  // --- Wheel entities (black cylinders, parented to car) ---
  const wheelEntities = WHEEL_DEFS.map(def => {
    const wheel = scene.createEntity(def.name);

    const wheelRenderer = new MeshRenderer();
    wheelRenderer.setMesh(Geometry.createCylinder(WHEEL_RADIUS, WHEEL_WIDTH, 16));
    wheelRenderer.setMaterial(new Material(undefined, {
      color: new Vec4(0.08, 0.08, 0.08, 1),
      ambient: 0.5,
      diffuse: 0.5,
      specular: 0.2,
      shininess: 8,
    }));
    wheel.addComponent(wheelRenderer);

    wheel.transform.setParent(car.transform);
    wheel.transform.position = new Vec3(def.x, WHEEL_RADIUS, def.z);
    // Upright default rotation set by WheelSteering on every frame
    wheelRenderer.initialize(device, format);

    return wheel;
  });

  // --- Physics and input ---
  const physics = new CarPhysics();
  car.addComponent(physics);
  car.addComponent(new CarController(engine));

  // --- Wheel steering + rolling animation ---
  car.addComponent(new WheelSteering(
    wheelEntities[0].transform, // FL
    wheelEntities[1].transform, // FR
    wheelEntities[2].transform, // RL
    wheelEntities[3].transform, // RR
  ));

  return { car, physics };
}
