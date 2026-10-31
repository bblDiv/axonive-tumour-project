// Surgical corridor planner. Casts candidate corridors outward from the tumor center, finds where each
// one reaches the cortical surface, and scores it by depth, the regions it passes through and how close
// it runs to eloquent cortex. Works on the atlas surfaces, so it is a planning aid, not a navigation plan.

import { eloquenceOf, riskLevel, tractEloquence } from './eloquence';
import { buildTracts } from './tracts';
import type { Eloquence, FunctionCategory, Hemisphere } from './eloquence';
import type { Atlas, TumorParams } from './atlas';

type Vec3 = [number, number, number];

export interface CorridorStructure {
  id: number;
  name: string;
  fn: string;
  category: FunctionCategory;
  weight: number;
}

export interface Trajectory {
  direction: Vec3; // unit vector, scene axes
  entry: Vec3; // scene units
  entryStructure: string;
  depthMm: number; // cortex to tumor margin
  lengthMm: number; // cortex to tumor center
  crossed: CorridorStructure[];
  closest: (CorridorStructure & { clearanceMm: number })[];
  cost: number;
  angleFromVerticalDeg: number;
  heading: string;
  positioning: string;
  approach: string;
  entryRas: Vec3; // mm, right / anterior / superior from brain center
}

export interface StructureRisk extends CorridorStructure {
  distanceMm: number; // to tumor margin, 0 = touching
  corridorClearanceMm: number | null;
  crossed: boolean;
  peakKpa: number;
  peakShiftMm: number;
  score: number;
  level: 'High' | 'Moderate' | 'Low';
}

export const ROUTE_LABELS = ['Recommended', 'Alt 1', 'Alt 2'] as const;

export interface Route {
  label: (typeof ROUTE_LABELS)[number];
  trajectory: Trajectory;
  risks: StructureRisk[];
  checklist: string[];
}

export interface SurgicalPlan {
  dominant: Hemisphere;
  corridorMm: number;
  best: Trajectory | null;
  alternatives: Trajectory[];
  routes: Route[]; // recommended first
  noCorridorReason?: string;
  lesion: {
    location: string;
    lobe: string;
    side: 'left' | 'right' | 'midline';
    inDominantHemisphere: boolean;
    volumeCm3: number;
    diameterMm: number;
    depthFromCortexMm: number;
    centerRas: Vec3;
    nearestEloquent: { name: string; fn: string; distanceMm: number } | null;
  };
  risks: StructureRisk[];
  checklist: string[];
}

const DIRECTIONS = 520;
const OUTER_MARGIN_MM = 8;

// Marks vertices that lie on the outer envelope of the brain, seen from its center, by binning
// directions and comparing each vertex to the farthest one in its own and neighbouring bins.
function outerSurfaceFlags(rel: Float32Array, total: number) {
  let ox = 0, oy = 0, oz = 0;
  for (let v = 0; v < total; v++) { ox += rel[v * 3]; oy += rel[v * 3 + 1]; oz += rel[v * 3 + 2]; }
  ox /= total; oy /= total; oz /= total;
  const TH = 36, PH = 72;
  const maxR = new Float32Array(TH * PH);
  const bin = new Uint16Array(total);
  const rad = new Float32Array(total);
  for (let v = 0; v < total; v++) {
    const x = rel[v * 3] - ox, y = rel[v * 3 + 1] - oy, z = rel[v * 3 + 2] - oz;
    const r = Math.sqrt(x * x + y * y + z * z);
    const th = Math.min(TH - 1, Math.floor((Math.acos(Math.max(-1, Math.min(1, y / (r || 1)))) / Math.PI) * TH));
    const ph = Math.min(PH - 1, Math.floor(((Math.atan2(z, x) + Math.PI) / (2 * Math.PI)) * PH));
    const b = th * PH + ph;
    bin[v] = b; rad[v] = r;
    if (r > maxR[b]) maxR[b] = r;
  }
  const smooth = new Float32Array(TH * PH);
  for (let th = 0; th < TH; th++) {
    for (let ph = 0; ph < PH; ph++) {
      let m = 0;
      for (let dt = -1; dt <= 1; dt++) {
        const t2 = th + dt;
        if (t2 < 0 || t2 >= TH) continue;
        for (let dp = -1; dp <= 1; dp++) m = Math.max(m, maxR[t2 * PH + ((ph + dp + PH) % PH)]);
      }
      smooth[th * PH + ph] = m;
    }
  }
  const out = new Uint8Array(total);
  for (let v = 0; v < total; v++) out[v] = rad[v] >= smooth[bin[v]] - OUTER_MARGIN_MM ? 1 : 0;
  return out;
}
const MIN_HITS = 2;

