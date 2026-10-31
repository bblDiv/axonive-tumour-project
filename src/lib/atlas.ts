import { planSurgery } from './planner';
import type { SurgicalPlan } from './planner';
import type { Hemisphere } from './eloquence';
import type { DeformationModel } from './deformation';

// Per-structure brain atlas: one closed surface per labelled region.
// Built from the parcellated STLs by the build_atlas script into /public/brain.
// Scene axes: x = patient left, y = superior, z = anterior. 10 units across the brain.

export type Lobe = 'Frontal' | 'Parietal' | 'Temporal' | 'Occipital' | 'Insula' | 'Limbic' | 'Brainstem' | 'Other';

export interface Structure {
  id: number;
  name: string;
  lobe: Lobe;
  side: 'left' | 'right' | 'midline';
  volumeCm3: number;
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  centroid: [number, number, number];
}

export interface Atlas {
  mmPerUnit: number;
  structures: Structure[];
}

export interface TumorParams {
  center: [number, number, number]; // scene units
  radiusMm: number;
  stiffness: number; // relative tissue stiffness, 3 = typical
  openingCm: number; // craniotomy diameter
  corridorMm: number; // tubular retractor or corridor diameter
  dominant: Hemisphere; // language-dominant hemisphere
}

export interface SimulationResult {
  deformed: Float32Array[];
  stress: Float32Array[];
  maxStressKpa: number;
  perStructure: { peakKpa: number; peakShiftMm: number }[];
  plan: SurgicalPlan;
  // Filled in once the plan exists, since the operative stages depend on the corridor
  deformation?: DeformationModel;
  phases?: { label: string; maxShiftMm: number; deepMarginShiftMm: number }[];
  routeModels?: { deformation: DeformationModel; phases: { label: string; maxShiftMm: number; deepMarginShiftMm: number }[] }[];
  metrics: {
    max_displacement_mm: number;
    avg_stress_kpa: number;
    affected_volume_cm3: number;
    vulnerable_regions: string[];
    tumor_location: string;
    tumor_volume_cm3: number;
  };
}

interface ManifestEntry {
  id: number;
  name: string;
  lobe: Lobe;
  side: Structure['side'];
  volumeCm3: number;
  positions: [number, number];
  indices: [number, number, 16 | 32];
}

let cached: Promise<Atlas> | null = null;

export function loadAtlas(): Promise<Atlas> {
  if (!cached) {
    cached = (async () => {
      const [manifest, bin] = await Promise.all([
        fetch('/brain/atlas.json').then((r) => r.json()),
        fetch('/brain/atlas.bin').then((r) => r.arrayBuffer()),
      ]);
      const structures = (manifest.structures as ManifestEntry[]).map((m) => {
        const positions = new Float32Array(bin, m.positions[0], m.positions[1]);
        const indices = m.indices[2] === 16
          ? new Uint16Array(bin, m.indices[0], m.indices[1])
          : new Uint32Array(bin, m.indices[0], m.indices[1]);
        let cx = 0, cy = 0, cz = 0;
        const n = positions.length / 3;
        for (let i = 0; i < positions.length; i += 3) {
          cx += positions[i]; cy += positions[i + 1]; cz += positions[i + 2];
        }
        return {
          id: m.id, name: m.name, lobe: m.lobe, side: m.side, volumeCm3: m.volumeCm3,
          positions, indices, centroid: [cx / n, cy / n, cz / n] as [number, number, number],
        };
      });
      return { mmPerUnit: manifest.mmPerUnit, structures };
    })();
    cached.catch(() => { cached = null; });
  }
  return cached;
}

// Sample case: a tumor in the right middle frontal gyrus, just deep of the cortex
export function defaultTumor(atlas: Atlas): TumorParams {
  const host = atlas.structures.find((s) => s.name === 'Right middle frontal gyrus') ?? atlas.structures[0];
  const [x, y, z] = host.centroid;
  return {
    center: [x * 0.88, y * 0.88, z * 0.88], radiusMm: 12.5, stiffness: 3, openingCm: 5, corridorMm: 12, dominant: 'left',
  };
}

export function sphereVolumeCm3(radiusMm: number) {
  return (4 / 3) * Math.PI * Math.pow(radiusMm / 10, 3);
}

