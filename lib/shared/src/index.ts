export const APP_NAME = "Pinnacle³";

export const DISCLAIMER_VERSION = "1.0";

export const DISCLAIMER_TEXT =
  "Pinnacle³ is not a law firm and does not provide legal advice. All content is for informational and advisory purposes only. Always consult a licensed immigration attorney before making any immigration decisions.";

export const AI_DISCLAIMER_TEXT =
  "AI-generated content — verify with your attorney.";

export type VisaPath = {
  id: string;
  name: string;
  fullName: string;
  description: string;
};

export const VISA_PATHS: VisaPath[] = [
  {
    id: "eb1a",
    name: "EB-1A",
    fullName: "EB-1A Extraordinary Ability",
    description:
      "For individuals with extraordinary ability in sciences, arts, education, business, or athletics.",
  },
  {
    id: "eb2niw",
    name: "EB-2 NIW",
    fullName: "EB-2 National Interest Waiver",
    description:
      "For advanced degree professionals whose work is in the national interest of the United States.",
  },
  {
    id: "o1a",
    name: "O-1A",
    fullName: "O-1A Extraordinary Ability",
    description:
      "Non-immigrant visa for individuals with extraordinary ability in sciences, education, business, or athletics.",
  },
];

export const EB1A_CRITERIA = [
  { id: "awards", label: "Major Awards or Prizes" },
  { id: "membership", label: "Membership in Selective Associations" },
  { id: "press", label: "Published Material About You" },
  { id: "judging", label: "Participation as a Judge" },
  { id: "original_contributions", label: "Original Contributions of Major Significance" },
  { id: "scholarly_articles", label: "Authorship of Scholarly Articles" },
  { id: "critical_role", label: "Critical Role in Distinguished Organizations" },
  { id: "high_salary", label: "High Salary or Remuneration" },
  { id: "commercial_success", label: "Commercial Success in Performing Arts" },
  { id: "exhibitions", label: "Artistic Exhibitions or Showcases" },
] as const;

export type CriterionId = (typeof EB1A_CRITERIA)[number]["id"];

export const ACCESS_LEVELS = ["free", "evidence_vault", "excellence_lab", "elite_blueprint", "all"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const EVIDENCE_STATUSES = ["draft", "pending", "approved", "rejected"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const MILESTONE_STATUSES = ["not_started", "in_progress", "complete", "blocked"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];
