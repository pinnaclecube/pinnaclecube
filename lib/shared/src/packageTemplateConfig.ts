/**
 * packageTemplateConfig.ts — Evidence Package module template config (spec §8).
 *
 * The single home for document roles, section orders (spec §2 layer 3), the
 * EB-1A criteria + their 8 CFR citations, the exhibit-code scheme (§2 layer 2),
 * and the house-style constants (§2 layer 4). Both the renderer (api-server) and
 * the template importer (scripts) import this via @workspace/shared.
 *
 * templateVersion 1 is the spec-seeded baseline. Reconciliation against the real
 * _Templates docx (scripts/src/importTemplateFromDrive.ts → the .draft.json) is
 * deferred until Drive access is available; applying those differences will bump
 * the version.
 */

export const PACKAGE_TEMPLATE_VERSION = 1;

export type DocRole = "sub_exhibit" | "criterion" | "index" | "final_merits";

export interface HouseStyle {
  bodyFont: string;
  bodySizePt: number;
  headingSizesPt: { h1: number; h2: number; h3: number };
  accentColor: string; // title block only
  marginInches: number;
  lineSpacing: number;
  paraSpacingAfterPt: number;
  figureMaxWidthInches: number;
  figureCaptionSizePt: number;
  figureCaptionItalic: boolean;
  figureCaptionFormat: string; // {code}.{k}, {source}, {desc}
  draftWatermark: string;
  citationFormat: string; // {code}
  footerFormat: string; // {displayNumber}, {code}
}

export const EB1A_HOUSE_STYLE: HouseStyle = {
  bodyFont: "Times New Roman",
  bodySizePt: 12,
  headingSizesPt: { h1: 16, h2: 13, h3: 12 },
  accentColor: "#1E2D6B",
  marginInches: 1,
  lineSpacing: 1.15,
  paraSpacingAfterPt: 8,
  figureMaxWidthInches: 6.0,
  figureCaptionSizePt: 10,
  figureCaptionItalic: true,
  figureCaptionFormat: "Figure {code}.{k}: {source} — {desc}",
  draftWatermark: "DRAFT — FOR STAFF REVIEW",
  citationFormat: "[Exhibit {code}]",
  footerFormat: "Exhibit {displayNumber} · {code} · page {page} of {pages}",
};

export interface SectionDef {
  key: string;
  heading: string;
  regulation?: string;
}

export interface RoleTemplate {
  role: DocRole;
  sections: SectionDef[];
}

export interface CriterionDef {
  letter: string; // A..J (exhibit-code prefix)
  key: string; // normalized criterion key (matches evidence_groups.criterion_folder)
  name: string;
  regulation: string;
}

export interface VisaPackageTemplate {
  visaCategory: "EB1A";
  templateVersion: number;
  houseStyle: HouseStyle;
  criteria: CriterionDef[];
  roles: Record<DocRole, RoleTemplate>;
}

// ─── EB-1A criteria — 8 C.F.R. § 204.5(h)(3)(i)–(x) ─────────────────────────────

const EB1A_CRITERIA: CriterionDef[] = [
  { letter: "A", key: "extraordinary_ability_awards", name: "Extraordinary Ability Awards", regulation: "8 C.F.R. § 204.5(h)(3)(i)" },
  { letter: "B", key: "membership_in_associations", name: "Membership in Associations", regulation: "8 C.F.R. § 204.5(h)(3)(ii)" },
  { letter: "C", key: "published_material_about_the_alien", name: "Published Material About the Alien", regulation: "8 C.F.R. § 204.5(h)(3)(iii)" },
  { letter: "D", key: "judge_of_others_work", name: "Judge of Others' Work", regulation: "8 C.F.R. § 204.5(h)(3)(iv)" },
  { letter: "E", key: "original_contributions", name: "Original Contributions", regulation: "8 C.F.R. § 204.5(h)(3)(v)" },
  { letter: "F", key: "scholarly_articles", name: "Scholarly Articles", regulation: "8 C.F.R. § 204.5(h)(3)(vi)" },
  { letter: "G", key: "artistic_exhibitions", name: "Artistic Exhibitions", regulation: "8 C.F.R. § 204.5(h)(3)(vii)" },
  { letter: "H", key: "leading_or_critical_role", name: "Leading or Critical Role", regulation: "8 C.F.R. § 204.5(h)(3)(viii)" },
  { letter: "I", key: "high_salary", name: "High Salary", regulation: "8 C.F.R. § 204.5(h)(3)(ix)" },
  { letter: "J", key: "commercial_success", name: "Commercial Success", regulation: "8 C.F.R. § 204.5(h)(3)(x)" },
];

