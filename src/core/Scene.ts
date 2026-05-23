import { Entity } from './Entity';

export class Scene {
  public name: string;
  private entities: Entity[] = [];

  constructor(name: string = 'Scene') {
    this.name = name;
  }

  createEntity(name?: string): Entity {
    const entity = new Entity(name);
    this.addEntity(entity);
    return entity;
  }

  addEntity(entity: Entity): void {
    if (entity.parent !== null) return;
    if (!this.entities.includes(entity)) {
      this.entities.push(entity);
    }
    entity.scene = this;
  }

  removeEntity(entity: Entity): void {
    const index = this.entities.indexOf(entity);
    if (index !== -1) {
      this.entities.splice(index, 1);
    }
    entity.scene = null;
  }

  getEntity(name: string): Entity | null {
    return this.entities.find(e => e.name === name) || null;
  }

  getEntities(): Entity[] {
    return [...this.entities];
  }

  findEntitiesWithComponent<T>(type: new (...args: any[]) => T): Entity[] {
    const result: Entity[] = [];
    const collect = (entity: Entity) => {
      if (entity.hasComponent(type as any)) result.push(entity);
      for (const child of entity.children) collect(child);
    };
    for (const entity of this.entities) collect(entity);
    return result;
  }

  update(deltaTime: number): void {
    for (const entity of this.entities) {
      entity.update(deltaTime);
    }
  }

  fixedUpdate(fixedDeltaTime: number): void {
    for (const entity of this.entities) {
      entity.fixedUpdate(fixedDeltaTime);
    }
  }

  clear(): void {
    for (const entity of this.entities) {
      entity.destroy();
    }
    this.entities = [];
  }
}
