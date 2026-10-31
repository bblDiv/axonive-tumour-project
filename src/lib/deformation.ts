// Brain shift through the stages of the operation, so the model can be scrubbed like a timeline:
//   0 pre-op, 1 craniotomy and dural opening (CSF loss, the brain sags away from the opening under gravity),
//   2 retractor advanced along the corridor (tissue pushed radially to the retractor wall),
//   3 tumor removed (tissue relaxes into the cavity).
// Each stage is a precomputed displacement field; positions at any point in the timeline are a blend.

import type { Atlas, SimulationResult, TumorParams } from './atlas';
import type { Trajectory } from './planner';

type Vec3 = [number, number, number];

export const PHASES = ['Pre-op', 'Dura open', 'Retractor in', 'Tumor out'] as const;

export interface DeformationModel {
  sag: Float32Array[]; // scene units
  retract: Float32Array[]; // scene units, for a fully advanced retractor
  axisDepthMm: Float32Array[]; // depth of each vertex along the corridor from the entry point
  resect: Float32Array[]; // scene units
  corridorDepthMm: number;
  sagMaxMm: number;
  deepMargin: { sag: Vec3; resect: Vec3 }; // mm, field at the margin farthest from the entry
}

export interface DeformationFrame {
  positions: Float32Array[];
  shift: Float32Array[]; // mm per vertex
  maxShiftMm: number;
  deepMarginShiftMm: number;
  toolTipMm: number; // retractor tip depth past the cortex, negative while still outside
}

const SAG_DECAY_MM = 35;
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function buildDeformation(
  atlas: Atlas, tumor: TumorParams, result: SimulationResult, route: Trajectory | null = result.plan.best,
): DeformationModel {
  const mm = atlas.mmPerUnit;
  const best = route;
  // With the entry uppermost, gravity points from the opening into the head
  const d: Vec3 = best ? best.direction : [0, 1, 0];
  const entry: Vec3 = best ? best.entry : [tumor.center[0], tumor.center[1] + 4, tumor.center[2]];
  const corridorDepthMm = best ? best.depthMm : 0;
  const R = tumor.corridorMm / 2;
  const sagMaxMm = Math.min(6, (1 + 0.5 * tumor.openingCm) * Math.sqrt(3 / Math.max(0.5, tumor.stiffness)));

  // A unit vector perpendicular to the corridor, for vertices sitting exactly on its axis
  const perp: Vec3 = Math.abs(d[1]) < 0.9 ? [d[2], 0, -d[0]] : [0, -d[2], d[1]];
  const pl = Math.hypot(...perp) || 1;

  const sag: Float32Array[] = [], retract: Float32Array[] = [], axisDepthMm: Float32Array[] = [], resect: Float32Array[] = [];

  atlas.structures.forEach((s, si) => {
    const p = s.positions;
    const n = p.length / 3;
    const sg = new Float32Array(p.length), rt = new Float32Array(p.length), ad = new Float32Array(n), rs = new Float32Array(p.length);
    const def = result.deformed[si];
    for (let v = 0, i = 0; v < n; v++, i += 3) {
      const vx = (p[i] - entry[0]) * mm, vy = (p[i + 1] - entry[1]) * mm, vz = (p[i + 2] - entry[2]) * mm;
      const dist = Math.sqrt(vx * vx + vy * vy + vz * vz);

      const sagMm = sagMaxMm * Math.exp(-dist / SAG_DECAY_MM);
      sg[i] = (-d[0] * sagMm) / mm; sg[i + 1] = (-d[1] * sagMm) / mm; sg[i + 2] = (-d[2] * sagMm) / mm;

      // Depth along the corridor (into the head is -d) and distance from its axis
      const depth = -(vx * d[0] + vy * d[1] + vz * d[2]);
      ad[v] = depth;
      let rx = vx + d[0] * depth, ry = vy + d[1] * depth, rz = vz + d[2] * depth;
      let rd = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (rd < 1e-3) { rx = perp[0] / pl; ry = perp[1] / pl; rz = perp[2] / pl; rd = 1; }
      const push = best && depth > -3 ? R * Math.exp(-rd / (R * 1.3)) : 0;
      rt[i] = (rx / rd) * push / mm; rt[i + 1] = (ry / rd) * push / mm; rt[i + 2] = (rz / rd) * push / mm;

      rs[i] = def[i] - p[i]; rs[i + 1] = def[i + 1] - p[i + 1]; rs[i + 2] = def[i + 2] - p[i + 2];
    }
    sag.push(sg); retract.push(rt); axisDepthMm.push(ad); resect.push(rs);
  });

  // Deep margin: the tumor surface farthest from the entry. Sag pushes it deeper, relaxation pulls it back toward the cavity
  const deep: Vec3 = [
    tumor.center[0] - (d[0] * tumor.radiusMm) / mm,
    tumor.center[1] - (d[1] * tumor.radiusMm) / mm,
    tumor.center[2] - (d[2] * tumor.radiusMm) / mm,
  ];
  const dd = Math.hypot((deep[0] - entry[0]) * mm, (deep[1] - entry[1]) * mm, (deep[2] - entry[2]) * mm);
  const sagDeep = sagMaxMm * Math.exp(-dd / SAG_DECAY_MM);
  const relax = result.metrics.max_displacement_mm;

  return {
    sag, retract, axisDepthMm, resect, corridorDepthMm, sagMaxMm,
    deepMargin: {
      sag: [-d[0] * sagDeep, -d[1] * sagDeep, -d[2] * sagDeep],
      resect: [d[0] * relax, d[1] * relax, d[2] * relax],
    },
  };
}

