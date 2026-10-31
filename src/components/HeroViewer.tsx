"use client";
import { useEffect, useRef, useState } from 'react';

// Resection cavity on the axial slice, in viewBox units
const CX = 128;
const CY = 82;
const TUMOR_R = 15;
const MAX_SHIFT_MM = 3.52;

const BRAIN = 'M100 26 C150 26 168 62 166 100 C164 138 144 174 100 174 C56 174 36 138 34 100 C32 62 50 26 100 26 Z';

function warp(x: number, y: number, t: number) {
  const dx = x - CX;
  const dy = y - CY;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { x, y };
  const d = 11 * t * Math.exp(-Math.max(0, dist - TUMOR_R) / 26);
  return { x: x - (dx / dist) * d, y: y - (dy / dist) * d };
}

function gridPaths(t: number) {
  const lines: string[] = [];
  const steps = 24;
  for (let i = 0; i <= 16; i++) {
    const c = 20 + i * 10;
    let h = '';
    let v = '';
    for (let j = 0; j <= steps; j++) {
      const s = 20 + (j * 160) / steps;
      const a = warp(s, c, t);
      const b = warp(c, s, t);
      h += `${j === 0 ? 'M' : 'L'}${a.x.toFixed(2)} ${a.y.toFixed(2)} `;
      v += `${j === 0 ? 'M' : 'L'}${b.x.toFixed(2)} ${b.y.toFixed(2)} `;
    }
    lines.push(h, v);
  }
  return lines;
}

export function HeroViewer() {
  const [mode, setMode] = useState<'pre' | 'post'>('post');
  const [t, setT] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const target = mode === 'post' ? 1 : 0;
    const from = t;
    const start = performance.now();
    const duration = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setT(from + (target - from) * eased);
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const shift = (MAX_SHIFT_MM * t).toFixed(2);
  const stress = (1.18 * t).toFixed(2);

  return (
    <div className="rounded-2xl bg-ink-900 border border-white/[0.08] shadow-window overflow-hidden text-[#eef0f5]">
      {/* Window header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/[0.08] bg-ink-950">
        <div className="font-mono text-xs text-[#a3a9b8] truncate">
          Case 0142 · T1 axial · slice 88/176
        </div>
        <div className="flex p-0.5 rounded-lg bg-ink-850 border border-white/[0.06] shrink-0" role="tablist">
          {(['pre', 'post'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                mode === m
                  ? 'bg-ink-800 text-[#eef0f5] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-[#7a8296] hover:text-[#a3a9b8]'
              }`}
            >
              {m === 'pre' ? 'Pre-op' : 'Post-resection'}
            </button>
          ))}
        </div>
      </div>

      {/* Viewport */}
      <div className="relative aspect-[5/4] bg-ink-950">
        <svg viewBox="0 0 200 200" className="absolute inset-0 m-auto h-full" aria-label="Axial MRI slice with simulated tissue shift after tumor resection">
          <defs>
            <clipPath id="hero-brain">
              <path d={BRAIN} />
            </clipPath>
            <radialGradient id="hero-stress" cx={CX} cy={CY} r="58" gradientUnits="userSpaceOnUse">
              <stop offset="0.22" stopColor="#e5484d" stopOpacity="0.75" />
              <stop offset="0.5" stopColor="#f5a524" stopOpacity="0.4" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Skull */}
          <path d="M100 18 C156 18 176 58 174 100 C172 142 150 182 100 182 C50 182 28 142 26 100 C24 58 44 18 100 18 Z" fill="none" stroke="#c9ced8" strokeWidth="3" opacity="0.85" />

          {/* Grey matter, white matter, ventricles */}
          <path d={BRAIN} fill="#3a4152" />
          <path d="M100 40 C140 40 152 70 151 100 C150 130 134 160 100 160 C66 160 50 130 49 100 C48 70 60 40 100 40 Z" fill="#5d6577" />
          <path d="M93 78 C82 88 82 108 94 118 C96 104 96 92 93 78 Z M107 78 C118 88 118 108 106 118 C104 104 104 92 107 78 Z" fill="#38bdf8" opacity="0.85" />
          <path d="M100 30 L100 170" stroke="#2a3040" strokeWidth="1.2" />

          {/* Stress field and deformation grid, clipped to tissue */}
          <g clipPath="url(#hero-brain)">
            <circle cx={CX} cy={CY} r="58" fill="url(#hero-stress)" opacity={t} />
            {gridPaths(t).map((d, i) => (
              <path key={i} d={d} fill="none" stroke="#eef0f5" strokeOpacity={0.1 + t * 0.1} strokeWidth="0.5" />
            ))}
          </g>

          {/* Tumor before, cavity after */}
          <circle cx={CX} cy={CY} r={TUMOR_R} fill="#e5484d" opacity={1 - t} />
          <circle cx={CX} cy={CY} r={TUMOR_R} fill="#07080d" opacity={t} />
          <circle cx={CX} cy={CY} r={TUMOR_R} fill="none" stroke="#e5484d" strokeWidth="0.8" strokeDasharray="2 2" opacity={t} />

          {/* Caliper on the cavity wall */}
          <g opacity={t} stroke="#eef0f5" strokeWidth="0.6">
            <line x1={CX + TUMOR_R} y1={CY} x2={CX + TUMOR_R + 26} y2={CY} />
            <line x1={CX + TUMOR_R} y1={CY - 3} x2={CX + TUMOR_R} y2={CY + 3} />
            <line x1={CX + TUMOR_R + 26} y1={CY - 3} x2={CX + TUMOR_R + 26} y2={CY + 3} />
          </g>
          <text x={CX + TUMOR_R + 13} y={CY - 5} textAnchor="middle" fontSize="6" fill="#eef0f5" opacity={t} className="font-mono">
            {shift} mm
          </text>
        </svg>

        {/* Scanner-style corner annotations */}
        <div className="absolute top-3 left-4 font-mono text-[11px] leading-4 text-[#7a8296]">
          <div>Z 140.8 mm</div>
          <div>R ← → L</div>
        </div>
        <div className="absolute bottom-3 left-4 font-mono text-[11px] leading-4 text-[#7a8296]">
          <div>Tumor 8.5 cm³</div>
          <div>Right frontal, anterior</div>
        </div>
        <div className="absolute top-3 right-4 flex items-center gap-2 font-mono text-[11px] text-[#7a8296]">
          <span>0</span>
          <span className="w-16 h-1.5 rounded-sm bg-[linear-gradient(90deg,#38bdf8,#f5a524,#e5484d)]" />
          <span>1.35 kPa</span>
        </div>
      </div>

      {/* Readout */}
      <div className="grid grid-cols-3 border-t border-white/[0.08] bg-ink-900">
        {[
          ['Max shift', `${shift} mm`],
          ['Avg stress', `${stress} kPa`],
          ['Motor cortex', t > 0.5 ? 'Clear' : '—'],
        ].map(([label, value], i) => (
          <div key={label} className={`px-4 py-3 ${i > 0 ? 'border-l border-white/[0.08]' : ''}`}>
            <div className="text-xs text-[#7a8296]">{label}</div>
            <div className="mt-1 font-mono text-sm tabular-nums text-[#eef0f5]">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
