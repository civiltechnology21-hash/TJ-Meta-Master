import type { MarketplaceRules, UserConstraints } from "@/types/metadata";
import type { NegativePolicy } from "@/types/negative";
import { ADOBE_STOCK_RULES, buildAdobeStockInstruction } from "./adobeStock";
import { buildShutterstockInstruction, SHUTTERSTOCK_RULES } from "./shutterstock";

/**
 * One entry per marketplace button on the Home page. Only ONE marketplace is used per batch.
 * To add a marketplace later: create its rules file (rules + instruction) and add ONE entry here.
 */
export interface Marketplace {
  id: string;
  /** Button text. */
  label: string;
  /** Structure of the metadata: which fields exist, CSV columns, limits. */
  rules: MarketplaceRules;
  /** System instruction (the rules) sent to Gemini for this marketplace. */
  buildInstruction: (constraints: UserConstraints, negative?: NegativePolicy | null) => string;
}

export const MARKETPLACES: readonly Marketplace[] = [
  {
    id: "adobe-stock",
    label: "Adobe Stock",
    rules: ADOBE_STOCK_RULES,
    buildInstruction: buildAdobeStockInstruction,
  },
  {
    id: "shutterstock",
    label: "Shutterstock",
    rules: SHUTTERSTOCK_RULES,
    buildInstruction: buildShutterstockInstruction,
  },
];

export const DEFAULT_MARKETPLACE_ID = "adobe-stock";

export function getMarketplace(id: string | null | undefined): Marketplace {
  return MARKETPLACES.find((m) => m.id === id) ?? MARKETPLACES[0]!;
}

/** Description slider cannot go below this when the marketplace requires a description. */
export const REQUIRED_DESCRIPTION_MIN = 50;

/** Lowest / highest description length the slider may use for this marketplace. */
export function descriptionRange(rules: MarketplaceRules): { min: number; max: number } {
  return {
    min: rules.descriptionRequired ? REQUIRED_DESCRIPTION_MIN : 0,
    max: rules.descriptionMax ?? 400,
  };
}

/**
 * The limits a batch really runs with: the slider values, adjusted to what the
 * marketplace allows (e.g. Shutterstock: description always on, at most 200 characters).
 * The saved slider values are never changed, so switching marketplace is lossless.
 */
export function effectiveConstraints(
  rules: MarketplaceRules,
  constraints: UserConstraints,
): UserConstraints {
  const { min, max } = descriptionRange(rules);
  const wanted = constraints.descriptionLimit;
  const descriptionLimit =
    wanted <= 0 ? (rules.descriptionRequired ? max : 0) : Math.min(Math.max(wanted, min), max);
  return { ...constraints, descriptionLimit };
}
