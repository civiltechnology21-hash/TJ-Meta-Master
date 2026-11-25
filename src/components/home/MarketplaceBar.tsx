"use client";

import { MARKETPLACES } from "@/features/ai/marketplaces";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/settingsStore";

/** One button per marketplace. The selected one decides the generation rules. */
export function MarketplaceBar() {
  const selected = useSettingsStore((s) => s.marketplace);
  const setMarketplace = useSettingsStore((s) => s.setMarketplace);

  return (
    <div
      role="radiogroup"
      aria-label="Marketplace"
      className="mb-8 flex flex-wrap items-center justify-center gap-2"
    >
      {MARKETPLACES.map((m) => {
        const active = m.id === selected;
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMarketplace(m.id)}
            className={cn(
              "inline-flex h-10 items-center gap-2.5 rounded-md border px-5 text-[13px] font-bold",
              "transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out",
              "hover:-translate-y-px active:translate-y-0 active:scale-[0.98]",
              active
                ? "border-brand bg-brand text-white shadow-[0_5px_18px_var(--c-brand-wash)] hover:bg-brand-hover"
                : "border-line-strong bg-field text-fg hover:border-brand",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "block h-2 w-2 rounded-[2px] border-[1.5px] transition-colors",
                active ? "border-white/80" : "border-muted-2",
              )}
            />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
