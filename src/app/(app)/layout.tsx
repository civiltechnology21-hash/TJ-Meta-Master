"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { startCsvAutoSave } from "@/features/csv/autoSave";
import { ROUTES } from "@/lib/constants";
import { useBatchStore } from "@/store/batchStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useUiStore } from "@/store/uiStore";

/** Shell for every logged-in page: top bar + page content + Settings window. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const batchStatus = useBatchStore((s) => s.status);

  useEffect(() => {
    useSettingsStore.getState().hydrate();
    return startCsvAutoSave(); // saves finished batches to the database as CSV
  }, []);

  const showStop = pathname === ROUTES.results && batchStatus === "running";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        onOpenSettings={() => useUiStore.getState().openSettings()}
        showStop={showStop}
        onStop={() => useBatchStore.getState().abort()}
      />
      <main className="flex-1">{children}</main>
      <SettingsModal />
    </div>
  );
}
