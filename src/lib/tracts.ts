// Atlas-derived white matter tracts. Each tract follows published anatomical waypoints, anchored to the
// centroids and surfaces of the atlas regions it connects, and is drawn as a bundle of fibers. These are
// a stand-in for the patient's own DTI tractography, which this app cannot import yet.

import type { Atlas } from './atlas';

type Vec3 = [number, number, number];

export interface Tract {
  key: 'cst' | 'af' | 'or' | 'cc';
  name: string;
  side: 'left' | 'right' | 'midline';
  fibers: Vec3[][]; // densely sampled points, scene units
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: Vec3, b: Vec3, f: number): Vec3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
const add = (a: Vec3, b: Vec3, f = 1): Vec3 => [a[0] + b[0] * f, a[1] + b[1] * f, a[2] + b[2] * f];

// Uniform Catmull-Rom through the control points, `per` samples per segment
export function sampleSpline(pts: Vec3[], per = 10): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const c = (j: number) =>
        0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
      out.push([c(0), c(1), c(2)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Evenly spaced surface points of a region that pass a filter, pulled toward an anchor so they sit in white matter
function seeds(atlas: Atlas, name: string, n: number, keep: (p: Vec3, c: Vec3) => boolean, anchor: Vec3, pull: number): Vec3[] {
  const s = atlas.structures.find((x) => x.name === name);
  if (!s) return [anchor];
  const pts: Vec3[] = [];
  for (let i = 0; i < s.positions.length; i += 3) {
    const p: Vec3 = [s.positions[i], s.positions[i + 1], s.positions[i + 2]];
    if (keep(p, s.centroid)) pts.push(p);
  }
  if (pts.length === 0) return [anchor];
  pts.sort((a, b) => a[2] - b[2] || a[1] - b[1]);
  const out: Vec3[] = [];
  for (let k = 0; k < n; k++) out.push(lerp(pts[Math.floor(((k + 0.5) / n) * pts.length)], anchor, pull));
  return out;
}

function bundle(controls: (i: number) => Vec3[], n: number, spread: number[], seed: number): Vec3[][] {
  const rnd = mulberry32(seed);
  const fibers: Vec3[][] = [];
  for (let i = 0; i < n; i++) {
    const o: Vec3 = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5];
    const pts = controls(i).map((p, k) => add(p, o, spread[Math.min(k, spread.length - 1)]));
    fibers.push(sampleSpline(pts, 10));
  }
  return fibers;
}

const cache = new WeakMap<Atlas, Tract[]>();

export function buildTracts(atlas: Atlas): Tract[] {
  const hit = cache.get(atlas);
  if (hit) return hit;
  const tracts: Tract[] = [];

  for (const side of ['left', 'right'] as const) {
    const s = side === 'left' ? 1 : -1;
    const Side = side === 'left' ? 'Left' : 'Right';
    const X = (x: number, y: number, z: number): Vec3 => [s * x, y, z];

    // Corticospinal: fans out from the precentral gyrus, converges through the internal capsule into the medulla
    const cstSeeds = seeds(atlas, `${Side} precentral gyrus`, 16, (p, c) => p[1] > c[1] - 0.6, X(1.35, 1.75, -0.45), 0.3);
    tracts.push({
      key: 'cst', name: `${Side} corticospinal tract`, side,
      fibers: bundle((i) => [
        cstSeeds[i % cstSeeds.length],
        lerp(cstSeeds[i % cstSeeds.length], X(1.35, 1.75, -0.45), 0.55),
        X(1.35, 1.75, -0.45), X(0.95, 0.75, -0.25), X(0.45, -0.75, -0.1), X(0.3, -1.8, -0.35), X(0.15, -2.9, -0.7),
      ], 16, [0, 0.12, 0.18, 0.12, 0.08, 0.06, 0.04], side === 'left' ? 11 : 12),
    });

    // Arcuate fasciculus: posterior inferior frontal gyrus, arching around the sylvian fissure into the posterior temporal lobe
    const afStart = seeds(atlas, `${Side} inferior frontal gyrus`, 10, (p, c) => p[2] < c[2], X(2.0, 1.4, 1.0), 0.35);
    const afEnd = seeds(atlas, `Posterior part of ${side} superior temporal gyrus`, 10, () => true, X(2.6, 0.3, -1.0), 0.35);
    tracts.push({
      key: 'af', name: `${Side} arcuate fasciculus`, side,
      fibers: bundle((i) => [
        afStart[i % afStart.length], X(2.05, 1.75, 0.5), X(2.15, 1.85, -0.6), X(2.35, 1.55, -1.5),
        X(2.55, 0.8, -1.75), X(2.65, 0.25, -1.3), afEnd[i % afEnd.length],
      ], 12, [0, 0.14, 0.16, 0.16, 0.14, 0.1, 0], side === 'left' ? 21 : 22),
    });

    // Optic radiation: lateral geniculate, Meyer's loop around the temporal horn, back to the calcarine cortex
    const orEnd = [
      ...seeds(atlas, `${Side} cuneus`, 6, (p, c) => p[1] < c[1], X(0.6, -0.1, -3.3), 0.2),
      ...seeds(atlas, `${Side} lingual gyrus`, 6, (p, c) => p[1] > c[1], X(0.6, -0.1, -3.3), 0.2),
    ];
    tracts.push({
      key: 'or', name: `${Side} optic radiation`, side,
      fibers: bundle((i) => [
        X(0.8, -0.5, -0.45), X(1.35, -0.7, 0.05), X(1.75, -0.45, -0.6), X(1.7, -0.25, -1.6), X(1.35, -0.15, -2.6), orEnd[i % orEnd.length],
      ], 12, [0.04, 0.12, 0.14, 0.14, 0.12, 0], side === 'left' ? 31 : 32),
    });
  }

  // Corpus callosum body: arcs across the midline just under the cingulate gyri
  const cc: Vec3[][] = [];
  for (let i = 0; i < 14; i++) {
    const z = -1.5 + (2.6 * i) / 13;
    const yMid = 1.15 - 0.15 * Math.pow((z + 0.2) / 1.3, 2);
    cc.push(sampleSpline([[-1.9, 2.2, z], [-1.0, yMid + 0.4, z], [0, yMid, z], [1.0, yMid + 0.4, z], [1.9, 2.2, z]], 10));
  }
  tracts.push({ key: 'cc', name: 'Corpus callosum', side: 'midline', fibers: cc });

  cache.set(atlas, tracts);
  return tracts;
}
