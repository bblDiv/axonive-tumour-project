"use client";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { LOBE_COLORS } from '../lib/atlas';
import type { Atlas, Structure, TumorParams } from '../lib/atlas';
import type { SurgicalPlan, Trajectory } from '../lib/planner';
import { eloquenceOf } from '../lib/eloquence';
import { buildTracts } from '../lib/tracts';
import { buildSkull } from '../lib/skull';
import { ApproachOverlay } from './ApproachOverlay';
import { TractsLayer, SkullLayer } from './ImagingLayers';

export type ColorMode = 'anatomy' | 'fmri' | 'shift';

export interface ViewerLayers {
  dti: boolean;
  ct: boolean;
  approach: boolean;
  glass: boolean;
}

export interface FocusRequest {
  mode: 'side' | 'surgeon' | 'reset';
  key: number;
}

interface BrainViewer3DProps {
  atlas: Atlas;
  tumor: TumorParams | null;
  plan?: SurgicalPlan | null;
  routeIndex?: number;
  onSelectRoute?: (i: number) => void;
  positions?: Float32Array[] | null; // deformed positions for the current operative stage
  shift?: Float32Array[] | null; // mm per vertex
  shiftScaleMm?: number;
  tumorRemoved?: boolean;
  toolTipMm?: number | null;
  colorMode?: ColorMode;
  layers?: ViewerLayers;
  focus?: FocusRequest | null;
  title?: string;
  selectedId?: number | null;
  hiddenIds?: number[];
  onSelect?: (id: number | null) => void;
}

const DEFAULT_LAYERS: ViewerLayers = { dti: false, ct: false, approach: true, glass: false };

// Shift ramp shared with the landing page legend: scanner blue, amber, tumor red
const RAMP = [new THREE.Color('#38bdf8'), new THREE.Color('#f5a524'), new THREE.Color('#e5484d')];
function rampColor(t: number, out: THREE.Color) {
  const x = Math.min(1, Math.max(0, t)) * 2;
  const i = Math.min(1, Math.floor(x));
  return out.copy(RAMP[i]).lerp(RAMP[i + 1], x - i);
}

// fMRI-style "hot" map for activation over greyscale anatomy
const HOT = [new THREE.Color('#7f1d1d'), new THREE.Color('#dc2626'), new THREE.Color('#f97316'), new THREE.Color('#fde047')];
function hotColor(t: number) {
  const x = Math.min(1, Math.max(0, t)) * 3;
  const i = Math.min(2, Math.floor(x));
  return HOT[i].clone().lerp(HOT[i + 1], x - i);
}

export function structureColor(s: Structure) {
  const c = new THREE.Color(LOBE_COLORS[s.lobe]);
  // Hemispheres differ slightly so the midline reads; neighbours vary a touch in lightness
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const l = hsl.l + (s.side === 'left' ? 0.05 : s.side === 'right' ? -0.03 : 0) + ((s.id % 3) - 1) * 0.025;
  return c.setHSL(hsl.h, hsl.s, Math.min(0.85, Math.max(0.3, l)));
}

function functionColor(s: Structure, dominant: 'left' | 'right') {
  const w = eloquenceOf(s.name, dominant).weight;
  if (w < 20) {
    const g = 0.42 + ((s.id % 3) - 1) * 0.03;
    return new THREE.Color(g, g, g * 1.04);
  }
  return hotColor((Math.min(w, 100) - 20) / 80);
}

