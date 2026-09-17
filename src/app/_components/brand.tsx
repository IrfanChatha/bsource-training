import { TrendingUp } from "lucide-react";

/**
 * The BSource Training wordmark. Rendered in both the site header and the
 * footer, so it lives on its own to keep the two in lockstep.
 */
export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary shadow-brand">
        <TrendingUp
          className="size-[18px] text-white"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </span>
      <span className="text-[15px] leading-none tracking-tight">
        <span className="font-bold text-foreground">BSource</span>{" "}
        <span className="text-muted-foreground">Training</span>
      </span>
    </span>
  );
}
