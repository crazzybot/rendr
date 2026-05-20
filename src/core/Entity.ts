import { Component } from './Component';
import { Transform } from './Transform';
import { Scene } from './Scene';

export class Entity {
  public name: string;
  public active: boolean = true;
  public scene: Scene | null = null;

  private components: Map<string, Component[]> = new Map();
  public transform: Transform;

  constructor(name: string = 'Entity') {
    this.name = name;
    this.transform = new Transform();
    this.transform.entity = this;
    this.components.set('Transform', [this.transform]);
  }

  addComponent<T extends Component>(component: T): T {
    const key = component.constructor.name;
    const list = this.components.get(key);
    if (list) {
      list.push(component);
    } else {
      this.components.set(key, [component]);
    }
    component.entity = this;
    if (component.onAttach) {
      component.onAttach();
    }
    return component;
  }

  getComponent<T extends Component>(type: new (...args: any[]) => T): T | null {
    return (this.components.get(type.name)?.[0] as T) ?? null;
  }

  getComponentsOfType<T extends Component>(type: new (...args: any[]) => T): T[] {
    return (this.components.get(type.name) ?? []) as T[];
  }

  getComponents(): Component[] {
    const result: Component[] = [];
    for (const list of this.components.values()) {
      result.push(...list);
    }
    return result;
  }

  removeComponent<T extends Component>(type: new (...args: any[]) => T): void {
    const list = this.components.get(type.name);
    if (!list || list.length === 0) return;
    const component = list[0];
    if (component.onDetach) {
      component.onDetach();
    }
    component.entity = null;
    list.splice(0, 1);
    if (list.length === 0) {
      this.components.delete(type.name);
    }
  }

  hasComponent<T extends Component>(type: new (...args: any[]) => T): boolean {
    const list = this.components.get(type.name);
    return list !== undefined && list.length > 0;
  }

  update(deltaTime: number): void {
    if (!this.active) return;
    for (const list of this.components.values()) {
      for (const component of list) {
        if (component.enabled && component.onUpdate) {
          component.onUpdate(deltaTime);
        }
      }
    }
  }

  fixedUpdate(fixedDeltaTime: number): void {
    if (!this.active) return;
    for (const list of this.components.values()) {
      for (const component of list) {
        if (component.enabled && component.onFixedUpdate) {
          component.onFixedUpdate(fixedDeltaTime);
        }
      }
    }
  }

  destroy(): void {
    for (const list of this.components.values()) {
      for (const component of list) {
        if (component.onDestroy) {
          component.onDestroy();
        }
        component.entity = null;
      }
    }
    this.components.clear();
    if (this.scene) {
      this.scene.removeEntity(this);
    }
  }
}
