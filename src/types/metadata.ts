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
  /** false = the marketplace has no description field (default true). */
  descriptionSupported?: boolean;
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

  /* ---- hard limits and checks that belong to ONE marketplace only ---- */
  /** Longest title (characters, full stop included). */
  titleMax?: number;
  /** Shortest title that is accepted. */
  titleMinChars?: number;
  /** Title: no commas, colons, slashes, quotes, hashtags, emojis, ALL CAPS. */
  titleStrict?: boolean;
  /** Every meaningful title word must be inside the first N keywords. */
  titleWordsInTopKeywords?: number;
  /** Most keywords the marketplace accepts. */
  keywordMax?: number;
  /** A word stem may appear in at most this many keywords. */
  stemCap?: number;
  /** Words/phrases that may never appear in the title, description or keywords. */
  bannedTerms?: readonly string[];
  /** Keywords that are silently removed (fillers, evaluatives). */
  droppedKeywords?: readonly string[];
  /** Description needs at least this many words. */
  descriptionMinWords?: number;
  /** Description may only use letters, digits, spaces, commas, periods, hyphens, apostrophes. */
  descriptionSafeChars?: boolean;
  /** The description may not repeat a word (or word stem). */
  noRepeatedDescriptionWords?: boolean;
  /** Used (first one allowed for the file type) when the AI never gives a valid category. */
  fallbackCategories?: readonly string[];
  /** Categories that cannot be used for video files. */
  categoriesNotForVideo?: readonly string[];
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
