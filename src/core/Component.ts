import { Entity } from './Entity';

export abstract class Component {
  public entity: Entity | null = null;
  public enabled: boolean = true;

  onAttach?(): void;
  onDetach?(): void;
  onUpdate?(deltaTime: number): void;
  onDestroy?(): void;
}
