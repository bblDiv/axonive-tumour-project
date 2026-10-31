"use client";
import React, { useEffect, useRef } from 'react';
import { PHASES } from '../lib/deformation';
import type { ColorMode, ViewerLayers } from './BrainViewer3D';

function Toggle({ label, checked, onChange, disabled }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 h-7 text-xs ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
      <span className="text-[#a3a9b8]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-7 h-4 rounded-full transition-colors ${checked ? 'bg-[#22d3ee]' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

export function LayersPanel({
  colorMode, onColorMode, layers, onLayers, canShift, hasPlan, onFocus, routes, routeIndex, onSelectRoute,
}: {
  colorMode: ColorMode;
  onColorMode: (m: ColorMode) => void;
  layers: ViewerLayers;
  onLayers: (l: ViewerLayers) => void;
  canShift: boolean;
  hasPlan: boolean;
  onFocus: (mode: 'side' | 'surgeon' | 'reset') => void;
  routes: { label: string; depthMm: number }[];
  routeIndex: number;
  onSelectRoute: (i: number) => void;
}) {
  const modes: [ColorMode, string, boolean][] = [
    ['anatomy', 'MRI', true],
    ['fmri', 'fMRI', true],
    ['shift', 'Shift', canShift],
  ];
  return (
    <div className="absolute top-4 right-4 z-20 w-[212px] rounded-xl bg-ink-900/95 border border-white/[0.08] p-3 text-[#eef0f5]">
      <div className="text-xs font-medium mb-2">Imaging</div>
      <div className="flex p-0.5 rounded-lg bg-ink-950 border border-white/[0.06]" role="radiogroup" aria-label="Surface color">
        {modes.map(([m, label, enabled]) => (
          <button
            key={m}
            role="radio"
            aria-checked={colorMode === m}
            disabled={!enabled}
            onClick={() => onColorMode(m)}
            className={`flex-1 h-7 rounded-md text-xs font-medium transition-colors disabled:opacity-30 ${
              colorMode === m ? 'bg-ink-800 text-[#eef0f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]' : 'text-[#7a8296] hover:text-[#a3a9b8]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2">
        <Toggle label="DTI tracts" checked={layers.dti} onChange={(v) => onLayers({ ...layers, dti: v, glass: v ? true : layers.glass })} />
        <Toggle label="CT skull" checked={layers.ct} onChange={(v) => onLayers({ ...layers, ct: v })} />
        <Toggle label="See-through cortex" checked={layers.glass} onChange={(v) => onLayers({ ...layers, glass: v })} />
        <Toggle label="Approach" checked={layers.approach} onChange={(v) => onLayers({ ...layers, approach: v })} disabled={!hasPlan} />
      </div>
      {routes.length > 1 && (
        <div className="mt-2 pt-2 border-t border-white/[0.08]">
          <div className="text-xs text-[#7a8296] mb-1.5">Route</div>
          <div className="space-y-1" role="radiogroup" aria-label="Surgical route">
            {routes.map((r, i) => (
              <button
                key={r.label}
                role="radio"
                aria-checked={routeIndex === i}
                onClick={() => onSelectRoute(i)}
                className={`w-full h-8 px-2.5 rounded-md border flex items-center justify-between text-xs transition-colors ${
                  routeIndex === i
                    ? 'bg-[#22d3ee]/10 border-[#22d3ee]/50 text-[#eef0f5]'
                    : 'bg-ink-850 border-white/[0.06] text-[#a3a9b8] hover:text-[#eef0f5]'
                }`}
              >
                <span>{r.label}</span>
                <span className="font-mono tabular-nums text-[#7a8296]">{r.depthMm.toFixed(0)} mm</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {hasPlan && (
        <div className="mt-2 pt-2 border-t border-white/[0.08]">
          <div className="text-xs text-[#7a8296] mb-1.5">View corridor</div>
          <div className="grid grid-cols-3 gap-1">
            {([['side', 'Side'], ['surgeon', 'Surgeon'], ['reset', 'Reset']] as const).map(([m, label]) => (
              <button
                key={m}
                onClick={() => onFocus(m)}
                className="h-7 rounded-md bg-ink-850 border border-white/[0.06] text-xs text-[#a3a9b8] hover:text-[#eef0f5] transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-4 text-[#7a8296]">
        fMRI, DTI and CT layers are derived from the template atlas, not this patient&apos;s scans.
      </p>
    </div>
  );
}

export function PhaseScrubber({
  phase, onPhase, maxShiftMm, deepMarginShiftMm, toolTipMm, corridorDepthMm,
}: {
  phase: number;
  onPhase: (p: number) => void;
  maxShiftMm: number;
  deepMarginShiftMm: number;
  toolTipMm: number;
  corridorDepthMm: number;
}) {
  const playing = useRef<number | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [isPlaying, setIsPlaying] = React.useState(false);

  const stop = () => {
    if (playing.current) cancelAnimationFrame(playing.current);
    playing.current = null;
    setIsPlaying(false);
  };

  const play = () => {
    if (playing.current) return stop();
    let p = phaseRef.current >= 2.99 ? 0 : phaseRef.current;
    let last = performance.now();
    setIsPlaying(true);
    const tick = (now: number) => {
      p = Math.min(3, p + ((now - last) / 1000) * 0.5);
      last = now;
      onPhase(p);
      if (p < 3) playing.current = requestAnimationFrame(tick);
      else stop();
    };
    playing.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => { if (playing.current) cancelAnimationFrame(playing.current); }, []);

  const stage = PHASES[Math.min(3, Math.round(phase))];
  const inserted = Math.max(0, Math.min(toolTipMm, corridorDepthMm));

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(560px,calc(100%-440px))] min-w-[340px] rounded-xl bg-ink-900/95 border border-white/[0.08] px-4 py-3 text-[#eef0f5]">
      <div className="flex items-center gap-3">
        <button
          onClick={play}
          aria-label={isPlaying ? 'Pause' : 'Play the operation'}
          className="w-8 h-8 shrink-0 rounded-lg bg-[#eef0f5] text-ink-950 flex items-center justify-center hover:bg-white transition-colors"
        >
          {isPlaying ? (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5Z" /></svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium">{stage}</span>
            <span className="font-mono tabular-nums text-[#a3a9b8]">
              max {maxShiftMm.toFixed(1)} mm · deep margin {deepMarginShiftMm.toFixed(1)} mm
              {phase > 1 ? ` · retractor ${inserted.toFixed(0)} mm` : ''}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={3}
            step={0.01}
            value={phase}
            onChange={(e) => { stop(); onPhase(parseFloat(e.target.value)); }}
            aria-label="Operative stage"
            className="mt-2 w-full accent-[#22d3ee] h-1 cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-[11px] text-[#7a8296]">
            {PHASES.map((label, i) => (
              <button
                key={label}
                onClick={() => { stop(); onPhase(i); }}
                className={`hover:text-[#eef0f5] transition-colors ${Math.round(phase) === i ? 'text-[#eef0f5]' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
