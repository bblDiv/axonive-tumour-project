import Link from 'next/link';

// Flat Axonive mark: one soma with five axons, drawn in the current text color
export function LogoMark({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        d="M128 128 L128 38 M128 128 L213 90 M128 128 L180 210 M128 128 L76 210 M128 128 L43 90"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <circle cx="128" cy="128" r="34" fill="currentColor" />
      <circle cx="128" cy="38" r="20" fill="currentColor" />
      <circle cx="213" cy="90" r="20" fill="currentColor" />
      <circle cx="180" cy="210" r="20" fill="currentColor" />
      <circle cx="76" cy="210" r="20" fill="currentColor" />
      <circle cx="43" cy="90" r="20" fill="currentColor" />
    </svg>
  );
}

export function Logo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-2 ${tone === 'dark' ? 'text-navy-deep' : 'text-[#eef0f5]'}`}
    >
      <LogoMark className="w-6 h-6" />
      <span className="text-lg font-semibold tracking-tight">Axonive</span>
    </Link>
  );
}
