export type VisaPathKey = "eb1a" | "niw" | "o1";

export type CriteriaEntry = {
  folderName: string;
  displayName: string;
  legalStandard: string;
  visaPath: VisaPathKey;
  displayOrder: number;
};

export type CriteriaFolderMap = Record<string, CriteriaEntry>;

export const CRITERIA_FOLDER_MAP: CriteriaFolderMap = {
  // EB-1A (10 criteria)
  "EB1A-01": {
    folderName: "EB1A-01_Awards_and_Prizes",
    displayName: "Awards and prizes",
    legalStandard:
      "Documentation of the alien's receipt of nationally or internationally recognized prizes or awards for excellence in the field of endeavor.",
    visaPath: "eb1a",
    displayOrder: 1,
  },
  "EB1A-02": {
    folderName: "EB1A-02_Membership",
    displayName: "Membership",
    legalStandard:
      "Documentation of the alien's membership in associations in the field which require outstanding achievements of their members, as judged by recognized national or international experts.",
    visaPath: "eb1a",
    displayOrder: 2,
  },
  "EB1A-03": {
    folderName: "EB1A-03_Press_and_Media",
    displayName: "Press and media",
    legalStandard:
      "Published material about the alien in professional or major trade publications or other major media, relating to the alien's work in the field.",
    visaPath: "eb1a",
    displayOrder: 3,
  },
  "EB1A-04": {
    folderName: "EB1A-04_Judging_Others",
    displayName: "Judging others",
    legalStandard:
      "Evidence of the alien's participation, either individually or on a panel, as a judge of the work of others in the same or an allied field of specialization.",
    visaPath: "eb1a",
    displayOrder: 4,
  },
  "EB1A-05": {
    folderName: "EB1A-05_Original_Contributions",
    displayName: "Original contributions",
    legalStandard:
      "Evidence of the alien's original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.",
    visaPath: "eb1a",
    displayOrder: 5,
  },
  "EB1A-06": {
    folderName: "EB1A-06_Scholarly_Articles",
    displayName: "Scholarly articles",
    legalStandard:
      "Evidence of the alien's authorship of scholarly articles in the field, in professional or major trade publications or other major media.",
    visaPath: "eb1a",
    displayOrder: 6,
  },
  "EB1A-07": {
    folderName: "EB1A-07_Critical_Role",
    displayName: "Critical role",
    legalStandard:
      "Evidence that the alien has performed in a leading or critical role for organizations or establishments that have a distinguished reputation.",
    visaPath: "eb1a",
    displayOrder: 7,
  },
  "EB1A-08": {
    folderName: "EB1A-08_High_Salary",
    displayName: "High salary",
    legalStandard:
      "Evidence that the alien has commanded a high salary or other significantly high remuneration for services, in relation to others in the field.",
    visaPath: "eb1a",
    displayOrder: 8,
  },
  "EB1A-09": {
    folderName: "EB1A-09_Commercial_Success",
    displayName: "Commercial success",
    legalStandard:
      "Evidence of commercial successes in the performing arts, as shown by box office receipts or record, cassette, compact disk, or video sales.",
    visaPath: "eb1a",
    displayOrder: 9,
  },
  "EB1A-10": {
    folderName: "EB1A-10_Exhibitions",
    displayName: "Exhibitions",
    legalStandard:
      "Evidence of the display of the alien's work in the field at artistic exhibitions or showcases.",
    visaPath: "eb1a",
    displayOrder: 10,
  },

  // EB-2 NIW (8 prongs)
  "NIW-01": {
    folderName: "NIW-01_Substantial_Merit",
    displayName: "Substantial merit",
    legalStandard:
      "The proposed endeavor has substantial merit and national importance in business, science, technology, culture, health, or education.",
    visaPath: "niw",
    displayOrder: 1,
  },
  "NIW-02": {
    folderName: "NIW-02_National_Importance",
    displayName: "National importance",
    legalStandard:
      "The proposed endeavor is of national importance with potential impact that is national in scope.",
    visaPath: "niw",
    displayOrder: 2,
  },
  "NIW-03": {
    folderName: "NIW-03_Well_Positioned",
    displayName: "Well-positioned",
    legalStandard:
      "The petitioner is well positioned to advance the proposed endeavor based on education, skills, knowledge, and record of success.",
    visaPath: "niw",
    displayOrder: 3,
  },
  "NIW-04": {
    folderName: "NIW-04_Education_Credentials",
    displayName: "Education and credentials",
    legalStandard:
      "Advanced degree or exceptional ability demonstrated through academic credentials and professional qualifications.",
    visaPath: "niw",
    displayOrder: 4,
  },
  "NIW-05": {
    folderName: "NIW-05_Track_Record",
    displayName: "Track record",
    legalStandard:
      "Past contributions and demonstrated expertise showing a track record of success in the field of endeavor.",
    visaPath: "niw",
    displayOrder: 5,
  },
  "NIW-06": {
    folderName: "NIW-06_Future_Plan",
    displayName: "Future plan",
    legalStandard:
      "A detailed and credible plan for the proposed endeavor in the United States and the benefits it will bring.",
    visaPath: "niw",
    displayOrder: 6,
  },
  "NIW-07": {
    folderName: "NIW-07_Support_Letters",
    displayName: "Support letters",
    legalStandard:
      "Letters from experts and organizations with firsthand knowledge confirming the national interest and the petitioner's standing.",
    visaPath: "niw",
    displayOrder: 7,
  },
  "NIW-08": {
    folderName: "NIW-08_Balance_of_Factors",
    displayName: "Balance of factors",
    legalStandard:
      "On balance, waiving the job offer and labor certification requirement serves the national interest of the United States.",
    visaPath: "niw",
    displayOrder: 8,
  },

  // O-1A (8 criteria)
  "O1A-01": {
    folderName: "O1A-01_Awards_and_Prizes",
    displayName: "Awards and prizes",
    legalStandard:
      "Documentation of the beneficiary's receipt of nationally or internationally recognized prizes or awards for excellence in the field.",
    visaPath: "o1",
    displayOrder: 1,
  },
  "O1A-02": {
    folderName: "O1A-02_Membership",
    displayName: "Membership",
    legalStandard:
      "Documentation of the beneficiary's membership in associations that require outstanding achievements as judged by recognized experts.",
    visaPath: "o1",
    displayOrder: 2,
  },
  "O1A-03": {
    folderName: "O1A-03_Press_Coverage",
    displayName: "Press coverage",
    legalStandard:
      "Published material in professional or major trade publications about the beneficiary and the beneficiary's work.",
    visaPath: "o1",
    displayOrder: 3,
  },
  "O1A-04": {
    folderName: "O1A-04_Judging",
    displayName: "Judging",
    legalStandard:
      "Evidence of the beneficiary's participation as a judge of the work of others in the same or allied field.",
    visaPath: "o1",
    displayOrder: 4,
  },
  "O1A-05": {
    folderName: "O1A-05_Original_Contributions",
    displayName: "Original contributions",
    legalStandard:
      "Evidence of the beneficiary's original scientific, scholarly, or business-related contributions of major significance.",
    visaPath: "o1",
    displayOrder: 5,
  },
  "O1A-06": {
    folderName: "O1A-06_Scholarly_Articles",
    displayName: "Scholarly articles",
    legalStandard:
      "Evidence of the beneficiary's authorship of scholarly articles in professional journals or other major media.",
    visaPath: "o1",
    displayOrder: 6,
  },
  "O1A-07": {
    folderName: "O1A-07_Critical_Role",
    displayName: "Critical or essential role",
    legalStandard:
      "Evidence of the beneficiary's performance in a critical or essential role for distinguished organizations or establishments.",
    visaPath: "o1",
    displayOrder: 7,
  },
  "O1A-08": {
    folderName: "O1A-08_High_Remuneration",
    displayName: "High remuneration",
    legalStandard:
      "Evidence of the beneficiary's high salary or other remuneration for services compared to others in the field.",
    visaPath: "o1",
    displayOrder: 8,
  },
};

export type CriteriaWithId = CriteriaEntry & { id: string };

export function getCriteriaForVisaPath(visaPath: VisaPathKey): CriteriaWithId[] {
  return Object.entries(CRITERIA_FOLDER_MAP)
    .filter(([, v]) => v.visaPath === visaPath)
    .sort((a, b) => a[1].displayOrder - b[1].displayOrder)
    .map(([id, v]) => ({ id, ...v }));
}

export function buildEvidenceFileName(criteriaId: string, originalName: string): string {
  const date = new Date().toISOString().split("T")[0];
  const ext = originalName.includes(".") ? "." + originalName.split(".").pop() : "";
  const base = originalName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .substring(0, 50);
  return `${criteriaId}_${date}_${base}${ext}`;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 60);
}