function fibonacciSphere(n: number): Vec3[] {
  const out: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    out.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return out;
}

const toRas = (v: Vec3, mm: number): Vec3 => [-v[0] * mm, v[2] * mm, v[1] * mm];

function describeHeading(d: Vec3, tumorSide: 'left' | 'right' | 'midline') {
  const lateralSign = tumorSide === 'left' ? 1 : -1;
  const terms: string[] = [];
  if (d[1] > 0.35) terms.push('superior');
  if (Math.abs(d[0]) > 0.35) terms.push(d[0] * lateralSign > 0 ? 'lateral' : 'medial');
  if (Math.abs(d[2]) > 0.35) terms.push(d[2] > 0 ? 'anterior' : 'posterior');
  if (d[1] < -0.35) terms.push('inferior');
  if (terms.length === 0) return 'oblique';
  if (terms[0] === 'superior' && terms.length > 1) {
    return [`supero${terms[1]}`, ...terms.slice(2)].join(', ');
  }
  return terms.join(', ');
}

function describePositioning(d: Vec3, tumorSide: 'left' | 'right' | 'midline') {
  const lateral = Math.abs(d[0]);
  const up = d[1];
  const ant = d[2];
  const away = tumorSide === 'left' ? 'right' : 'left';
  if (ant < -0.55 && up < 0.6) return 'Prone in pins, head flexed so the entry point is uppermost';
  if (up > 0.8) return 'Supine, head neutral, elevated 20 to 30 degrees with the neck slightly flexed';
  const turn = Math.min(90, Math.round((Math.atan2(lateral, Math.max(up, 0.01)) * 180) / Math.PI / 5) * 5);
  if (lateral > 0.6 && up < 0.3) {
    return `Lateral (park bench), or supine with a shoulder roll and the head turned about ${turn} degrees to the ${away}`;
  }
  if (lateral >= Math.abs(ant)) return `Supine, head turned about ${turn} degrees to the ${away} so the entry point is uppermost`;
  if (ant > 0) return 'Supine, head neutral with slight extension';
  return 'Supine with the head flexed, or prone, so the entry point is uppermost';
}

