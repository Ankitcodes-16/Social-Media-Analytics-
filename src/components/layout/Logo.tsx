export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-signal">
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-28 12 12)" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(32 12 12)" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <circle cx="20.3" cy="8.2" r="1.3" fill="currentColor" />
    </svg>
  );
}
