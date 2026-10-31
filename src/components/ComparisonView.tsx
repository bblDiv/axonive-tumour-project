"use client";
import React from 'react';
import { BrainViewer3D } from './BrainViewer3D';
import type { ColorMode, FocusRequest, ViewerLayers } from './BrainViewer3D';
import type { Atlas, SimulationResult, TumorParams } from '../lib/atlas';
import type { DeformationFrame } from '../lib/deformation';

interface ComparisonViewProps {
  atlas: Atlas;
  tumor: TumorParams;
  result: SimulationResult;
  frame: DeformationFrame | null;
  phase: number;
  shiftScaleMm: number;
  colorMode: ColorMode;
  layers: ViewerLayers;
  focus: FocusRequest | null;
  routeIndex: number;
  onSelectRoute: (i: number) => void;
  selectedId?: number | null;
  hiddenIds?: number[];
  onSelect?: (id: number | null) => void;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  atlas, tumor, result, frame, phase, shiftScaleMm, colorMode, layers, focus, ...rest
}) => {
  return (
    <div className="h-full flex">
      <div className="flex-1 border-r border-white/[0.08]">
        <BrainViewer3D
          atlas={atlas}
          tumor={tumor}
          plan={result.plan}
          colorMode={colorMode === 'shift' ? 'anatomy' : colorMode}
          layers={layers}
          focus={focus}
          title="Pre-op"
          {...rest}
        />
      </div>
      <div className="flex-1">
        <BrainViewer3D
          atlas={atlas}
          tumor={tumor}
          plan={result.plan}
          positions={frame?.positions}
          shift={frame?.shift}
          shiftScaleMm={shiftScaleMm}
          tumorRemoved={phase >= 2.5}
          toolTipMm={frame?.toolTipMm ?? null}
          colorMode={colorMode}
          layers={layers}
          focus={focus}
          title="During surgery"
          {...rest}
        />
      </div>
    </div>
  );
};
