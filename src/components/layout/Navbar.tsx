"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand.generated";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { BrandNameImage } from "@/components/ui/BrandNameImage";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface NavbarProps {
  onOpenSettings: () => void;
  /** Results page only: show the red "stop everything" button. */
  showStop?: boolean;
  onStop?: () => void;
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function Navbar({ onOpenSettings, showStop = false, onStop }: NavbarProps) {
  const pathname = usePathname();
  const onResults = pathname === ROUTES.results;

  return (
    <header className="sticky top-0 z-40 flex h-[70px] shrink-0 items-center justify-between gap-4 border-b border-line bg-bar px-[clamp(1rem,3.15vw,3rem)] backdrop-blur-md">
      {onResults ? (
        <Link
          href={ROUTES.home}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-panel-2 px-4 text-sm font-semibold text-muted transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-panel-3 hover:text-fg active:translate-y-0 active:scale-[0.98]"
        >
          <span aria-hidden="true">←</span> Home
        </Link>
      ) : (
        <Link href={ROUTES.home} className="flex items-center gap-3" aria-label={APP_NAME}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logo} alt="" className="h-10 w-10 rounded-lg object-contain" />
          {BRAND.name ? (
            <BrandNameImage alt={APP_NAME} className="h-8 w-auto" />
          ) : (
            <span className="font-mono text-lg font-semibold tracking-tight">{APP_NAME}</span>
          )}
        </Link>
      )}

      <div className="flex items-center gap-2.5">
        {showStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop all running requests"
            title="Stop all running requests"
            className="animate-pop flex h-10 w-12 items-center justify-center rounded-md bg-bad text-white transition-[background-color,transform] duration-200 hover:bg-bad-hover active:scale-[0.96]"
          >
            <span className="block h-3 w-3 rounded-[2px] bg-white" />
          </button>
        ) : null}
        <ThemeToggle />
        <Button onClick={onOpenSettings} aria-label="Settings">
          <GearIcon /> <span className="max-sm:hidden">Settings</span>
        </Button>
      </div>
    </header>
  );
}
