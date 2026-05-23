import { Component } from './Component';
import { Transform } from './Transform';
import { Scene } from './Scene';

export class Entity {
  public name: string;
  public active: boolean = true;
  private _scene: Scene | null = null;

  public parent: Entity | null = null;
  public children: Entity[] = [];

  private components: Map<string, Component[]> = new Map();
  public transform: Transform;

  constructor(name: string = 'Entity') {
    this.name = name;
    this.transform = new Transform();
    this.transform.entity = this;
    this.components.set('Transform', [this.transform]);
  }

  get scene(): Scene | null {
    if (this._scene !== null) return this._scene;
    return this.parent ? this.parent.scene : null;
  }

  set scene(value: Scene | null) {
    this._scene = value;
    for (const child of this.children) {
      child.scene = value;
    }
  }

  addChild(child: Entity): void {
    if (child.parent) {
      child.parent.removeChild(child);
    }
    child.parent = this;
    this.children.push(child);
    child.transform.setParent(this.transform);
    child.scene = this._scene;
  }

  removeChild(child: Entity): void {
    const index = this.children.indexOf(child);
    if (index === -1) return;
    this.children.splice(index, 1);
    child.parent = null;
    child.transform.setParent(null);
    child.scene = null;
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
    for (const child of this.children) {
      child.update(deltaTime);
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
    for (const child of this.children) {
      child.fixedUpdate(fixedDeltaTime);
    }
  }

  destroy(): void {
    for (const child of this.children) {
      child.parent = null;
      child.destroy();
    }
    this.children = [];

    for (const list of this.components.values()) {
      for (const component of list) {
        if (component.onDestroy) {
          component.onDestroy();
        }
        component.entity = null;
      }
    }
    this.components.clear();

    if (this.parent) {
      const idx = this.parent.children.indexOf(this);
      if (idx !== -1) this.parent.children.splice(idx, 1);
      this.parent = null;
    } else if (this._scene) {
      this._scene.removeEntity(this);
    }
    this._scene = null;
  }
}
