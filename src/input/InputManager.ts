import { Vec3 } from '../math';

export enum MouseButton {
  Left = 0,
  Middle = 1,
  Right = 2
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  private keys: Set<string> = new Set();
  private keysDown: Set<string> = new Set();
  private keysUp: Set<string> = new Set();

  private mouseButtons: Set<number> = new Set();
  private mouseButtonsDown: Set<number> = new Set();
  private mouseButtonsUp: Set<number> = new Set();

  private mousePosition: Vec3 = Vec3.zero();
  private mouseDelta: Vec3 = Vec3.zero();
  private lastMousePosition: Vec3 = Vec3.zero();
  private mouseWheel: number = 0;

  private pointerLocked: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('wheel', this.handleWheel);

    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.keys.has(event.code)) {
      this.keysDown.add(event.code);
    }
    this.keys.add(event.code);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
    this.keysUp.add(event.code);
  };

  private handleMouseDown = (event: MouseEvent): void => {
    if (!this.mouseButtons.has(event.button)) {
      this.mouseButtonsDown.add(event.button);
    }
    this.mouseButtons.add(event.button);
  };

  private handleMouseUp = (event: MouseEvent): void => {
    this.mouseButtons.delete(event.button);
    this.mouseButtonsUp.add(event.button);
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (this.pointerLocked) {
      this.mouseDelta.x = event.movementX;
      this.mouseDelta.y = event.movementY;
    } else {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePosition.x = event.clientX - rect.left;
      this.mousePosition.y = event.clientY - rect.top;

      this.mouseDelta.x = this.mousePosition.x - this.lastMousePosition.x;
      this.mouseDelta.y = this.mousePosition.y - this.lastMousePosition.y;
    }
  };

  private handleWheel = (event: WheelEvent): void => {
    this.mouseWheel = event.deltaY;
    event.preventDefault();
  };

  private handlePointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  update(): void {
    this.keysDown.clear();
    this.keysUp.clear();
    this.mouseButtonsDown.clear();
    this.mouseButtonsUp.clear();
    this.mouseWheel = 0;

    this.lastMousePosition.copy(this.mousePosition);
    this.mouseDelta.set(0, 0, 0);
  }

  isKeyPressed(key: string): boolean {
    return this.keys.has(key);
  }

  isKeyDown(key: string): boolean {
    return this.keysDown.has(key);
  }

  isKeyUp(key: string): boolean {
    return this.keysUp.has(key);
  }

  isMouseButtonPressed(button: MouseButton): boolean {
    return this.mouseButtons.has(button);
  }

  isMouseButtonDown(button: MouseButton): boolean {
    return this.mouseButtonsDown.has(button);
  }

  isMouseButtonUp(button: MouseButton): boolean {
    return this.mouseButtonsUp.has(button);
  }

  getMousePosition(): Vec3 {
    return this.mousePosition.clone();
  }

  getMouseDelta(): Vec3 {
    return this.mouseDelta.clone();
  }

  getMouseWheel(): number {
    return this.mouseWheel;
  }

  requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  exitPointerLock(): void {
    document.exitPointerLock();
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('wheel', this.handleWheel);

    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
  }
}
