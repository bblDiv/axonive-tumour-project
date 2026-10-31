"use client";
import React, { useEffect, useRef, useState } from 'react';

// ScrollRow wrapper component for scroll-based popups
interface ScrollRowProps {
  children: React.ReactNode;
}

const ScrollRow: React.FC<ScrollRowProps> = ({ children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        threshold: 0.2, // Triggers when 20% of the row is visible
        rootMargin: '0px 0px -50px 0px'
      }
    );

    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    return () => {
      if (rowRef.current) {
        observer.unobserve(rowRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={rowRef}
      className={`transition-[opacity,transform] duration-500 ease-out-quint ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`}
    >
      {children}
    </div>
  );
};

// 1. Step 1: 2D Brain Scan Slicer & Segmenter
const ScanSlicerSim: React.FC = () => {
  const [scanY, setScanY] = useState(30); // Percentage from top
  const [direction, setDirection] = useState(1); // 1 = down, -1 = up
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setScanY((prev) => {
        let next = prev + direction * 0.8;
        if (next >= 85) {
          setDirection(-1);
          return 85;
        }
        if (next <= 15) {
          setDirection(1);
          return 15;
        }
        return next;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [direction, isPaused]);

  return (
    <div 
      className="h-[400px] lg:h-[450px] w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-950 relative flex flex-col items-center justify-center p-6 group cursor-pointer"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Title */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-white/[0.08]">
        <h4 className="text-xs font-medium text-slate-200">Scan segmenter</h4>
      </div>

      <div className="w-full max-w-[280px] h-[280px] relative">
        {/* Brain Scan Base (Grayscale Blueprint) */}
        <svg className="w-full h-full absolute inset-0 opacity-20 filter blur-[0.5px]" viewBox="0 0 200 200">
          <rect width="200" height="200" fill="none" />
          {/* Skull Outline */}
          <circle cx="100" cy="100" r="80" fill="none" stroke="#64748B" strokeWidth="4" strokeDasharray="3 3" />
          {/* Lobe Left */}
          <path d="M100 30 C50 30, 40 70, 45 100 C50 130, 60 170, 100 170" fill="none" stroke="#64748B" strokeWidth="2" />
          {/* Lobe Right */}
          <path d="M100 30 C150 30, 160 70, 155 100 C150 130, 140 170, 100 170" fill="none" stroke="#64748B" strokeWidth="2" />
          {/* Ventricles */}
          <path d="M85 85 C80 95, 80 105, 95 110 M115 85 C120 95, 120 105, 105 110" fill="none" stroke="#64748B" strokeWidth="1.5" />
          {/* Tumor Outline */}
          <circle cx="130" cy="80" r="16" fill="none" stroke="#64748B" strokeWidth="2" />
        </svg>

        {/* Brain Scan Segmented Reveal (using clip-path based on scanY) */}
        <div 
          className="w-full h-full absolute inset-0 transition-all duration-75 overflow-hidden"
          style={{ clipPath: `inset(0% 0% ${100 - scanY}% 0%)` }}
        >
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 200 200">
            {/* Skull (Segmented - Light Grey) */}
            <circle cx="100" cy="100" r="80" fill="none" stroke="#E2E8F0" strokeWidth="5" />
            {/* Left Lobe (Segmented Grey/White Matter) */}
            <path d="M100 30 C50 30, 40 70, 45 100 C50 130, 60 170, 100 170 Z" fill="#475569" opacity="0.65" />
            <path d="M100 45 C65 45, 55 75, 58 100 C62 120, 70 155, 100 155 Z" fill="#94A3B8" opacity="0.5" />
            
            {/* Right Lobe */}
            <path d="M100 30 C150 30, 160 70, 155 100 C150 130, 140 170, 100 170 Z" fill="#475569" opacity="0.65" />
            <path d="M100 45 C135 45, 145 75, 142 100 C138 120, 130 155, 100 155 Z" fill="#94A3B8" opacity="0.5" />

            {/* Ventricles (CSF - Blue) */}
            <path d="M85 85 C80 95, 80 105, 95 110 Z" fill="#38BDF8" opacity="0.8" />
            <path d="M115 85 C120 95, 120 105, 105 110 Z" fill="#38BDF8" opacity="0.8" />

            {/* Tumor Segmented (Bright Red with glow) */}
            <circle cx="130" cy="80" r="16" fill="#EF4444" opacity="0.9" />
            <circle cx="130" cy="80" r="12" fill="#FCA5A5" opacity="0.9" />
          </svg>
        </div>

        {/* Scanner Bar */}
        <div 
          className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent flex items-center justify-center transition-all duration-75"
          style={{ top: `${scanY}%` }}
        >
          {/* Glow effect */}
          <div className="w-full h-4 bg-sky-400/20 blur-md absolute"></div>
          {/* Laser marker */}
          <div className="w-2 h-2 rounded-full bg-sky-400 border border-white"></div>
        </div>
      </div>

      {/* Hover Instruction */}
      <div className="mt-4 text-center">
        <p className="text-xs text-slate-500">
          {isPaused ? "Scan paused" : "Scanning · hover to pause"}
        </p>
      </div>

      {/* Stats Overlay */}
      <div className="absolute bottom-4 right-4 bg-slate-900/90 px-3 py-2 rounded-lg border border-white/[0.08] text-[11px] text-slate-400 space-y-1 select-none">
        <div className="flex justify-between gap-4">
          <span>Slice Z</span>
          <span className="font-mono tabular-nums text-slate-200">{(scanY * 1.8).toFixed(1)} mm</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Target</span>
          <span className="text-red-400">Tumor, 8.5 cm³</span>
        </div>
      </div>
    </div>
  );
};

// 2. Step 2: 2D Biomechanical FEA Grid Warper
const FEAGridWarperSim: React.FC = () => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1

  const handleSimulate = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setProgress(0);

    let start = 0;
    const interval = setInterval(() => {
      start += 0.02;
      if (start >= 1) {
        setProgress(1);
        clearInterval(interval);
        setTimeout(() => {
          // Keep it at deformed state, click to reset
        }, 1000);
      } else {
        setProgress(start);
      }
    }, 20);
  };

  const handleReset = () => {
    setProgress(0);
    setIsSimulating(false);
  };

  // Center of resection cavity
  const cx = 130;
  const cy = 80;
  const tumorRadius = 16;

  // Grid coordinates generation
  // Grid lines span from x=20 to 180 and y=20 to 180
  const gridResolution = 10; // Number of vertical and horizontal lines
  
  // Calculate a warped point towards (cx, cy)
  const getWarpedPoint = (x: number, y: number, t: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Limit warp range. Skull line (dist > 75) does not warp
    if (dist > 75 || dist === 0) return { x, y };

    // Max warp displacement happens near resection cavity boundary
    const maxDisplacement = 12 * t; // pixels
    const decayFactor = 35; // falloff range

    // Exponential decay of deformation
    const displacement = maxDisplacement * Math.exp(-dist / decayFactor);

    // Warps INWARD (towards cavity)
    const ux = -dx / dist;
    const uy = -dy / dist;

    return {
      x: x + ux * displacement,
      y: y + uy * displacement
    };
  };

  // Draw grid path based on deformation progress t
  const renderHorizontalLines = (t: number) => {
    const lines = [];
    const steps = 12; // vertical slices of horizontal lines
    for (let i = 1; i < gridResolution; i++) {
      const y = 20 + (i * 160) / gridResolution;
      let pathData = '';
      for (let j = 0; j <= steps; j++) {
        const x = 20 + (j * 160) / steps;
        const warped = getWarpedPoint(x, y, t);
        pathData += `${j === 0 ? 'M' : 'L'} ${warped.x} ${warped.y} `;
      }
      lines.push(
        <path 
          key={`h-${i}`} 
          d={pathData} 
          fill="none" 
          stroke={t > 0.1 ? `rgba(14, 165, 233, ${0.1 + t * 0.25})` : 'rgba(71, 85, 105, 0.2)'} 
          strokeWidth={t > 0.1 ? 1.5 : 1}
          className="transition-colors duration-200"
        />
      );
    }
    return lines;
  };

  const renderVerticalLines = (t: number) => {
    const lines = [];
    const steps = 12; // horizontal slices of vertical lines
    for (let i = 1; i < gridResolution; i++) {
      const x = 20 + (i * 160) / gridResolution;
      let pathData = '';
      for (let j = 0; j <= steps; j++) {
        const y = 20 + (j * 160) / steps;
        const warped = getWarpedPoint(x, y, t);
        pathData += `${j === 0 ? 'M' : 'L'} ${warped.x} ${warped.y} `;
      }
      lines.push(
        <path 
          key={`v-${i}`} 
          d={pathData} 
          fill="none" 
          stroke={t > 0.1 ? `rgba(14, 165, 233, ${0.1 + t * 0.25})` : 'rgba(71, 85, 105, 0.2)'} 
          strokeWidth={t > 0.1 ? 1.5 : 1}
          className="transition-colors duration-200"
        />
      );
    }
    return lines;
  };

  return (
    <div className="h-[400px] lg:h-[450px] w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-950 relative flex flex-col items-center justify-center p-6">
      {/* Title */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-white/[0.08]">
        <h4 className="text-xs font-medium text-slate-200">Resection simulator</h4>
      </div>

      {/* Grid Canvas */}
      <div className="w-full max-w-[280px] h-[280px] relative">
        <svg className="w-full h-full absolute inset-0" viewBox="0 0 200 200">
          <defs>
            {/* Radial Gradient for stress heatmap */}
            <radialGradient id="stressHeatmap" cx="65%" cy="40%" r="40%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity={0.8 * progress} />
              <stop offset="40%" stopColor="#F59E0B" stopOpacity={0.6 * progress} />
              <stop offset="75%" stopColor="#3B82F6" stopOpacity={0.3 * progress} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Brain Contour Base */}
          <circle cx="100" cy="100" r="80" fill="#0B0F19" stroke="#1E293B" strokeWidth="2" />
          
          {/* Right Lobe tissue fill */}
          <path d="M100 30 C150 30, 160 70, 155 100 C150 130, 140 170, 100 170 Z" fill="#0F172A" />
          {/* Left Lobe tissue fill */}
          <path d="M100 30 C50 30, 40 70, 45 100 C50 130, 60 170, 100 170 Z" fill="#0F172A" />

          {/* Render Warping Grid */}
          {renderHorizontalLines(progress)}
          {renderVerticalLines(progress)}

          {/* Stress Heatmap layer */}
          <circle cx={cx} cy={cy} r="70" fill="url(#stressHeatmap)" pointerEvents="none" />

          {/* Resection boundary / Tumor */}
          {progress < 0.9 && (
            <circle 
              cx={cx} 
              cy={cy} 
              r={tumorRadius} 
              fill={isSimulating ? '#1E293B' : '#EF4444'} 
              stroke="#EF4444" 
              strokeWidth="2" 
              opacity={1 - progress}
              className="transition-colors duration-500" 
            />
          )}

          {/* Target marker (dotted circle around cavity) */}
          <circle cx={cx} cy={cy} r={tumorRadius + 5} fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2 2" opacity={progress} />
          
          {/* Skull Boundary Ring */}
          <circle cx="100" cy="100" r="80" fill="none" stroke="#334155" strokeWidth="3" />
        </svg>

        {/* Center overlay button when idle */}
        {progress === 0 && !isSimulating && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px]">
            <button 
              onClick={handleSimulate}
              className="h-9 px-4 bg-[#eef0f5] hover:bg-white text-slate-950 font-medium text-xs rounded-lg active:scale-[0.98] transition-[background-color,transform]"
            >
              Simulate resection
            </button>
          </div>
        )}

        {/* Completed Reset Button */}
        {progress === 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <button 
              onClick={handleReset}
              className="h-7 px-3 bg-slate-900 border border-white/[0.08] text-slate-300 hover:text-white font-medium text-[11px] rounded-md transition-colors"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Simulator Metrics */}
      <div className="mt-4 text-center">
        {isSimulating ? (
          <div className="flex flex-col items-center space-y-1">
            <span className="text-[11px] text-slate-400">
              {progress < 1 ? "Solving mesh" : "Solved"}
            </span>
            <div className="w-40 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-sky-400 transition-all duration-75" style={{ width: `${progress * 100}%` }}></div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Tissue relaxes inward toward the resection cavity
          </p>
        )}
      </div>

      {/* Live Heatmap scale indicators */}
      <div className="absolute bottom-4 right-4 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-white/[0.08] text-[11px] text-slate-400 flex items-center space-x-2 select-none">
        <span className="text-slate-500">Stress</span>
        <div className="w-12 h-2.5 bg-gradient-to-r from-blue-500 via-yellow-400 to-red-500 rounded-sm"></div>
        <span className="text-slate-200 font-mono tabular-nums">{isSimulating ? (1.35 * progress).toFixed(2) : "0.00"} kPa</span>
      </div>
    </div>
  );
};

