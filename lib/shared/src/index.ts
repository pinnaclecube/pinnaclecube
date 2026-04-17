export const APP_NAME = "Pinnacle³";

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

export const ACCESS_LEVELS = [
  "free",
  "evidence_vault",
  "excellence_lab",
  "elite_blueprint",
  "all",
] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const EVIDENCE_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const MILESTONE_STATUSES = [
  "not_started",
  "in_progress",
  "complete",
  "blocked",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export * from "./disclaimers";
export * from "./criteriaFolders";
