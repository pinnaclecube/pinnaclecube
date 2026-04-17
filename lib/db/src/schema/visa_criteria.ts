import { pgTable, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const visaCriteriaTable = pgTable("visa_criteria", {
  id: text("id").primaryKey(),
  visaPath: text("visa_path").notNull(),
  criteriaCode: text("criteria_code").notNull(),
  criteriaName: text("criteria_name").notNull(),
  legalStandard: text("legal_standard").notNull(),
  folderName: text("folder_name").notNull(),
  displayOrder: integer("display_order").notNull(),
  isCommon: boolean("is_common").default(true),
});

export const insertVisaCriterionSchema = createInsertSchema(visaCriteriaTable);
export type InsertVisaCriterion = z.infer<typeof insertVisaCriterionSchema>;
export type VisaCriterion = typeof visaCriteriaTable.$inferSelect;

export const VISA_CRITERIA_SEED: InsertVisaCriterion[] = [
  { id: "EB1A-01", visaPath: "eb1a", criteriaCode: "01", criteriaName: "Awards and prizes", legalStandard: "Documentation of the alien's receipt of nationally or internationally recognized prizes or awards for excellence in the field of endeavor.", folderName: "EB1A-01_Awards_and_Prizes", displayOrder: 1, isCommon: true },
  { id: "EB1A-02", visaPath: "eb1a", criteriaCode: "02", criteriaName: "Membership", legalStandard: "Documentation of the alien's membership in associations in the field which require outstanding achievements of their members, as judged by recognized national or international experts.", folderName: "EB1A-02_Membership", displayOrder: 2, isCommon: true },
  { id: "EB1A-03", visaPath: "eb1a", criteriaCode: "03", criteriaName: "Press and media", legalStandard: "Published material about the alien in professional or major trade publications or other major media, relating to the alien's work in the field.", folderName: "EB1A-03_Press_and_Media", displayOrder: 3, isCommon: true },
  { id: "EB1A-04", visaPath: "eb1a", criteriaCode: "04", criteriaName: "Judging others", legalStandard: "Evidence of the alien's participation, either individually or on a panel, as a judge of the work of others in the same or an allied field.", folderName: "EB1A-04_Judging_Others", displayOrder: 4, isCommon: true },
  { id: "EB1A-05", visaPath: "eb1a", criteriaCode: "05", criteriaName: "Original contributions", legalStandard: "Evidence of the alien's original scientific, scholarly, artistic, athletic, or business-related contributions of major significance in the field.", folderName: "EB1A-05_Original_Contributions", displayOrder: 5, isCommon: true },
  { id: "EB1A-06", visaPath: "eb1a", criteriaCode: "06", criteriaName: "Scholarly articles", legalStandard: "Evidence of the alien's authorship of scholarly articles in the field, in professional or major trade publications or other major media.", folderName: "EB1A-06_Scholarly_Articles", displayOrder: 6, isCommon: true },
  { id: "EB1A-07", visaPath: "eb1a", criteriaCode: "07", criteriaName: "Critical role", legalStandard: "Evidence that the alien has performed in a leading or critical role for organizations or establishments that have a distinguished reputation.", folderName: "EB1A-07_Critical_Role", displayOrder: 7, isCommon: true },
  { id: "EB1A-08", visaPath: "eb1a", criteriaCode: "08", criteriaName: "High salary", legalStandard: "Evidence that the alien has commanded a high salary or other significantly high remuneration for services, in relation to others in the field.", folderName: "EB1A-08_High_Salary", displayOrder: 8, isCommon: true },
  { id: "EB1A-09", visaPath: "eb1a", criteriaCode: "09", criteriaName: "Commercial success", legalStandard: "Evidence of commercial successes in the performing arts, as shown by box office receipts or record, cassette, compact disk, or video sales.", folderName: "EB1A-09_Commercial_Success", displayOrder: 9, isCommon: false },
  { id: "EB1A-10", visaPath: "eb1a", criteriaCode: "10", criteriaName: "Exhibitions", legalStandard: "Evidence of the display of the alien's work in the field at artistic exhibitions or showcases.", folderName: "EB1A-10_Exhibitions", displayOrder: 10, isCommon: false },
  { id: "NIW-01", visaPath: "niw", criteriaCode: "01", criteriaName: "Substantial merit", legalStandard: "The proposed endeavor has substantial merit and national importance in business, science, technology, culture, health, or education.", folderName: "NIW-01_Substantial_Merit", displayOrder: 1, isCommon: true },
  { id: "NIW-02", visaPath: "niw", criteriaCode: "02", criteriaName: "National importance", legalStandard: "The proposed endeavor is of national importance with potential impact that is national in scope.", folderName: "NIW-02_National_Importance", displayOrder: 2, isCommon: true },
  { id: "NIW-03", visaPath: "niw", criteriaCode: "03", criteriaName: "Well-positioned", legalStandard: "The petitioner is well positioned to advance the proposed endeavor based on education, skills, knowledge, and record of success.", folderName: "NIW-03_Well_Positioned", displayOrder: 3, isCommon: true },
  { id: "NIW-04", visaPath: "niw", criteriaCode: "04", criteriaName: "Education and credentials", legalStandard: "Advanced degree or exceptional ability demonstrated through academic credentials and professional qualifications.", folderName: "NIW-04_Education_Credentials", displayOrder: 4, isCommon: true },
  { id: "NIW-05", visaPath: "niw", criteriaCode: "05", criteriaName: "Track record", legalStandard: "Past contributions and demonstrated expertise showing a track record of success in the field of endeavor.", folderName: "NIW-05_Track_Record", displayOrder: 5, isCommon: true },
  { id: "NIW-06", visaPath: "niw", criteriaCode: "06", criteriaName: "Future plan", legalStandard: "A detailed and credible plan for the proposed endeavor in the United States and the benefits it will bring.", folderName: "NIW-06_Future_Plan", displayOrder: 6, isCommon: true },
  { id: "NIW-07", visaPath: "niw", criteriaCode: "07", criteriaName: "Support letters", legalStandard: "Letters from experts and organizations with firsthand knowledge confirming the national interest and the petitioner's standing.", folderName: "NIW-07_Support_Letters", displayOrder: 7, isCommon: true },
  { id: "NIW-08", visaPath: "niw", criteriaCode: "08", criteriaName: "Balance of factors", legalStandard: "On balance, waiving the job offer and labor certification requirement serves the national interest of the United States.", folderName: "NIW-08_Balance_of_Factors", displayOrder: 8, isCommon: true },
  { id: "O1A-01", visaPath: "o1", criteriaCode: "01", criteriaName: "Awards and prizes", legalStandard: "Documentation of the beneficiary's receipt of nationally or internationally recognized prizes or awards for excellence in the field.", folderName: "O1A-01_Awards_and_Prizes", displayOrder: 1, isCommon: true },
  { id: "O1A-02", visaPath: "o1", criteriaCode: "02", criteriaName: "Membership", legalStandard: "Documentation of the beneficiary's membership in associations that require outstanding achievements as judged by recognized experts.", folderName: "O1A-02_Membership", displayOrder: 2, isCommon: true },
  { id: "O1A-03", visaPath: "o1", criteriaCode: "03", criteriaName: "Press coverage", legalStandard: "Published material in professional or major trade publications about the beneficiary and the beneficiary's work.", folderName: "O1A-03_Press_Coverage", displayOrder: 3, isCommon: true },
  { id: "O1A-04", visaPath: "o1", criteriaCode: "04", criteriaName: "Judging", legalStandard: "Evidence of the beneficiary's participation as a judge of the work of others in the same or allied field.", folderName: "O1A-04_Judging", displayOrder: 4, isCommon: true },
  { id: "O1A-05", visaPath: "o1", criteriaCode: "05", criteriaName: "Original contributions", legalStandard: "Evidence of the beneficiary's original scientific, scholarly, or business-related contributions of major significance.", folderName: "O1A-05_Original_Contributions", displayOrder: 5, isCommon: true },
  { id: "O1A-06", visaPath: "o1", criteriaCode: "06", criteriaName: "Scholarly articles", legalStandard: "Evidence of the beneficiary's authorship of scholarly articles in professional journals or other major media.", folderName: "O1A-06_Scholarly_Articles", displayOrder: 6, isCommon: true },
  { id: "O1A-07", visaPath: "o1", criteriaCode: "07", criteriaName: "Critical or essential role", legalStandard: "Evidence of the beneficiary's performance in a critical or essential role for distinguished organizations.", folderName: "O1A-07_Critical_Role", displayOrder: 7, isCommon: true },
  { id: "O1A-08", visaPath: "o1", criteriaCode: "08", criteriaName: "High remuneration", legalStandard: "Evidence of the beneficiary's high salary or other remuneration for services compared to others in the field.", folderName: "O1A-08_High_Remuneration", displayOrder: 8, isCommon: true },
];
