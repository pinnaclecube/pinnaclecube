/**
 * Demo seed script — creates 5 realistic client profiles + supporting data
 * Run: pnpm --filter @workspace/api-server run seed-demo
 */
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  profilesTable,
  readinessIntakeTable,
  evidenceTable,
  clientUserProductsTable,
  prospectsTable,
  applicationsTable,
} from "@workspace/db/schema";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const DEMO_PASSWORD = "Demo1234!";
const SALT_ROUNDS = 12;

async function seed() {
  console.log("🌱 Seeding demo data...\n");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // ── 1. Profiles ──────────────────────────────────────────────────────────────
  console.log("Creating profiles...");

  const [arjun] = await db
    .insert(profilesTable)
    .values({
      name: "Arjun Krishnamurthy",
      firstName: "Arjun",
      lastName: "Krishnamurthy",
      email: "arjun.krishnamurthy@demo.pinnacle3.dev",
      passwordHash,
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date("2026-01-10T09:00:00Z"),
      disclaimerVersion: "1.0",
      visaTarget: "eb1a",
      profession: "Senior Machine Learning Engineer",
      yearsExperience: 8,
      currentStatus: "H-1B",
      caseStatus: "active",
      bio: "Senior ML Engineer at Google DeepMind. Specializing in large language models and reinforcement learning. 8 peer-reviewed publications, 3 filed patents.",
      country: "United States",
      city: "San Francisco, CA",
      nationality: "Indian",
      linkedinUrl: "https://linkedin.com/in/arjun-krishnamurthy",
      accessLevel: "evidence_vault",
    })
    .returning();

  const [mei] = await db
    .insert(profilesTable)
    .values({
      name: "Mei-Lin Chen",
      firstName: "Mei-Lin",
      lastName: "Chen",
      email: "mei.chen@demo.pinnacle3.dev",
      passwordHash,
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date("2026-02-03T14:00:00Z"),
      disclaimerVersion: "1.0",
      visaTarget: "eb1a",
      profession: "Research Scientist",
      yearsExperience: 6,
      currentStatus: "H-1B",
      caseStatus: "active",
      bio: "Research Scientist at OpenAI. Core contributor to multimodal foundation models. PhD in Computer Science from MIT. 12 NeurIPS/ICML papers, h-index 14.",
      country: "United States",
      city: "San Francisco, CA",
      nationality: "Chinese",
      linkedinUrl: "https://linkedin.com/in/meilin-chen-ai",
      accessLevel: "excellence_lab",
    })
    .returning();

  const [alejandro] = await db
    .insert(profilesTable)
    .values({
      name: "Alejandro Vega",
      firstName: "Alejandro",
      lastName: "Vega",
      email: "alejandro.vega@demo.pinnacle3.dev",
      passwordHash,
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date("2026-01-25T11:00:00Z"),
      disclaimerVersion: "1.0",
      visaTarget: "niw",
      profession: "Principal Software Engineer",
      yearsExperience: 10,
      currentStatus: "H-1B",
      caseStatus: "active",
      bio: "Principal SWE at Meta. Leads distributed systems infrastructure serving 3B+ users. Formerly TL at AWS. Holds 5 patents in distributed computing.",
      country: "United States",
      city: "Menlo Park, CA",
      nationality: "Mexican",
      linkedinUrl: "https://linkedin.com/in/avega-engineering",
      accessLevel: "evidence_vault",
    })
    .returning();

  const [fatima] = await db
    .insert(profilesTable)
    .values({
      name: "Fatima Al-Rashid",
      firstName: "Fatima",
      lastName: "Al-Rashid",
      email: "fatima.alrashid@demo.pinnacle3.dev",
      passwordHash,
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date("2026-03-01T10:00:00Z"),
      disclaimerVersion: "1.0",
      visaTarget: "o1a",
      profession: "Computational Biology Researcher",
      yearsExperience: 5,
      currentStatus: "J-1",
      caseStatus: "active",
      bio: "Postdoctoral Researcher at Stanford School of Medicine. Pioneering AI methods for drug target discovery. 6 Nature/Cell publications. NIH K99 awardee.",
      country: "United States",
      city: "Palo Alto, CA",
      nationality: "Emirati",
      linkedinUrl: "https://linkedin.com/in/fatima-alrashid-bio",
      accessLevel: "free",
    })
    .returning();

  const [yuki] = await db
    .insert(profilesTable)
    .values({
      name: "Yuki Tanaka",
      firstName: "Yuki",
      lastName: "Tanaka",
      email: "yuki.tanaka@demo.pinnacle3.dev",
      passwordHash,
      disclaimerAccepted: true,
      disclaimerAcceptedAt: new Date("2026-02-20T08:00:00Z"),
      disclaimerVersion: "1.0",
      visaTarget: "eb1a",
      profession: "Product Director",
      yearsExperience: 7,
      currentStatus: "L-1A",
      caseStatus: "active",
      bio: "Product Director at Stripe leading the global payments infrastructure platform. Scaled Stripe's API from $50B to $500B in processed volume. TEDx speaker.",
      country: "United States",
      city: "Seattle, WA",
      nationality: "Japanese",
      linkedinUrl: "https://linkedin.com/in/yuki-tanaka-product",
      accessLevel: "evidence_vault",
    })
    .returning();

  console.log(`  ✓ Created 5 profiles (IDs: ${arjun.id}, ${mei.id}, ${alejandro.id}, ${fatima.id}, ${yuki.id})`);

  // ── 2. Product access ─────────────────────────────────────────────────────────
  console.log("Creating product access...");

  await db.insert(clientUserProductsTable).values([
    {
      profileId: arjun.id,
      clientEmail: arjun.email,
      product: "evidence_vault",
      offlinePayment: true,
      grantedByStaffId: "staff",
      grantNotes: "Granted at onboarding — paid via bank transfer",
      status: "active",
      amountPaid: "497",
    },
    {
      profileId: arjun.id,
      clientEmail: arjun.email,
      product: "excellence_lab",
      offlinePayment: true,
      grantedByStaffId: "staff",
      grantNotes: "Bundled with Evidence Vault",
      status: "active",
      amountPaid: "0",
    },
    {
      profileId: mei.id,
      clientEmail: mei.email,
      product: "excellence_lab",
      offlinePayment: true,
      grantedByStaffId: "staff",
      grantNotes: "Trial access — converting to Evidence Vault",
      status: "active",
      amountPaid: "297",
    },
    {
      profileId: alejandro.id,
      clientEmail: alejandro.email,
      product: "evidence_vault",
      offlinePayment: true,
      grantedByStaffId: "staff",
      grantNotes: "Paid via Stripe — offline recorded",
      status: "active",
      amountPaid: "497",
    },
    {
      profileId: alejandro.id,
      clientEmail: alejandro.email,
      product: "excellence_lab",
      offlinePayment: true,
      grantedByStaffId: "staff",
      status: "active",
      amountPaid: "0",
    },
    {
      profileId: yuki.id,
      clientEmail: yuki.email,
      product: "evidence_vault",
      offlinePayment: true,
      grantedByStaffId: "staff",
      grantNotes: "Elite Blueprint client — full access granted",
      status: "active",
      amountPaid: "497",
    },
    {
      profileId: yuki.id,
      clientEmail: yuki.email,
      product: "excellence_lab",
      offlinePayment: true,
      grantedByStaffId: "staff",
      status: "active",
      amountPaid: "0",
    },
  ]);

  console.log("  ✓ Created product access records");

  // ── 3. Readiness intakes ──────────────────────────────────────────────────────
  console.log("Creating readiness intakes...");

  await db.insert(readinessIntakeTable).values([
    {
      profileId: arjun.id,
      fullName: "Arjun Krishnamurthy",
      email: arjun.email,
      currentRole: "Senior Machine Learning Engineer",
      company: "Google DeepMind",
      country: "United States",
      education: "M.S. Computer Science, Carnegie Mellon University (2018). B.Tech. IIT Bombay (2016).",
      fieldOfWork: "Machine Learning / Artificial Intelligence",
      yearsExperience: "8",
      summary: "I am a Senior ML Engineer at Google DeepMind working on large language model alignment and reinforcement learning from human feedback (RLHF). My work directly influences production systems used by hundreds of millions of users globally.",
      describeWork: "I lead a team of 6 engineers developing training pipelines for foundation models. My key technical contributions include a novel RLHF reward modeling approach that improved model safety scores by 34%, and a distributed training framework that reduced compute costs by 22%.",
      keyAchievements: "1) Led RLHF training for Gemini Ultra safety layer. 2) Filed 3 patents on efficient transformer training. 3) Promoted to Senior MLE L6 in 4 years (typical is 7+). 4) Invited keynote at NeurIPS 2025 workshop.",
      publications: "8 peer-reviewed papers: 3 in NeurIPS, 2 in ICML, 1 in ICLR, 2 in ACL. h-index: 11. Total citations: 430+.",
      awards: "Google Spot Bonus (2024, 2023). Best Paper Honorable Mention, NeurIPS 2023. CMU Outstanding Alumni Award 2025.",
      media: "Quoted in MIT Technology Review article on AI safety (Dec 2024). Featured in Forbes 30 Under 30 AI category (2025).",
      judgingReviewing: "Reviewer for NeurIPS 2024, ICML 2024, ICLR 2025. Area Chair for COLM 2025.",
      leadershipRoles: "Tech Lead of RLHF Safety Team (6 engineers). Mentored 4 junior engineers promoted to L4/L5.",
      memberships: "Senior Member, ACM. Member, IEEE Computer Society.",
      salaryIndicators: "Current TC: $680,000/year (base + RSU + bonus). Significantly above the 90th percentile for ML engineers nationally.",
      documentationAvailable: "All publications available. Patent filings accessible. Performance reviews available on request.",
      evidenceOrganization: "Organized — have a Google Drive folder with all documents",
      evidenceStorage: "Google Drive",
      visaPath: "EB-1A",
      timeline: "File within 6 months",
      currentGoal: "Build the strongest possible EB-1A petition — particularly around publications, peer review, and high salary criteria.",
      status: "completed",
      readinessCompleted: true,
      readinessCompletedAt: new Date("2026-01-12T10:00:00Z"),
    },
    {
      profileId: mei.id,
      fullName: "Mei-Lin Chen",
      email: mei.email,
      currentRole: "Research Scientist II",
      company: "OpenAI",
      country: "United States",
      education: "Ph.D. Computer Science, MIT (2020). B.S. Peking University (2015).",
      fieldOfWork: "AI Research / Multimodal Models",
      yearsExperience: "6",
      summary: "Core research scientist at OpenAI contributing to multimodal foundation models including GPT-4V. My research focuses on vision-language alignment and efficient inference.",
      describeWork: "I design and implement novel architectures for multimodal understanding. My most impactful contribution is a cross-modal attention mechanism that improved zero-shot image understanding by 18% over baseline models.",
      keyAchievements: "Core contributor to GPT-4V multimodal capabilities. 12 publications at top venues. Highest cited OpenAI researcher under 5 years tenure.",
      publications: "12 papers: 4 NeurIPS, 3 ICML, 2 CVPR, 2 ICLR, 1 ECCV. h-index: 14. Citations: 890+.",
      awards: "OpenAI Excellence Award (2024). NeurIPS 2023 Best Paper (2nd author). MIT Outstanding Graduate Research Award.",
      media: "Nature News article on multimodal AI (2024). Interviewed for Wired on AI safety research.",
      judgingReviewing: "Program Committee: NeurIPS 2023, 2024; ICML 2024; ICLR 2025. Co-organizer: ICML 2024 Workshop on Multimodal Learning.",
      leadershipRoles: "Led 4-person research team on multimodal reasoning. Mentored 2 PhD interns (both received return offers).",
      memberships: "Member, ACM. IEEE Women in Engineering.",
      salaryIndicators: "TC: $780,000/year. Top of band for RSI level.",
      documentationAvailable: "Full publication list, citation reports, performance reviews, offer letter history.",
      visaPath: "EB-1A",
      timeline: "File within 9 months",
      currentGoal: "Strengthen evidence for criteria 1 (publications) and criteria 6 (original contributions). Need help framing the judging/reviewing criterion.",
      status: "completed",
      readinessCompleted: true,
      readinessCompletedAt: new Date("2026-02-05T14:00:00Z"),
    },
    {
      profileId: alejandro.id,
      fullName: "Alejandro Vega",
      email: alejandro.email,
      currentRole: "Principal Software Engineer",
      company: "Meta",
      country: "United States",
      education: "M.S. Computer Science, Stanford University (2016). B.S. ITAM Mexico City (2014).",
      fieldOfWork: "Distributed Systems / Infrastructure",
      yearsExperience: "10",
      summary: "Principal SWE at Meta leading distributed systems infrastructure. My teams' systems handle over 3 billion daily active users. Previously TL at AWS on DynamoDB core team.",
      describeWork: "Technical lead on Meta's next-gen real-time messaging infrastructure. Designed novel consensus algorithms reducing latency by 40% at billion-user scale.",
      keyAchievements: "Holds 5 patents in distributed computing. Promoted to E8 (Principal) in 9 years — Meta's typical timeline is 12+. Led team that reduced infrastructure costs by $120M annually.",
      publications: "3 papers at OSDI, NSDI, SOSP. 5 patents filed/granted.",
      awards: "Meta Infrastructure Award (2023, 2024). AWS Distinguished Engineer Nomination (2021).",
      media: "Speaker at AWS re:Invent 2022 (10,000+ attendees). Quoted in ACM Queue article on distributed consensus.",
      judgingReviewing: "Reviewer: OSDI 2024, EuroSys 2024. Program Committee: SOSP 2025.",
      leadershipRoles: "TL of 14-person distributed systems team. Architected systems now used by 8 product teams.",
      memberships: "Senior Member, ACM.",
      salaryIndicators: "TC: $750,000/year. Top 1% for software engineers nationally.",
      documentationAvailable: "Patents, papers, performance reviews, compensation documentation.",
      visaPath: "EB-2 NIW",
      timeline: "File within 12 months",
      currentGoal: "Build NIW petition around critical role in U.S. national interest — specifically AI infrastructure for national security and economic competitiveness.",
      status: "completed",
      readinessCompleted: true,
      readinessCompletedAt: new Date("2026-01-28T11:00:00Z"),
    },
    {
      profileId: yuki.id,
      fullName: "Yuki Tanaka",
      email: yuki.email,
      currentRole: "Product Director, Payments Infrastructure",
      company: "Stripe",
      country: "United States",
      education: "MBA, Wharton School, UPenn (2019). B.Eng. Keio University, Japan (2014).",
      fieldOfWork: "Product Management / Financial Technology",
      yearsExperience: "7",
      summary: "Product Director at Stripe responsible for the global payments infrastructure platform used by 2M+ businesses. Previously PM at Rakuten and Mercari.",
      describeWork: "I lead product strategy and execution for Stripe's core payments API. Under my leadership, we scaled from $50B to $500B in annual processed volume, launched in 8 new markets, and shipped 3 major infrastructure upgrades.",
      keyAchievements: "Scaled Stripe's payment volume 10x. Led entry into 8 new countries. TEDx speaker on fintech accessibility. Invited speaker at Money20/20 and Finovate.",
      publications: "2 case studies in Harvard Business Review. Chapter contribution to O'Reilly book on payment systems.",
      awards: "Stripe Product Impact Award (2023, 2024). Forbes 30 Under 35 Finance (2024). Wharton Alumni Innovation Award.",
      media: "Featured in The Economist on fintech infrastructure (2024). Interviewed on TechCrunch and Bloomberg Technology.",
      judgingReviewing: "Judge: Fintech Innovation Awards 2024 (EU). Mentor: Y Combinator W25 batch (fintech companies).",
      leadershipRoles: "Director managing 3 PMs and cross-functional org of 40+. Built Stripe's first payments localization team.",
      memberships: "Product Council, Stripe. Advisory Board, two early-stage fintech startups.",
      salaryIndicators: "TC: $620,000/year including equity. Top of market for Director-level product roles.",
      visaPath: "EB-1A",
      timeline: "File within 6 months",
      currentGoal: "Build strongest possible EB-1A case. Primary criteria: high salary, critical role, press/media, judging. Need guidance on framing product contributions as extraordinary ability.",
      status: "completed",
      readinessCompleted: true,
      readinessCompletedAt: new Date("2026-02-22T09:00:00Z"),
    },
  ]);

  console.log("  ✓ Created 4 readiness intakes");

  // ── 4. Evidence items ─────────────────────────────────────────────────────────
  console.log("Creating evidence items...");

  await db.insert(evidenceTable).values([
    // Arjun — EB-1A
    { profileId: arjun.id, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "NeurIPS 2023 Paper: Efficient RLHF at Scale", description: "Peer-reviewed publication accepted at NeurIPS 2023 Workshop on RLHF. 87 citations to date.", evidenceType: "publication", status: "strong", dateAchieved: "2023-12-01" },
    { profileId: arjun.id, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "ICML 2024 Paper: Reward Modeling for LLM Alignment", description: "Full paper at ICML 2024. 124 citations. Selected as spotlight presentation.", evidenceType: "publication", status: "strong", dateAchieved: "2024-07-15" },
    { profileId: arjun.id, criterionId: 0, primaryCriteriaId: "EB1A-03", title: "Google Spot Bonus Award 2024", description: "Awarded Google's highest discretionary bonus for exceptional contributions to Gemini safety systems.", evidenceType: "award", status: "strong", dateAchieved: "2024-03-01" },
    { profileId: arjun.id, criterionId: 0, primaryCriteriaId: "EB1A-03", title: "Forbes 30 Under 30 — AI Category 2025", description: "Selected for Forbes 30 Under 30 in the Artificial Intelligence category.", evidenceType: "award", status: "strong", dateAchieved: "2025-01-10" },
    { profileId: arjun.id, criterionId: 0, primaryCriteriaId: "EB1A-04", title: "MIT Technology Review Feature", description: "Named and quoted expert in MIT Tech Review article on AI safety research. Reached 450K readers.", evidenceType: "media", status: "strong", dateAchieved: "2024-12-15" },
    { profileId: arjun.id, criterionId: 0, primaryCriteriaId: "EB1A-05", title: "NeurIPS 2024 Program Committee Reviewer", description: "Served as reviewer for NeurIPS 2024 — one of the most selective AI conferences globally.", evidenceType: "peer_review", status: "strong", dateAchieved: "2024-10-01" },
    { profileId: arjun.id, criterionId: 0, primaryCriteriaId: "EB1A-09", title: "Google L6 Compensation Package", description: "Base salary $280K + $350K annual RSU + bonus. Documented as significantly above 90th percentile nationally.", evidenceType: "high_salary", status: "strong", dateAchieved: "2024-01-01" },
    { profileId: arjun.id, criterionId: 0, primaryCriteriaId: "EB1A-08", title: "US Patent 11,934,521 — RLHF Training System", description: "Granted patent on novel reinforcement learning from human feedback architecture. Named inventor.", evidenceType: "original_contributions", status: "strong", dateAchieved: "2024-06-20" },

    // Mei — EB-1A
    { profileId: mei.id, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "NeurIPS 2023 Best Paper (2nd Author) — Multimodal Reasoning", description: "Second author on Best Paper Award winner at NeurIPS 2023. 340+ citations.", evidenceType: "publication", status: "strong", dateAchieved: "2023-12-10" },
    { profileId: mei.id, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "ICML 2024 — Cross-Modal Attention for Vision-Language Models", description: "Sole first-author paper at ICML 2024. Novel architecture with 89 citations in 8 months.", evidenceType: "publication", status: "strong", dateAchieved: "2024-07-20" },
    { profileId: mei.id, criterionId: 0, primaryCriteriaId: "EB1A-05", title: "ICML 2024 Workshop Co-Organizer", description: "Co-organized Multimodal Learning Workshop at ICML 2024. 600+ attendees, 85 paper submissions.", evidenceType: "peer_review", status: "strong", dateAchieved: "2024-07-01" },
    { profileId: mei.id, criterionId: 0, primaryCriteriaId: "EB1A-04", title: "Wired Feature: The Researchers Making AI See", description: "Featured in Wired magazine article on multimodal AI research. International publication.", evidenceType: "media", status: "strong", dateAchieved: "2024-09-01" },
    { profileId: mei.id, criterionId: 0, primaryCriteriaId: "EB1A-09", title: "OpenAI RSI Compensation — $780K TC", description: "Total compensation significantly above the 90th percentile for research scientists nationally.", evidenceType: "high_salary", status: "reviewing", dateAchieved: "2025-01-01" },

    // Alejandro — EB-2 NIW
    { profileId: alejandro.id, criterionId: 0, primaryCriteriaId: "EB1A-08", title: "US Patent 10,877,912 — Distributed Consensus Algorithm", description: "Granted patent on novel consensus mechanism for distributed databases. Named first inventor.", evidenceType: "original_contributions", status: "strong", dateAchieved: "2023-01-15" },
    { profileId: alejandro.id, criterionId: 0, primaryCriteriaId: "EB1A-08", title: "US Patent 11,423,081 — Real-Time Replication Protocol", description: "Granted patent on low-latency database replication. Applied in DynamoDB and Meta infrastructure.", evidenceType: "original_contributions", status: "strong", dateAchieved: "2023-08-20" },
    { profileId: alejandro.id, criterionId: 0, primaryCriteriaId: "EB1A-01", title: "OSDI 2023 — Consensus at Billion-User Scale", description: "Full paper at OSDI 2023 (top-tier systems conference). 67 citations. Presented at main track.", evidenceType: "publication", status: "strong", dateAchieved: "2023-10-01" },
    { profileId: alejandro.id, criterionId: 0, primaryCriteriaId: "EB1A-04", title: "AWS re:Invent 2022 Keynote Speaker", description: "Delivered keynote session on distributed systems at AWS re:Invent 2022. 10,000+ in-person attendees.", evidenceType: "media", status: "strong", dateAchieved: "2022-12-01" },
    { profileId: alejandro.id, criterionId: 0, primaryCriteriaId: "EB1A-09", title: "Meta E8 Compensation — $750K TC", description: "Total compensation at 99th+ percentile for software engineers nationally per Levels.fyi data.", evidenceType: "high_salary", status: "strong", dateAchieved: "2025-01-01" },

    // Yuki — EB-1A
    { profileId: yuki.id, criterionId: 0, primaryCriteriaId: "EB1A-04", title: "The Economist Feature — Stripe's Payment Infrastructure", description: "Named expert and quoted in The Economist article on global fintech infrastructure. Readership 1.5M.", evidenceType: "media", status: "strong", dateAchieved: "2024-11-01" },
    { profileId: yuki.id, criterionId: 0, primaryCriteriaId: "EB1A-03", title: "Forbes 30 Under 35 Finance — 2024", description: "Selected for Forbes 30 Under 35 in Finance category for leadership at Stripe.", evidenceType: "award", status: "strong", dateAchieved: "2024-09-15" },
    { profileId: yuki.id, criterionId: 0, primaryCriteriaId: "EB1A-05", title: "Fintech Innovation Awards 2024 — Judge", description: "Served as judge for EU Fintech Innovation Awards 2024. Selected 12 winners from 340 applicants.", evidenceType: "peer_review", status: "strong", dateAchieved: "2024-06-01" },
    { profileId: yuki.id, criterionId: 0, primaryCriteriaId: "EB1A-09", title: "Stripe Director Compensation — $620K TC", description: "TC significantly above the 90th percentile for Product Directors nationally.", evidenceType: "high_salary", status: "strong", dateAchieved: "2025-01-01" },
    { profileId: yuki.id, criterionId: 0, primaryCriteriaId: "EB1A-10", title: "Critical Role — $50B to $500B Payments Volume Scale", description: "Sole Director responsible for product decisions scaling Stripe's core payments 10x over 3 years.", evidenceType: "critical_role", status: "strong", dateAchieved: "2026-01-01" },
  ]);

  console.log("  ✓ Created 23 evidence items");

  // ── 5. Prospects ──────────────────────────────────────────────────────────────
  console.log("Creating prospects...");

  await db.insert(prospectsTable).values([
    {
      fullName: "Riya Desai",
      email: "riya.desai@quantumml.io",
      phone: "+1 (415) 555-0182",
      currentRole: "Staff ML Engineer, Quantum ML Inc.",
      fieldOfWork: "Quantum Machine Learning",
      yearsOfExperience: "7",
      summary: "Staff engineer at an AI startup. Strong publications record (ICML, NeurIPS). Interested in EB-1A. Has not yet registered on platform.",
      publicationsSignal: true,
      awardsSignal: false,
      leadershipSignal: true,
      sourceType: "linkedin_outreach",
      internalNotes: "Reached out via LinkedIn. Very strong publications. Needs help with salary documentation and award criteria. Follow up in 2 weeks.",
      status: "engaged",
      registrationStatus: "not_invited",
      ownerStaffUser: "staff",
    },
    {
      fullName: "Marcus Webb",
      email: "marcus.webb@hopkinsmed.edu",
      phone: "+1 (410) 555-0234",
      currentRole: "Assistant Professor, Johns Hopkins Medical School",
      fieldOfWork: "Computational Medicine",
      yearsOfExperience: "9",
      summary: "Academic physician-scientist. 20+ publications in NEJM, Lancet. NIH grant recipient. O-1A candidate. Very strong profile.",
      publicationsSignal: true,
      awardsSignal: true,
      leadershipSignal: true,
      sourceType: "referral",
      internalNotes: "Referred by Fatima Al-Rashid. Exceptional publication record. Needs to understand the difference between O-1A and EB-1A pathways. Strong candidate for either.",
      status: "new",
      registrationStatus: "not_invited",
      ownerStaffUser: "staff",
    },
    {
      fullName: "Priya Sundaram",
      email: "priya.s@deepscinc.com",
      phone: "+1 (650) 555-0391",
      currentRole: "Senior Research Scientist, DeepSci Inc.",
      fieldOfWork: "Protein Structure Prediction / Biotech",
      yearsOfExperience: "5",
      summary: "Research scientist working on protein folding. Published in Nature Methods. Early career but exceptional trajectory. H-1B expiring in 8 months.",
      publicationsSignal: true,
      awardsSignal: false,
      leadershipSignal: false,
      sourceType: "quiz_lead",
      internalNotes: "Came in through the Visa Readiness Quiz. Scored 'Strong Foundation' result. Has urgency due to H-1B expiry. Schedule call within 1 week.",
      status: "engaged",
      registrationStatus: "invited",
      ownerStaffUser: "staff",
    },
    {
      fullName: "Daniel Osei",
      email: "d.osei@cloudarch.dev",
      currentRole: "Cloud Solutions Architect, Amazon Web Services",
      fieldOfWork: "Cloud Infrastructure / Solutions Architecture",
      yearsOfExperience: "6",
      summary: "AWS Solutions Architect with certifications and strong client impact record. No formal publications but strong high-salary and critical role profile. Exploring EB-2 NIW.",
      publicationsSignal: false,
      awardsSignal: true,
      leadershipSignal: true,
      sourceType: "direct_inquiry",
      internalNotes: "Emailed directly asking about NIW eligibility. Compensation $380K TC. Less traditional profile — no publications. Would need strong critical role narrative. May be borderline for EB-1A but good NIW candidate.",
      status: "new",
      registrationStatus: "not_invited",
      ownerStaffUser: "staff",
    },
    {
      fullName: "Aiko Watanabe",
      email: "aiko.watanabe@neurox.ai",
      currentRole: "Co-Founder & CTO, Neurox AI",
      fieldOfWork: "AI Startup / Neurotechnology",
      yearsOfPerience: "8",
      summary: "CTO of well-funded AI startup ($42M Series B). Former Google Brain researcher. 9 publications, 2 patents. EB-1A with strong funding and press profile.",
      publicationsSignal: true,
      awardsSignal: true,
      leadershipSignal: true,
      sourceType: "referral",
      internalNotes: "Referred by Arjun Krishnamurthy. Excellent profile — strong on all fronts. Critical role as CTO, investor backing, press coverage. High priority prospect.",
      status: "engaged",
      registrationStatus: "not_invited",
      ownerStaffUser: "staff",
    },
  ]);

  console.log("  ✓ Created 5 prospects");

  // ── 6. Elite Blueprint Applications ──────────────────────────────────────────
  console.log("Updating Elite Blueprint applications with richer data...");

  // First clear the test data
  await pool.query("DELETE FROM applications WHERE email LIKE '%example.com%' OR current_role = 'postgres'");

  await db.insert(applicationsTable).values([
    {
      profileId: yuki.id,
      fullName: "Yuki Tanaka",
      email: "yuki.tanaka@demo.pinnacle3.dev",
      currentRole: "Product Director, Payments Infrastructure",
      country: "United States",
      visaPath: "EB-1A",
      field: "Financial Technology / Product Management",
      yearsExperience: "7",
      topAchievements: "Scaled Stripe's payment volume 10x ($50B to $500B). Led entry into 8 new international markets. TEDx speaker on fintech accessibility.",
      publications: "2 HBR case studies. Chapter in O'Reilly payment systems book.",
      awards: "Forbes 30 Under 35 Finance (2024). Stripe Product Impact Award (2023, 2024).",
      evidenceOrganization: "Well organized — have documentation for all achievements",
      documentationAvailable: "Yes — compensation, media coverage, speaking engagements, award letters",
      linkedinUrl: "https://linkedin.com/in/yuki-tanaka-product",
      whyApplying: "I want a dedicated advisor to help build the strongest possible EB-1A case and coordinate with my immigration attorney.",
      timeline: "File within 6 months",
      status: "reviewed",
      paymentStatus: "received",
      paymentNotes: "Paid $2,500 engagement fee via wire transfer on March 15, 2026",
      paymentReceivedAt: new Date("2026-03-15T18:00:00Z"),
      paymentReceivedBy: "staff",
      adminConfidenceScore: 87,
      adminStrengtheningRoadmap: "1. Secure 2 more structured media features. 2. Obtain letters from Stripe leadership and at least 3 external VCs referencing Yuki's critical role. 3. Document 10x volume growth with verifiable Stripe metrics. 4. Add 1-2 conference speaking slots at global fintech events.",
      adminEstimatedTimeline: "6-8 months to file-ready",
      adminReviewNotes: "Strong profile for EB-1A. High salary, press, awards, and critical role are solid. Publications are thin — HBR case studies are good but need framing. Judging criterion (Fintech Awards) is useful. Main gap: need stronger evidence of national/international recognition beyond fintech industry.",
      adminReviewedAt: new Date("2026-03-18T11:00:00Z"),
      adminReviewedBy: "staff",
      includeExcellenceLab: true,
    },
    {
      fullName: "Aisha Nkrumah",
      email: "aisha.nkrumah@prospectapp.demo",
      currentRole: "Senior Data Scientist, Palantir Technologies",
      country: "United States",
      visaPath: "EB-1A",
      field: "Data Science / Defense Technology",
      yearsExperience: "6",
      topAchievements: "Lead data scientist on classified federal defense contracts. 5 patents. Contributed to systems now used by 4 federal agencies.",
      publications: "4 papers (2 classified, 2 public). ICLR 2023, NeurIPS 2022.",
      awards: "Palantir Forward Deployed Excellence Award (2023). In-Q-Tel Fellows Program.",
      evidenceOrganization: "Partially organized — some documents are clearance-restricted",
      documentationAvailable: "Selective — some classified documentation requires attorney coordination",
      whyApplying: "Need expert guidance navigating EB-1A with a classified work profile. Want to understand what I can and cannot use as evidence.",
      timeline: "File within 12 months",
      status: "submitted",
      paymentStatus: "pending",
      includeExcellenceLab: false,
    },
    {
      fullName: "Mateo Rivera",
      email: "mateo.rivera@biotech.demo",
      currentRole: "Principal Scientist, Genentech",
      country: "United States",
      visaPath: "EB-1A",
      field: "Oncology / Drug Discovery",
      yearsExperience: "11",
      topAchievements: "Discovered 2 drug candidates now in Phase II clinical trials. 18 publications in Cancer Cell, Nature Cancer, JCI. 340K in NIH grant funding.",
      publications: "18 papers including Nature Cancer (2022, 2024), Cancer Cell (2023), JCI (2021). h-index: 19.",
      awards: "American Cancer Society Young Investigator Award (2022). Genentech Annual Research Award (2023, 2024).",
      evidenceOrganization: "Highly organized — all documents ready",
      documentationAvailable: "Full documentation including clinical trial records, grant documentation, peer review invitations",
      whyApplying: "I have a strong academic profile and want advisory support to translate it into a winning EB-1A petition. My attorney is handling filing but needs the strategy layer.",
      timeline: "File within 3 months",
      status: "under_review",
      paymentStatus: "pending",
      includeExcellenceLab: true,
    },
  ]);

  console.log("  ✓ Created 3 Elite Blueprint applications (cleared test data)");
  console.log("\n✅ Seed complete!\n");
  console.log("Demo login credentials (all profiles):");
  console.log("  Password: Demo1234!");
  console.log("  Emails:");
  console.log("    arjun.krishnamurthy@demo.pinnacle3.dev");
  console.log("    mei.chen@demo.pinnacle3.dev");
  console.log("    alejandro.vega@demo.pinnacle3.dev");
  console.log("    fatima.alrashid@demo.pinnacle3.dev");
  console.log("    yuki.tanaka@demo.pinnacle3.dev");

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
