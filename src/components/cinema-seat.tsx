export function CinemaSeat({ className = "" }: { className?: string }) {
  return <svg className={"cinema-seat-symbol " + className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <rect x="8" y="3" width="24" height="25" rx="6" fill="currentColor" />
    <rect x="2" y="15" width="5" height="17" rx="2" fill="currentColor" />
    <rect x="33" y="15" width="5" height="17" rx="2" fill="currentColor" />
    <path d="M7 27h26v3a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4v-3Z" fill="currentColor" />
    <path d="M11 34v3m18-3v3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
