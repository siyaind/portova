import Link from "next/link";

export function BrandMark({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true"><path d="M9 31V10h12a8 8 0 0 1 0 16h-7" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M16 17h6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><circle cx="30.5" cy="31" r="3" fill="currentColor" /></svg>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className={`brand ${compact ? "brand-compact" : ""}`} aria-label="Portova home"><span className="brand-symbol"><BrandMark /></span><span>portova<span className="brand-period">.</span></span></Link>;
}
