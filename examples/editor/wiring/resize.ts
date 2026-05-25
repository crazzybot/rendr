import { state } from '../state';

export function wireResize(): void {
  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    const w = Math.floor(width), h = Math.floor(height);
    if (w <= 0 || h <= 0) return;
    state.canvasEl!.width  = w;
    state.canvasEl!.height = h;
    state.engine!.resize(w, h);
    state.camera!.setAspect(w / h);
  });
  ro.observe(state.canvasEl!);
}
