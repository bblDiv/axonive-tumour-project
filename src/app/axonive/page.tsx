"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSimulation } from '@/hooks/useSimulation';
import { FileUpload } from '@/components/FileUpload';
import { BrainViewer3D } from '@/components/BrainViewer3D';
import type { ColorMode, FocusRequest, ViewerLayers } from '@/components/BrainViewer3D';
import { LayersPanel, PhaseScrubber } from '@/components/ViewerControls';
import { deformAt } from '@/lib/deformation';
import { planForRoute } from '@/lib/planner';
import { SimulationControls } from '@/components/SimulationControls';
import { ComparisonView } from '@/components/ComparisonView';
import { ReportPopup } from '@/components/ReportPopup';
import { Logo, LogoMark } from '@/components/Logo';
import { LOBE_COLORS } from '@/lib/atlas';
import type { Lobe, Structure } from '@/lib/atlas';
import { getGeminiInsights } from '@/utils/api';
import { buildReportFacts } from '@/lib/reportFacts';
import type { GeminiResponse } from '@/types';

export default function AxonivePage() {
  const {
    atlas, tumor, setTumor, result, isLoading, error, isSimulated,
    loadSample, segment, simulate, resetSimulation,
  } = useSimulation();

  const [showComparison, setShowComparison] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [colorMode, setColorMode] = useState<ColorMode>('anatomy');
  const [layers, setLayers] = useState<ViewerLayers>({ dti: false, ct: false, approach: true, glass: false });
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [phase, setPhase] = useState(0);
  const [routeIndex, setRouteIndex] = useState(0);

  const [report, setReport] = useState<GeminiResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const routeCount = result?.plan.routes.length ?? 0;
  const activeRoute = routeIndex < routeCount ? routeIndex : 0;
  const routeModel = result?.routeModels?.[activeRoute] ?? null;
  const activePlan = useMemo(() => (result ? planForRoute(result.plan, activeRoute) : null), [result, activeRoute]);

  const facts = useMemo(
    () => (atlas && tumor && result ? buildReportFacts(atlas, tumor, result, activeRoute) : null),
    // The facts belong to the simulation that produced them, not to later slider moves
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, activeRoute],
  );

  // Only the latest request may update the report, so switching routes quickly never shows a stale one
  const requestId = useRef(0);
  const fetchReport = useCallback(async () => {
    if (!facts) return;
    const id = ++requestId.current;
    setReportLoading(true);
    setReportError(null);
    try {
      const r = await getGeminiInsights(facts);
      if (id === requestId.current) setReport(r);
    } catch (err: any) {
      if (id === requestId.current) setReportError(err.message || 'Something went wrong');
    } finally {
      if (id === requestId.current) setReportLoading(false);
    }
  }, [facts]);

  // The tissue at the current point of the operative timeline, for the selected route
  const frame = useMemo(
    () => (atlas && routeModel ? deformAt(atlas, routeModel.deformation, phase) : null),
    [atlas, routeModel, phase],
  );
  const shiftScaleMm = Math.max(4, Math.ceil(routeModel?.phases[2]?.maxShiftMm ?? 6));

  // A new simulation starts on the recommended route at the end of the operation and opens the report
  useEffect(() => {
    if (!result) {
      setReport(null);
      setReportOpen(false);
      setShowComparison(false);
      setPhase(0);
      setRouteIndex(0);
      setColorMode((m) => (m === 'shift' ? 'anatomy' : m));
      return;
    }
    setRouteIndex(0);
    setPhase(3);
    setColorMode('shift');
    setReportOpen(true);
  }, [result]);

  // Each route gets its own narrative
  useEffect(() => {
    if (facts) fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts]);

  const groups = useMemo(() => {
    if (!atlas) return [] as [Lobe, Structure[]][];
    const byLobe = new Map<Lobe, Structure[]>();
    for (const s of atlas.structures) {
      if (!byLobe.has(s.lobe)) byLobe.set(s.lobe, []);
      byLobe.get(s.lobe)!.push(s);
    }
    return [...byLobe.entries()];
  }, [atlas]);

  const toggleStructure = (id: number) =>
    setHiddenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () =>
    setHiddenIds((prev) => (prev.length > 0 || !atlas ? [] : atlas.structures.map((s) => s.id)));

  return (
    <div className="h-screen flex flex-col bg-paper overflow-hidden">
      <nav className="h-14 shrink-0 bg-white border-b border-navy-deep/[0.08] px-6 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm text-fg-3">Sandbox</span>
        </div>
        <div className="flex items-center gap-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-fg-2">
              <div className="w-3.5 h-3.5 border-2 border-scan-700 border-t-transparent rounded-full animate-spin" />
              <span>Loading atlas</span>
            </div>
          )}
          {isSimulated && (
            <>
              <button onClick={() => setShowComparison((v) => !v)} className="btn-secondary text-sm !py-1.5">
                {showComparison ? 'Single view' : 'Before and after'}
              </button>
              <button onClick={() => setReportOpen(true)} className="btn-primary text-sm !py-1.5">
                Pre-op report
              </button>
            </>
          )}
        </div>
      </nav>

      {error && (
        <div className="fixed top-20 right-6 z-40 animate-slide-up bg-white border border-tumor/30 rounded-lg px-4 py-3 shadow-float max-w-md">
          <p className="text-sm text-fg">{error}</p>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Controls and structures */}
        <aside className="w-[320px] shrink-0 bg-white border-r border-navy-deep/[0.08] flex flex-col overflow-hidden">
          <div className="p-4 space-y-4 overflow-y-auto max-h-[60%] shrink-0">
            <SimulationControls
              mmPerUnit={atlas?.mmPerUnit ?? 1}
              tumor={tumor}
              onTumorChange={setTumor}
              onLoadSample={loadSample}
              onSimulate={simulate}
              onReset={resetSimulation}
              onOpenReport={() => setReportOpen(true)}
              isLoading={isLoading}
              hasData={!!atlas}
              metrics={result?.metrics ?? null}
              plan={activePlan}
              routeIndex={activeRoute}
              routeLabels={result?.plan.routes.map((r) => r.label) ?? []}
              onSelectRoute={setRouteIndex}
            />
            {!atlas && (
              <div className="border-t border-navy-deep/[0.08] pt-4">
                <h3 className="text-sm font-medium text-fg mb-3">Upload scan</h3>
                <FileUpload onUploadSuccess={segment} />
              </div>
            )}
          </div>

          {atlas && (
            <div className="border-t border-navy-deep/[0.08] flex-1 flex flex-col min-h-0">
              <div className="h-11 px-4 flex justify-between items-center shrink-0">
                <h3 className="text-sm font-medium text-fg">
                  Structures <span className="font-mono text-xs text-fg-3 tabular-nums">{atlas.structures.length}</span>
                </h3>
                <button onClick={toggleAll} className="text-xs text-scan-700 hover:text-navy-deep font-medium">
                  {hiddenIds.length > 0 ? 'Show all' : 'Hide all'}
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-2 pb-3">
                {groups.map(([lobe, items]) => (
                  <div key={lobe} className="mb-2">
                    <div className="h-7 px-2 flex items-center gap-2 text-xs text-fg-3">
                      <span className="w-2 h-2 rounded-full" style={{ background: LOBE_COLORS[lobe] }} />
                      {lobe}
                    </div>
                    {items.map((s) => {
                      const isHidden = hiddenIds.includes(s.id);
                      const isSelected = selectedId === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedId(isSelected ? null : s.id)}
                          className={`flex items-center h-8 px-2 gap-2 rounded-md cursor-pointer transition-colors group ${
                            isSelected ? 'bg-paper-raised' : 'hover:bg-paper'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={!isHidden}
                            onChange={() => toggleStructure(s.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Show ${s.name}`}
                            className="accent-[#0369a1] w-3.5 h-3.5 cursor-pointer shrink-0"
                          />
                          <span className={`text-xs truncate flex-1 ${isSelected ? 'text-fg font-medium' : 'text-fg-2 group-hover:text-fg'} ${isHidden ? 'opacity-50' : ''}`}>
                            {s.name}
                          </span>
                          <span className="font-mono text-[11px] text-fg-3 tabular-nums">{s.volumeCm3.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Viewer */}
        <main className="flex-1 relative min-w-0">
          {!atlas ? (
            <div className="h-full flex items-center justify-center p-12 bg-ink-950">
              <div className="text-center max-w-sm animate-fade-in">
                <LogoMark className="w-10 h-10 mx-auto mb-6 text-[#eef0f5]" />
                <h2 className="text-3xl font-serif text-[#eef0f5] mb-3 tracking-[-0.02em]">No scan loaded</h2>
                <p className="text-[#a3a9b8] mb-8">
                  Load the sample brain to see 59 labelled structures in 3D, then place a tumor and simulate its removal.
                </p>
                <button
                  onClick={loadSample}
                  disabled={isLoading}
                  className="h-10 px-4 rounded-lg bg-[#eef0f5] text-ink-950 text-sm font-medium hover:bg-white transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Loading' : 'Load sample brain'}
                </button>
              </div>
            </div>
          ) : showComparison && result && tumor ? (
            <ComparisonView
              routeIndex={activeRoute}
              onSelectRoute={setRouteIndex}
              atlas={atlas}
              tumor={tumor}
              result={result}
              selectedId={selectedId}
              hiddenIds={hiddenIds}
              onSelect={setSelectedId}
              frame={frame}
              phase={phase}
              shiftScaleMm={shiftScaleMm}
              colorMode={colorMode}
              layers={layers}
              focus={focus}
            />
          ) : (
            <BrainViewer3D
              atlas={atlas}
              tumor={tumor}
              plan={result?.plan}
              routeIndex={activeRoute}
              onSelectRoute={setRouteIndex}
              positions={frame?.positions}
              shift={frame?.shift}
              shiftScaleMm={shiftScaleMm}
              tumorRemoved={isSimulated && phase >= 2.5}
              toolTipMm={frame ? frame.toolTipMm : null}
              colorMode={colorMode}
              layers={layers}
              focus={focus}
              title={isSimulated ? 'Operative plan' : 'Segmented brain'}
              selectedId={selectedId}
              hiddenIds={hiddenIds}
              onSelect={setSelectedId}
            />
          )}
          {atlas && (
            <LayersPanel
              colorMode={colorMode}
              onColorMode={setColorMode}
              layers={layers}
              onLayers={setLayers}
              canShift={!!frame}
              hasPlan={!!result?.plan.best}
              routes={result?.plan.routes.map((r) => ({ label: r.label, depthMm: r.trajectory.depthMm })) ?? []}
              routeIndex={activeRoute}
              onSelectRoute={setRouteIndex}
              onFocus={(mode) => setFocus((f) => ({ mode, key: (f?.key ?? 0) + 1 }))}
            />
          )}
          {frame && result?.deformation && (
            <PhaseScrubber
              phase={phase}
              onPhase={setPhase}
              maxShiftMm={frame.maxShiftMm}
              deepMarginShiftMm={frame.deepMarginShiftMm}
              toolTipMm={frame.toolTipMm}
              corridorDepthMm={routeModel?.deformation.corridorDepthMm ?? 0}
            />
          )}
        </main>
      </div>

      <ReportPopup
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        report={report}
        facts={facts}
        isLoading={reportLoading}
        error={reportError}
        onRegenerate={fetchReport}
      />
    </div>
  );
}
