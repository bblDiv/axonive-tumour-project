"use client";
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tract } from '../lib/tracts';
import { skullIndices } from '../lib/skull';
import type { SkullShell } from '../lib/skull';

// DTI convention: left-right red, anterior-posterior green, superior-inferior blue
function directionColors(geo: THREE.TubeGeometry, curve: THREE.Curve<THREE.Vector3>) {
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const rings = geo.parameters.tubularSegments + 1;
  const perRing = count / rings;
  const tangent = new THREE.Vector3();
  for (let i = 0; i < rings; i++) {
    curve.getTangentAt(Math.min(1, i / (rings - 1)), tangent);
    // Normalised so the dominant direction is at full intensity, as DTI viewers show it
    const ax = Math.abs(tangent.x), az = Math.abs(tangent.z), ay = Math.abs(tangent.y);
    const m = Math.max(ax, ay, az, 1e-3);
    const r = 0.08 + 0.92 * (ax / m) ** 1.5;
    const g = 0.08 + 0.92 * (az / m) ** 1.5;
    const b = 0.08 + 0.92 * (ay / m) ** 1.5;
    for (let k = 0; k < perRing; k++) {
      const v = (i * perRing + k) * 3;
      colors[v] = r; colors[v + 1] = g; colors[v + 2] = b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function TractMesh({ tract, emphasis, overlay }: { tract: Tract; emphasis: boolean; overlay: boolean }) {
  const geometry = useMemo(() => {
    const parts = tract.fibers.map((pts) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      const geo = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 2), 0.024, 5, false);
      directionColors(geo, curve);
      return geo;
    });
    const merged = mergeGeometries(parts, false) ?? new THREE.BufferGeometry();
    parts.forEach((p) => p.dispose());
    return merged;
  }, [tract]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    // Over see-through cortex the tracts are drawn last and on top, so the glow does not wash out their colors
    <mesh geometry={geometry} renderOrder={overlay ? 9 : 5}>
      <meshStandardMaterial
        key={overlay ? 'overlay' : 'inline'}
        vertexColors
        roughness={0.45}
        emissive="#ffffff"
        emissiveIntensity={emphasis ? 0.1 : 0}
        depthTest={!overlay}
        transparent={overlay}
        opacity={overlay ? (emphasis ? 1 : 0.8) : 1}
      />
    </mesh>
  );
}

export function TractsLayer({ tracts, emphasize, overlay }: { tracts: Tract[]; emphasize: Set<string>; overlay: boolean }) {
  return (
    <group>
      {tracts.map((t) => (
        <TractMesh key={t.name} tract={t} overlay={overlay} emphasis={emphasize.size === 0 || emphasize.has(t.name)} />
      ))}
    </group>
  );
}

export function SkullLayer({ shell, entry, craniotomyRadius }: {
  shell: SkullShell;
  entry: [number, number, number] | null;
  craniotomyRadius: number;
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(shell.positions, 3));
    g.setIndex(new THREE.BufferAttribute(skullIndices(shell, entry, craniotomyRadius), 1));
    g.computeVertexNormals();
    return g;
  }, [shell, entry, craniotomyRadius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={2}>
      <meshStandardMaterial
        color="#e9e3d6"
        roughness={0.85}
        transparent
        opacity={0.2}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
