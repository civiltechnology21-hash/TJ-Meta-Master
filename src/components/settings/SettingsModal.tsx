"use client";

import { useState } from "react";
import { logout } from "@/app/login/actions";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/uiStore";
import { ApiKeyTab } from "./ApiKeyTab";
import { CsvHistoryTab } from "./CsvHistoryTab";

type TabId = "api" | "csv";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "api", label: "API Configuration" },
  { id: "csv", label: "CSV Export" },
];

/** Large (~92% of the screen) settings window with a side menu. */
export function SettingsModal() {
  const open = useUiStore((s) => s.settingsOpen);
  const close = useUiStore((s) => s.closeSettings);
  const [tab, setTab] = useState<TabId>("api");

  return (
    <Modal open={open} onClose={close} title="Settings">
      <div className="flex min-h-full flex-col md:flex-row">
        <nav
          role="tablist"
          aria-label="Settings sections"
          className="flex shrink-0 flex-row gap-1 border-b border-line bg-bar p-2 md:w-56 md:flex-col md:border-b-0 md:border-r"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-3 py-2.5 text-left text-sm transition-[background-color,color,box-shadow] duration-200",
                tab === t.id
                  ? "bg-panel-3 font-semibold text-fg shadow-[inset_3px_0_0_var(--c-brand)]"
                  : "text-muted shadow-[inset_0_0_0_var(--c-brand)] hover:bg-panel-3/60 hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}

          <form action={logout} className="ml-auto md:ml-0 md:mt-auto">
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2.5 text-left text-sm text-muted transition-colors duration-200 hover:bg-panel-3/60 hover:text-bad-fg"
            >
              Log out
            </button>
          </form>
        </nav>

        <div key={tab} role="tabpanel" className="animate-fade min-w-0 flex-1">
          {tab === "api" ? <ApiKeyTab /> : <CsvHistoryTab />}
        </div>
      </div>
    </Modal>
  );
}
