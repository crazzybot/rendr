import { Vec3 } from '../../../src/index';
import { state } from '../state';
import { updateTransform, updateNodeMaterial } from '../nodes';
import { updateSelectedLayer } from '../mesh-edit';
import type { MaterialProps, CsgLayer, CsgOp, PrimitiveType } from '../types';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255)/255, (n >> 8 & 255)/255, (n & 255)/255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r,g,b].map(v => Math.round(v*255).toString(16).padStart(2,'0')).join('');
}

function gn(id: string): number {
  return parseFloat((document.getElementById(id) as HTMLInputElement).value);
}

export function renderProperties(): void {
  if (state.editorMode === 'mesh-edit') { renderLayerProperties(); return; }

  const panel = state.propertiesEl!;
  if (state.selectedIds.size === 0) {
    panel.innerHTML = '<div class="prop-empty">Nothing selected<small>Click an object or double-click to edit its mesh</small></div>';
    return;
  }
  if (state.selectedIds.size > 1) {
    panel.innerHTML = `<div class="prop-empty">${state.selectedIds.size} objects selected</div>`;
    return;
  }

  const [id] = state.selectedIds;
  const node = state.nodes.get(id);
  if (!node) return;

  const { position: pos, rotation: rot, scale } = node.entity.transform;
  const euler = rot.toEuler();
  const rx = euler.x * 180 / Math.PI, ry = euler.y * 180 / Math.PI, rz = euler.z * 180 / Math.PI;

  let matHtml = '';
  if (!node.isComposite && node.matProps) {
    const mp = node.matProps;
    matHtml = `
      <div class="prop-section">
        <div class="prop-title">Material</div>
        <div class="prop-row prop-color-row"><label>Color</label>
          <input id="mc" type="color" value="${rgbToHex(mp.r, mp.g, mp.b)}"></div>
        <div class="prop-row"><label>Ambient</label>
          <input id="ma" type="range" min="0" max="1" step="0.01" value="${mp.ambient}">
          <span class="slider-val" id="ma-v">${mp.ambient.toFixed(2)}</span></div>
        <div class="prop-row"><label>Diffuse</label>
          <input id="md" type="range" min="0" max="1" step="0.01" value="${mp.diffuse}">
          <span class="slider-val" id="md-v">${mp.diffuse.toFixed(2)}</span></div>
        <div class="prop-row"><label>Specular</label>
          <input id="ms" type="range" min="0" max="1" step="0.01" value="${mp.specular}">
          <span class="slider-val" id="ms-v">${mp.specular.toFixed(2)}</span></div>
        <div class="prop-row"><label>Shininess</label>
          <input id="msh" type="range" min="1" max="128" step="1" value="${mp.shininess}">
          <span class="slider-val" id="msh-v">${mp.shininess.toFixed(0)}</span></div>
      </div>`;
  }

  panel.innerHTML = `
    <div class="prop-section">
      <div class="prop-title">${node.isComposite ? 'Composite' : 'Mesh'} · ${node.name}</div>
      <div class="prop-row"><label>Position</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="px" type="number" step="0.1" value="${pos.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="py" type="number" step="0.1" value="${pos.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="pz" type="number" step="0.1" value="${pos.z.toFixed(3)}">
        </div></div>
      <div class="prop-row"><label>Rotation</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="rx" type="number" step="1" value="${rx.toFixed(1)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="ry" type="number" step="1" value="${ry.toFixed(1)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="rz" type="number" step="1" value="${rz.toFixed(1)}">
        </div></div>
      <div class="prop-row"><label>Scale</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="sx" type="number" step="0.01" value="${scale.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="sy" type="number" step="0.01" value="${scale.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="sz" type="number" step="0.01" value="${scale.z.toFixed(3)}">
        </div></div>
    </div>${matHtml}`;

  const getTransform = () => ({
    pos:   new Vec3(gn('px'), gn('py'), gn('pz')),
    rot:   new Vec3(gn('rx'), gn('ry'), gn('rz')),
    scale: new Vec3(gn('sx'), gn('sy'), gn('sz')),
  });

  for (const pid of ['px','py','pz','rx','ry','rz','sx','sy','sz'])
    document.getElementById(pid)?.addEventListener('change', () => {
      const { pos, rot, scale } = getTransform();
      updateTransform(id, pos, rot, scale);
    });

  if (!node.isComposite) {
    document.getElementById('mc')?.addEventListener('input', (e) => {
      const [r,g,b] = hexToRgb((e.target as HTMLInputElement).value);
      updateNodeMaterial(id, { r, g, b });
    });
    const wireSlider = (inputId: string, valId: string, key: keyof MaterialProps) => {
      const input = document.getElementById(inputId) as HTMLInputElement | null;
      const valEl = document.getElementById(valId);
      input?.addEventListener('input', () => {
        const v = parseFloat(input.value);
        if (valEl) valEl.textContent = v.toFixed(key === 'shininess' ? 0 : 2);
        updateNodeMaterial(id, { [key]: v } as Partial<MaterialProps>);
      });
    };
    wireSlider('ma','ma-v','ambient'); wireSlider('md','md-v','diffuse');
    wireSlider('ms','ms-v','specular'); wireSlider('msh','msh-v','shininess');
  }
}

