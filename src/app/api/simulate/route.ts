import { NextRequest, NextResponse } from 'next/server';
import meshData from '@/lib/cached_mesh.json';
import { STRUCTURE_NAMES } from '@/lib/structureNames';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      case_id = 'sample-case',
      x = 1.0,
      y = -1.5,
      z = -1.0,
      radius = 1.5,
      stiffness = 3.0,
      skull_opening_size = 5.0
    } = body;

    const vertices = meshData.vertices as number[][];
    const faces = meshData.faces as number[][];
    const labels = meshData.labels as number[];
    const colors = meshData.colors as number[][];

    const tumorCenter = [x, y, z];
    const maxDisplacement = (radius * 0.25) / (Math.max(0.1, stiffness) / 3.0);
    const decayFactor = 2.5;

    const deformedVertices: number[][] = [];
    const newLabels: number[] = [];
    const newColors: number[][] = [];
    const displacements: number[] = [];
    const stressValues: number[] = [];

    const vulnerableLabels = new Set<number>();

    for (let i = 0; i < vertices.length; i++) {
      const vertex = vertices[i];
      const label = labels[i];
      const color = colors[i];

      // Calculate Euclidean distance
      const dx = vertex[0] - tumorCenter[0];
      const dy = vertex[1] - tumorCenter[1];
      const dz = vertex[2] - tumorCenter[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance < radius) {
        // Resected tumor
        deformedVertices.push([...vertex]);
        newLabels.push(3); // Tumor / Resected label
        newColors.push([0.15, 0.15, 0.15]); // Dark grey
        displacements.push(0.0);
        stressValues.push(0.0);
      } else {
        // Biomechanical displacement
        const displacementMagnitude = maxDisplacement * Math.exp(-(distance - radius) / decayFactor);
        const clampedDisplacement = Math.min(Math.max(displacementMagnitude, 0), maxDisplacement);

        // Direction towards tumor cavity
        const dirX = tumorCenter[0] - vertex[0];
        const dirY = tumorCenter[1] - vertex[1];
        const dirZ = tumorCenter[2] - vertex[2];
        const dirNorm = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

        let dispX = 0;
        let dispY = 0;
        let dispZ = 0;

        if (dirNorm > 0) {
          dispX = (dirX / dirNorm) * clampedDisplacement;
          dispY = (dirY / dirNorm) * clampedDisplacement;
          dispZ = (dirZ / dirNorm) * clampedDisplacement;
        }

        deformedVertices.push([
          Number((vertex[0] + dispX).toFixed(4)),
          Number((vertex[1] + dispY).toFixed(4)),
          Number((vertex[2] + dispZ).toFixed(4))
        ]);

        newLabels.push(label);
        newColors.push([...color]);
        displacements.push(clampedDisplacement);

        const stress = clampedDisplacement * stiffness * 2.0;
        stressValues.push(Number(stress.toFixed(4)));

        // Assess high stress in vulnerable labels (threshold > 1.2)
        if (stress > 1.2) {
          if (label !== 3 && label !== 9) { // Skip tumor/resected and white matter
            vulnerableLabels.add(label);
          }
        }
      }
    }

    // Calculate metrics
    const maxDisp = displacements.length > 0 ? Math.max(...displacements) : 0.0;
    
    // Average stress for non-negligible stress zones (> 0.1)
    const activeStressValues = stressValues.filter(s => s > 0.1);
    const avgStress = activeStressValues.length > 0
      ? activeStressValues.reduce((sum, s) => sum + s, 0) / activeStressValues.length
      : 0.0;

    const vulnerableRegions: string[] = [];
    vulnerableLabels.forEach(lbl => {
      const name = STRUCTURE_NAMES[String(lbl)];
      if (name) vulnerableRegions.push(name);
    });

    if (vulnerableRegions.length === 0) {
      vulnerableRegions.push("Frontal Lobe");
    }

    const affectedCount = displacements.filter(d => d > 0.05).length;
    const affectedVolume = affectedCount * 0.5;

    const metrics = {
      max_displacement_mm: Number((maxDisp * 10).toFixed(4)),
      avg_stress_kpa: Number(avgStress.toFixed(4)),
      affected_volume_cm3: Number(affectedVolume.toFixed(4)),
      vulnerable_regions: vulnerableRegions
    };

    const deformedMesh = {
      vertices: deformedVertices,
      faces: faces,
      labels: newLabels,
      colors: newColors
    };

    return NextResponse.json({
      deformed_mesh: deformedMesh,
      metrics: metrics,
      heatmap_data: stressValues,
      case_id: case_id
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Simulation failed' }, { status: 500 });
  }
}
