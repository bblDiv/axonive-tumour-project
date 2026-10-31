// Atlas-derived skull shell, standing in for the patient's CT. Built from the outer envelope of the brain
// seen from its center, offset outward by the CSF space and bone thickness, with an optional craniotomy hole.

import type { Atlas } from './atlas';

type Vec3 = [number, number, number];

export interface SkullShell {
  positions: Float32Array;
  directions: Float32Array; // unit direction of each vertex from the center
  indices: Uint32Array;
  center: Vec3;
}

const TH = 48, PH = 96;
const cache = new WeakMap<Atlas, SkullShell>();

export function buildSkull(atlas: Atlas, offsetMm = 6): SkullShell {
  const hit = cache.get(atlas);
  if (hit) return hit;
  let cx = 0, cy = 0, cz = 0, n = 0;
  for (const s of atlas.structures) {
    for (let i = 0; i < s.positions.length; i += 3) { cx += s.positions[i]; cy += s.positions[i + 1]; cz += s.positions[i + 2]; n++; }
  }
  const center: Vec3 = [cx / n, cy / n, cz / n];

  const maxR = new Float32Array((TH + 1) * PH);
  for (const s of atlas.structures) {
    const p = s.positions;
    for (let i = 0; i < p.length; i += 3) {
      const x = p[i] - center[0], y = p[i + 1] - center[1], z = p[i + 2] - center[2];
      const r = Math.sqrt(x * x + y * y + z * z);
      const th = Math.round((Math.acos(Math.max(-1, Math.min(1, y / (r || 1)))) / Math.PI) * TH);
      const ph = ((Math.round(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * PH) % PH) + PH) % PH;
      const b = th * PH + ph;
      if (r > maxR[b]) maxR[b] = r;
    }
  }

  // Fill empty bins and smooth so the shell reads as bone, not as a cast of every gyrus
  let grid = maxR;
  for (let pass = 0; pass < 6; pass++) {
    const next = new Float32Array(grid.length);
    for (let th = 0; th <= TH; th++) {
      for (let ph = 0; ph < PH; ph++) {
        let sum = 0, cnt = 0, mx = 0;
        for (let dt = -1; dt <= 1; dt++) {
          const t2 = th + dt;
          if (t2 < 0 || t2 > TH) continue;
          for (let dp = -1; dp <= 1; dp++) {
            const v = grid[t2 * PH + ((ph + dp + PH) % PH)];
            if (v > 0) { sum += v; cnt++; mx = Math.max(mx, v); }
          }
        }
        next[th * PH + ph] = cnt ? 0.5 * mx + 0.5 * (sum / cnt) : 0;
      }
    }
    grid = next;
  }

  const offset = offsetMm / atlas.mmPerUnit;
  const positions = new Float32Array((TH + 1) * PH * 3);
  const directions = new Float32Array((TH + 1) * PH * 3);
  for (let th = 0; th <= TH; th++) {
    const theta = (th / TH) * Math.PI;
    for (let ph = 0; ph < PH; ph++) {
      const phi = (ph / PH) * 2 * Math.PI - Math.PI;
      const d: Vec3 = [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)];
      const r = grid[th * PH + ph] + offset;
      const k = (th * PH + ph) * 3;
      directions[k] = d[0]; directions[k + 1] = d[1]; directions[k + 2] = d[2];
      positions[k] = center[0] + d[0] * r; positions[k + 1] = center[1] + d[1] * r; positions[k + 2] = center[2] + d[2] * r;
    }
  }
  const idx: number[] = [];
  for (let th = 0; th < TH; th++) {
    for (let ph = 0; ph < PH; ph++) {
      const a = th * PH + ph, b = th * PH + ((ph + 1) % PH), c = (th + 1) * PH + ph, d = (th + 1) * PH + ((ph + 1) % PH);
      idx.push(a, c, b, b, c, d);
    }
  }
  const shell = { positions, directions, indices: new Uint32Array(idx), center };
  cache.set(atlas, shell);
  return shell;
}

// Faces whose vertices fall inside the craniotomy (a cone around the entry direction) or the foramen magnum are dropped
export function skullIndices(shell: SkullShell, entry: Vec3 | null, craniotomyRadius: number): Uint32Array {
  const { directions, indices, center } = shell;
  let cosLimit = 2;
  let ed: Vec3 = [0, 1, 0];
  if (entry) {
    const v: Vec3 = [entry[0] - center[0], entry[1] - center[1], entry[2] - center[2]];
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    ed = [v[0] / len, v[1] / len, v[2] / len];
    cosLimit = Math.cos(Math.atan(craniotomyRadius / len));
  }
  const removed = (vi: number) => {
    const k = vi * 3;
    if (directions[k + 1] < -0.93) return true;
    const dot = directions[k] * ed[0] + directions[k + 1] * ed[1] + directions[k + 2] * ed[2];
    return entry !== null && dot > cosLimit;
  };
  const out: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    if (removed(indices[i]) || removed(indices[i + 1]) || removed(indices[i + 2])) continue;
    out.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  return new Uint32Array(out);
}
