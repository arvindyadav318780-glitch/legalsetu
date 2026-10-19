import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ inverted, compact }: { inverted?: boolean; compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="LegalSetu home">
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg", inverted ? "bg-accent" : "bg-navy")}>
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-navy-foreground" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M3 17c3-6 15-6 18 0" />
          <path d="M6 17v-3M12 17v-5M18 17v-3" />
          <path d="M2 17h20" />
        </svg>
      </span>
      {!compact && (
        <span className={cn("text-lg font-bold tracking-tight", inverted ? "text-navy-foreground" : "text-navy")}>
          Legal<span className="text-accent">Setu</span>
        </span>
      )}
    </Link>
  );
}
