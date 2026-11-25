"use client";

import { useId, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  /** Text shown instead of the number (e.g. "Off" at 0). */
  formatValue?: (value: number) => string;
  className?: string;
}

/** Blue range slider with a light handle; the label is on the left, the live number on the right. */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  onChange,
  formatValue,
  className,
}: SliderProps) {
  const id = useId();
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-medium text-fg">
          {label}
        </label>
        <output
          htmlFor={id}
          className="min-w-10 text-right font-display text-[13px] font-bold tabular-nums"
        >
          {formatValue ? formatValue(value) : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="tj-range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ "--pct": `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
