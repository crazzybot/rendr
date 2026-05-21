import { Component } from '../../src/core/Component';
import { Engine } from '../../src/core/Engine';
import { CarPhysics } from '../../src/physics/CarPhysics';

export class CarController extends Component {
  private engine: Engine;

  constructor(engine: Engine) {
    super();
    this.engine = engine;
  }

  onUpdate(_dt: number): void {
    const input = this.engine.getInput();
    const physics = this.entity!.getComponent(CarPhysics);
    if (!physics) return;

    // Throttle: W = forward, S = reverse
    physics.throttleInput =
      (input.isKeyPressed('KeyW') ? 1 : 0) -
      (input.isKeyPressed('KeyS') ? 1 : 0);

    // Handbrake / brake: Space
    physics.brakeInput = input.isKeyPressed('Space') ? 1 : 0;

    // Steering: A = left, D = right
    physics.steeringInput =
      (input.isKeyPressed('KeyD') ? 1 : 0) -
      (input.isKeyPressed('KeyA') ? 1 : 0);
  }
}
