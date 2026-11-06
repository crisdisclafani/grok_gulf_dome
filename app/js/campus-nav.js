// Shared campus numbers. The exterior mesh, the sea bed, and the orbit
// limits all read these so a close zoom cannot disagree with the ground.
export const G = 1.6;
export const LABS = { x: -120, z: -110 };
export const SEA_BED = -24;
export const CAMPUS_MIN_DISTANCE = 3.25;
export const CAMPUS_MAX_DISTANCE = 900;
export const CAMERA_CLEARANCE = 2.75;

export function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const t = (x - min) / (max - min);
  return t * t * (3 - 2 * t);
}

export function shoreX(z) {
  return 70 + 18 * Math.sin(z / 140) + 8 * Math.sin(z / 53 + 1);
}

function inCompound(x, z) {
  return x > -215 && x < 58 && z > -255 && z < 235;
}

export function landHeight(x, z) {
  const d = shoreX(z) - x;
  let h = G * smoothstep(d, -6, 30) - 3.5 * (1 - smoothstep(d, -90, -2));
  const far = smoothstep(d, 120, 420);
  const dn = (Math.sin(x * .011 + z * .004) * Math.sin(z * .013 - x * .002) + .5 * Math.sin(x * .031 + 2) * Math.sin(z * .027)) * 6;
  if (!inCompound(x, z)) h += far * Math.max(-1, dn);
  return h;
}

// Anything below the waterline is pushed far under the surface so the
// depth buffer cannot z-fight the sea as the camera approaches.
export function dropSeabed(h) {
  return h < 0.12 ? SEA_BED : h;
}

export function surfaceY(x, z) {
  const h = landHeight(x, z);
  return h < 0.12 ? 0 : h;
}

export function constrainCampusCamera(cam, target, floorY) {
  const radius = Math.max(0.001, Math.hypot(cam.x - target.x, cam.y - target.y, cam.z - target.z));
  const rise = floorY - target.y;
  let maxPolar = 1.42;
  if (rise > 0.05) {
    const c = rise / radius;
    maxPolar = c >= 0.999 ? 0.2 : Math.min(1.42, Math.acos(Math.min(1, c)) - 0.02);
  }
  const camY = cam.y < floorY ? floorY : cam.y;
  return { maxPolar, camY, targetY: target.y, radius };
}

// One dolly step of the campus orbit. Zoom keeps travelling past the old
// 20m stop, then holds still on the clearance floor instead of jittering.
export function stepCampusDolly(state, scale) {
  const floorY = state.floorY;
  let radius = Math.max(CAMPUS_MIN_DISTANCE, Math.min(CAMPUS_MAX_DISTANCE, state.radius * scale));
  let phi = state.phi;
  const targetY = state.targetY;
  const rise = floorY - targetY;
  if (rise > 0.05) {
    const c = rise / radius;
    if (c >= 0.999) {
      radius = state.radius;
      phi = state.phi;
    } else {
      const maxPolar = Math.min(1.42, Math.acos(c) - 0.02);
      if (phi > maxPolar) phi = maxPolar;
    }
  }
  let camY = targetY + radius * Math.cos(phi);
  if (camY < floorY) {
    const cos = Math.max(0.05, Math.cos(phi));
    radius = Math.max(radius, (floorY - targetY) / cos);
    camY = targetY + radius * Math.cos(phi);
    if (camY < floorY) camY = floorY;
  }
  return { radius, phi, targetY, camY, floorY };
}

// Cinematic arc from the current eye to a stand-off in front of a pin.
export function campusApproach(from, lookFrom, pin, id) {
  let dx = from.x - pin.x, dz = from.z - pin.z;
  let len = Math.hypot(dx, dz);
  let ux, uz;
  if (len < 12) { ux = 0.72; uz = 0.7; len = 80; }
  else { ux = dx / len; uz = dz / len; }
  const stand = id === 'cages' ? 86 : 42;
  const end = {
    x: pin.x + ux * stand,
    y: Math.max(pin.y + 16, 30),
    z: pin.z + uz * stand,
  };
  const mid = {
    x: (from.x + end.x) / 2,
    y: Math.max(from.y, end.y) + Math.min(36, Math.max(14, len * 0.06)),
    z: (from.z + end.z) / 2,
  };
  const look = { x: pin.x, y: G + 5, z: pin.z };
  const lookMid = {
    x: (lookFrom.x + look.x) / 2,
    y: (lookFrom.y + look.y) / 2,
    z: (lookFrom.z + look.z) / 2,
  };
  const travel = Math.hypot(end.x - from.x, end.y - from.y, end.z - from.z);
  const dur = Math.min(3.2, Math.max(1.85, 1.5 + travel / 220));
  return { mid, end, lookMid, look, dur, fov: id === 'cages' ? 42 : 36, sway: 0 };
}
