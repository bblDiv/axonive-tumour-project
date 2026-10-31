// What each atlas region does, and how much a planner should avoid crossing or approaching it.
// Weights are planning heuristics, not outcome data: 100 = primary motor cortex, 0 = non-eloquent.

export type FunctionCategory =
  | 'motor' | 'sensory' | 'language' | 'visual' | 'memory' | 'vascular'
  | 'supplementary motor' | 'association' | 'brainstem' | 'non-eloquent';

export interface Eloquence {
  fn: string;
  category: FunctionCategory;
  weight: number;
  noGo?: boolean;
}

export type Hemisphere = 'left' | 'right';

export function eloquenceOf(name: string, dominant: Hemisphere): Eloquence {
  const n = name.toLowerCase();
  const isDominant = n.includes(dominant);

  if (n.includes('medulla') || n.includes('colliculus')) {
    return { fn: 'Brainstem: vital functions, auditory and visual reflexes', category: 'brainstem', weight: 1000, noGo: true };
  }
  if (n.includes('precentral')) return { fn: 'Primary motor cortex', category: 'motor', weight: 100 };
  if (n.includes('postcentral')) return { fn: 'Primary sensory cortex', category: 'sensory', weight: 60 };
  if (n.includes('insula')) {
    return { fn: 'Insula, overlying MCA branches and lenticulostriate perforators', category: 'vascular', weight: 70 };
  }
  if (n.includes('hippocampus')) {
    return { fn: isDominant ? 'Verbal memory' : 'Non-verbal memory', category: 'memory', weight: isDominant ? 70 : 55 };
  }
  if (n.includes('cuneus') && !n.includes('precuneus')) {
    return { fn: 'Primary visual cortex (upper calcarine bank)', category: 'visual', weight: 60 };
  }
  if (n.includes('lingual')) return { fn: 'Primary visual cortex (lower calcarine bank)', category: 'visual', weight: 60 };

  if (isDominant) {
    if (n.includes('inferior frontal')) return { fn: "Expressive language (Broca's area)", category: 'language', weight: 85 };
    if (n.includes('posterior part') && n.includes('superior temporal')) {
      return { fn: "Receptive language (Wernicke's area)", category: 'language', weight: 85 };
    }
    if (n.includes('supramarginal')) return { fn: 'Language and phonological processing', category: 'language', weight: 55 };
    if (n.includes('angular')) return { fn: 'Reading, writing and calculation', category: 'language', weight: 55 };
    if (n.includes('middle temporal')) return { fn: 'Semantic language', category: 'language', weight: 30 };
    if (n.includes('fusiform')) return { fn: 'Word and object recognition', category: 'association', weight: 25 };
    if (n.includes('anterior part') && n.includes('superior temporal')) {
      return { fn: 'Auditory and language association', category: 'association', weight: 20 };
    }
  } else {
    if (n.includes('supramarginal') || n.includes('angular')) {
      return { fn: 'Spatial attention (neglect risk)', category: 'association', weight: 25 };
    }
    if (n.includes('fusiform')) return { fn: 'Face recognition', category: 'association', weight: 15 };
    if (n.includes('inferior frontal')) return { fn: 'Prosody and response inhibition', category: 'association', weight: 10 };
  }

  if (n.includes('superior frontal')) return { fn: 'Supplementary motor area (posterior third)', category: 'supplementary motor', weight: 25 };
  if (n.includes('parahippocampal')) return { fn: 'Memory encoding, spatial navigation', category: 'memory', weight: 30 };
  if (n.includes('lateral occipital') || n.includes('superior occipital')) {
    return { fn: 'Visual association', category: 'association', weight: 20 };
  }
  if (n.includes('superior parietal')) return { fn: 'Visuomotor integration', category: 'association', weight: 15 };
  if (n.includes('cingulate')) return { fn: 'Attention, emotion, motivation', category: 'association', weight: 20 };
  if (n.includes('straight') ) return { fn: 'Orbitofrontal, olfactory tract nearby', category: 'association', weight: 15 };
  if (n.includes('precuneus')) return { fn: 'Visuospatial and self-referential processing', category: 'association', weight: 10 };
  if (n.includes('orbital')) return { fn: 'Orbitofrontal: decision making, behaviour', category: 'association', weight: 10 };
  if (n.includes('middle frontal')) return { fn: 'Working memory, frontal eye field (posterior)', category: 'association', weight: 8 };
  return { fn: 'Non-eloquent cortex', category: 'non-eloquent', weight: 5 };
}

export function riskLevel(score: number): 'High' | 'Moderate' | 'Low' {
  return score >= 60 ? 'High' : score >= 25 ? 'Moderate' : 'Low';
}

// White matter tracts carry the same function as the cortex they connect, and cannot be mapped by
// cortical stimulation alone, so they weigh as much as their cortical endpoints.
export function tractEloquence(key: string, side: 'left' | 'right' | 'midline', dominant: Hemisphere): Eloquence {
  if (key === 'cst') return { fn: 'Voluntary movement (descending motor fibers)', category: 'motor', weight: 100 };
  if (key === 'af') {
    return side === dominant
      ? { fn: 'Language repetition and production', category: 'language', weight: 80 }
      : { fn: 'Prosody (non-dominant)', category: 'association', weight: 15 };
  }
  if (key === 'or') return { fn: 'Contralateral visual field', category: 'visual', weight: 60 };
  return { fn: 'Interhemispheric connection', category: 'association', weight: 10 };
}