function renderLayerProperties(): void {
  const panel = state.propertiesEl!;
  const node  = state.meshEditTargetId ? state.nodes.get(state.meshEditTargetId) : null;
  if (!node || node.isComposite) { panel.innerHTML = '<div class="prop-empty">No mesh selected</div>'; return; }
  if (!state.meshEditSelectedLayerId) { panel.innerHTML = '<div class="prop-empty">Select a layer</div>'; return; }

  const layer = node.csgLayers.find(l => l.id === state.meshEditSelectedLayerId);
  if (!layer) return;

  const isBase = layer.op === 'base';
  const opOpts = (['base','union','subtract','intersect'] as CsgOp[])
    .map(o => `<option value="${o}" ${layer.op===o?'selected':''} ${o==='base'?'disabled':''}>${o}</option>`).join('');
  const primOpts = (['cube','sphere','cylinder','plane'] as PrimitiveType[])
    .map(p => `<option value="${p}" ${layer.primitiveType===p?'selected':''}>${p}</option>`).join('');

  panel.innerHTML = `
    <div class="prop-section">
      <div class="prop-title">CSG Layer</div>
      <div class="prop-row"><label>Primitive</label>
        <select id="lp-prim" class="prop-select">${primOpts}</select></div>
      <div class="prop-row"><label>Size</label>
        <input class="prop-num" id="lp-size" type="number" step="0.1" min="0.01" value="${layer.size}" style="flex:1"></div>
      <div class="prop-row"><label>Operation</label>
        <select id="lp-op" class="prop-select" ${isBase?'disabled':''}>${opOpts}</select></div>
    </div>
    <div class="prop-section">
      <div class="prop-title">Layer Transform</div>
      <div class="prop-row"><label>Position</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="lp-px" type="number" step="0.1" value="${layer.position.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="lp-py" type="number" step="0.1" value="${layer.position.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="lp-pz" type="number" step="0.1" value="${layer.position.z.toFixed(3)}">
        </div></div>
      <div class="prop-row"><label>Rotation</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="lp-rx" type="number" step="1" value="${layer.rotation.x.toFixed(1)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="lp-ry" type="number" step="1" value="${layer.rotation.y.toFixed(1)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="lp-rz" type="number" step="1" value="${layer.rotation.z.toFixed(1)}">
        </div></div>
      <div class="prop-row"><label>Scale</label>
        <div class="prop-xyz">
          <label class="axis-label x">X</label><input class="prop-num" id="lp-sx" type="number" step="0.01" value="${layer.scale.x.toFixed(3)}">
          <label class="axis-label y">Y</label><input class="prop-num" id="lp-sy" type="number" step="0.01" value="${layer.scale.y.toFixed(3)}">
          <label class="axis-label z">Z</label><input class="prop-num" id="lp-sz" type="number" step="0.01" value="${layer.scale.z.toFixed(3)}">
        </div></div>
    </div>`;

  const patchTransform = () => updateSelectedLayer({
    position: new Vec3(gn('lp-px'), gn('lp-py'), gn('lp-pz')),
    rotation: new Vec3(gn('lp-rx'), gn('lp-ry'), gn('lp-rz')),
    scale:    new Vec3(gn('lp-sx'), gn('lp-sy'), gn('lp-sz')),
  });

  for (const pid of ['lp-px','lp-py','lp-pz','lp-rx','lp-ry','lp-rz','lp-sx','lp-sy','lp-sz'])
    document.getElementById(pid)?.addEventListener('change', patchTransform);

  document.getElementById('lp-prim')?.addEventListener('change', (e) =>
    updateSelectedLayer({ primitiveType: (e.target as HTMLSelectElement).value as PrimitiveType }));
  document.getElementById('lp-size')?.addEventListener('change', (e) =>
    updateSelectedLayer({ size: parseFloat((e.target as HTMLInputElement).value) }));
  document.getElementById('lp-op')?.addEventListener('change', (e) =>
    updateSelectedLayer({ op: (e.target as HTMLSelectElement).value as CsgOp }));
}
