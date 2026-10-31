// The computed facts behind a pre-op report. Every number in the report comes from here; the language
// model only writes the narrative around these facts, so it cannot change them.

import type { SimulationResult, TumorParams, Atlas } from './atlas';
import { planForRoute } from './planner';
import type { Trajectory } from './planner';

export interface ApproachFacts {
  approach: string;
  entryStructure: string;
  heading: string;
  angleFromVerticalDeg: number;
  depthMm: number;
  lengthMm: number;
  entryRas: [number, number, number];
  positioning: string;
  crossed: { name: string; fn: string }[];
  closest: { name: string; fn: string; clearanceMm: number }[];
}

export interface ReportFacts {
  lesion: {
    location: string;
    lobe: string;
    side: string;
    dominantHemisphere: string;
    inDominantHemisphere: boolean;
    volumeCm3: number;
    diameterMm: number;
    depthFromCortexMm: number;
    centerRas: [number, number, number];
    nearestEloquent: { name: string; fn: string; distanceMm: number } | null;
  };
  approach: ApproachFacts | null;
  route: { label: string; isRecommended: boolean };
  noCorridorReason?: string;
  // `note` says why a route is not preferred, or for the recommended one why it is
  alternatives: (ApproachFacts & { label: string; isRecommended: boolean; note: string })[];
  shift: {
    maxShiftMm: number;
    avgStressKpa: number;
    affectedCm3: number;
    mostStressed: { name: string; peakKpa: number; peakShiftMm: number }[];
    phases: { label: string; maxShiftMm: number; deepMarginShiftMm: number }[];
  };
  risks: {
    name: string;
    fn: string;
    level: 'High' | 'Moderate' | 'Low';
    distanceMm: number;
    corridorClearanceMm: number | null;
    crossed: boolean;
    peakKpa: number;
  }[];
  checklist: string[];
  params: { radiusMm: number; stiffness: number; openingCm: number; corridorMm: number };
}

function approachFacts(t: Trajectory): ApproachFacts {
  return {
    approach: t.approach,
    entryStructure: t.entryStructure,
    heading: t.heading,
    angleFromVerticalDeg: t.angleFromVerticalDeg,
    depthMm: t.depthMm,
    lengthMm: t.lengthMm,
    entryRas: t.entryRas,
    positioning: t.positioning,
    crossed: t.crossed.map((c) => ({ name: c.name, fn: c.fn })),
    closest: t.closest.map((c) => ({ name: c.name, fn: c.fn, clearanceMm: c.clearanceMm })),
  };
}

// A clause that completes "Not preferred because ..."
function whyNot(alt: Trajectory, best: Trajectory): string {
  const reasons: string[] = [];
  if (alt.depthMm > best.depthMm + 3) reasons.push(`it is ${(alt.depthMm - best.depthMm).toFixed(0)} mm deeper`);
  const bestCrossed = new Set(best.crossed.map((c) => c.name));
  const extra = alt.crossed.filter((c) => !bestCrossed.has(c.name) && c.weight >= 20);
  if (extra.length) reasons.push(`it also passes through the ${extra.map((c) => c.name.toLowerCase()).join(' and ')}`);
  const tight = alt.closest[0];
  if (tight && tight.clearanceMm < (best.closest[0]?.clearanceMm ?? Infinity) - 1) {
    reasons.push(`it runs ${tight.clearanceMm.toFixed(1)} mm from the ${tight.name.toLowerCase()}`);
  }
  if (!reasons.length) return 'it scores slightly worse once depth and nearby eloquent cortex are weighed together';
  return reasons.length > 1 ? `${reasons.slice(0, -1).join(', ')} and ${reasons[reasons.length - 1]}` : reasons[0];
}

// Once the operative stages are modelled, the shift advice is based on them rather than on resection alone
function withPhaseShift(checklist: string[], phases: SimulationResult['phases']): string[] {
  if (!phases?.length) return checklist;
  const [dura, , out] = phases;
  const line = `Dural opening moves the deep margin about ${dura.deepMarginShiftMm.toFixed(1)} mm and it reaches ${out.deepMarginShiftMm.toFixed(1)} mm after resection. Register navigation before opening the dura and re-check with intraoperative ultrasound after debulking.`;
  return checklist.map((c) => (/^(Brain shift reaches|Predicted shift is under)/.test(c) ? line : c));
}

export function buildReportFacts(atlas: Atlas, tumor: TumorParams, result: SimulationResult, routeIndex = 0): ReportFacts {
  const { metrics, perStructure } = result;
  const index = result.plan.routes[routeIndex] ? routeIndex : 0;
  const plan = planForRoute(result.plan, index);
  const phases = result.routeModels?.[index]?.phases ?? result.phases;
  const recommended = result.plan.routes[0]?.trajectory;
  const mostStressed = atlas.structures
    .map((s, i) => ({ name: s.name, ...perStructure[i] }))
    .sort((a, b) => b.peakKpa - a.peakKpa)
    .slice(0, 5);

  return {
    lesion: {
      ...plan.lesion,
      dominantHemisphere: plan.dominant,
    },
    approach: plan.best ? approachFacts(plan.best) : null,
    route: { label: result.plan.routes[index]?.label ?? 'Recommended', isRecommended: index === 0 },
    noCorridorReason: plan.noCorridorReason,
    alternatives: result.plan.routes
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => i !== index)
      .map(({ r, i }) => ({
        ...approachFacts(r.trajectory),
        label: r.label,
        isRecommended: i === 0,
        note: i === 0 && plan.best
          ? `lowest combined risk score (${r.trajectory.cost.toFixed(0)} against ${plan.best.cost.toFixed(0)} for this route)`
          : whyNot(r.trajectory, recommended ?? r.trajectory),
      })),
    shift: {
      maxShiftMm: metrics.max_displacement_mm,
      avgStressKpa: metrics.avg_stress_kpa,
      affectedCm3: metrics.affected_volume_cm3,
      mostStressed,
      phases: phases ?? [],
    },
    risks: plan.risks.map((r) => ({
      name: r.name, fn: r.fn, level: r.level, distanceMm: r.distanceMm,
      corridorClearanceMm: r.corridorClearanceMm, crossed: r.crossed, peakKpa: r.peakKpa,
    })),
    checklist: withPhaseShift(plan.checklist, phases),
    params: { radiusMm: tumor.radiusMm, stiffness: tumor.stiffness, openingCm: tumor.openingCm, corridorMm: tumor.corridorMm },
  };
}

export const fmtRas = (v: [number, number, number]) =>
  `${v[0] >= 0 ? 'R' : 'L'} ${Math.abs(v[0]).toFixed(0)}, ${v[1] >= 0 ? 'A' : 'P'} ${Math.abs(v[1]).toFixed(0)}, ${v[2] >= 0 ? 'S' : 'I'} ${Math.abs(v[2]).toFixed(0)} mm`;
