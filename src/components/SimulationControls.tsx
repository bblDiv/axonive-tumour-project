"use client";
import React from 'react';
import { sphereVolumeCm3 } from '../lib/atlas';
import type { SimulationResult, TumorParams } from '../lib/atlas';
import type { SurgicalPlan } from '../lib/planner';

interface SimulationControlsProps {
  mmPerUnit: number;
  tumor: TumorParams | null;
  onTumorChange: (t: TumorParams) => void;
  onLoadSample: () => void;
  onSimulate: () => void;
  onReset: () => void;
  onOpenReport: () => void;
  isLoading: boolean;
  hasData: boolean;
  metrics: SimulationResult['metrics'] | null;
  plan: SurgicalPlan | null;
  routeIndex: number;
  routeLabels: string[];
  onSelectRoute: (i: number) => void;
}

function Slider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex justify-between items-baseline text-xs text-fg-2 mb-1">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-fg">{value.toFixed(step < 1 ? 1 : 0)} {unit}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#0369a1] h-1 cursor-pointer"
      />
    </label>
  );
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  mmPerUnit,
  tumor,
  onTumorChange,
  onLoadSample,
  onSimulate,
  onReset,
  onOpenReport,
  isLoading,
  hasData,
  metrics,
  plan,
  routeIndex,
  routeLabels,
  onSelectRoute,
}) => {
  // Scene axes are x = patient left, y = superior, z = anterior; the UI works in mm
  const setAxis = (axis: 0 | 1 | 2, mm: number) => {
    if (!tumor) return;
    const center = [...tumor.center] as [number, number, number];
    center[axis] = mm / mmPerUnit;
    onTumorChange({ ...tumor, center });
  };
  const mm = (axis: 0 | 1 | 2) => (tumor ? tumor.center[axis] * mmPerUnit : 0);

  if (!hasData) {
    return (
      <button onClick={onLoadSample} disabled={isLoading} className="w-full btn-primary text-sm">
        {isLoading ? 'Loading' : 'Load sample brain'}
      </button>
    );
  }

  if (metrics) {
    return (
      <div className="space-y-4 text-left">
        <div>
          <h3 className="text-sm font-medium text-fg">Result</h3>
          <p className="mt-1 text-xs text-fg-2">Tumor in the {metrics.tumor_location.toLowerCase()}</p>
        </div>
        {routeLabels.length > 1 && (
          <div className="flex p-0.5 rounded-lg bg-paper-raised" role="radiogroup" aria-label="Surgical route">
            {routeLabels.map((label, i) => (
              <button
                key={label}
                role="radio"
                aria-checked={routeIndex === i}
                onClick={() => onSelectRoute(i)}
                className={`flex-1 h-7 rounded-md text-xs font-medium transition-colors ${
                  routeIndex === i ? 'bg-white text-fg shadow-[0_1px_2px_rgba(10,37,64,0.08)]' : 'text-fg-2 hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {plan?.best ? (
          <div className="rounded-xl border border-scan-700/20 bg-scan-700/[0.04] p-3 space-y-2">
            <div className="flex items-baseline justify-between">
              <h4 className="text-sm font-medium text-fg">{routeIndex === 0 ? 'Recommended approach' : `${routeLabels[routeIndex]} approach`}</h4>
              <span className="font-mono text-xs text-fg-3 tabular-nums">{plan.best.depthMm.toFixed(0)} mm deep</span>
            </div>
            <p className="text-xs leading-5 text-fg-2">
              {plan.best.approach}, heading {plan.best.heading}, {plan.best.angleFromVerticalDeg.toFixed(0)}° from vertical.
            </p>
            {plan.best.crossed.length > 0 && (
              <p className="text-xs leading-5 text-fg-2">
                Passes through {plan.best.crossed.map((c) => c.name.toLowerCase()).join(', ')}.
              </p>
            )}
            <p className="text-xs leading-5 text-fg-2">
              Risk score <span className="font-mono tabular-nums text-fg">{plan.best.cost.toFixed(0)}</span>
              {routeIndex > 0 && plan.routes[0] && (
                <> against <span className="font-mono tabular-nums text-fg">{plan.routes[0].trajectory.cost.toFixed(0)}</span> for the recommended route</>
              )}
              . Lower is safer.
            </p>
            {plan.best.closest[0] && (
              <p className="text-xs leading-5 text-fg-2">
                Closest eloquent region: {plan.best.closest[0].name.toLowerCase()},{' '}
                <span className="font-mono tabular-nums text-fg">{plan.best.closest[0].clearanceMm.toFixed(1)} mm</span>
              </p>
            )}
          </div>
        ) : plan ? (
          <div className="rounded-xl border border-tumor/30 bg-tumor/[0.04] p-3 text-xs leading-5 text-fg">
            {plan.noCorridorReason}
          </div>
        ) : null}
        <div className="space-y-1">
          <MetricRow label="Max displacement" value={`${metrics.max_displacement_mm.toFixed(2)} mm`} />
          <MetricRow label="Avg stress" value={`${metrics.avg_stress_kpa.toFixed(2)} kPa`} />
          <MetricRow label="Tissue that moved" value={`${metrics.affected_volume_cm3.toFixed(1)} cm³`} />
          <MetricRow label="Tumor volume" value={`${metrics.tumor_volume_cm3.toFixed(1)} cm³`} />
        </div>
        {metrics.vulnerable_regions.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-fg-2 mb-2">Regions under high stress</h4>
            <ul className="space-y-1.5">
              {metrics.vulnerable_regions.map((region) => (
                <li key={region} className="flex items-center gap-2 text-xs text-fg">
                  <span className="w-1.5 h-1.5 rounded-full bg-tumor shrink-0" />
                  {region}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-2">
          <button onClick={onOpenReport} className="w-full btn-primary text-sm">Open pre-op report</button>
          <button onClick={onReset} className="w-full btn-secondary text-sm">Adjust tumor and rerun</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      {tumor && (
        <div className="space-y-3 bg-paper p-4 rounded-xl border border-navy-deep/[0.06]">
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-medium text-fg">Tumor</h4>
            <span className="font-mono text-xs tabular-nums text-fg-3">{sphereVolumeCm3(tumor.radiusMm).toFixed(1)} cm³</span>
          </div>
          <Slider label="Left / right" value={mm(0)} min={-60} max={60} step={1} unit="mm" onChange={(v) => setAxis(0, v)} />
          <Slider label="Down / up" value={mm(1)} min={-50} max={60} step={1} unit="mm" onChange={(v) => setAxis(1, v)} />
          <Slider label="Back / front" value={mm(2)} min={-80} max={80} step={1} unit="mm" onChange={(v) => setAxis(2, v)} />
          <Slider label="Radius" value={tumor.radiusMm} min={5} max={25} step={0.5} unit="mm" onChange={(v) => onTumorChange({ ...tumor, radiusMm: v })} />
          <div className="pt-1 border-t border-navy-deep/[0.06]" />
          <Slider label="Tissue stiffness" value={tumor.stiffness} min={1} max={10} step={0.5} unit="" onChange={(v) => onTumorChange({ ...tumor, stiffness: v })} />
          <Slider label="Skull opening" value={tumor.openingCm} min={2} max={10} step={0.5} unit="cm" onChange={(v) => onTumorChange({ ...tumor, openingCm: v })} />
          <Slider label="Corridor width" value={tumor.corridorMm} min={6} max={24} step={1} unit="mm" onChange={(v) => onTumorChange({ ...tumor, corridorMm: v })} />
          <div>
            <div className="text-xs text-fg-2 mb-1.5">Language-dominant hemisphere</div>
            <div className="flex p-0.5 rounded-lg bg-white border border-navy-deep/[0.08]" role="radiogroup">
              {(['left', 'right'] as const).map((h) => (
                <button
                  key={h}
                  role="radio"
                  aria-checked={tumor.dominant === h}
                  onClick={() => onTumorChange({ ...tumor, dominant: h })}
                  className={`flex-1 h-7 rounded-md text-xs font-medium transition-colors ${
                    tumor.dominant === h ? 'bg-navy-deep text-white' : 'text-fg-2 hover:text-fg'
                  }`}
                >
                  {h === 'left' ? 'Left' : 'Right'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <button onClick={onSimulate} disabled={isLoading} className="w-full btn-primary text-sm">
        Plan approach and simulate
      </button>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between bg-paper rounded-lg px-3 h-9">
    <p className="text-xs text-fg-2">{label}</p>
    <p className="font-mono text-sm tabular-nums text-fg">{value}</p>
  </div>
);
