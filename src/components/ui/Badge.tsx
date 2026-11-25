import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "danger" | "neutral" | "info";

const TONES: Record<Tone, string> = {
  success: "bg-ok text-white",
  danger: "bg-bad text-white",
  neutral: "bg-panel-3 text-muted border border-line",
  info: "bg-brand text-white",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold",
        "transition-colors duration-300",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
