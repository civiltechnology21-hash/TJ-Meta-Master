import { create } from "zustand";
import { getMarketplace, DEFAULT_MARKETPLACE_ID } from "@/features/ai/marketplaces";
import { emptyNegativeInput, sanitizeNegativeInput } from "@/features/negative/policy";
import { DEFAULT_CONSTRAINTS } from "@/lib/constants";
import {
  clearApiKey,
  loadApiKey,
  loadConstraints,
  loadMarketplace,
  loadNegativeInput,
  saveMarketplace,
  sanitizeConstraints,
  saveApiKey,
  saveConstraints,
  saveNegativeInput,
} from "@/lib/storage";
import type { UserConstraints } from "@/types/metadata";
import type { NegativePromptInput } from "@/types/negative";

interface SettingsState {
  constraints: UserConstraints;
  /** Selected marketplace (decides the generation rules). */
  marketplace: string;
  /** Gemini API key (kept in this browser only). */
  apiKey: string;
  /** What the user typed in the "Negative Prompts" card (kept in this browser only). */
  negativeInput: NegativePromptInput;
  hydrated: boolean;
  /** Load saved values from localStorage. Call once after mount (avoids SSR mismatch). */
  hydrate: () => void;
  setMarketplace: (id: string) => void;
  setConstraints: (patch: Partial<UserConstraints>) => void;
  /** Updates the Negative Prompt titles and/or keywords (limits are enforced here). */
  setNegativeInput: (patch: Partial<NegativePromptInput>) => void;
  /** Saves a new key and replaces the old one. Returns false if empty / not saved. */
  setApiKey: (key: string) => boolean;
  removeApiKey: () => void;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  constraints: { ...DEFAULT_CONSTRAINTS },
  marketplace: DEFAULT_MARKETPLACE_ID,
  apiKey: "",
  negativeInput: emptyNegativeInput(),
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    set({
      constraints: loadConstraints(),
      marketplace: getMarketplace(loadMarketplace()).id,
      apiKey: loadApiKey(),
      negativeInput: loadNegativeInput(),
      hydrated: true,
    });
  },

  setMarketplace: (id) => {
    const next = getMarketplace(id).id;
    saveMarketplace(next);
    set({ marketplace: next });
  },

  setConstraints: (patch) => {
    const next = sanitizeConstraints({ ...get().constraints, ...patch });
    saveConstraints(next);
    set({ constraints: next });
  },

  setNegativeInput: (patch) => {
    const next = sanitizeNegativeInput({ ...get().negativeInput, ...patch });
    saveNegativeInput(next);
    set({ negativeInput: next });
  },

  setApiKey: (key) => {
    const trimmed = key.trim();
    if (!trimmed || !saveApiKey(trimmed)) return false;
    set({ apiKey: trimmed });
    return true;
  },

  removeApiKey: () => {
    clearApiKey();
    set({ apiKey: "" });
  },
}));
