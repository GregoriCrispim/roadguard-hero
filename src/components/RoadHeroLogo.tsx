import { Shield } from "lucide-react";

export function RoadHeroLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary glow-primary">
        <Shield className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <span className="font-display text-lg font-bold tracking-tight">
        Road<span className="text-gradient">Hero</span>
      </span>
    </div>
  );
}