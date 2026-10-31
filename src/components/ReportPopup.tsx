"use client";
import React, { useEffect, useRef, useState } from 'react';
import { LogoMark } from './Logo';
import type { GeminiResponse } from '../types';
import { fmtRas } from '../lib/reportFacts';
import type { ReportFacts } from '../lib/reportFacts';

interface ReportPopupProps {
  open: boolean;
  onClose: () => void;
  report: GeminiResponse | null;
  facts: ReportFacts | null;
  isLoading: boolean;
  error: string | null;
  onRegenerate: () => void;
}

const f1 = (n: number) => n.toFixed(1);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const SECTIONS = [
  ['overview', 'Overview'],
  ['lesion', 'Lesion'],
  ['approach', 'Approach'],
  ['shift', 'Brain shift'],
  ['risks', 'Structures at risk'],
  ['checklist', 'Checklist'],
  ['model', 'Model and limits'],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`report-${id}`} className="scroll-mt-6 pt-10 first:pt-0">
      <h2 className="text-lg font-medium text-fg">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Facts({ items, cols = 3 }: { items: [string, React.ReactNode][]; cols?: 2 | 3 }) {
  return (
    <dl className={`grid grid-cols-1 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : ''} gap-px bg-navy-deep/[0.08] rounded-lg overflow-hidden border border-navy-deep/[0.08]`}>
      {items.map(([k, v]) => (
        <div key={k} className="bg-white px-4 py-3">
          <dt className="text-xs text-fg-3">{k}</dt>
          <dd className="mt-1 text-[15px] leading-6 text-fg">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

const LEVEL_STYLES = {
  High: 'bg-tumor/10 text-[#b4252b]',
  Moderate: 'bg-[#f5a524]/15 text-[#8a5a00]',
  Low: 'bg-paper-raised text-fg-2',
};

function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[13px] tabular-nums">{children}</span>;
}

function reportAsText(f: ReportFacts, r: GeminiResponse | null) {
  const a = f.approach;
  const lines = [
    'AXONIVE PRE-OP PLANNING REPORT (template brain, research prototype)',
    '',
    r?.surgeon.summary ?? '',
    '',
    `Lesion: ${f.lesion.location}, ${f.lesion.side}, ${f1(f.lesion.volumeCm3)} cm3, ${f1(f.lesion.diameterMm)} mm, ${f1(f.lesion.depthFromCortexMm)} mm deep. Center ${fmtRas(f.lesion.centerRas)}.`,
    a
      ? `Approach: ${a.approach}; heading ${a.heading}, ${a.angleFromVerticalDeg.toFixed(0)} deg from vertical; ${f1(a.depthMm)} mm to margin; entry ${fmtRas(a.entryRas)}; ${a.positioning}.`
      : `Approach: none acceptable. ${f.noCorridorReason}`,
    a ? `Passes through: ${a.crossed.map((c) => c.name).join(', ') || 'entry gyrus only'}.` : '',
    ...f.alternatives.map((x) => `${x.label}: ${x.approach}, ${f1(x.depthMm)} mm. ${x.isRecommended ? `Recommended: ${x.note}.` : `Not preferred because ${x.note}.`}`),
    `Brain shift: max ${f.shift.maxShiftMm.toFixed(2)} mm, avg stress ${f.shift.avgStressKpa.toFixed(2)} kPa, ${f1(f.shift.affectedCm3)} cm3 moved > 0.5 mm.`,
    ...f.shift.phases.map((p) => `  ${p.label}: max ${p.maxShiftMm.toFixed(1)} mm, deep margin ${p.deepMarginShiftMm.toFixed(1)} mm`),
    '',
    'Structures at risk:',
    ...f.risks.map((x) => `- ${x.name} (${x.fn}): ${x.level}; ${f1(x.distanceMm)} mm to tumor${x.corridorClearanceMm !== null ? `, ${f1(x.corridorClearanceMm)} mm to corridor` : ''}${x.crossed ? ', crossed' : ''}`),
    '',
    'Checklist:',
    ...f.checklist.map((c, i) => `${i + 1}. ${c}`),
    '',
    ...(r?.surgeon.points ?? []).map((p) => `Watch: ${p}`),
  ];
  return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
}

// Lying flat on the desk beside the laptop: chest piece in front, tubing looping back to the ear tips
function Stethoscope({ className }: { className?: string }) {
  const tube = 'M214 128 C176 140 150 132 136 112 C122 92 100 86 84 92';
  const earL = 'M84 92 C66 98 52 92 44 76';
  const earR = 'M84 92 C82 72 92 52 110 40';
  return (
    <svg className={className} viewBox="0 0 280 180" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="steth-steel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4f6f9" />
          <stop offset="1" stopColor="#a3abb8" />
        </linearGradient>
        <radialGradient id="steth-diaphragm" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#f1f3f7" />
          <stop offset="1" stopColor="#bcc3ce" />
        </radialGradient>
        <filter id="steth-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <g opacity="0.55" filter="url(#steth-shadow)" transform="translate(3 9)">
        <path d={tube} stroke="#000" strokeWidth="13" strokeLinecap="round" />
        <path d={earL} stroke="#000" strokeWidth="11" strokeLinecap="round" />
        <path d={earR} stroke="#000" strokeWidth="11" strokeLinecap="round" />
        <circle cx="236" cy="132" r="32" fill="#000" />
      </g>

      {[tube, earL, earR].map((d) => (
        <g key={d}>
          <path d={d} stroke="#4a5a76" strokeWidth="11" strokeLinecap="round" />
          <path d={d} stroke="#ffffff" strokeOpacity="0.22" strokeWidth="2.5" strokeLinecap="round" transform="translate(-1 -3)" />
        </g>
      ))}

      {/* Binaurals and ear tips */}
      <path d="M44 76 C38 62 38 48 44 34" stroke="url(#steth-steel)" strokeWidth="5" strokeLinecap="round" />
      <path d="M110 40 C122 32 136 30 148 34" stroke="url(#steth-steel)" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="45" cy="28" rx="8" ry="9" fill="#26303f" />
      <ellipse cx="155" cy="36" rx="9" ry="8" fill="#26303f" />
      <circle cx="84" cy="92" r="7" fill="url(#steth-steel)" stroke="#8a93a3" strokeWidth="1" />

      {/* Chest piece */}
      <rect x="204" y="118" width="20" height="12" rx="4" fill="url(#steth-steel)" transform="rotate(-18 214 124)" />
      <circle cx="236" cy="132" r="32" fill="url(#steth-steel)" />
      <circle cx="236" cy="132" r="25" fill="url(#steth-diaphragm)" stroke="#8a93a3" strokeWidth="1.5" />
      <circle cx="236" cy="132" r="16" fill="none" stroke="#a9b0bc" strokeWidth="1" />
    </svg>
  );
}

export const ReportPopup: React.FC<ReportPopupProps> = ({
  open, onClose, report, facts, isLoading, error, onRegenerate,
}) => {
  const [reader, setReader] = useState<'surgeon' | 'patient'>('surgeon');
  const [done, setDone] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => setDone(new Set()), [facts]);

  if (!open) return null;

  const jump = (id: string) => {
    const el = scroller.current?.querySelector(`#report-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const copy = async () => {
    if (!facts) return;
    try {
      await navigator.clipboard.writeText(reportAsText(facts, report));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const a = facts?.approach;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/60 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Pre-op report"
    >
      <div className="relative w-full max-w-[1040px] animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 h-8 px-3 rounded-lg text-sm text-[#eef0f5] hover:bg-white/10 transition-colors"
        >
          Close
        </button>

        {/* Lid */}
        <div className="rounded-[20px] bg-[#1b1f2a] p-3 pt-6 shadow-window border border-white/[0.06] relative">
          <span className="absolute top-2.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#2c3344]" />

          {/* Screen */}
          <div className="rounded-lg bg-white overflow-hidden flex flex-col h-[min(680px,76vh)]">
            <div className="h-12 shrink-0 px-5 flex items-center justify-between border-b border-navy-deep/[0.08]">
              <div className="flex items-center gap-2 min-w-0">
                <LogoMark className="w-4 h-4 text-navy-deep shrink-0" />
                <span className="text-sm font-medium text-fg">Pre-op report</span>
                {facts && <span className="text-sm text-fg-3 truncate">· {facts.lesion.location}</span>}
              </div>
              <div className="flex p-0.5 rounded-lg bg-paper-raised shrink-0" role="tablist">
                {(['surgeon', 'patient'] as const).map((r) => (
                  <button
                    key={r}
                    role="tab"
                    aria-selected={reader === r}
                    onClick={() => setReader(r)}
                    className={`h-7 px-3 rounded-md text-xs font-medium transition-colors ${
                      reader === r ? 'bg-white text-fg shadow-[0_1px_2px_rgba(10,37,64,0.08)]' : 'text-fg-2 hover:text-fg'
                    }`}
                  >
                    {r === 'surgeon' ? 'For the surgeon' : 'For the patient'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 flex min-h-0">
              {reader === 'surgeon' && facts && (
                <nav className="hidden md:block w-44 shrink-0 border-r border-navy-deep/[0.08] bg-paper p-3">
                  {SECTIONS.map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => jump(id)}
                      className="w-full h-8 px-3 rounded-md text-left text-sm text-fg-2 hover:bg-paper-raised hover:text-fg transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              )}

              <div ref={scroller} className="flex-1 overflow-y-auto px-6 py-8 sm:px-10">
                {!facts ? null : reader === 'surgeon' ? (
                  <div key="surgeon" className="max-w-3xl animate-fade-in">
                    <Section id="overview" title="Overview">
                      {isLoading ? (
                        <div className="space-y-3" aria-busy="true">
                          {[100, 96, 88, 60].map((w) => (
                            <div key={w} className="h-4 rounded bg-paper-raised" style={{ width: `${w}%` }} />
                          ))}
                        </div>
                      ) : error ? (
                        <p className="text-[15px] text-fg">
                          The narrative didn&apos;t come through ({error}). Everything below is computed and still valid.{' '}
                          <button onClick={onRegenerate} className="font-medium text-scan-700 hover:text-navy-deep">Try again</button>
                        </p>
                      ) : report ? (
                        <>
                          <p className="text-[17px] leading-[30px] text-fg">{report.surgeon.summary}</p>
                          <h3 className="mt-6 text-sm font-medium text-fg-2">What I would keep an eye on</h3>
                          <ol className="mt-3 space-y-3">
                            {report.surgeon.points.map((p, i) => (
                              <li key={p} className="flex gap-3">
                                <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-scan-700/10 text-scan-700 font-mono text-xs flex items-center justify-center tabular-nums">
                                  {i + 1}
                                </span>
                                <span className="text-[15px] leading-6 text-fg">{p}</span>
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : null}
                    </Section>

                    <Section id="lesion" title="Lesion">
                      <Facts
                        items={[
                          ['Location', `${facts.lesion.location} (${facts.lesion.lobe.toLowerCase()} lobe)`],
                          ['Hemisphere', `${cap(facts.lesion.side)}${facts.lesion.side !== 'midline' ? `, ${facts.lesion.inDominantHemisphere ? 'language-dominant' : 'non-dominant'}` : ''}`],
                          ['Volume', <Num key="v">{f1(facts.lesion.volumeCm3)} cm³</Num>],
                          ['Diameter', <Num key="d">{f1(facts.lesion.diameterMm)} mm</Num>],
                          ['Depth below cortex', <Num key="dp">{f1(facts.lesion.depthFromCortexMm)} mm</Num>],
                          ['Center', <Num key="c">{fmtRas(facts.lesion.centerRas)}</Num>],
                        ]}
                      />
                      {facts.lesion.nearestEloquent && (
                        <p className="mt-4 text-[15px] leading-6 text-fg-2">
                          Nearest eloquent region: <span className="text-fg">{facts.lesion.nearestEloquent.name}</span>{' '}
                          ({facts.lesion.nearestEloquent.fn.charAt(0).toLowerCase() + facts.lesion.nearestEloquent.fn.slice(1)}),{' '}
                          <Num>{f1(facts.lesion.nearestEloquent.distanceMm)} mm</Num> from the tumor margin
                          {facts.lesion.nearestEloquent.distanceMm < 1 ? ', so the tumor is touching or infiltrating it' : ''}.
                        </p>
                      )}
                    </Section>

                    <Section id="approach" title={facts.route.isRecommended ? 'Recommended approach' : `Selected approach: ${facts.route.label}`}>
                      {a ? (
                        <>
                          {!facts.route.isRecommended && (
                            <p className="mb-3 rounded-lg bg-[#f5a524]/[0.12] px-3 py-2 text-sm text-[#8a5a00]">
                              You are viewing {facts.route.label}, not the recommended route. Everything in this report is for this route.
                            </p>
                          )}
                          <p className="text-[17px] leading-7 text-fg">{a.approach}</p>
                          <div className="mt-4">
                            <Facts
                              items={[
                                ['Heading', `${cap(a.heading)}, ${a.angleFromVerticalDeg.toFixed(0)}° from vertical`],
                                ['Cortex to tumor margin', <Num key="d">{f1(a.depthMm)} mm</Num>],
                                ['Cortex to tumor center', <Num key="l">{f1(a.lengthMm)} mm</Num>],
                                ['Entry point', <Num key="e">{fmtRas(a.entryRas)}</Num>],
                                ['Corridor width', <Num key="w">{facts.params.corridorMm} mm</Num>],
                                ['Craniotomy', <Num key="c">{f1(facts.params.openingCm)} cm, centered on entry</Num>],
                              ]}
                            />
                          </div>
                          <p className="mt-4 text-[15px] leading-6 text-fg-2">
                            <span className="text-fg">Positioning:</span> {a.positioning}.
                          </p>

                          <h3 className="mt-6 text-sm font-medium text-fg-2">Corridor passes through</h3>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(a.crossed.length ? a.crossed : [{ name: a.entryStructure, fn: 'entry gyrus' }]).map((c) => (
                              <span key={c.name} className="inline-flex h-7 items-center rounded-md bg-[#f5a524]/[0.12] px-2.5 text-xs text-[#8a5a00]" title={c.fn}>
                                {c.name}
                              </span>
                            ))}
                          </div>

                          <h3 className="mt-6 text-sm font-medium text-fg-2">Closest eloquent regions to the corridor</h3>
                          <table className="mt-2 w-full text-left text-sm">
                            <tbody>
                              {a.closest.map((c) => (
                                <tr key={c.name} className="border-t border-navy-deep/[0.06]">
                                  <td className="py-2 pr-3 text-fg">{c.name}</td>
                                  <td className="py-2 pr-3 text-fg-2">{c.fn}</td>
                                  <td className="py-2 text-right"><Num>{f1(c.clearanceMm)} mm</Num></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          {facts.alternatives.length > 0 && (
                            <>
                              <h3 className="mt-6 text-sm font-medium text-fg-2">Other routes</h3>
                              <ul className="mt-2 space-y-2">
                                {facts.alternatives.map((alt) => (
                                  <li key={alt.label} className="rounded-lg border border-navy-deep/[0.08] px-4 py-3">
                                    <div className="flex items-baseline justify-between gap-4">
                                      <span className="text-[15px] text-fg">{alt.label}: {alt.approach}</span>
                                      <Num>{f1(alt.depthMm)} mm</Num>
                                    </div>
                                    <p className="mt-1 text-sm text-fg-2">
                                      {cap(alt.heading)}. {alt.isRecommended ? `Recommended: ${alt.note}.` : `Not preferred because ${alt.note}.`}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </>
                      ) : (
                        <p className="rounded-lg border border-tumor/30 bg-tumor/[0.04] px-4 py-3 text-[15px] leading-6 text-fg">
                          {facts.noCorridorReason}
                        </p>
                      )}
                    </Section>

                    <Section id="shift" title="Brain shift after resection">
                      <Facts
                        items={[
                          ['Relaxation into cavity', <Num key="m">{facts.shift.maxShiftMm.toFixed(2)} mm</Num>],
                          ['Average stress', <Num key="s">{facts.shift.avgStressKpa.toFixed(2)} kPa</Num>],
                          ['Tissue moving over 0.5 mm', <Num key="t">{f1(facts.shift.affectedCm3)} cm³</Num>],
                        ]}
                      />
                      {facts.shift.phases.length > 0 && (
                        <table className="mt-4 w-full text-left text-sm">
                          <thead>
                            <tr className="text-xs text-fg-3">
                              <th className="pb-2 font-normal">Stage of the operation</th>
                              <th className="pb-2 font-normal text-right">Max tissue shift</th>
                              <th className="pb-2 font-normal text-right">Deep margin shift</th>
                            </tr>
                          </thead>
                          <tbody>
                            {facts.shift.phases.map((p) => (
                              <tr key={p.label} className="border-t border-navy-deep/[0.06]">
                                <td className="py-2 text-fg">{p.label}</td>
                                <td className="py-2 text-right"><Num>{p.maxShiftMm.toFixed(1)} mm</Num></td>
                                <td className="py-2 text-right"><Num>{p.deepMarginShiftMm.toFixed(1)} mm</Num></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <p className="mt-3 text-sm leading-6 text-fg-2">
                        Max shift after the retractor goes in is mostly the corridor wall being pushed aside, about half the
                        corridor width. The deep margin shift is what your navigation will be off by at the far side of the tumor.
                      </p>
                      <table className="mt-4 w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs text-fg-3">
                            <th className="pb-2 font-normal">Most stressed regions</th>
                            <th className="pb-2 font-normal text-right">Peak stress</th>
                            <th className="pb-2 font-normal text-right">Peak shift</th>
                          </tr>
                        </thead>
                        <tbody>
                          {facts.shift.mostStressed.map((s) => (
                            <tr key={s.name} className="border-t border-navy-deep/[0.06]">
                              <td className="py-2 text-fg">{s.name}</td>
                              <td className="py-2 text-right"><Num>{s.peakKpa.toFixed(2)} kPa</Num></td>
                              <td className="py-2 text-right"><Num>{s.peakShiftMm.toFixed(2)} mm</Num></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Section>

                    <Section id="risks" title="Structures at risk">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <thead>
                            <tr className="text-xs text-fg-3">
                              <th className="pb-2 font-normal">Structure</th>
                              <th className="pb-2 font-normal">Function</th>
                              <th className="pb-2 font-normal text-right">To tumor</th>
                              <th className="pb-2 font-normal text-right">To corridor</th>
                              <th className="pb-2 font-normal text-right">Risk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {facts.risks.map((r) => (
                              <tr key={r.name} className="border-t border-navy-deep/[0.06] align-top">
                                <td className="py-2.5 pr-3 text-fg">{r.name}</td>
                                <td className="py-2.5 pr-3 text-fg-2">{r.fn}</td>
                                <td className="py-2.5 text-right"><Num>{f1(r.distanceMm)} mm</Num></td>
                                <td className="py-2.5 text-right">
                                  {r.crossed ? <span className="text-xs text-[#8a5a00]">crossed</span> : r.corridorClearanceMm !== null ? <Num>{f1(r.corridorClearanceMm)} mm</Num> : '—'}
                                </td>
                                <td className="py-2.5 pl-3 text-right">
                                  <span className={`inline-flex h-6 items-center rounded-md px-2 text-xs font-medium ${LEVEL_STYLES[r.level]}`}>{r.level}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Section>

                    <Section id="checklist" title="Intraoperative checklist">
                      <ul className="space-y-2">
                        {facts.checklist.map((c, i) => (
                          <li key={c}>
                            <label className="flex gap-3 rounded-lg px-3 py-2.5 hover:bg-paper cursor-pointer">
                              <input
                                type="checkbox"
                                checked={done.has(i)}
                                onChange={() => setDone((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i); else next.add(i);
                                  return next;
                                })}
                                className="mt-1 accent-[#0369a1] w-4 h-4 shrink-0"
                              />
                              <span className={`text-[15px] leading-6 ${done.has(i) ? 'text-fg-3 line-through' : 'text-fg'}`}>{c}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </Section>

                    <Section id="model" title="Model and limits">
                      <Facts
                        cols={2}
                        items={[
                          ['Tumor radius', <Num key="r">{f1(facts.params.radiusMm)} mm</Num>],
                          ['Tissue stiffness (relative)', <Num key="s">{f1(facts.params.stiffness)}</Num>],
                          ['Craniotomy', <Num key="o">{f1(facts.params.openingCm)} cm</Num>],
                          ['Corridor width', <Num key="c">{facts.params.corridorMm} mm</Num>],
                        ]}
                      />
                      <p className="mt-4 text-sm leading-6 text-fg-2">
                        Anatomy comes from a labelled template brain with 59 cortical and deep regions, not this patient&apos;s scan.
                        The fMRI, DTI and CT layers are derived from that template: function from each region&apos;s known role,
                        tracts from published anatomical waypoints, bone from the brain&apos;s outer envelope. Tissue shift is modelled
                        in stages (gravity sag on dural opening, retractor displacement, relaxation into the cavity) with simplified
                        exponential fields rather than full finite element analysis, and vessels and the ventricles are not modelled. Corridors are scored on depth, the regions
                        they pass through and their distance to eloquent cortex; interhemispheric and skull base routes are not
                        considered. Use this to prepare for the planning discussion and confirm everything on the patient&apos;s own
                        imaging with neuronavigation.
                      </p>
                    </Section>
                  </div>
                ) : (
                  <div key="patient" className="max-w-xl animate-fade-in">
                    {isLoading ? (
                      <p className="text-sm text-fg-3">Writing your summary</p>
                    ) : report ? (
                      <>
                        <p className="text-[17px] leading-[30px] text-fg">{report.patient.summary}</p>
                        <h3 className="mt-8 text-sm font-medium text-fg-2">Good to know</h3>
                        <ol className="mt-3 space-y-3">
                          {report.patient.points.map((p, i) => (
                            <li key={p} className="flex gap-3">
                              <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-scan-700/10 text-scan-700 font-mono text-xs flex items-center justify-center tabular-nums">
                                {i + 1}
                              </span>
                              <span className="text-[15px] leading-6 text-fg">{p}</span>
                            </li>
                          ))}
                        </ol>
                        <h3 className="mt-8 text-sm font-medium text-fg-2">Questions you could ask your surgeon</h3>
                        <ul className="mt-3 space-y-2">
                          {report.patient.questions.map((q) => (
                            <li key={q} className="rounded-lg bg-paper px-4 py-3 text-[15px] leading-6 text-fg">{q}</li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="h-11 shrink-0 px-5 flex items-center justify-between gap-4 border-t border-navy-deep/[0.08] bg-paper text-xs text-fg-3">
              <span className="truncate">
                Numbers computed from the simulation.{' '}
                {report?.source === 'gemini' ? 'Narrative by Gemini 2.5 Flash.' : 'Add a Gemini key for a live narrative.'}
              </span>
              <div className="flex items-center gap-4 shrink-0">
                <button onClick={copy} className="font-medium text-scan-700 hover:text-navy-deep transition-colors">
                  {copied ? 'Copied' : 'Copy report'}
                </button>
                <button
                  onClick={onRegenerate}
                  disabled={isLoading}
                  className="font-medium text-scan-700 hover:text-navy-deep disabled:opacity-50 transition-colors"
                >
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Base */}
        <div className="relative mx-[-4%] h-4 rounded-b-[18px] rounded-t-sm bg-[linear-gradient(#e2e6ec,#b6bdc9)] shadow-[0_14px_28px_-10px_rgba(7,8,13,0.6)]">
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-1.5 rounded-b-lg bg-[#a6adba]" />
        </div>

        <Stethoscope className="hidden min-[1360px]:block absolute -right-[196px] -bottom-[40px] w-[210px] pointer-events-none" />
      </div>
    </div>
  );
};