function StructureMesh({
  structure, positions, shift, shiftScaleMm, base, dimmed, glass, selected, inCorridor, onSelect, onHover,
}: {
  structure: Structure;
  positions: Float32Array;
  shift?: Float32Array;
  shiftScaleMm: number;
  base: THREE.Color;
  dimmed: boolean;
  glass: boolean;
  selected: boolean;
  inCorridor: boolean;
  onSelect?: (id: number | null) => void;
  onHover: (s: Structure | null, p?: THREE.Vector3) => void;
}) {
  // One geometry per region; scrubbing the timeline only rewrites its buffers
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(structure.positions), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(structure.positions.length), 3));
    g.setIndex(new THREE.BufferAttribute(structure.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [structure]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const attr = geometry.attributes.position as THREE.BufferAttribute;
    (attr.array as Float32Array).set(positions);
    attr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }, [geometry, positions]);

  useLayoutEffect(() => {
    if (!shift) return;
    const attr = geometry.attributes.color as THREE.BufferAttribute;
    const colors = attr.array as Float32Array;
    const c = new THREE.Color();
    for (let v = 0; v < shift.length; v++) {
      const t = shift[v] / shiftScaleMm;
      rampColor(t, c);
      c.lerpColors(base, c, Math.min(1, t * 2.5));
      colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
    }
    attr.needsUpdate = true;
  }, [geometry, shift, shiftScaleMm, base]);

  // See-through cortex blends additively: the result does not depend on draw order, so overlapping
  // regions never shimmer, and tracts and the corridor inside stay visible
  const xray = glass && !selected && !dimmed;
  const transparent = dimmed || xray;
  const opacity = dimmed ? 0.1 : xray ? 0.22 : 1;

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => { e.stopPropagation(); onSelect?.(selected ? null : structure.id); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(structure, e.point); }}
      onPointerOut={() => onHover(null)}
    >
      {/* Keyed so three.js recompiles the shader when vertex colors switch on or off */}
      <meshStandardMaterial
        key={`${shift ? 'shift' : 'solid'}-${xray ? 'xray' : 'opaque'}`}
        color={shift ? '#ffffff' : selected ? '#f2f4f8' : base}
        vertexColors={!!shift}
        roughness={0.62}
        metalness={0.02}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
        blending={xray ? THREE.AdditiveBlending : THREE.NormalBlending}
        emissive={selected ? '#38bdf8' : inCorridor ? '#f5a524' : '#000000'}
        emissiveIntensity={selected ? 0.25 : inCorridor ? 0.12 : 0}
      />
    </mesh>
  );
}

// Moves the camera to look along or across the planned corridor
function CameraFocus({ focus, route, tumor }: { focus: FocusRequest | null; route: Trajectory | null; tumor: TumorParams | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null;
  const anim = useRef<{ fromPos: THREE.Vector3; toPos: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t: number } | null>(null);

  useEffect(() => {
    if (!focus || !controls) return;
    let toPos: THREE.Vector3, toT: THREE.Vector3;
    if (focus.mode === 'reset' || !route || !tumor) {
      toPos = new THREE.Vector3(-13, 6, 13);
      toT = new THREE.Vector3(0, 0, 0);
    } else {
      const d = new THREE.Vector3(...route.direction);
      const entry = new THREE.Vector3(...route.entry);
      const center = new THREE.Vector3(...tumor.center);
      if (focus.mode === 'surgeon') {
        toT = center;
        toPos = entry.clone().addScaledVector(d, 9);
      } else {
        toT = entry.clone().add(center).multiplyScalar(0.5);
        let side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0));
        if (side.lengthSq() < 0.01) side = new THREE.Vector3().crossVectors(d, new THREE.Vector3(1, 0, 0));
        side.normalize();
        // Look from the lesion's own side so the corridor is not seen through the other hemisphere
        if (side.dot(toT) < 0) side.negate();
        toPos = toT.clone().addScaledVector(side, 13).addScaledVector(d, 2.5).add(new THREE.Vector3(0, 1.5, 0));
      }
    }
    anim.current = { fromPos: camera.position.clone(), toPos, fromT: controls.target.clone(), toT, t: 0 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.key]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + dt / 0.7);
    const e = 1 - Math.pow(1 - a.t, 4);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    controls.target.lerpVectors(a.fromT, a.toT, e);
    controls.update();
    if (a.t >= 1) anim.current = null;
  });
  return null;
}

