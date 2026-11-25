/** Metadata generated for ONE file. */
export interface MetaResult {
  /** Empty when the marketplace has no title field (e.g. Shutterstock). */
  title: string;
  description: string;
  keywords: string[];
  /** Only for marketplaces that use categories (e.g. Shutterstock). */
  categories?: string[];
}

export type CsvColumnId = "filename" | "title" | "description" | "keywords" | "categories";

/** What a marketplace needs from the metadata. One object per marketplace. */
export interface MarketplaceRules {
  /** false = no title is requested, validated or exported. */
  hasTitle: boolean;
  /** true = the description cannot be switched off. */
  descriptionRequired: boolean;
  /** Longest description the marketplace accepts (characters). */
  descriptionMax?: number;
  /** Fewest keywords the marketplace accepts (default 5). */
  minKeywords?: number;
  /** Allowed category names. Present = categories are generated, validated and exported. */
  categories?: readonly string[];
  /** How many categories to pick (default 2). */
  categoryCount?: number;
  /** CSV columns, in order. */
  csvColumns: readonly CsvColumnId[];
}

/** The 3 slider values chosen by the user on the Home page. */
export interface UserConstraints {
  /** Max title length in characters. */
  titleLimit: number;
  /** Max description length in characters. */
  descriptionLimit: number;
  /** Max number of keywords. */
  keywordCount: number;
}

/** Counts shown under each metadata box in a result card. */
export interface MetaCounts {
  titleWords: number;
  titleChars: number;
  descriptionWords: number;
  descriptionChars: number;
  keywordCount: number;
}