export function planSurgery(
  atlas: Atlas,
  tumor: TumorParams,
  dominant: Hemisphere,
  corridorMm: number,
  stressByStructure: { peakKpa: number; peakShiftMm: number }[],
): SurgicalPlan {
  const mm = atlas.mmPerUnit;
  const [cx, cy, cz] = tumor.center;
  const radius = tumor.radiusMm;
  const r = corridorMm / 2;
  const r2 = r * r;
  const tumorSide: 'left' | 'right' | 'midline' = cx * mm > 8 ? 'left' : cx * mm < -8 ? 'right' : 'midline';

  // Entities are the atlas regions followed by the white matter tracts; tracts never define the entry point
  const tracts = buildTracts(atlas);
  const S = atlas.structures.length;
  const E = S + tracts.length;
  const elo: Eloquence[] = [
    ...atlas.structures.map((s) => eloquenceOf(s.name, dominant)),
    ...tracts.map((t) => tractEloquence(t.key, t.side, dominant)),
  ];
  const entityName = (e: number) => (e < S ? atlas.structures[e].name : tracts[e - S].name);
  const entitySide = (e: number) => (e < S ? atlas.structures[e].side : tracts[e - S].side);
  const entityId = (e: number) => (e < S ? e : 1000 + (e - S));

  // Vertices relative to the tumor center, in mm
  let total = 0;
  for (const s of atlas.structures) total += s.positions.length / 3;
  const rel = new Float32Array(total * 3);
  const len2 = new Float32Array(total);
  const owner = new Uint8Array(total);
  const minDist = new Float32Array(E).fill(Infinity);
  let k = 0;
  let minY = Infinity, maxY = -Infinity;
  atlas.structures.forEach((s, si) => {
    const p = s.positions;
    for (let i = 0; i < p.length; i += 3, k++) {
      const x = (p[i] - cx) * mm, y = (p[i + 1] - cy) * mm, z = (p[i + 2] - cz) * mm;
      rel[k * 3] = x; rel[k * 3 + 1] = y; rel[k * 3 + 2] = z;
      const l2 = x * x + y * y + z * z;
      len2[k] = l2;
      owner[k] = si;
      const d = Math.sqrt(l2) - radius;
      if (d < minDist[si]) minDist[si] = d;
      const wy = p[i + 1] * mm;
      if (wy < minY) minY = wy;
      if (wy > maxY) maxY = wy;
    }
  });
  const skullBaseY = minY + (maxY - minY) * 0.28 - cy * mm; // relative to tumor center

  // Tract fiber points relative to the tumor center, in mm
  let tTotal = 0;
  for (const t of tracts) for (const f of t.fibers) tTotal += f.length;
  const relT = new Float32Array(tTotal * 3);
  const len2T = new Float32Array(tTotal);
  const ownerT = new Uint8Array(tTotal);
  let q = 0;
  tracts.forEach((t, ti) => {
    for (const f of t.fibers) {
      for (const pt of f) {
        const x = (pt[0] - cx) * mm, y = (pt[1] - cy) * mm, z = (pt[2] - cz) * mm;
        relT[q * 3] = x; relT[q * 3 + 1] = y; relT[q * 3 + 2] = z;
        len2T[q] = x * x + y * y + z * z;
        ownerT[q] = S + ti;
        const d = Math.sqrt(len2T[q]) - radius;
        if (d < minDist[S + ti]) minDist[S + ti] = d;
        q++;
      }
    }
  });
  const rT2 = (r + 1) * (r + 1);
  const outer = outerSurfaceFlags(rel, total);

  // Pass 1: entry point and regions crossed for every candidate direction
  const hits = new Uint16Array(E);
  interface Candidate { d: Vec3; tEntry: number; entryOwner: number; crossed: number[]; cost: number; }
  const candidates: Candidate[] = [];
  let shallowest = Infinity;

  for (const d of fibonacciSphere(DIRECTIONS)) {
    hits.fill(0);
    let tEntry = -1, entryOwner = -1, entryVertex = -1;
    for (let v = 0; v < total; v++) {
      const t = rel[v * 3] * d[0] + rel[v * 3 + 1] * d[1] + rel[v * 3 + 2] * d[2];
      if (t <= 0) continue;
      if (len2[v] - t * t > r2) continue;
      if (t > tEntry) { tEntry = t; entryOwner = owner[v]; entryVertex = v; }
      if (t > radius) hits[owner[v]]++;
    }
    // The corridor has to surface on the outer convexity, not leave through a gap between deep regions
    if (tEntry < 0 || !outer[entryVertex]) continue;
    if (tEntry - radius < shallowest) shallowest = Math.max(0, tEntry - radius);

    // Skull base entries are not reachable from a standard craniotomy
    if (tEntry * d[1] < skullBaseY) continue;

    for (let v = 0; v < tTotal; v++) {
      const t = relT[v * 3] * d[0] + relT[v * 3 + 1] * d[1] + relT[v * 3 + 2] * d[2];
      if (t <= radius || t >= tEntry) continue;
      if (len2T[v] - t * t <= rT2) hits[ownerT[v]]++;
    }

    const crossed: number[] = [];
    let cost = Math.max(0, tEntry - radius);
    let feasible = true;
    for (let si = 0; si < hits.length; si++) {
      if (hits[si] < MIN_HITS) continue;
      const e = elo[si];
      const side = entitySide(si);
      if (e.noGo) { feasible = false; break; }
      // A lateralised lesion should not be reached through the other hemisphere
      if (tumorSide !== 'midline' && side !== 'midline' && side !== tumorSide) { feasible = false; break; }
      crossed.push(si);
      cost += e.weight;
    }
    if (!feasible) continue;
    if (d[1] < 0) cost += 30 * -d[1];
    candidates.push({ d, tEntry, entryOwner, crossed, cost });
  }

  // Pass 2: clearance to eloquent regions along the best candidates
  candidates.sort((a, b) => a.cost - b.cost);
  const shortlist = candidates.slice(0, 40);
  const clearanceFor = (c: Candidate) => {
    const clear = new Float32Array(E).fill(Infinity);
    const d = c.d;
    const scan = (pts: Float32Array, own: Uint8Array, count: number) => {
      for (let v = 0; v < count; v++) {
        const x = pts[v * 3], y = pts[v * 3 + 1], z = pts[v * 3 + 2];
        let t = x * d[0] + y * d[1] + z * d[2];
        if (t < 0) t = 0; else if (t > c.tEntry) t = c.tEntry;
        const px = x - d[0] * t, py = y - d[1] * t, pz = z - d[2] * t;
        const dist = Math.sqrt(px * px + py * py + pz * pz) - r;
        if (dist < clear[own[v]]) clear[own[v]] = dist;
      }
    };
    scan(rel, owner, total);
    scan(relT, ownerT, tTotal);
    return clear;
  };

  const scored = shortlist.map((c) => {
    const clear = clearanceFor(c);
    let cost = c.cost;
    clear.forEach((cm, si) => {
      if (c.crossed.includes(si) || elo[si].weight < 20) return;
      cost += elo[si].weight * Math.max(0, (10 - Math.max(0, cm)) / 10) * 0.6;
    });
    return { c, clear, cost };
  });
  scored.sort((a, b) => a.cost - b.cost);

  const toTrajectory = ({ c, clear, cost }: (typeof scored)[number]): Trajectory => {
    const d = c.d;
    const entry: Vec3 = [cx + (d[0] * c.tEntry) / mm, cy + (d[1] * c.tEntry) / mm, cz + (d[2] * c.tEntry) / mm];
    const info = (si: number): CorridorStructure => ({
      id: entityId(si), name: entityName(si), fn: elo[si].fn, category: elo[si].category, weight: elo[si].weight,
    });
    const closest = elo
      .map((_, si) => si)
      .filter((si) => !c.crossed.includes(si) && elo[si].weight >= 20)
      .sort((a, b) => clear[a] - clear[b])
      .slice(0, 4)
      .map((si) => ({ ...info(si), clearanceMm: Math.max(0, clear[si]) }));
    const entryName = atlas.structures[c.entryOwner].name;
    return {
      direction: d,
      entry,
      entryStructure: entryName,
      depthMm: Math.max(0, c.tEntry - radius),
      lengthMm: c.tEntry,
      crossed: c.crossed.map(info).sort((a, b) => b.weight - a.weight),
      closest,
      cost,
      angleFromVerticalDeg: (Math.acos(Math.max(-1, Math.min(1, d[1]))) * 180) / Math.PI,
      heading: describeHeading(d, tumorSide),
      positioning: describePositioning(d, tumorSide),
      approach: `Transcortical through the ${entryName.toLowerCase()}`,
      entryRas: toRas(entry, mm),
    };
  };

  // The recommended route plus up to two alternatives that point at least 25 degrees away from it and each other
  const angle = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
  const pickedScored: (typeof scored)[number][] = [];
  for (const s of scored) {
    if (pickedScored.length >= 3) break;
    if (pickedScored.every((p) => angle(p.c.d, s.c.d) > (25 * Math.PI) / 180)) pickedScored.push(s);
  }

  // Structure-level risk for one route: what the tumor, its corridor and the shift do to each region
  const risksFor = (sc: (typeof scored)[number] | undefined): StructureRisk[] => {
    const clear = sc?.clear;
    const crossedSet = new Set(sc?.c.crossed ?? []);
    return elo.map((e, si) => {
      const dist = Math.max(0, minDist[si]);
      const corridor = clear ? Math.max(0, clear[si]) : null;
      const crossed = crossedSet.has(si);
      const near = Math.min(dist, corridor ?? Infinity);
      const prox = crossed ? 1 : Math.max(0, 1 - near / 20);
      const stress = (si < S && stressByStructure[si]) || { peakKpa: 0, peakShiftMm: 0 };
      const stressF = Math.min(1, stress.peakKpa / 1.0);
      const score = Math.min(100, e.weight) * Math.max(prox, 0.6 * stressF);
      return {
        id: entityId(si), name: entityName(si), fn: e.fn, category: e.category, weight: e.weight,
        distanceMm: dist, corridorClearanceMm: corridor, crossed,
        peakKpa: stress.peakKpa, peakShiftMm: stress.peakShiftMm,
        score, level: riskLevel(score),
      };
    }).filter((x) => x.score >= 5 || x.crossed).sort((a, b) => b.score - a.score).slice(0, 10);
  };

  // Lesion summary
  let host = 0;
  atlas.structures.forEach((_, si) => { if (minDist[si] < minDist[host]) host = si; });
  const hostS = atlas.structures[host];
  const eloquentNear = elo
    .map((_, si) => ({ name: entityName(si), si }))
    .filter(({ si }) => elo[si].weight >= 50)
    .sort((a, b) => minDist[a.si] - minDist[b.si])[0];

  const lesion = {
    location: hostS.name,
    lobe: hostS.lobe,
    side: tumorSide,
    inDominantHemisphere: tumorSide === dominant,
    volumeCm3: (4 / 3) * Math.PI * Math.pow(radius / 10, 3),
    diameterMm: radius * 2,
    depthFromCortexMm: Number.isFinite(shallowest) ? shallowest : 0,
    centerRas: toRas(tumor.center, mm),
    nearestEloquent: eloquentNear
      ? { name: eloquentNear.name, fn: elo[eloquentNear.si].fn, distanceMm: Math.max(0, minDist[eloquentNear.si]) }
      : null,
  };

  const routes: Route[] = pickedScored.map((sc, i) => {
    const trajectory = toTrajectory(sc);
    const risks = risksFor(sc);
    return {
      label: ROUTE_LABELS[i],
      trajectory,
      risks,
      checklist: buildChecklist(lesion, trajectory, risks, stressByStructure, dominant),
    };
  });
  const risks = routes[0]?.risks ?? risksFor(undefined);

  return {
    dominant,
    corridorMm,
    best: routes[0]?.trajectory ?? null,
    alternatives: routes.slice(1).map((r) => r.trajectory),
    routes,
    noCorridorReason: routes.length
      ? undefined
      : 'Every corridor from this position crosses the brainstem, the other hemisphere or the skull base. Consider an endoscopic, skull base or staged approach.',
    lesion,
    risks,
    checklist: routes[0]?.checklist ?? buildChecklist(lesion, null, risks, stressByStructure, dominant),
  };
}

