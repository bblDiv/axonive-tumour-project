"use client";
import React, { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { SurgicalPlan, Trajectory } from '../lib/planner';
import type { TumorParams } from '../lib/atlas';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const CORRIDOR = '#22d3ee';

function Label({ position, children, tone = 'primary', align = 'above' }: {
  position: THREE.Vector3; children: React.ReactNode; tone?: 'primary' | 'muted'; align?: 'above' | 'right';
}) {
  return (
    <Html position={position} style={{ pointerEvents: 'none' }} zIndexRange={[15, 0]}>
      <div
        className={`whitespace-nowrap rounded-md border px-2 py-1 text-xs ${
          align === 'above' ? '-translate-x-1/2 -translate-y-[calc(100%+10px)]' : 'translate-x-3 -translate-y-1/2'
        } ${
          tone === 'primary'
            ? 'bg-ink-900/95 border-[#22d3ee]/50 text-[#eef0f5]'
            : 'bg-ink-900/80 border-white/[0.08] text-[#a3a9b8]'
        }`}
      >
        {children}
      </div>
    </Html>
  );
}

// A segment between two points, as a mesh oriented along it
function Segment({ from, to, radius, children, renderOrder = 11 }: {
  from: THREE.Vector3; to: THREE.Vector3; radius: number; children: React.ReactNode; renderOrder?: number;
}) {
  const { mid, len, quat } = useMemo(() => {
    const dir = to.clone().sub(from);
    const len = Math.max(0.001, dir.length());
    return { mid: from.clone().add(to).multiplyScalar(0.5), len, quat: new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()) };
  }, [from, to]);
  return (
    <mesh position={mid} quaternion={quat} renderOrder={renderOrder}>
      <cylinderGeometry args={[radius, radius, len, 32, 1, true]} />
      {children}
    </mesh>
  );
}

function Corridor({ trajectory, label, tumor, mmPerUnit, corridorMm, openingCm, toolTipMm }: {
  trajectory: Trajectory; label: string; tumor: TumorParams; mmPerUnit: number; corridorMm: number; openingCm: number; toolTipMm: number | null;
}) {
  const u = (mmv: number) => mmv / mmPerUnit;
  const g = useMemo(() => {
    const d = new THREE.Vector3(...trajectory.direction);
    const inward = d.clone().negate();
    const entry = new THREE.Vector3(...trajectory.entry);
    const center = new THREE.Vector3(...tumor.center);
    const margin = center.clone().addScaledVector(d, tumor.radiusMm / mmPerUnit);
    const at = (depthMm: number) => entry.clone().addScaledVector(inward, depthMm / mmPerUnit);
    return {
      d, inward, entry, center, margin, at,
      approachStart: entry.clone().addScaledVector(d, 45 / mmPerUnit),
      ringQuat: new THREE.Quaternion().setFromUnitVectors(FORWARD, d),
      ticks: Array.from({ length: Math.floor(trajectory.depthMm / 10) }, (_, i) => (i + 1) * 10),
    };
  }, [trajectory, tumor, mmPerUnit]);

  const R = u(corridorMm / 2);
  const craniR = u((openingCm * 10) / 2);
  const tipDepth = toolTipMm ?? -8; // before insertion the retractor waits just outside the cortex
  const tip = g.at(tipDepth);
  const handle = g.entry.clone().addScaledVector(g.d, 40 / mmPerUnit);

  return (
    <group>
      {/* Planned corridor through tissue: drawn on top of the cortex so it is always visible */}
      <Segment from={g.entry} to={g.margin} radius={R}>
        <meshBasicMaterial color={CORRIDOR} transparent opacity={0.32} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </Segment>
      <Segment from={g.entry} to={g.margin} radius={R * 1.02} renderOrder={12}>
        <meshBasicMaterial color={CORRIDOR} wireframe transparent opacity={0.35} depthTest={false} depthWrite={false} />
      </Segment>

      {/* Trajectory line from outside the head to the tumor center */}
      <Line points={[g.approachStart, g.center]} color="#ecfeff" lineWidth={3} depthTest={false} renderOrder={14} />
      <mesh position={g.center} renderOrder={14}>
        <sphereGeometry args={[u(1.6), 16, 12]} />
        <meshBasicMaterial color="#ecfeff" depthTest={false} />
      </mesh>

      {/* Depth markers every 10 mm, plus the margin */}
      {g.ticks.map((mmv) => (
        <mesh key={mmv} position={g.at(mmv)} quaternion={g.ringQuat} renderOrder={13}>
          <torusGeometry args={[R * 1.08, u(0.5), 6, 40]} />
          <meshBasicMaterial color="#ecfeff" depthTest={false} transparent opacity={0.8} />
        </mesh>
      ))}
      <mesh position={g.margin} quaternion={g.ringQuat} renderOrder={13}>
        <torusGeometry args={[R * 1.1, u(0.7), 6, 40]} />
        <meshBasicMaterial color="#e5484d" depthTest={false} />
      </mesh>
      <Label position={g.margin} tone="muted" align="right">
        Margin <span className="font-mono text-[#eef0f5]">{trajectory.depthMm.toFixed(0)} mm</span>
      </Label>

      {/* Craniotomy outline and cortical entry */}
      <mesh position={g.entry.clone().addScaledVector(g.d, u(2))} quaternion={g.ringQuat} renderOrder={13}>
        <torusGeometry args={[craniR, u(0.9), 8, 72]} />
        <meshBasicMaterial color="#eef0f5" depthTest={false} transparent opacity={0.95} />
      </mesh>
      <mesh position={g.entry} quaternion={g.ringQuat} renderOrder={13}>
        <torusGeometry args={[R * 1.15, u(0.9), 8, 48]} />
        <meshBasicMaterial color={CORRIDOR} depthTest={false} />
      </mesh>

      {/* Tubular retractor: advances with the operative timeline */}
      {toolTipMm !== null && (
        <group>
          <Segment from={handle} to={tip} radius={R * 0.96} renderOrder={15}>
            <meshStandardMaterial color="#e6ebf2" emissive="#cbd5e1" emissiveIntensity={0.75} metalness={0.15} roughness={0.35} transparent opacity={0.85} depthTest={false} side={THREE.DoubleSide} />
          </Segment>
          <mesh position={tip} quaternion={g.ringQuat} renderOrder={16}>
            <torusGeometry args={[R * 0.96, u(0.8), 8, 40]} />
            <meshBasicMaterial color="#ffffff" depthTest={false} />
          </mesh>
        </group>
      )}

      <Label position={g.approachStart}>
        <span className="text-[#22d3ee]">{label}</span> · {trajectory.entryStructure}
        <span className="ml-2 font-mono text-[#7a8296]">{trajectory.depthMm.toFixed(0)} mm to margin</span>
      </Label>
    </group>
  );
}

