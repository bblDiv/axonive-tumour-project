"use client";
import React, { useEffect, useRef, useState } from 'react';

interface FeatureItem {
  id: string;
  stepNum: string;
  title: string;
  tagline: string;
  description: string;
  bullets: string[];
}

const features: FeatureItem[] = [
  {
    id: 'analytics',
    stepNum: '01',
    title: 'Predictive analytics',
    tagline: 'Know the tissue before you open',
    description: 'Map the elasticity of each brain layer and flag vessels and regions likely to be pulled by the resection, before the skull is opened.',
    bullets: [
      'Elasticity mapping of brain layers',
      'Vascular deformation risk profiles',
      'Patient-specific material coefficients'
    ],
  },
  {
    id: 'simulation',
    stepNum: '02',
    title: 'Resection simulation',
    tagline: 'Change the plan, see the shift',
    description: 'Move the tumor, change its size, tissue stiffness or the skull opening, and the deformed mesh updates in the 3D viewer.',
    bullets: [
      'Deformation grid around the cavity',
      'Tissue recoil after tumor removal',
      'Before and after comparison view'
    ],
  },
  {
    id: 'insights',
    stepNum: '03',
    title: 'Surgical reports',
    tagline: 'Two readers, two summaries',
    description: 'Gemini turns displacement, stress and affected volume into a technical summary for the team and a plain-language one for the patient.',
    bullets: [
      'Risk regions named by structure',
      'Surgeon and patient versions',
      'Follow-up questions on the same case'
    ],
  }
];

// Node positions on the dial at 0, 120 and 240 degrees from the top
const NODE_POSITIONS = [
  { left: '50%', top: '0%' },
  { left: '93.3%', top: '75%' },
  { left: '6.7%', top: '75%' },
];

export const FeatureSpinner: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [progressOffset, setProgressOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      if (rect.top < windowHeight && rect.top + rect.height > 0) {
        const progress = (windowHeight - rect.top) / (windowHeight + rect.height);
        const adjusted = Math.min(Math.max(progress + progressOffset, 0), 1);
        const targetRotation = adjusted * 240;
        setRotation(targetRotation);
        setActiveStep(targetRotation < 80 ? 0 : targetRotation < 160 ? 1 : 2);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [progressOffset]);

  const handleNodeClick = (stepIndex: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const currentProgress = (windowHeight - rect.top) / (windowHeight + rect.height);
    const targetProgress = [0.2, 0.5, 0.8][stepIndex];
    setProgressOffset(targetProgress - currentProgress);
    setActiveStep(stepIndex);
    setRotation(targetProgress * 240);
  };

  const active = features[activeStep];

  return (
    <div
      ref={containerRef}
      className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center bg-white p-6 md:p-12 rounded-2xl border border-navy-deep/[0.08]"
    >
      <div key={active.id} className="animate-fade-in">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-sm text-fg-3 tabular-nums">{active.stepNum} / 03</span>
          <span className="text-sm text-fg-3">{active.tagline}</span>
        </div>
        <h3 className="mt-4 font-serif text-4xl tracking-[-0.02em] text-navy-deep">
          {active.title}
        </h3>
        <p className="mt-6 text-lg leading-[30px] text-fg-2 max-w-lg">
          {active.description}
        </p>
        <ul className="mt-8 space-y-3">
          {active.bullets.map((bullet) => (
            <li key={bullet} className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-scan-700" />
              <span className="text-base text-fg">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Dial: scroll turns it, nodes jump to a module */}
      <div className="flex justify-center items-center h-[340px] md:h-[400px]">
        <div
          className="relative w-[240px] h-[240px] md:w-[300px] md:h-[300px] rounded-full border border-navy-deep/[0.12] flex items-center justify-center"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Tick ring, like a scanner gantry */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
            {Array.from({ length: 60 }, (_, i) => (
              <line
                key={i}
                x1="50" y1="3" x2="50" y2={i % 5 === 0 ? 7 : 5}
                stroke="#0A2540"
                strokeOpacity={i % 5 === 0 ? 0.3 : 0.12}
                strokeWidth="0.4"
                transform={`rotate(${i * 6} 50 50)`}
              />
            ))}
          </svg>

          <div className="w-[150px] h-[150px] md:w-[184px] md:h-[184px] rounded-full border border-dashed border-navy-deep/[0.12] flex items-center justify-center">
            <div
              className="w-20 h-20 rounded-full bg-navy-deep flex items-center justify-center"
              style={{ transform: `rotate(${-rotation}deg)` }}
            >
              <span className="font-mono text-lg text-white tabular-nums">{active.stepNum}</span>
            </div>
          </div>

          {NODE_POSITIONS.map((pos, i) => (
            <button
              key={i}
              onClick={() => handleNodeClick(i)}
              aria-label={features[i].title}
              className={`absolute w-12 h-12 -ml-6 -mt-6 rounded-full border flex items-center justify-center font-mono text-sm tabular-nums transition-colors ${
                activeStep === i
                  ? 'bg-scan-700 text-white border-scan-700'
                  : 'bg-white text-fg-3 border-navy-deep/[0.12] hover:text-fg hover:border-navy-deep/[0.24]'
              }`}
              style={{
                ...pos,
                transform: `rotate(${-rotation}deg)`,
              }}
            >
              {features[i].stepNum}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