// The plan as seen from one route: that route becomes "best", the others its alternatives
export function planForRoute(plan: SurgicalPlan, index: number): SurgicalPlan {
  const route = plan.routes[index];
  if (!route || index === 0) return plan;
  return {
    ...plan,
    best: route.trajectory,
    alternatives: plan.routes.filter((_, i) => i !== index).map((r) => r.trajectory),
    risks: route.risks,
    checklist: route.checklist,
  };
}

function buildChecklist(
  lesion: SurgicalPlan['lesion'],
  best: Trajectory | null,
  risks: StructureRisk[],
  stress: { peakKpa: number; peakShiftMm: number }[],
  dominant: Hemisphere,
): string[] {
  const out: string[] = [];
  const near = (cat: FunctionCategory, mmLimit: number) =>
    risks.find((r) => r.category === cat && (r.crossed || Math.min(r.distanceMm, r.corridorClearanceMm ?? Infinity) < mmLimit));

  const motor = near('motor', 10);
  if (motor) out.push(`Motor mapping: ${motor.name.toLowerCase()} is within 10 mm. Plan MEP monitoring and direct cortical or subcortical stimulation, and consider DTI of the corticospinal tract.`);
  const sensory = near('sensory', 8);
  if (sensory) out.push(`Sensory cortex (${sensory.name.toLowerCase()}) is close. SSEP monitoring and phase reversal help locate the central sulcus.`);
  const language = near('language', 15);
  if (language) out.push(`Language: ${language.name.toLowerCase()} (${language.fn.charAt(0).toLowerCase() + language.fn.slice(1)}) is within 15 mm in the ${dominant} hemisphere. Confirm dominance with fMRI or Wada and consider an awake craniotomy with language mapping.`);
  const visual = near('visual', 15);
  if (visual) out.push('Visual cortex is close. Get formal visual fields before surgery and consider DTI of the optic radiations.');
  const vascular = near('vascular', 8);
  if (vascular) out.push('The corridor runs near the insula. Expect MCA branches and lenticulostriate perforators at the deep margin; review CTA or MRA.');
  const memory = near('memory', 10);
  if (memory) out.push(`${memory.name} is close. Baseline neuropsychological memory testing is worth having.`);
  const sma = near('supplementary motor', 5);
  if (sma) out.push('Corridor passes the posterior superior frontal gyrus (SMA). Warn the patient about transient SMA syndrome.');

  const tract = risks.find((r) => r.id >= 1000 && r.weight >= 50 && (r.crossed || Math.min(r.distanceMm, r.corridorClearanceMm ?? Infinity) < 10));
  if (tract) {
    out.push(`Subcortical: the ${tract.name.toLowerCase()} runs ${tract.crossed ? 'through the corridor' : `${Math.min(tract.distanceMm, tract.corridorClearanceMm ?? Infinity).toFixed(0)} mm away`}. Plan subcortical stimulation and confirm its course on the patient's own DTI.`);
  }
  const stem = risks.find((r) => r.category === 'brainstem' && Math.min(r.distanceMm, r.corridorClearanceMm ?? Infinity) < 10);
  if (stem) out.unshift(`High risk: ${stem.name.toLowerCase()} is ${Math.min(stem.distanceMm, stem.corridorClearanceMm ?? Infinity).toFixed(0)} mm away. A transcortical corridor is unlikely to be the right answer; discuss a skull base approach or stereotactic biopsy with a skull base team.`);

  const maxShift = Math.max(0, ...stress.map((s) => s.peakShiftMm));
  if (maxShift >= 3) {
    out.push(`Brain shift reaches ${maxShift.toFixed(1)} mm. Re-register navigation or use intraoperative ultrasound or MRI after debulking.`);
  } else {
    out.push('Predicted shift is under 3 mm, so navigation should stay usable, but check accuracy against landmarks after debulking.');
  }
  if (best && best.depthMm > 25) {
    out.push(`The lesion is ${best.depthMm.toFixed(0)} mm deep along this corridor. A tubular retractor keeps the corridor width fixed and limits retraction pressure.`);
  }
  if (lesion.inDominantHemisphere && !language) {
    out.push('Lesion is in the language-dominant hemisphere. Confirm dominance even though no language area is within 15 mm.');
  }
  out.push("Confirm the trajectory on the patient's own MRI. These numbers come from a template brain.");
  return out;
}