export const BrainViewer3D: React.FC<BrainViewer3DProps> = ({
  atlas,
  tumor,
  plan = null,
  routeIndex = 0,
  onSelectRoute,
  positions = null,
  shift = null,
  shiftScaleMm = 6,
  tumorRemoved = false,
  toolTipMm = null,
  colorMode = 'anatomy',
  layers = DEFAULT_LAYERS,
  focus = null,
  title,
  selectedId = null,
  hiddenIds = [],
  onSelect,
}) => {
  const hidden = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const [hover, setHover] = useState<{ s: Structure; p: THREE.Vector3 } | null>(null);
  const tumorRadius = tumor ? tumor.radiusMm / atlas.mmPerUnit : 0;
  const dominant = tumor?.dominant ?? 'left';
  const activeRoute = plan?.routes[routeIndex] ?? plan?.routes[0] ?? null;
  const showApproach = layers.approach && !!activeRoute && !!tumor;

  const corridorIds = useMemo(
    () => new Set(showApproach && activeRoute ? activeRoute.trajectory.crossed.map((c) => c.id) : []),
    [activeRoute, showApproach],
  );
  const bases = useMemo(
    () => atlas.structures.map((s) => (colorMode === 'fmri' ? functionColor(s, dominant) : structureColor(s))),
    [atlas, colorMode, dominant],
  );
  const tracts = useMemo(() => buildTracts(atlas), [atlas]);
  const skull = useMemo(() => buildSkull(atlas), [atlas]);
  const tractEmphasis = useMemo(() => {
    const names = new Set<string>();
    (activeRoute?.risks ?? plan?.risks)?.forEach((r) => { if (r.id >= 1000 && r.level !== 'Low') names.add(r.name); });
    return names;
  }, [plan, activeRoute]);

  return (
    <div className="h-full w-full relative bg-ink-950">
      {title && (
        <div className="absolute top-4 left-4 z-10 h-8 px-3 flex items-center rounded-lg bg-ink-900/90 border border-white/[0.08] text-sm font-medium text-[#eef0f5]">
          {title}
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-10 rounded-xl bg-ink-900/90 border border-white/[0.08] p-3 text-xs text-[#a3a9b8] min-w-[188px] space-y-3">
        {colorMode === 'shift' && shift ? (
          <div>
            <div className="text-[#eef0f5] font-medium mb-2">Tissue displacement</div>
            <div className="h-1.5 rounded-sm bg-[linear-gradient(90deg,#38bdf8,#f5a524,#e5484d)]" />
            <div className="mt-1.5 flex justify-between font-mono tabular-nums text-[11px] text-[#7a8296]">
              <span>0</span>
              <span>{shiftScaleMm.toFixed(0)} mm</span>
            </div>
          </div>
        ) : colorMode === 'fmri' ? (
          <div>
            <div className="text-[#eef0f5] font-medium mb-2">Function (fMRI view)</div>
            <div className="h-1.5 rounded-sm bg-[linear-gradient(90deg,#7f1d1d,#dc2626,#f97316,#fde047)]" />
            <div className="mt-1.5 flex justify-between text-[11px] text-[#7a8296]">
              <span>Association</span>
              <span>Motor, language</span>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-[#eef0f5] font-medium mb-2">Lobes</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {(['Frontal', 'Parietal', 'Temporal', 'Occipital', 'Insula', 'Limbic'] as const).map((l) => (
                <div key={l} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: LOBE_COLORS[l] }} />
                  {l}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-tumor" />
                Tumor
              </div>
            </div>
          </div>
        )}
        {layers.dti && (
          <div className="pt-3 border-t border-white/[0.08]">
            <div className="text-[#eef0f5] font-medium mb-1.5">DTI direction</div>
            <div className="flex gap-3 text-[11px]">
              <span><span className="text-[#ff6b6b]">●</span> L–R</span>
              <span><span className="text-[#5ee39a]">●</span> A–P</span>
              <span><span className="text-[#6ba8ff]">●</span> S–I</span>
            </div>
          </div>
        )}
        {showApproach && (
          <div className="pt-3 border-t border-white/[0.08] flex items-center gap-2">
            <span className="w-4 h-1 rounded-full bg-[#22d3ee]" />
            <span>Planned corridor</span>
          </div>
        )}
      </div>

      <Canvas
        camera={{ position: [-13, 6, 13], fov: 40 }}
        onPointerMissed={() => onSelect?.(null)}
        dpr={[1, 2]}
      >
        <hemisphereLight args={['#dfe7f5', '#1a1e28', 0.9]} />
        <directionalLight position={[-6, 8, 8]} intensity={1.6} />
        <directionalLight position={[7, -2, -6]} intensity={0.5} />

        {atlas.structures.map((s, i) =>
          hidden.has(s.id) ? null : (
            <StructureMesh
              key={s.id}
              structure={s}
              positions={positions ? positions[i] : s.positions}
              shift={colorMode === 'shift' && shift ? shift[i] : undefined}
              shiftScaleMm={shiftScaleMm}
              base={bases[i]}
              glass={layers.glass}
              selected={selectedId === s.id}
              inCorridor={corridorIds.has(s.id)}
              dimmed={selectedId !== null && selectedId !== s.id}
              onSelect={onSelect}
              onHover={(hs, p) => setHover(hs && p ? { s: hs, p } : null)}
            />
          )
        )}

        {layers.dti && <TractsLayer tracts={tracts} emphasize={tractEmphasis} overlay={layers.glass} />}
        {layers.ct && (
          <SkullLayer
            shell={skull}
            entry={showApproach && activeRoute ? activeRoute.trajectory.entry : null}
            craniotomyRadius={tumor ? (tumor.openingCm * 10) / 2 / atlas.mmPerUnit : 0}
          />
        )}

        {/* The tumor sits under the cortex, so it is also drawn through tissue as a faint silhouette */}
        {tumor && !tumorRemoved && (
          <group position={tumor.center}>
            <mesh>
              <sphereGeometry args={[tumorRadius, 48, 32]} />
              <meshStandardMaterial color="#e5484d" roughness={0.45} />
            </mesh>
            <mesh renderOrder={10}>
              <sphereGeometry args={[tumorRadius, 48, 32]} />
              <meshBasicMaterial color="#e5484d" transparent opacity={0.4} depthTest={false} depthWrite={false} />
            </mesh>
          </group>
        )}
        {tumor && tumorRemoved && (
          <mesh position={tumor.center} renderOrder={10}>
            <sphereGeometry args={[tumorRadius, 24, 16]} />
            <meshBasicMaterial color="#e5484d" wireframe transparent opacity={0.45} depthTest={false} depthWrite={false} />
          </mesh>
        )}

        {showApproach && plan && tumor && (
          <ApproachOverlay
            plan={plan}
            routeIndex={routeIndex}
            onSelectRoute={onSelectRoute}
            tumor={tumor}
            mmPerUnit={atlas.mmPerUnit}
            openingCm={tumor.openingCm}
            toolTipMm={toolTipMm}
          />
        )}

        {hover && (
          <Html position={hover.p} style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
            <div className="translate-x-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink-900/95 border border-white/[0.1] px-2 py-1 text-xs text-[#eef0f5]">
              {hover.s.name}
              <span className="ml-2 font-mono text-[#7a8296]">{hover.s.volumeCm3.toFixed(1)} cm³</span>
            </div>
          </Html>
        )}

        <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={4} maxDistance={30} />
        <CameraFocus focus={focus} route={activeRoute?.trajectory ?? null} tumor={tumor} />
      </Canvas>
    </div>
  );
};