export function deformAt(atlas: Atlas, model: DeformationModel, t: number): DeformationFrame {
  const mm = atlas.mmPerUnit;
  const sagF = smooth(clamp01(t));
  // The retractor starts 8 mm outside the cortex and stops 1 mm past the tumor margin
  const toolTipMm = -8 + clamp01(t - 1) * (model.corridorDepthMm + 9);
  const retractOn = t > 1;
  const resectF = smooth(clamp01(t - 2));

  const positions: Float32Array[] = [], shift: Float32Array[] = [];
  let maxShiftMm = 0;
  atlas.structures.forEach((s, si) => {
    const p = s.positions, sg = model.sag[si], rt = model.retract[si], ad = model.axisDepthMm[si], rs = model.resect[si];
    const out = new Float32Array(p.length), sh = new Float32Array(p.length / 3);
    for (let v = 0, i = 0; i < p.length; v++, i += 3) {
      const g = retractOn ? clamp01(1 - (ad[v] - toolTipMm) / 4) : 0;
      const dx = sg[i] * sagF + rt[i] * g + rs[i] * resectF;
      const dy = sg[i + 1] * sagF + rt[i + 1] * g + rs[i + 1] * resectF;
      const dz = sg[i + 2] * sagF + rt[i + 2] * g + rs[i + 2] * resectF;
      out[i] = p[i] + dx; out[i + 1] = p[i + 1] + dy; out[i + 2] = p[i + 2] + dz;
      const m = Math.sqrt(dx * dx + dy * dy + dz * dz) * mm;
      sh[v] = m;
      if (m > maxShiftMm) maxShiftMm = m;
    }
    positions.push(out); shift.push(sh);
  });

  const dm = model.deepMargin;
  const x = dm.sag[0] * sagF + dm.resect[0] * resectF, y = dm.sag[1] * sagF + dm.resect[1] * resectF, z = dm.sag[2] * sagF + dm.resect[2] * resectF;
  return { positions, shift, maxShiftMm, deepMarginShiftMm: Math.sqrt(x * x + y * y + z * z), toolTipMm };
}

export function phaseStats(atlas: Atlas, model: DeformationModel) {
  return PHASES.slice(1).map((label, i) => {
    const f = deformAt(atlas, model, i + 1);
    return { label, maxShiftMm: f.maxShiftMm, deepMarginShiftMm: f.deepMarginShiftMm };
  });
}