function nearestStructure(atlas: Atlas, p: [number, number, number]) {
  let best = atlas.structures[0];
  let bestD = Infinity;
  for (const s of atlas.structures) {
    const pos = s.positions;
    for (let i = 0; i < pos.length; i += 9) {
      const d = (pos[i] - p[0]) ** 2 + (pos[i + 1] - p[1]) ** 2 + (pos[i + 2] - p[2]) ** 2;
      if (d < bestD) { bestD = d; best = s; }
    }
  }
  return best;
}

// Tissue relaxes toward the cavity once the tumor is removed. Displacement decays
// exponentially with distance from the cavity wall; stress scales with stiffness.
const DECAY_MM = 20;
const STRESS_PER_MM = 0.11;

export function simulateResection(atlas: Atlas, t: TumorParams): SimulationResult {
  const mm = atlas.mmPerUnit;
  const [cx, cy, cz] = t.center;
  const openingFactor = 0.8 + 0.04 * t.openingCm;
  const maxShiftMm = (t.radiusMm * 0.28 * openingFactor) / (Math.max(0.5, t.stiffness) / 3);

  const deformed: Float32Array[] = [];
  const stress: Float32Array[] = [];
  let maxShift = 0, maxStress = 0, stressSum = 0, stressCount = 0, affected = 0;
  const vulnerable: { name: string; peak: number }[] = [];
  const perStructure: { peakKpa: number; peakShiftMm: number }[] = [];

  for (const s of atlas.structures) {
    const src = s.positions;
    const out = new Float32Array(src.length);
    const st = new Float32Array(src.length / 3);
    let moved = 0, peak = 0, peakShift = 0;
    for (let i = 0, v = 0; i < src.length; i += 3, v++) {
      const dx = src[i] - cx, dy = src[i + 1] - cy, dz = src[i + 2] - cz;
      const distMm = Math.sqrt(dx * dx + dy * dy + dz * dz) * mm;
      const wall = Math.max(0, distMm - t.radiusMm);
      const shiftMm = distMm < 1e-6 ? 0 : maxShiftMm * Math.exp(-wall / DECAY_MM);
      const k = distMm < 1e-6 ? 0 : shiftMm / (distMm);
      out[i] = src[i] - dx * k;
      out[i + 1] = src[i + 1] - dy * k;
      out[i + 2] = src[i + 2] - dz * k;
      const kpa = shiftMm * t.stiffness * STRESS_PER_MM;
      st[v] = kpa;
      if (shiftMm > maxShift) maxShift = shiftMm;
      if (shiftMm > peakShift) peakShift = shiftMm;
      if (kpa > peak) peak = kpa;
      if (kpa > 0.1) { stressSum += kpa; stressCount++; }
      if (shiftMm > 0.5) moved++;
    }
    affected += s.volumeCm3 * (moved / (src.length / 3));
    if (peak > maxStress) maxStress = peak;
    if (peak > 0.6) vulnerable.push({ name: s.name, peak });
    perStructure.push({ peakKpa: peak, peakShiftMm: peakShift });
    deformed.push(out);
    stress.push(st);
  }

  vulnerable.sort((a, b) => b.peak - a.peak);
  return {
    deformed,
    stress,
    maxStressKpa: maxStress,
    perStructure,
    plan: planSurgery(atlas, t, t.dominant, t.corridorMm, perStructure),
    metrics: {
      max_displacement_mm: maxShift,
      avg_stress_kpa: stressCount ? stressSum / stressCount : 0,
      affected_volume_cm3: affected,
      vulnerable_regions: vulnerable.slice(0, 5).map((v) => v.name),
      tumor_location: nearestStructure(atlas, t.center).name,
      tumor_volume_cm3: sphereVolumeCm3(t.radiusMm),
    },
  };
}

export const LOBE_COLORS: Record<Lobe, string> = {
  Frontal: '#7c9cc9',
  Parietal: '#8fb79a',
  Temporal: '#d1a86a',
  Occipital: '#b48ab8',
  Insula: '#c98a7c',
  Limbic: '#6fb3b0',
  Brainstem: '#a8a29e',
  Other: '#9ca3af',
};
