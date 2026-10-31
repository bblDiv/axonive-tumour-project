"use client";
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Logo } from '@/components/Logo';
import { HeroViewer } from '@/components/HeroViewer';
import { ScrollSimulations } from '@/components/ScrollSimulations';
import { FeatureSpinner } from '@/components/FeatureSpinner';

const FACTS = [
  ['62', 'labelled structures per scan'],
  ['DICOM, NIfTI', 'scan formats accepted'],
  ['2 reports', 'one for the surgeon, one for the patient'],
  ['In the browser', 'no workstation install'],
];

const STACK = [
  ['Gemini 2.5 Flash', 'Reads the simulation metrics and writes the surgical and patient summaries'],
  ['Snowflake', 'Stores cases and simulation results so similar resections can be compared'],
  ['DigitalOcean', 'Runs the mesh deformation jobs for larger scans'],
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-20 lg:pt-32 lg:pb-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-12 lg:gap-16 items-center animate-slide-up">
          <div>
            <p className="font-mono text-xs text-fg-3">Neurosurgical planning</p>
            <h1 className="mt-4 font-serif text-[40px] leading-[1.06] sm:text-6xl lg:text-[64px] tracking-[-0.03em] text-navy-deep">
              See how the brain will shift before you operate
            </h1>
            <p className="mt-6 text-lg leading-[30px] text-fg-2 max-w-[34rem]">
              Axonive segments a patient&apos;s MRI, simulates how tissue moves once the tumor is removed,
              and writes a pre-op summary for the surgical team and the patient.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/axonive"
                className="h-12 px-5 inline-flex items-center justify-center rounded-lg bg-navy-deep text-white font-medium hover:bg-[#12345a] active:scale-[0.98] transition-[background-color,transform]"
              >
                Run the sample case
              </Link>
              <a
                href="#how-it-works"
                className="h-12 px-5 inline-flex items-center justify-center rounded-lg border border-navy-deep/[0.12] bg-white text-navy-deep font-medium hover:bg-paper-raised transition-colors"
              >
                How it works
              </a>
            </div>
          </div>

          <HeroViewer />
        </div>
      </section>

      {/* What it handles */}
      <section className="px-6">
        <dl className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-px bg-navy-deep/[0.08] border border-navy-deep/[0.08] rounded-xl overflow-hidden">
          {FACTS.map(([value, label]) => (
            <div key={label} className="bg-white p-6 flex flex-col-reverse justify-end">
              <dt className="mt-2 text-sm leading-5 text-fg-3">{label}</dt>
              <dd className="text-2xl font-medium text-navy-deep tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Features */}
      <section id="features" className="py-24 lg:py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16">
            <h2 className="font-serif text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] text-navy-deep">
              Three modules, one planning session
            </h2>
            <p className="mt-6 text-lg leading-[30px] text-fg-2">
              Measure the tissue, simulate the resection, then read what it means. Scroll to move through the modules,
              or pick one on the dial.
            </p>
          </div>
          <FeatureSpinner />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 lg:py-32 px-6 bg-white border-y border-navy-deep/[0.08] overflow-hidden">
        <div className="max-w-7xl mx-auto mb-4">
          <div className="max-w-2xl">
            <h2 className="font-serif text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] text-navy-deep">
              How Axonive works
            </h2>
            <p className="mt-6 text-lg leading-[30px] text-fg-2">
              Each step below is interactive. Pause the scanner, run the resection, switch the report between surgeon and patient.
            </p>
          </div>
        </div>
        <ScrollSimulations />
      </section>

      {/* Stack */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-serif text-3xl lg:text-4xl tracking-[-0.02em] text-navy-deep">What it runs on</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {STACK.map(([name, body]) => (
              <div key={name} className="rounded-xl bg-white border border-navy-deep/[0.08] p-6">
                <h3 className="text-base font-medium text-navy-deep">{name}</h3>
                <p className="mt-2 text-[15px] leading-6 text-fg-2">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-24">
        <div className="max-w-7xl mx-auto rounded-2xl bg-ink-900 px-8 py-16 lg:px-16 lg:py-20 grid lg:grid-cols-[1fr_auto] gap-10 items-end">
          <div>
            <p className="font-mono text-xs text-[#7a8296]">Case 0142 · right frontal · 8.5 cm³</p>
            <h2 className="mt-4 font-serif text-4xl lg:text-5xl leading-[1.1] tracking-[-0.02em] text-[#eef0f5] max-w-2xl">
              Run a resection on the sample brain
            </h2>
            <p className="mt-4 text-lg leading-[30px] text-[#a3a9b8] max-w-xl">
              Load the sample case, move the tumor, change tissue stiffness and see the shift in 3D.
            </p>
          </div>
          <Link
            href="/axonive"
            className="h-12 px-5 inline-flex items-center justify-center rounded-lg bg-[#eef0f5] text-ink-950 font-medium hover:bg-white active:scale-[0.98] transition-[background-color,transform]"
          >
            Open the sandbox
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink-950 text-[#a3a9b8] pt-16 pb-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-6 gap-10 mb-12">
            <div className="md:col-span-3">
              <Logo tone="light" />
              <p className="mt-4 text-[15px] leading-6 max-w-sm">
                Brain shift simulation for neurosurgical planning.
              </p>
              <div className="mt-6 flex gap-2">
                {[
                  ['https://x.com/Daktardtm', 'X', 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'],
                  ['https://github.com/bblDiv', 'GitHub', 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z'],
                  ['https://www.linkedin.com/in/divye-rawat-463064375/', 'LinkedIn', 'M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z'],
                ].map(([href, label, d]) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-lg border border-white/[0.08] flex items-center justify-center text-[#7a8296] hover:text-[#eef0f5] hover:bg-white/[0.04] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={d} /></svg>
                  </a>
                ))}
              </div>
            </div>

            {[
              ['Product', [['Features', '#features'], ['How it works', '#how-it-works'], ['Sandbox', '/axonive']]],
              ['Developer', [['GitHub', 'https://github.com/bblDiv'], ['LinkedIn', 'https://www.linkedin.com/in/divye-rawat-463064375/']]],
              ['Legal', [['Privacy', '#'], ['Terms', '#']]],
            ].map(([title, links]) => (
              <div key={title as string}>
                <h4 className="text-sm font-medium text-[#eef0f5]">{title as string}</h4>
                <ul className="mt-4 space-y-3 text-[15px]">
                  {(links as string[][]).map(([label, href]) => (
                    <li key={label}>
                      <a href={href} className="hover:text-[#eef0f5] transition-colors">{label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/[0.08] pt-8 text-sm text-[#7a8296] flex flex-col md:flex-row justify-between gap-2">
            <p>© 2026 Axonive</p>
            <p>Research prototype. Not for clinical use.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
