import { NextRequest, NextResponse } from 'next/server';
import meshData from '@/lib/cached_mesh.json';
import { STRUCTURE_NAMES } from '@/lib/structureNames';

export async function POST(req: NextRequest) {
  try {
    const { case_id } = await req.json();
    
    return NextResponse.json({
      mesh_data: meshData,
      label_names: STRUCTURE_NAMES,
      case_id: case_id || 'sample-case'
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Segmentation failed' }, { status: 500 });
  }
}
