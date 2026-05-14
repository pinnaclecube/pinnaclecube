/**
 * driveFolderConfig.ts — Pinnacle³
 *
 * Single source of truth for the Google Drive folder structure created for
 * every case. All folder-creation logic reads from this config — never
 * hardcodes folder names or tree layout elsewhere.
 *
 * Types mirror the DB enums in lib/db/src/schema/drive.ts:
 *   folderTypeEnum  → "root" | "resume" | "evidence" | "demographics" | "exhibits" | "criteria"
 *   visaCategoryEnum → "EB1A" | "NIW" | "O1A"
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FolderType = "root" | "resume" | "evidence" | "demographics" | "exhibits" | "criteria";
export type VisaCategory = "EB1A" | "NIW" | "O1A";

export interface TopLevelFolderDef {
  name: string;
  type: Exclude<FolderType, "root" | "criteria">;
}

export interface CriterionFolderDef {
  /** Display name used as the Drive subfolder name. */
  name: string;
  /** Zero-based index used for ordering and the criteria_index DB column. */
  index: number;
}

export interface VisaFolderStructure {
  /** Ordered list of top-level folders created under the case root. */
  topLevel: TopLevelFolderDef[];
  /** Ordered criteria subfolders created inside the Evidence folder. */
  criteria: CriterionFolderDef[];
}

// ─── Shared top-level folders (identical for every visa category) ──────────────

const TOP_LEVEL_FOLDERS: TopLevelFolderDef[] = [
  { name: "Resume",       type: "resume"       },
  { name: "Evidence",     type: "evidence"     },
  { name: "Demographics", type: "demographics" },
  { name: "Exhibits",     type: "exhibits"     },
];

// ─── Per-visa criteria ────────────────────────────────────────────────────────

const EB1A_CRITERIA: CriterionFolderDef[] = [
  { name: "Extraordinary Ability Awards",      index: 0 },
  { name: "Membership in Associations",        index: 1 },
  { name: "Published Material About the Alien", index: 2 },
  { name: "Judge of Others' Work",             index: 3 },
  { name: "Original Contributions",            index: 4 },
  { name: "Scholarly Articles",                index: 5 },
  { name: "Artistic Exhibitions",              index: 6 },
  { name: "Leading or Critical Role",          index: 7 },
  { name: "High Salary",                       index: 8 },
  { name: "Commercial Success",                index: 9 },
];

const NIW_CRITERIA: CriterionFolderDef[] = [
  { name: "Substantial Merit and National Importance", index: 0 },
  { name: "Well Positioned to Advance",               index: 1 },
  { name: "Balance of Benefits",                      index: 2 },
];

const O1A_CRITERIA: CriterionFolderDef[] = [
  { name: "Awards/Prizes",         index: 0 },
  { name: "Membership",            index: 1 },
  { name: "Press/Media Coverage",  index: 2 },
  { name: "Judging",               index: 3 },
  { name: "Original Contributions", index: 4 },
  { name: "Scholarly Articles",    index: 5 },
  { name: "Critical Role",         index: 6 },
  { name: "High Remuneration",     index: 7 },
];

// ─── Main export ──────────────────────────────────────────────────────────────

export const VISA_FOLDER_STRUCTURE: Record<VisaCategory, VisaFolderStructure> = {
  EB1A: {
    topLevel: TOP_LEVEL_FOLDERS,
    criteria: EB1A_CRITERIA,
  },
  NIW: {
    topLevel: TOP_LEVEL_FOLDERS,
    criteria: NIW_CRITERIA,
  },
  O1A: {
    topLevel: TOP_LEVEL_FOLDERS,
    criteria: O1A_CRITERIA,
  },
};

// ─── Convenience helpers ──────────────────────────────────────────────────────

/** Returns the ordered list of criteria folder definitions for a given visa category. */
export function getCriteriaFolders(visaCategory: VisaCategory): CriterionFolderDef[] {
  return VISA_FOLDER_STRUCTURE[visaCategory].criteria;
}

/** Returns the ordered top-level folder definitions for a given visa category. */
export function getTopLevelFolders(visaCategory: VisaCategory): TopLevelFolderDef[] {
  return VISA_FOLDER_STRUCTURE[visaCategory].topLevel;
}

/** Total number of folders (top-level + criteria) that will be created for a case. */
export function totalFolderCount(visaCategory: VisaCategory): number {
  const { topLevel, criteria } = VISA_FOLDER_STRUCTURE[visaCategory];
  return 1 /* root */ + topLevel.length + criteria.length;
}