// ─── Section orders per role (spec §2 layer 3) ──────────────────────────────────

const EB1A_ROLES: Record<DocRole, RoleTemplate> = {
  sub_exhibit: {
    role: "sub_exhibit",
    sections: [
      { key: "title_block", heading: "" }, // header comes from the exhibit code
      { key: "source_summary", heading: "Summary of Evidence" },
      { key: "figures", heading: "Supporting Documents" },
      { key: "relevance_note", heading: "Relevance" },
    ],
  },
  criterion: {
    role: "criterion",
    sections: [
      { key: "title_block", heading: "" },
      { key: "regulatory_standard", heading: "Regulatory Standard", regulation: "8 C.F.R. § 204.5(h)(3)" },
      { key: "evidence_summary", heading: "Evidence Submitted" },
      { key: "argument", heading: "Argument" },
      { key: "conclusion", heading: "Conclusion" },
    ],
  },
  final_merits: {
    role: "final_merits",
    sections: [
      { key: "title_block", heading: "" },
      { key: "introduction", heading: "Introduction" },
      { key: "criteria_met", heading: "Criteria Met" },
      { key: "totality_argument", heading: "Final Merits Determination", regulation: "8 C.F.R. § 204.5(h)(2); Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010)" },
      { key: "exhibit_index", heading: "Index of Exhibits" },
      { key: "conclusion", heading: "Conclusion" },
    ],
  },
  index: {
    role: "index",
    sections: [
      { key: "title_block", heading: "" },
      { key: "exhibit_table", heading: "Index of Exhibits" },
    ],
  },
};

export const PACKAGE_TEMPLATES: Record<"EB1A", VisaPackageTemplate> = {
  EB1A: {
    visaCategory: "EB1A",
    templateVersion: PACKAGE_TEMPLATE_VERSION,
    houseStyle: EB1A_HOUSE_STYLE,
    criteria: EB1A_CRITERIA,
    roles: EB1A_ROLES,
  },
};

// ─── Exhibit-code scheme (spec §2 layer 2) ──────────────────────────────────────

export const INDEX_CODE = "INDEX";
export const FINAL_MERITS_CODE = "FM";

export function criterionByKey(key: string | null | undefined): CriterionDef | undefined {
  return EB1A_CRITERIA.find((c) => c.key === key);
}
export function criterionByLetter(letter: string): CriterionDef | undefined {
  return EB1A_CRITERIA.find((c) => c.letter === letter.toUpperCase());
}

/** Stable sub-exhibit code, e.g. ("original_contributions", 2) -> "E2". */
export function subExhibitCode(criterionKey: string, seq: number): string {
  const c = criterionByKey(criterionKey);
  return `${c?.letter ?? "Z"}${seq}`;
}
/** Criterion-document code is the bare letter, e.g. "E". */
export function criterionCode(criterionKey: string): string {
  return criterionByKey(criterionKey)?.letter ?? "Z";
}

export interface CodeDescription {
  code: string;
  role: DocRole;
  criterion?: CriterionDef;
  headerTitle: string;
}

/** Resolve a code to its role + criterion + header title (headers derive from the
 * code, never from model text — spec §2 layer 2). */
export function describeExhibitCode(code: string): CodeDescription {
  const upper = code.toUpperCase();
  if (upper === INDEX_CODE) return { code: upper, role: "index", headerTitle: "Index of Exhibits" };
  if (upper === FINAL_MERITS_CODE) return { code: upper, role: "final_merits", headerTitle: "Final Merits Brief" };
  const m = upper.match(/^([A-J])(\d+)$/);
  if (m) {
    const crit = criterionByLetter(m[1]);
    return { code: upper, role: "sub_exhibit", criterion: crit, headerTitle: `Exhibit ${upper} — ${crit?.name ?? "Evidence"}` };
  }
  const crit = criterionByLetter(upper);
  if (crit && upper.length === 1) {
    return { code: upper, role: "criterion", criterion: crit, headerTitle: crit.name };
  }
  return { code: upper, role: "sub_exhibit", headerTitle: `Exhibit ${upper}` };
}
