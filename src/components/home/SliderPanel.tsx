"use client";

import { Slider } from "@/components/ui/Slider";
import {
  descriptionRange,
  getMarketplace,
  keywordRange,
  titleRange,
} from "@/features/ai/marketplaces";
import { useSettingsStore } from "@/store/settingsStore";

/**
 * The 3 sliders: title length, description length, keyword count.
 * The selected marketplace decides what is available: with no title field (Shutterstock)
 * the title slider is greyed out, and a required description cannot be switched off.
 */
export function SliderPanel() {
  const constraints = useSettingsStore((s) => s.constraints);
  const setConstraints = useSettingsStore((s) => s.setConstraints);
  const marketplace = useSettingsStore((s) => s.marketplace);
  const market = getMarketplace(marketplace);
  const { hasTitle, descriptionRequired } = market.rules;
  const hasDescription = market.rules.descriptionSupported !== false;
  const range = descriptionRange(market.rules);
  const descriptionValue = Math.min(Math.max(constraints.descriptionLimit, range.min), range.max);
  const titleR = titleRange(market.rules);
  const keywordR = keywordRange(market.rules);
  const fit = (v: number, r: { min: number; max: number }) => Math.min(Math.max(v, r.min), r.max);

  return (
    <section
      aria-labelledby="metadata-limits-heading"
      className="rounded-lg border border-line bg-panel-2 p-5 md:p-6"
    >
      <div className="mb-5 flex items-center gap-2.5">
        <div
          className="grid h-[30px] w-[30px] place-items-center rounded-sm bg-panel-3 text-muted"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
            <circle cx="9" cy="7" r="2" fill="var(--c-panel-2)" />
            <circle cx="15" cy="12" r="2" fill="var(--c-panel-2)" />
            <circle cx="11" cy="17" r="2" fill="var(--c-panel-2)" />
          </svg>
        </div>
        <div>
          <h2 id="metadata-limits-heading" className="font-display text-sm font-bold tracking-tight">
            Metadata limits
          </h2>
          <p className="text-[10px] text-muted-2">Fine-tune your output</p>
        </div>
      </div>

      <div className="space-y-5">
        <div
          className={hasTitle ? undefined : "pointer-events-none select-none opacity-45"}
          aria-disabled={!hasTitle}
        >
          <Slider
            label="Title length"
            min={titleR.min}
            max={titleR.max}
            value={fit(constraints.titleLimit, titleR)}
            disabled={!hasTitle}
            onChange={(titleLimit) => setConstraints({ titleLimit })}
            formatValue={hasTitle ? undefined : () => "Not used"}
          />
          {hasTitle ? null : (
            <p className="mt-1 text-[10px] text-muted-2">{market.label} has no title field.</p>
          )}
        </div>
        <div
          className={hasDescription ? undefined : "pointer-events-none select-none opacity-45"}
          aria-disabled={!hasDescription}
        >
          <Slider
            label="Description length"
            min={hasDescription ? range.min : 0}
            max={hasDescription ? range.max : 1}
            value={hasDescription ? descriptionValue : 0}
            disabled={!hasDescription}
            onChange={(descriptionLimit) => setConstraints({ descriptionLimit })}
            formatValue={(v) => (!hasDescription ? "Not used" : v === 0 ? "Off" : String(v))}
          />
          <p className="mt-1 text-[10px] text-muted-2">
            {!hasDescription
              ? `${market.label} has no description field.`
              : descriptionRequired
                ? `${market.label} needs a description (up to ${range.max} characters).`
                : "Set to Off to skip descriptions."}
          </p>
        </div>
        <Slider
          label="Keyword count"
          min={keywordR.min}
          max={keywordR.max}
          value={fit(constraints.keywordCount, keywordR)}
          onChange={(keywordCount) => setConstraints({ keywordCount })}
        />
      </div>
    </section>
  );
}
