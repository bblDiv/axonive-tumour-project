import { useState, useCallback } from 'react';
import { loadAtlas, defaultTumor, simulateResection } from '../lib/atlas';
import { buildDeformation, phaseStats } from '../lib/deformation';
import type { Atlas, TumorParams, SimulationResult } from '../lib/atlas';

export const useSimulation = () => {
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [tumor, setTumor] = useState<TumorParams | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSample = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const a = await loadAtlas();
      setAtlas(a);
      setTumor(defaultTumor(a));
      setResult(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load the sample brain');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Uploaded scans are segmented onto the same atlas until the segmentation service is wired up
  const segment = useCallback(async (_caseId: string) => {
    await loadSample();
  }, [loadSample]);

  const simulate = useCallback(() => {
    if (!atlas || !tumor) {
      setError('Load the sample brain or upload a scan first.');
      return;
    }
    setError(null);
    const r = simulateResection(atlas, tumor);
    // Each route opens the skull in a different place, so each gets its own operative timeline
    const routes = r.plan.routes.length ? r.plan.routes.map((rt) => rt.trajectory) : [null];
    const routeModels = routes.map((trajectory) => {
      const deformation = buildDeformation(atlas, tumor, r, trajectory);
      return { deformation, phases: phaseStats(atlas, deformation) };
    });
    setResult({ ...r, ...routeModels[0], routeModels });
  }, [atlas, tumor]);

  const resetSimulation = useCallback(() => setResult(null), []);

  return {
    atlas,
    tumor,
    setTumor,
    result,
    isLoading,
    error,
    isSimulated: !!result,
    loadSample,
    segment,
    simulate,
    resetSimulation,
  };
};