// 3. Step 3: 2D Gemini Surgical Insights Console
const GeminiInsightsSim: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'surgeon' | 'patient'>('surgeon');
  const [typedText, setTypedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const surgeonText = `Resection assessment
Target: Right Frontal Lobe (anterior)
Max tissue displacement: 3.52 mm (limit 5.0 mm)
Average local stress: 1.18 kPa

Recommended approach
* Right frontal craniotomy suitable.
* Rigid skull anchors avoid temporal lobe shearing.
* Low risk of sensory/motor deficits.
* Hemodynamic monitoring around frontal cortex advised.`;

  const patientText = `Patient summary
The surgical simulation is complete.
Expected tissue movement: under 4 mm, a small shift.
Risk rating: low.

What to expect
* The brain tissue will shift slightly but safely to fill the gap left by the tumor.
* Surrounding critical brain areas are unaffected.
* Expected recovery in hospital is 3 to 5 days, followed by typical healing at home.`;

  useEffect(() => {
    setTypedText('');
    setIsTyping(true);
    const targetText = activeTab === 'surgeon' ? surgeonText : patientText;
    let index = 0;
    
    const interval = setInterval(() => {
      setTypedText((prev) => prev + targetText.charAt(index));
      index++;
      if (index >= targetText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [activeTab]);

  return (
    <div className="h-[400px] lg:h-[450px] w-full rounded-2xl overflow-hidden border border-white/[0.08] bg-slate-950 relative flex flex-col p-4">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-sky-400"></div>
          <span className="text-xs font-medium text-slate-200">Pre-op report</span>
        </div>
        <div className="flex space-x-1.5">
          <button 
            onClick={() => setActiveTab('surgeon')}
            className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
              activeTab === 'surgeon' 
                ? 'bg-slate-800 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Surgeon
          </button>
          <button 
            onClick={() => setActiveTab('patient')}
            className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${
              activeTab === 'patient' 
                ? 'bg-slate-800 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Patient
          </button>
        </div>
      </div>

      {/* Main content grid split */}
      <div className="flex-1 grid grid-cols-5 gap-3 min-h-0">
        
        {/* Left Side: 2D scan slice with callout markers */}
        <div className="col-span-2 bg-slate-900/60 rounded-xl border border-white/[0.06] p-2 flex items-center justify-center relative overflow-hidden group">
          <svg className="w-full max-w-[110px] h-auto" viewBox="0 0 200 200">
            {/* Radial Gradient for heatmap */}
            <radialGradient id="insightsHeatmap" cx="65%" cy="40%" r="40%">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.7" />
              <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </radialGradient>

            <circle cx="100" cy="100" r="80" fill="#0B0F19" stroke="#1E293B" strokeWidth="2" />
            {/* Deformed lobes */}
            <path d="M100 30 C150 30, 160 70, 155 100 C150 130, 140 170, 100 170 Z" fill="#0F172A" />
            <path d="M100 30 C50 30, 40 70, 45 100 C50 130, 60 170, 100 170 Z" fill="#0F172A" />
            {/* Heatmap overlay */}
            <circle cx="130" cy="80" r="50" fill="url(#insightsHeatmap)" pointerEvents="none" />
            {/* Skull ring */}
            <circle cx="100" cy="100" r="80" fill="none" stroke="#334155" strokeWidth="2" />
            {/* Dotted target cavity */}
            <circle cx="130" cy="80" r="16" fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="2 2" />

            {/* Visual Callout Lines */}
            <line x1="130" y1="80" x2="170" y2="40" stroke="#F59E0B" strokeWidth="1.5" />
            <circle cx="170" cy="40" r="2.5" fill="#F59E0B" />

            <line x1="75" y1="130" x2="30" y2="130" stroke="#38BDF8" strokeWidth="1.5" />
            <circle cx="30" cy="130" r="2.5" fill="#38BDF8" />
          </svg>

          {/* Dotted Line Indicators labels */}
          <div className="absolute top-2 right-2 text-[11px] font-mono text-amber-300 select-none">
            3.52 mm
          </div>
          <div className="absolute bottom-2 left-2 text-[11px] text-sky-300 select-none">
            Motor cortex clear
          </div>
        </div>

        {/* Right Side: Typewriter Console */}
        <div className="col-span-3 bg-black/60 rounded-xl border border-white/[0.06] p-3 overflow-y-auto font-mono text-[11px] text-slate-300 select-none leading-[18px] flex flex-col justify-between">
          <div className="whitespace-pre-wrap">
            {typedText}
            {isTyping && <span className="w-1.5 h-3 bg-slate-300 inline-block ml-0.5 align-middle"></span>}
          </div>
          {!isTyping && (
            <div className="text-slate-500 text-[11px] border-t border-white/[0.06] pt-2 mt-2 flex justify-between">
              <span>Report complete</span>
              <span>Gemini 2.5 Flash</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const STEPS: { title: string; body: string; bullets: string[]; Sim: React.FC }[] = [
  {
    title: 'Upload and segment in seconds',
    body: 'Import MRI or CT scans in DICOM or NIfTI. Axonive labels the brain structures and outlines the tumor, so planning starts from a segmented scan.',
    bullets: [
      'Tissue classification: grey matter, white matter, skull',
      'Tumor localization and volume estimate',
      '62 labelled structures you can hide or isolate',
    ],
    Sim: ScanSlicerSim,
  },
  {
    title: 'Simulate the resection',
    body: 'Remove the tumor and see how surrounding tissue moves into the cavity, given its stiffness, the tumor size and the size of the skull opening.',
    bullets: [
      'Tissue displacement around the resection cavity',
      'Adjustable tumor position, radius, stiffness and opening',
      'Stress heatmap from low (blue) to high (red)',
    ],
    Sim: FEAGridWarperSim,
  },
  {
    title: 'Read the pre-op report',
    body: 'Gemini reads the simulation metrics and writes two summaries: a technical one for the surgical team and a plain-language one for the patient.',
    bullets: [
      'Regions under high stress, listed by name',
      'Suggested approach for the surgical team',
      'Patient summary for consent conversations',
    ],
    Sim: GeminiInsightsSim,
  },
];

export const ScrollSimulations: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-8 pt-12">
      {STEPS.map(({ title, body, bullets, Sim }, i) => (
        <ScrollRow key={title}>
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center bg-paper p-6 lg:p-10 rounded-2xl border border-navy-deep/[0.08]">
            <div>
              <span className="inline-flex h-7 items-center px-3 rounded-md bg-scan-700/10 text-scan-700 text-sm font-medium">
                Step {i + 1}
              </span>
              <h3 className="mt-6 font-serif text-4xl lg:text-[44px] leading-[1.1] tracking-[-0.02em] text-navy-deep">
                {title}
              </h3>
              <p className="mt-6 text-lg leading-[30px] text-fg-2">{body}</p>
              <ul className="mt-8 space-y-4">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5 shrink-0 text-scan-700" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-base leading-6 text-fg">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Sim />
          </div>
        </ScrollRow>
      ))}
    </div>
  );
};