export function ApproachOverlay({ plan, routeIndex, onSelectRoute, tumor, mmPerUnit, openingCm, toolTipMm }: {
  plan: SurgicalPlan;
  routeIndex: number;
  onSelectRoute?: (i: number) => void;
  tumor: TumorParams;
  mmPerUnit: number;
  openingCm: number;
  toolTipMm: number | null;
}) {
  const active = plan.routes[routeIndex] ?? plan.routes[0];
  if (!active) return null;
  return (
    <group>
      {plan.routes.map((route, i) => {
        if (route === active) return null;
        const t = route.trajectory;
        const d = new THREE.Vector3(...t.direction);
        const entry = new THREE.Vector3(...t.entry);
        const outside = entry.clone().addScaledVector(d, 25 / mmPerUnit);
        return (
          <group key={route.label}>
            <Line
              points={[outside, new THREE.Vector3(...tumor.center)]}
              color={i === 0 ? '#7dd3fc' : '#a3a9b8'}
              lineWidth={1.5}
              dashed
              dashSize={0.18}
              gapSize={0.12}
              transparent
              opacity={0.8}
              depthTest={false}
              renderOrder={10}
            />
            <Html position={outside} zIndexRange={[16, 0]}>
              <button
                onClick={() => onSelectRoute?.(i)}
                className="-translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md border border-white/[0.12] bg-ink-900/90 px-2 py-1 text-xs text-[#a3a9b8] hover:border-[#22d3ee]/60 hover:text-[#eef0f5] transition-colors"
              >
                {route.label} · {t.depthMm.toFixed(0)} mm
              </button>
            </Html>
          </group>
        );
      })}
      <Corridor
        trajectory={active.trajectory}
        label={active.label}
        tumor={tumor}
        mmPerUnit={mmPerUnit}
        corridorMm={plan.corridorMm}
        openingCm={openingCm}
        toolTipMm={toolTipMm}
      />
    </group>
  );
}
