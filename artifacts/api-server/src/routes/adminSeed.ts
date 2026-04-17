/**
 * adminSeed.ts — Pinnacle³
 *
 * Staff-only endpoint to seed demo data into the database.
 * Idempotent — skips inserts if data already exists.
 * Protected by X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  profilesTable,
  readinessIntakeTable,
  clientUserProductsTable,
  evidenceTable,
  prospectsTable,
  applicationsTable,
} from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import bcrypt from "bcrypt";

const router: IRouter = Router();

const DEMO_EMAILS = [
  "arjun.krishnamurthy@demo.pinnacle3.dev",
  "mei.chen@demo.pinnacle3.dev",
  "alejandro.vega@demo.pinnacle3.dev",
  "fatima.alrashid@demo.pinnacle3.dev",
  "yuki.tanaka@demo.pinnacle3.dev",
];

router.post(
  "/admin/seed-demo",
  requireStaffAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Check if already seeded
      const existing = await db
        .select({ id: profilesTable.id })
        .from(profilesTable)
        .where(eq(profilesTable.email, DEMO_EMAILS[0]))
        .limit(1);

      if (existing.length > 0) {
        res.json({ success: true, message: "Demo data already seeded — skipping.", alreadySeeded: true });
        return;
      }

      const PW = await bcrypt.hash("Demo1234!", 12);

      // ─── 1. Profiles ────────────────────────────────────────────────────────

      const profiles = await db.insert(profilesTable).values([
        {
          name: "Arjun Krishnamurthy", firstName: "Arjun", lastName: "Krishnamurthy",
          email: "arjun.krishnamurthy@demo.pinnacle3.dev", passwordHash: PW,
          disclaimerAccepted: true, disclaimerAcceptedAt: new Date("2026-01-10"), disclaimerVersion: "1.0",
          visaTarget: "eb1a", profession: "Senior Machine Learning Engineer", yearsExperience: "8",
          currentStatus: "H-1B", caseStatus: "active",
          bio: "Senior ML Engineer at Google DeepMind. 8 peer-reviewed publications, 3 filed patents. Specializing in RLHF and LLM alignment.",
          country: "United States", city: "San Francisco, CA", nationality: "Indian",
          linkedinUrl: "https://linkedin.com/in/arjun-krishnamurthy", accessLevel: "evidence_vault",
          createdAt: new Date("2026-01-10"), updatedAt: new Date("2026-01-10"),
        },
        {
          name: "Mei-Lin Chen", firstName: "Mei-Lin", lastName: "Chen",
          email: "mei.chen@demo.pinnacle3.dev", passwordHash: PW,
          disclaimerAccepted: true, disclaimerAcceptedAt: new Date("2026-02-03"), disclaimerVersion: "1.0",
          visaTarget: "eb1a", profession: "Research Scientist", yearsExperience: "6",
          currentStatus: "H-1B", caseStatus: "active",
          bio: "Research Scientist at OpenAI. Core contributor to multimodal foundation models. PhD MIT. 12 NeurIPS/ICML papers, h-index 14.",
          country: "United States", city: "San Francisco, CA", nationality: "Chinese",
          linkedinUrl: "https://linkedin.com/in/meilin-chen-ai", accessLevel: "excellence_lab",
          createdAt: new Date("2026-02-03"), updatedAt: new Date("2026-02-03"),
        },
        {
          name: "Alejandro Vega", firstName: "Alejandro", lastName: "Vega",
          email: "alejandro.vega@demo.pinnacle3.dev", passwordHash: PW,
          disclaimerAccepted: true, disclaimerAcceptedAt: new Date("2026-01-25"), disclaimerVersion: "1.0",
          visaTarget: "niw", profession: "Principal Software Engineer", yearsExperience: "10",
          currentStatus: "H-1B", caseStatus: "active",
          bio: "Principal SWE at Meta leading distributed systems for 3B+ daily active users. 5 patents in distributed computing.",
          country: "United States", city: "Menlo Park, CA", nationality: "Mexican",
          linkedinUrl: "https://linkedin.com/in/avega-engineering", accessLevel: "evidence_vault",
          createdAt: new Date("2026-01-25"), updatedAt: new Date("2026-01-25"),
        },
        {
          name: "Fatima Al-Rashid", firstName: "Fatima", lastName: "Al-Rashid",
          email: "fatima.alrashid@demo.pinnacle3.dev", passwordHash: PW,
          disclaimerAccepted: true, disclaimerAcceptedAt: new Date("2026-03-01"), disclaimerVersion: "1.0",
          visaTarget: "o1a", profession: "Computational Biology Researcher", yearsExperience: "5",
          currentStatus: "J-1", caseStatus: "active",
          bio: "Postdoctoral Researcher at Stanford Medicine. Pioneering AI methods for drug target discovery. NIH K99 awardee. 6 Nature/Cell publications.",
          country: "United States", city: "Palo Alto, CA", nationality: "Emirati",
          linkedinUrl: "https://linkedin.com/in/fatima-alrashid-bio", accessLevel: "free",
          createdAt: new Date("2026-03-01"), updatedAt: new Date("2026-03-01"),
        },
        {
          name: "Yuki Tanaka", firstName: "Yuki", lastName: "Tanaka",
          email: "yuki.tanaka@demo.pinnacle3.dev", passwordHash: PW,
          disclaimerAccepted: true, disclaimerAcceptedAt: new Date("2026-02-20"), disclaimerVersion: "1.0",
          visaTarget: "eb1a", profession: "Product Director", yearsExperience: "7",
          currentStatus: "L-1A", caseStatus: "active",
          bio: "Product Director at Stripe. Scaled payments platform from $50B to $500B in processed volume. TEDx speaker. Forbes 30 Under 35.",
          country: "United States", city: "Seattle, WA", nationality: "Japanese",
          linkedinUrl: "https://linkedin.com/in/yuki-tanaka-product", accessLevel: "evidence_vault",
          createdAt: new Date("2026-02-20"), updatedAt: new Date("2026-02-20"),
        },
      ]).returning({ id: profilesTable.id, email: profilesTable.email });

      const byEmail = Object.fromEntries(profiles.map((p) => [p.email, p.id]));
      const arjunId = byEmail["arjun.krishnamurthy@demo.pinnacle3.dev"];
      const meiId   = byEmail["mei.chen@demo.pinnacle3.dev"];
      const alejoId = byEmail["alejandro.vega@demo.pinnacle3.dev"];
      const yukiId  = byEmail["yuki.tanaka@demo.pinnacle3.dev"];

      // ─── 2. Product access ──────────────────────────────────────────────────

      await db.insert(clientUserProductsTable).values([
        { profileId: arjunId, clientEmail: "arjun.krishnamurthy@demo.pinnacle3.dev", product: "evidence_vault", offlinePayment: true, grantedByStaffId: "staff", grantNotes: "Paid via bank transfer", status: "active", amountPaid: "497" },
        { profileId: arjunId, clientEmail: "arjun.krishnamurthy@demo.pinnacle3.dev", product: "excellence_lab", offlinePayment: true, grantedByStaffId: "staff", grantNotes: "Bundled with Evidence Vault", status: "active", amountPaid: "0" },
        { profileId: meiId,   clientEmail: "mei.chen@demo.pinnacle3.dev",            product: "excellence_lab", offlinePayment: true, grantedByStaffId: "staff", grantNotes: "Trial access", status: "active", amountPaid: "297" },
        { profileId: alejoId, clientEmail: "alejandro.vega@demo.pinnacle3.dev",      product: "evidence_vault", offlinePayment: true, grantedByStaffId: "staff", grantNotes: "Paid via Stripe", status: "active", amountPaid: "497" },
        { profileId: alejoId, clientEmail: "alejandro.vega@demo.pinnacle3.dev",      product: "excellence_lab", offlinePayment: true, grantedByStaffId: "staff", grantNotes: "Bundled with Evidence Vault", status: "active", amountPaid: "0" },
        { profileId: yukiId,  clientEmail: "yuki.tanaka@demo.pinnacle3.dev",         product: "evidence_vault", offlinePayment: true, grantedByStaffId: "staff", grantNotes: "Elite Blueprint client", status: "active", amountPaid: "497" },
        { profileId: yukiId,  clientEmail: "yuki.tanaka@demo.pinnacle3.dev",         product: "excellence_lab", offlinePayment: true, grantedByStaffId: "staff", grantNotes: "Bundled with Blueprint", status: "active", amountPaid: "0" },
      ]);

      // ─── 3. Readiness intakes ───────────────────────────────────────────────

      await db.insert(readinessIntakeTable).values([
        {
          profileId: arjunId, fullName: "Arjun Krishnamurthy", email: "arjun.krishnamurthy@demo.pinnacle3.dev",
          currentRole: "Senior Machine Learning Engineer", company: "Google DeepMind", country: "United States",
          education: "M.S. Computer Science, Carnegie Mellon University (2018). B.Tech. IIT Bombay (2016).",
          fieldOfWork: "Machine Learning / Artificial Intelligence", yearsExperience: "8",
          summary: "Senior ML Engineer at Google DeepMind working on LLM alignment and RLHF. Work influences production systems used by hundreds of millions globally.",
          describeWork: "Lead a team of 6 engineers developing training pipelines for foundation models. Key: novel RLHF reward modeling improving safety scores by 34%, compute costs down 22%.",
          keyAchievements: "1) Led RLHF training for Gemini Ultra safety layer. 2) Filed 3 patents. 3) Promoted to Senior MLE L6 in 4 years (typical 7+). 4) Invited keynote NeurIPS 2025 workshop.",
          publications: "8 papers: 3 NeurIPS, 2 ICML, 1 ICLR, 2 ACL. h-index: 11. 430+ citations.",
          awards: "Google Spot Bonus 2024, 2023. Best Paper Honorable Mention NeurIPS 2023. Forbes 30 Under 30 AI 2025.",
          media: "MIT Technology Review feature Dec 2024 (450K readers). Forbes 30 Under 30 profile.",
          judgingReviewing: "Reviewer: NeurIPS 2024, ICML 2024, ICLR 2025. Area Chair: COLM 2025.",
          leadershipRoles: "Tech Lead RLHF Safety Team (6 engineers). Mentored 4 engineers promoted to L4/L5.",
          memberships: "Senior Member ACM. Member IEEE Computer Society.",
          salaryIndicators: "TC: $680,000/year. Above 90th percentile for ML engineers nationally.",
          documentationAvailable: "All publications, patent filings, performance reviews available.",
          evidenceOrganization: "Organized — Google Drive folder with all documents",
          visaPath: "EB-1A", timeline: "6 months",
          currentGoal: "Build strongest EB-1A — publications, peer review, high salary.",
          status: "completed", readinessCompleted: true, readinessCompletedAt: new Date("2026-01-12"),
        },
        {
          profileId: meiId, fullName: "Mei-Lin Chen", email: "mei.chen@demo.pinnacle3.dev",
          currentRole: "Research Scientist II", company: "OpenAI", country: "United States",
          education: "Ph.D. Computer Science, MIT (2020). B.S. Peking University (2015).",
          fieldOfWork: "AI Research / Multimodal Models", yearsExperience: "6",
          summary: "Core research scientist at OpenAI contributing to multimodal foundation models including GPT-4V.",
          describeWork: "Design novel architectures for multimodal understanding. Key: cross-modal attention mechanism improving zero-shot image understanding by 18%.",
          keyAchievements: "Core contributor to GPT-4V. 12 publications at top venues. Highest cited OpenAI researcher under 5 years tenure.",
          publications: "12 papers: 4 NeurIPS, 3 ICML, 2 CVPR, 2 ICLR, 1 ECCV. h-index: 14. 890+ citations.",
          awards: "OpenAI Excellence Award 2024. NeurIPS 2023 Best Paper (2nd author). MIT Outstanding Graduate Research Award.",
          media: "Nature News article on multimodal AI 2024. Wired interview on AI safety research.",
          judgingReviewing: "Program Committee: NeurIPS 2023, 2024; ICML 2024; ICLR 2025. Co-organizer ICML 2024 Workshop.",
          leadershipRoles: "Led 4-person research team. Mentored 2 PhD interns (both got return offers).",
          memberships: "Member ACM. IEEE Women in Engineering.",
          salaryIndicators: "TC: $780,000/year. Top of band for RSI level.",
          documentationAvailable: "Full publication list, citation reports, performance reviews.",
          evidenceOrganization: "Organized",
          visaPath: "EB-1A", timeline: "9 months",
          currentGoal: "Strengthen criteria 1 (publications) and 6 (original contributions). Need help framing judging criterion.",
          status: "completed", readinessCompleted: true, readinessCompletedAt: new Date("2026-02-05"),
        },
        {
          profileId: alejoId, fullName: "Alejandro Vega", email: "alejandro.vega@demo.pinnacle3.dev",
          currentRole: "Principal Software Engineer", company: "Meta", country: "United States",
          education: "M.S. Computer Science, Stanford (2016). B.S. ITAM Mexico City (2014).",
          fieldOfWork: "Distributed Systems / Infrastructure", yearsExperience: "10",
          summary: "Principal SWE at Meta leading distributed systems for 3B+ daily active users. Previously TL at AWS DynamoDB core team.",
          describeWork: "Tech lead on Meta next-gen messaging infrastructure. Designed consensus algorithms reducing latency 40% at billion-user scale.",
          keyAchievements: "5 patents in distributed computing. Promoted to E8 in 9 years (Meta typical is 12+). Led team cutting infrastructure costs by $120M annually.",
          publications: "3 papers at OSDI, NSDI, SOSP. 5 patents filed/granted.",
          awards: "Meta Infrastructure Award 2023, 2024. AWS Distinguished Engineer Nomination 2021.",
          media: "Speaker at AWS re:Invent 2022 (10,000+ attendees). Quoted in ACM Queue on distributed consensus.",
          judgingReviewing: "Reviewer: OSDI 2024, EuroSys 2024. Program Committee: SOSP 2025.",
          leadershipRoles: "TL of 14-person distributed systems team. Systems used by 8 product teams.",
          memberships: "Senior Member ACM.",
          salaryIndicators: "TC: $750,000/year. Top 1% for software engineers nationally.",
          documentationAvailable: "Patents, papers, performance reviews, compensation documentation.",
          evidenceOrganization: "Well organized",
          visaPath: "EB-2 NIW", timeline: "12 months",
          currentGoal: "Build NIW petition around critical role in US national interest — AI infrastructure.",
          status: "completed", readinessCompleted: true, readinessCompletedAt: new Date("2026-01-28"),
        },
        {
          profileId: yukiId, fullName: "Yuki Tanaka", email: "yuki.tanaka@demo.pinnacle3.dev",
          currentRole: "Product Director, Payments Infrastructure", company: "Stripe", country: "United States",
          education: "MBA Wharton UPenn (2019). B.Eng. Keio University Japan (2014).",
          fieldOfWork: "Product Management / Financial Technology", yearsExperience: "7",
          summary: "Product Director at Stripe for global payments platform used by 2M+ businesses. Scaled from $50B to $500B in annual processed volume.",
          describeWork: "Lead product strategy for Stripe core payments API. Scaled 10x, launched 8 new markets, shipped 3 major infrastructure upgrades.",
          keyAchievements: "Scaled Stripe payments 10x. Led entry into 8 countries. TEDx speaker. Invited speaker Money20/20 and Finovate.",
          publications: "2 HBR case studies. Chapter in O'Reilly book on payment systems.",
          awards: "Stripe Product Impact Award 2023, 2024. Forbes 30 Under 35 Finance 2024. Wharton Alumni Innovation Award.",
          media: "Featured in The Economist on fintech infrastructure 2024. Bloomberg Technology interview. TechCrunch feature.",
          judgingReviewing: "Judge: Fintech Innovation Awards 2024 EU. Mentor: Y Combinator W25 fintech batch.",
          leadershipRoles: "Director managing 3 PMs and cross-functional org of 40+. Built Stripe first payments localization team.",
          memberships: "Product Council Stripe. Advisory Board two early-stage fintech startups.",
          salaryIndicators: "TC: $620,000/year. Top of market for Director-level product roles.",
          documentationAvailable: "Compensation docs, media coverage, speaking records, award letters.",
          evidenceOrganization: "Organized",
          visaPath: "EB-1A", timeline: "6 months",
          currentGoal: "Build strongest EB-1A case — high salary, critical role, press, judging.",
          status: "completed", readinessCompleted: true, readinessCompletedAt: new Date("2026-02-22"),
        },
      ]);

      // ─── 4. Evidence ────────────────────────────────────────────────────────

      await db.insert(evidenceTable).values([
        // Arjun
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "NeurIPS 2023: Efficient RLHF at Scale", description: "Peer-reviewed publication at NeurIPS 2023 Workshop. 87 citations to date. Selected as spotlight paper.", evidenceType: "publication", status: "strong", dateAchieved: "2023-12-01" },
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "ICML 2024: Reward Modeling for LLM Alignment", description: "Full paper at ICML 2024. 124 citations. Spotlight presentation. 3rd most downloaded paper in proceedings.", evidenceType: "publication", status: "strong", dateAchieved: "2024-07-15" },
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "ACL 2023: Cross-lingual Transfer in RLHF Systems", description: "Full paper at ACL 2023. 52 citations. Demonstrates multilingual safety improvements.", evidenceType: "publication", status: "strong", dateAchieved: "2023-07-01" },
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-03", title: "Google Spot Bonus Award 2024", description: "Awarded Google highest discretionary bonus for exceptional contributions to Gemini safety systems.", evidenceType: "award", status: "strong", dateAchieved: "2024-03-01" },
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-03", title: "Forbes 30 Under 30 — AI Category 2025", description: "Selected for Forbes 30 Under 30 in the Artificial Intelligence category from 25,000+ nominees.", evidenceType: "award", status: "strong", dateAchieved: "2025-01-10" },
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-04", title: "MIT Technology Review Feature: AI Safety Research", description: "Named and quoted expert in MIT Tech Review article on AI safety. Reached 450K+ readers globally.", evidenceType: "media", status: "strong", dateAchieved: "2024-12-15" },
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-05", title: "NeurIPS 2024 Program Committee Reviewer", description: "Served as reviewer for NeurIPS 2024 — top-tier AI conference with 15,000+ submissions.", evidenceType: "peer_review", status: "strong", dateAchieved: "2024-10-01" },
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-09", title: "Google L6 Compensation Package — $680K TC", description: "Base $280K + $350K annual RSU + bonus. Documented above 90th percentile for ML engineers nationally.", evidenceType: "high_salary", status: "strong", dateAchieved: "2024-01-01" },
        { profileId: arjunId, criterionId: 0, primaryCriteriaId: "EB1A-08", title: "US Patent 11,934,521 — RLHF Training System", description: "Granted patent on novel RLHF architecture. Named inventor. Applied in production Gemini training.", evidenceType: "original_contributions", status: "strong", dateAchieved: "2024-06-20" },
        // Mei
        { profileId: meiId, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "NeurIPS 2023 Best Paper — Multimodal Reasoning", description: "Second author on Best Paper Award winner. 340+ citations. Invited for oral presentation.", evidenceType: "publication", status: "strong", dateAchieved: "2023-12-10" },
        { profileId: meiId, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "ICML 2024: Cross-Modal Attention for Vision-Language Models", description: "Sole first-author paper at ICML 2024. Novel architecture. 89 citations in 8 months.", evidenceType: "publication", status: "strong", dateAchieved: "2024-07-20" },
        { profileId: meiId, criterionId: 0, primaryCriteriaId: "EB1A-05", title: "ICML 2024 Workshop Co-Organizer — Multimodal Learning", description: "Co-organized Multimodal Learning Workshop at ICML 2024. 600+ attendees, 85 paper submissions.", evidenceType: "peer_review", status: "strong", dateAchieved: "2024-07-01" },
        { profileId: meiId, criterionId: 0, primaryCriteriaId: "EB1A-04", title: "Wired Feature: The Researchers Making AI See", description: "Featured in Wired magazine article on multimodal AI research. International circulation 800K+.", evidenceType: "media", status: "strong", dateAchieved: "2024-09-01" },
        { profileId: meiId, criterionId: 0, primaryCriteriaId: "EB1A-09", title: "OpenAI RSI Compensation — $780K TC", description: "Total compensation significantly above 90th percentile for research scientists nationally.", evidenceType: "high_salary", status: "reviewing", dateAchieved: "2025-01-01" },
        { profileId: meiId, criterionId: 0, primaryCriteriaId: "EB1A-08", title: "Cross-Modal Attention Architecture (Open-Source)", description: "Released novel cross-modal attention implementation. 2,400+ GitHub stars. Used in 12 research groups.", evidenceType: "original_contributions", status: "strong", dateAchieved: "2024-09-15" },
        // Alejandro
        { profileId: alejoId, criterionId: 0, primaryCriteriaId: "EB1A-08", title: "US Patent 10,877,912 — Distributed Consensus Algorithm", description: "Granted patent on novel consensus mechanism for distributed databases. First inventor.", evidenceType: "original_contributions", status: "strong", dateAchieved: "2023-01-15" },
        { profileId: alejoId, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "OSDI 2023: Consensus at Billion-User Scale", description: "Full paper at OSDI 2023 — top-tier systems conference. 67 citations. Presented main track.", evidenceType: "publication", status: "strong", dateAchieved: "2023-10-01" },
        { profileId: alejoId, criterionId: 0, primaryCriteriaId: "EB1A-04", title: "AWS re:Invent 2022 Keynote Speaker", description: "Delivered keynote on distributed systems at AWS re:Invent 2022. 10,000+ in-person attendees.", evidenceType: "media", status: "strong", dateAchieved: "2022-12-01" },
        { profileId: alejoId, criterionId: 0, primaryCriteriaId: "EB1A-09", title: "Meta E8 Compensation — $750K TC", description: "TC at 99th+ percentile for software engineers nationally per Levels.fyi data.", evidenceType: "high_salary", status: "strong", dateAchieved: "2025-01-01" },
        { profileId: alejoId, criterionId: 0, primaryCriteriaId: "EB1A-10", title: "Critical Role — $120M Infrastructure Cost Reduction", description: "Sole architect of distributed system design saving Meta $120M annually. Documented with org attestation.", evidenceType: "critical_role", status: "strong", dateAchieved: "2024-06-01" },
        // Yuki
        { profileId: yukiId, criterionId: 0, primaryCriteriaId: "EB1A-04", title: "The Economist Feature — Stripe Payments Infrastructure", description: "Named expert in The Economist article on global fintech. Readership 1.5M internationally.", evidenceType: "media", status: "strong", dateAchieved: "2024-11-01" },
        { profileId: yukiId, criterionId: 0, primaryCriteriaId: "EB1A-03", title: "Forbes 30 Under 35 Finance — 2024", description: "Selected for Forbes 30 Under 35 in Finance category for Stripe leadership. 30,000+ nominees.", evidenceType: "award", status: "strong", dateAchieved: "2024-09-15" },
        { profileId: yukiId, criterionId: 0, primaryCriteriaId: "EB1A-03", title: "Stripe Product Impact Award 2024", description: "Awarded Stripe highest internal product recognition for leading 10x payments volume growth.", evidenceType: "award", status: "strong", dateAchieved: "2024-12-01" },
        { profileId: yukiId, criterionId: 0, primaryCriteriaId: "EB1A-05", title: "Fintech Innovation Awards 2024 — Judge", description: "Served as judge for EU Fintech Innovation Awards 2024. Selected 12 winners from 340 applicants.", evidenceType: "peer_review", status: "strong", dateAchieved: "2024-06-01" },
        { profileId: yukiId, criterionId: 0, primaryCriteriaId: "EB1A-09", title: "Stripe Director Compensation — $620K TC", description: "TC significantly above 90th percentile for Product Directors nationally per Radford benchmark.", evidenceType: "high_salary", status: "strong", dateAchieved: "2025-01-01" },
        { profileId: yukiId, criterionId: 0, primaryCriteriaId: "EB1A-10", title: "Critical Role — $50B to $500B Payments Platform Scale", description: "Sole Director responsible for product decisions scaling Stripe core payments 10x over 3 years.", evidenceType: "critical_role", status: "strong", dateAchieved: "2026-01-01" },
      ]);

      // ─── 5. Prospects ───────────────────────────────────────────────────────

      await db.insert(prospectsTable).values([
        {
          fullName: "Riya Desai", email: "riya.desai@quantumml.io", phone: "+1 (415) 555-0182",
          currentRole: "Staff ML Engineer, Quantum ML Inc.", fieldOfWork: "Quantum Machine Learning", yearsOfExperience: "7",
          summary: "Strong publications record (ICML, NeurIPS). Interested in EB-1A. Has not yet registered.",
          publicationsSignal: true, awardsSignal: false, leadershipSignal: true,
          sourceType: "linkedin_outreach",
          internalNotes: "Reached out via LinkedIn. Very strong publications. Needs help with salary documentation and award criteria. Follow up in 2 weeks.",
          status: "engaged", registrationStatus: "not_invited", ownerStaffUser: "staff",
        },
        {
          fullName: "Marcus Webb", email: "marcus.webb@hopkinsmed.edu", phone: "+1 (410) 555-0234",
          currentRole: "Assistant Professor, Johns Hopkins Medical School", fieldOfWork: "Computational Medicine", yearsOfExperience: "9",
          summary: "20+ publications in NEJM, Lancet. NIH grant recipient. O-1A or EB-1A candidate. Very strong profile.",
          publicationsSignal: true, awardsSignal: true, leadershipSignal: true,
          sourceType: "referral",
          internalNotes: "Referred by Fatima Al-Rashid. Exceptional publication record. Strong candidate for either O-1A or EB-1A. High priority.",
          status: "new", registrationStatus: "not_invited", ownerStaffUser: "staff",
        },
        {
          fullName: "Priya Sundaram", email: "priya.s@deepscinc.com", phone: "+1 (650) 555-0391",
          currentRole: "Senior Research Scientist, DeepSci Inc.", fieldOfWork: "Protein Structure Prediction / Biotech", yearsOfExperience: "5",
          summary: "Research scientist on protein folding. Published in Nature Methods. Early career but exceptional trajectory. H-1B expiring in 8 months.",
          publicationsSignal: true, awardsSignal: false, leadershipSignal: false,
          sourceType: "quiz_lead",
          internalNotes: "Came in through Visa Readiness Quiz. Scored Strong Foundation result. Has urgency due to H-1B expiry. Schedule call within 1 week.",
          status: "engaged", registrationStatus: "invited", ownerStaffUser: "staff",
        },
        {
          fullName: "Daniel Osei", email: "d.osei@cloudarch.dev",
          currentRole: "Cloud Solutions Architect, Amazon Web Services", fieldOfWork: "Cloud Infrastructure / Solutions Architecture", yearsOfExperience: "6",
          summary: "AWS Solutions Architect. Strong client impact record. No formal publications but strong high-salary and critical role profile. Exploring EB-2 NIW.",
          publicationsSignal: false, awardsSignal: true, leadershipSignal: true,
          sourceType: "direct_inquiry",
          internalNotes: "Emailed directly asking about NIW eligibility. TC $380K. Less traditional — no publications. Would need strong critical role narrative. Good NIW candidate.",
          status: "new", registrationStatus: "not_invited", ownerStaffUser: "staff",
        },
        {
          fullName: "Aiko Watanabe", email: "aiko.watanabe@neurox.ai",
          currentRole: "Co-Founder & CTO, Neurox AI", fieldOfWork: "AI Startup / Neurotechnology", yearsOfExperience: "8",
          summary: "CTO of $42M Series B AI startup. Former Google Brain researcher. 9 publications, 2 patents. EB-1A with strong press and funding profile.",
          publicationsSignal: true, awardsSignal: true, leadershipSignal: true,
          sourceType: "referral",
          internalNotes: "Referred by Arjun Krishnamurthy. Excellent profile — strong on all fronts. HIGH PRIORITY.",
          status: "engaged", registrationStatus: "not_invited", ownerStaffUser: "staff",
        },
      ]);

      // ─── 6. Applications (Elite Blueprint) ─────────────────────────────────

      await db.insert(applicationsTable).values([
        {
          profileId: yukiId, fullName: "Yuki Tanaka", email: "yuki.tanaka@demo.pinnacle3.dev",
          currentRole: "Product Director, Payments Infrastructure", country: "United States", visaPath: "EB-1A",
          field: "Financial Technology / Product Management", yearsExperience: "7",
          topAchievements: "Scaled Stripe payment volume 10x ($50B to $500B). Led entry into 8 new markets. TEDx speaker on fintech accessibility.",
          publications: "2 HBR case studies. Chapter in O'Reilly payment systems book.",
          awards: "Forbes 30 Under 35 Finance 2024. Stripe Product Impact Award 2023, 2024.",
          evidenceOrganization: "Well organized — documentation for all achievements",
          documentationAvailable: "Yes — compensation, media coverage, speaking, award letters",
          linkedinUrl: "https://linkedin.com/in/yuki-tanaka-product",
          whyApplying: "I want a dedicated advisor to help build the strongest possible EB-1A case and coordinate with my immigration attorney.",
          timeline: "6 months", status: "reviewed", paymentStatus: "received",
          paymentNotes: "Paid $2,500 engagement fee via wire transfer on March 15, 2026",
          paymentReceivedAt: new Date("2026-03-15"), paymentReceivedBy: "staff",
          includeExcellenceLab: true, adminConfidenceScore: 87,
          adminStrengtheningRoadmap: "1. Secure 2 more structured media features. 2. Letters from Stripe leadership and 3+ external VCs referencing critical role. 3. Document 10x volume growth with verifiable Stripe metrics. 4. Add 1-2 conference speaking slots at global fintech events.",
          adminEstimatedTimeline: "6-8 months to file-ready",
          adminReviewNotes: "Strong EB-1A profile. High salary, press, awards, and critical role are solid. Publications are thin — HBR case studies need framing. Main gap: need stronger evidence of national/international recognition beyond fintech industry.",
          adminReviewedAt: new Date("2026-03-18"), adminReviewedBy: "staff",
        },
        {
          profileId: null, fullName: "Aisha Nkrumah", email: "aisha.nkrumah@palantir-prospect.demo",
          currentRole: "Senior Data Scientist, Palantir Technologies", country: "United States", visaPath: "EB-1A",
          field: "Data Science / Defense Technology", yearsExperience: "6",
          topAchievements: "Lead data scientist on classified federal defense contracts. 5 patents. Contributed to systems used by 4 federal agencies.",
          publications: "4 papers (2 classified, 2 public). ICLR 2023, NeurIPS 2022.",
          awards: "Palantir Forward Deployed Excellence Award 2023. In-Q-Tel Fellows Program.",
          evidenceOrganization: "Partially organized — some clearance-restricted documents",
          documentationAvailable: "Selective — some classified documentation requires attorney coordination",
          whyApplying: "Need expert guidance navigating EB-1A with a classified work profile. Want to understand what I can and cannot use as evidence.",
          timeline: "12 months", status: "submitted", paymentStatus: "pending", includeExcellenceLab: false,
        },
        {
          profileId: null, fullName: "Mateo Rivera", email: "mateo.rivera@genentech-prospect.demo",
          currentRole: "Principal Scientist, Genentech", country: "United States", visaPath: "EB-1A",
          field: "Oncology / Drug Discovery", yearsExperience: "11",
          topAchievements: "Discovered 2 drug candidates now in Phase II clinical trials. 18 publications in Cancer Cell, Nature Cancer, JCI. $340K in NIH grant funding.",
          publications: "18 papers: Nature Cancer 2022, 2024; Cancer Cell 2023; JCI 2021. h-index: 19.",
          awards: "American Cancer Society Young Investigator Award 2022. Genentech Annual Research Award 2023, 2024.",
          evidenceOrganization: "Highly organized — all documents ready",
          documentationAvailable: "Full documentation including clinical trial records, grant documentation, peer review invitations",
          whyApplying: "I have a strong academic profile and want advisory support to translate it into a winning EB-1A petition.",
          timeline: "3 months", status: "under_review", paymentStatus: "pending", includeExcellenceLab: true,
        },
      ]);

      res.json({
        success: true,
        message: "Demo data seeded successfully.",
        summary: {
          profiles: 5,
          products: 7,
          intakes: 4,
          evidence: 26,
          prospects: 5,
          applications: 3,
        },
      });
    } catch (err: any) {
      console.error("[seed-demo] Error:", err);
      res.status(500).json({ error: "Seed failed", detail: err?.message ?? "Unknown error" });
    }
  },
);

export default router;
