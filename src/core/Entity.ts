import { Component } from './Component';
import { Transform } from './Transform';
import { Scene } from './Scene';

export class Entity {
  public name: string;
  public active: boolean = true;
  public scene: Scene | null = null;

  private components: Map<string, Component> = new Map();
  public transform: Transform;

  constructor(name: string = 'Entity') {
    this.name = name;
    this.transform = new Transform();
    this.transform.entity = this;
    this.components.set('Transform', this.transform);
  }

  addComponent<T extends Component>(component: T): T {
    const className = component.constructor.name;

    if (this.components.has(className)) {
      console.warn(`Component ${className} already exists on entity ${this.name}`);
      return this.components.get(className) as T;
    }

    component.entity = this;
    this.components.set(className, component);

    if (component.onAttach) {
      component.onAttach();
    }

    return component;
  }

  getComponent<T extends Component>(type: new (...args: any[]) => T): T | null {
    return this.components.get(type.name) as T || null;
  }

  getComponents(): Component[] {
    return Array.from(this.components.values());
  }

  removeComponent<T extends Component>(type: new (...args: any[]) => T): void {
    const component = this.components.get(type.name);
    if (component) {
      if (component.onDetach) {
        component.onDetach();
      }
      component.entity = null;
      this.components.delete(type.name);
    }
  }

  hasComponent<T extends Component>(type: new (...args: any[]) => T): boolean {
    return this.components.has(type.name);
  }

  update(deltaTime: number): void {
    if (!this.active) return;

    for (const component of this.components.values()) {
      if (component.enabled && component.onUpdate) {
        component.onUpdate(deltaTime);
      }
    }
  }

  destroy(): void {
    for (const component of this.components.values()) {
      if (component.onDestroy) {
        component.onDestroy();
      }
      component.entity = null;
    }
    this.components.clear();

    if (this.scene) {
      this.scene.removeEntity(this);
    }
  }
}
