"use client";
import Link from 'next/link';
import { Logo } from './Logo';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-paper/90 backdrop-blur-md border-b border-navy-deep/[0.08]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Logo />

        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-[15px] text-fg-2 hover:text-fg transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-[15px] text-fg-2 hover:text-fg transition-colors">
            How it works
          </a>
          <Link
            href="/axonive"
            className="h-9 px-4 inline-flex items-center rounded-lg bg-navy-deep text-white text-sm font-medium hover:bg-[#12345a] transition-colors"
          >
            Open sandbox
          </Link>
        </div>

        <Link
          href="/axonive"
          className="md:hidden h-9 px-4 inline-flex items-center rounded-lg bg-navy-deep text-white text-sm font-medium"
        >
          Open sandbox
        </Link>
      </div>
    </nav>
  );
}
