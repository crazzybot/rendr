import { Vec3 } from '../../src/index';
import { state } from './state';

export function updateOrbitCamera(): void {
  const { orbitPhi: phi, orbitTheta: theta, orbitDist: dist, orbitTarget: tgt } = state;
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const st = Math.sin(theta), ct = Math.cos(theta);
  state.cameraEntity!.transform.position = new Vec3(
    tgt.x + dist * sp * st,
    tgt.y + dist * cp,
    tgt.z + dist * sp * ct,
  );
  state.cameraEntity!.transform.lookAt(tgt);
}
