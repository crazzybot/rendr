import { Scene } from './Scene';
import { Renderer } from '../rendering/Renderer';
import { InputManager } from '../input/InputManager';

export interface EngineConfig {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  antialias?: boolean;
}

export class Engine {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private inputManager: InputManager;
  private currentScene: Scene | null = null;
  private running: boolean = false;
  private lastTime: number = 0;
  private rafId: number = 0;

  constructor(config: EngineConfig) {
    this.canvas = config.canvas;

    if (config.width) this.canvas.width = config.width;
    if (config.height) this.canvas.height = config.height;

    this.renderer = new Renderer(this.canvas, {
      antialias: config.antialias ?? true
    });

    this.inputManager = new InputManager(this.canvas);
  }

  async initialize(): Promise<void> {
    await this.renderer.initialize();
  }

  setScene(scene: Scene): void {
    this.currentScene = scene;
  }

  getScene(): Scene | null {
    return this.currentScene;
  }

  getRenderer(): Renderer {
    return this.renderer;
  }

  getInput(): InputManager {
    return this.inputManager;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private gameLoop = (currentTime: number): void => {
    if (!this.running) return;

    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.rafId = requestAnimationFrame(this.gameLoop);
  };

  private update(deltaTime: number): void {
    if (this.currentScene) {
      this.currentScene.update(deltaTime);
    }

    this.inputManager.update();
  }

  private render(): void {
    if (this.currentScene) {
      this.renderer.render(this.currentScene);
    }
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer.resize(width, height);
  }

  destroy(): void {
    this.stop();
    if (this.currentScene) {
      this.currentScene.clear();
    }
    this.renderer.destroy();
    this.inputManager.destroy();
  }
}
