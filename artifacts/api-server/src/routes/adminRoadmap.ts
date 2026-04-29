/**
 * adminRoadmap.ts — Pinnacle³
 *
 * Resume upload, AI roadmap generation (Claude), PDF/Word export, email delivery.
 * All routes require X-Staff-Token header.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { createRequire } from "module";
import { eq } from "drizzle-orm";
import { db, prospectsTable } from "@workspace/db";
import { requireStaffAuth } from "../middlewares/staffAuth";
import { sendEmail } from "../services/emailService";
import multer from "multer";
import mammoth from "mammoth";
import Anthropic from "@anthropic-ai/sdk";
import PDFDocument from "pdfkit";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} from "docx";

const _require = createRequire(import.meta.url);
// Load pdf-parse via CJS require so module.parent is set and debug mode is skipped
const pdfParse = _require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Helpers ───────────────────────────────────────────────────────────────────

const INDIGO = { r: 30, g: 45, b: 107 };
const INDIGO_LIGHT = { r: 240, g: 244, b: 255 };
const GRAY_DARK = { r: 17, g: 24, b: 39 };
const GRAY_MED = { r: 107, g: 114, b: 128 };

function hexColor(c: { r: number; g: number; b: number }) {
  return `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`;
}

// ─── Route: Upload resume ────────────────────────────────────────────────────

router.post(
  "/admin/prospects/:id/resume",
  requireStaffAuth,
  upload.single("resume"),
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const file = req.file;
    if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }

    let resumeText = "";
    const mime = file.mimetype;
    const name = file.originalname.toLowerCase();

    try {
      if (mime === "application/pdf" || name.endsWith(".pdf")) {
        const parsed = await pdfParse(file.buffer);
        resumeText = parsed.text;
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        name.endsWith(".docx")
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        resumeText = result.value;
      } else if (mime === "text/plain" || name.endsWith(".txt")) {
        resumeText = file.buffer.toString("utf-8");
      } else {
        res.status(400).json({ error: "Unsupported file type. Please upload PDF, DOCX, or TXT." });
        return;
      }
    } catch (err) {
      res.status(422).json({ error: "Failed to parse resume file." });
      return;
    }

    await db.update(prospectsTable).set({
      resumeText: resumeText.slice(0, 50000),
      resumeFileName: file.originalname,
      roadmapContent: null,
      roadmapVisaCategory: null,
      roadmapGeneratedAt: null,
    }).where(eq(prospectsTable.id, id));

    res.json({ success: true, fileName: file.originalname, chars: resumeText.length });
  },
);

// ─── Route: Generate roadmap ──────────────────────────────────────────────────

router.post(
  "/admin/prospects/:id/roadmap/generate",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { visaCategory } = req.body as { visaCategory?: string };
    if (!visaCategory) { res.status(400).json({ error: "visaCategory is required" }); return; }

    const allowed = ["EB-1A", "EB-2 NIW", "O-1A"];
    if (!allowed.includes(visaCategory)) { res.status(400).json({ error: "Invalid visa category" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }
    if (!prospect.resumeText) { res.status(400).json({ error: "No resume uploaded for this prospect" }); return; }

    const prompt = buildRoadmapPrompt(prospect.fullName, visaCategory, prospect.resumeText);

    const message = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) ?? raw.match(/(\{[\s\S]*\})/);
    if (!jsonMatch) { res.status(500).json({ error: "Failed to parse AI response" }); return; }

    const roadmapJson = jsonMatch[1].trim();

    try {
      JSON.parse(roadmapJson);
    } catch {
      res.status(500).json({ error: "AI returned invalid JSON" });
      return;
    }

    await db.update(prospectsTable).set({
      roadmapContent: roadmapJson,
      roadmapVisaCategory: visaCategory,
      roadmapGeneratedAt: new Date(),
    }).where(eq(prospectsTable.id, id));

    res.json({ success: true, roadmap: JSON.parse(roadmapJson) });
  },
);

// ─── Route: Download PDF ──────────────────────────────────────────────────────

router.get(
  "/admin/prospects/:id/roadmap/download/pdf",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect?.roadmapContent) { res.status(404).json({ error: "No roadmap generated yet" }); return; }

    const roadmap = JSON.parse(prospect.roadmapContent) as RoadmapData;
    const fileName = `${prospect.fullName.replace(/\s+/g, "_")}_${roadmap.visaCategory.replace(/\s+/g, "_")}_Roadmap.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const pdfBuffer = await generatePDF(roadmap, prospect.fullName);
    res.end(pdfBuffer);
  },
);

// ─── Route: Download Word ─────────────────────────────────────────────────────

router.get(
  "/admin/prospects/:id/roadmap/download/docx",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect?.roadmapContent) { res.status(404).json({ error: "No roadmap generated yet" }); return; }

    const roadmap = JSON.parse(prospect.roadmapContent) as RoadmapData;
    const fileName = `${prospect.fullName.replace(/\s+/g, "_")}_${roadmap.visaCategory.replace(/\s+/g, "_")}_Roadmap.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const docxBuffer = await generateDocx(roadmap, prospect.fullName);
    res.end(docxBuffer);
  },
);

// ─── Route: Send roadmap by email ─────────────────────────────────────────────

router.post(
  "/admin/prospects/:id/roadmap/send",
  requireStaffAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [prospect] = await db.select().from(prospectsTable).where(eq(prospectsTable.id, id)).limit(1);
    if (!prospect?.roadmapContent) { res.status(404).json({ error: "No roadmap generated yet" }); return; }

    const roadmap = JSON.parse(prospect.roadmapContent) as RoadmapData;
    const firstName = prospect.fullName.split(" ")[0] ?? prospect.fullName;
    const pdfBuffer = await generatePDF(roadmap, prospect.fullName);
    const fileName = `${prospect.fullName.replace(/\s+/g, "_")}_${roadmap.visaCategory.replace(/\s+/g, "_")}_Roadmap.pdf`;

    await sendRoadmapEmail(prospect.email, firstName, roadmap.visaCategory, pdfBuffer, fileName);

    res.json({ success: true, message: `Roadmap sent to ${prospect.email}` });
  },
);

// ─── Claude prompt ────────────────────────────────────────────────────────────

function buildRoadmapPrompt(name: string, visa: string, resume: string): string {
  const visaInfo: Record<string, string> = {
    "EB-1A": "EB-1A Extraordinary Ability (self-petition, no employer/labor cert needed, no backlog for most nationalities). Requires meeting at least 3 of 10 USCIS criteria and passing the two-step Kazarian evaluation.",
    "EB-2 NIW": "EB-2 National Interest Waiver (self-petition, no labor cert, national interest waiver of job offer). Requires showing work is in a STEM/entrepreneurial field of substantial merit, you are well positioned to advance it, and it would be beneficial to waive the job offer requirement.",
    "O-1A": "O-1A Extraordinary Ability (employer-sponsored, temporary nonimmigrant visa). Requires meeting at least 3 of 8 USCIS criteria showing extraordinary achievement in the sciences, education, business, or athletics.",
  };

  const criteriaInfo: Record<string, string> = {
    "EB-1A": `The 10 EB-1A criteria:
1. Awards/prizes for excellence in the field
2. Membership in associations requiring outstanding achievement
3. Published material about the person in professional/major media
4. Judging others' work (peer review, panel judging, etc.)
5. Original scientific/scholarly/artistic/business contributions of major significance
6. Authorship of scholarly articles in professional publications
7. Work displayed at artistic exhibitions/showcases
8. Leading/critical role in distinguished organizations
9. High salary relative to peers
10. Commercial success in performing arts`,
    "EB-2 NIW": `The EB-2 NIW three-prong Dhanasar framework:
1. The proposed endeavor has substantial merit and national importance
2. The person is well positioned to advance the proposed endeavor
3. On balance, it would be beneficial to the US to waive the requirement of a job offer`,
    "O-1A": `The 8 O-1A criteria (must meet at least 3):
1. Awards/prizes for excellence
2. Membership in associations requiring outstanding achievement
3. Published material about the person
4. Judging others' work
5. Original contributions of major significance
6. Authorship of scholarly/academic articles
7. Leading/critical role in distinguished organizations
8. High salary/remuneration relative to peers`,
  };

  return `You are an expert US immigration strategist specializing in ${visa} petitions. Analyze the resume below and generate a detailed, personalized strategic roadmap for ${name}.

VISA CONTEXT: ${visaInfo[visa]}

CRITERIA: ${criteriaInfo[visa]}

RESUME:
${resume}

Generate a comprehensive roadmap as a JSON object with EXACTLY this structure. Be specific to this person's actual background, achievements, and gaps. Do NOT use generic advice — reference their specific experience, skills, publications, companies, roles, and achievements.

Return ONLY a JSON code block with this exact structure:

\`\`\`json
{
  "prospectName": "${name}",
  "visaCategory": "${visa}",
  "generatedDate": "${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}",
  "executiveSummary": {
    "strongCriteria": <number: criteria clearly met based on resume>,
    "partialCriteria": <number: criteria partially met or buildable>,
    "yearsExperience": "<years or range from resume>",
    "approvalRateContext": "<relevant approval rate or context for this visa>"
  },
  "visaOverview": {
    "whatItIs": "<2-3 sentence explanation of this visa and why it's relevant to this person specifically>",
    "howToQualify": ["<requirement 1>", "<requirement 2>", "<requirement 3>", "<requirement 4>"]
  },
  "criteriaAssessment": [
    {
      "criterion": "<criterion name>",
      "status": "<strong|partial|weak|not_applicable>",
      "currentEvidence": "<what they have now from resume>",
      "gaps": "<what is missing or could be stronger>",
      "actionRequired": "<specific action to strengthen or document this criterion>"
    }
  ],
  "roadmapPhases": [
    {
      "phaseNumber": <1-6>,
      "title": "<Phase N — Name>",
      "timeline": "<e.g. Months 1-2>",
      "urgency": "<Start immediately|Begin in parallel|Concurrent with Phase X|Critical for Filing>",
      "steps": ["<specific actionable step>", "<step 2>", "<step 3>", "<step 4>"]
    }
  ],
  "profileRarity": {
    "stats": [
      {"value": "<number or range>", "label": "<what it represents>", "sublabel": "<context>"},
      {"value": "<number or range>", "label": "<what it represents>", "sublabel": "<context>"},
      {"value": "<number or range>", "label": "<what it represents>", "sublabel": "<context>"},
      {"value": "<number or range>", "label": "<what it represents>", "sublabel": "<context>"}
    ],
    "competitiveAdvantage": "<2-3 sentences on what makes this person's niche/profile distinctive for USCIS>"
  },
  "risksAndMitigation": [
    {
      "risk": "<risk title>",
      "severity": "<High|Medium|Low>",
      "description": "<what the risk is and why it matters>",
      "mitigation": "<specific steps to mitigate>"
    }
  ],
  "confidenceAnalysis": {
    "currentConfidenceLow": <number: lower bound of current approval % without prep>,
    "currentConfidenceHigh": <number: upper bound of current approval %>,
    "currentLabel": "<e.g. HIGH RISK OF DENIAL OR RFE>",
    "postConfidenceLow": <number: lower bound after following roadmap>,
    "postConfidenceHigh": <number: upper bound after following roadmap>,
    "postLabel": "<e.g. STRONG APPROVAL LIKELIHOOD>",
    "timelineMonths": "<e.g. 9-14>",
    "upliftMessage": "<sentence on the confidence improvement>",
    "currentMetrics": {
      "strongCriteria": "<e.g. 2 of 10>",
      "independentLetters": "<e.g. 0 confirmed>",
      "judgingCredentials": "<e.g. None established>",
      "rfeRisk": "<e.g. Very High (70-80%)>"
    },
    "postMetrics": {
      "strongCriteria": "<e.g. 4-5 of 10>",
      "independentLetters": "<e.g. 4-6 confirmed>",
      "judgingCredentials": "<e.g. IEEE/field reviewer>",
      "rfeRisk": "<e.g. Low-Moderate (20-35%)>"
    }
  }
}
\`\`\`

Be concrete and specific. Reference the person's actual work history, specific papers/patents/achievements from the resume. The roadmap phases should be tailored to their specific gaps and strengths. Generate exactly 6 roadmap phases covering: audit/documentation, building evidence, publications/contributions, expert letters, awards/recognition, and filing.`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoadmapData {
  prospectName: string;
  visaCategory: string;
  generatedDate: string;
  executiveSummary: {
    strongCriteria: number;
    partialCriteria: number;
    yearsExperience: string;
    approvalRateContext: string;
  };
  visaOverview: {
    whatItIs: string;
    howToQualify: string[];
  };
  criteriaAssessment: Array<{
    criterion: string;
    status: string;
    currentEvidence: string;
    gaps: string;
    actionRequired: string;
  }>;
  roadmapPhases: Array<{
    phaseNumber: number;
    title: string;
    timeline: string;
    urgency: string;
    steps: string[];
  }>;
  profileRarity: {
    stats: Array<{ value: string; label: string; sublabel: string }>;
    competitiveAdvantage: string;
  };
  risksAndMitigation: Array<{
    risk: string;
    severity: string;
    description: string;
    mitigation: string;
  }>;
  confidenceAnalysis: {
    currentConfidenceLow: number;
    currentConfidenceHigh: number;
    currentLabel: string;
    postConfidenceLow: number;
    postConfidenceHigh: number;
    postLabel: string;
    timelineMonths: string;
    upliftMessage: string;
    currentMetrics: Record<string, string>;
    postMetrics: Record<string, string>;
  };
}

// ─── PDF Generator ────────────────────────────────────────────────────────────

async function generatePDF(roadmap: RoadmapData, prospectName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const MARGIN = 50;
    const WIDTH = doc.page.width - MARGIN * 2;
    const INDIGO_HEX = hexColor(INDIGO);
    const GRAY_HEX = hexColor(GRAY_DARK);

    function checkPageBreak(neededHeight: number) {
      if (doc.y + neededHeight > doc.page.height - 80) {
        doc.addPage();
      }
    }

    function sectionHeader(icon: string, title: string) {
      checkPageBreak(50);
      doc.moveDown(0.5);
      doc.rect(MARGIN, doc.y, WIDTH, 28).fill(INDIGO_HEX);
      doc.fillColor("white").fontSize(11).font("Helvetica-Bold")
        .text(`${icon}  ${title}`, MARGIN + 10, doc.y - 24, { width: WIDTH - 20 });
      doc.fillColor(GRAY_HEX).moveDown(0.8);
    }

    function bodyText(text: string, opts: object = {}) {
      doc.fontSize(10).font("Helvetica").fillColor(GRAY_HEX)
        .text(text, { lineGap: 3, ...opts });
    }

    function bulletItem(text: string) {
      checkPageBreak(18);
      const x = doc.x;
      doc.fontSize(10).font("Helvetica").fillColor(INDIGO_HEX).text("✓", x, doc.y, { width: 15, continued: false });
      doc.fontSize(10).font("Helvetica").fillColor(GRAY_HEX)
        .text(text, x + 18, doc.y - 12, { width: WIDTH - 18, lineGap: 2 });
      doc.moveDown(0.1);
    }

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 70).fill(INDIGO_HEX);
    doc.fillColor("white").fontSize(22).font("Helvetica-Bold")
      .text("Pinnacle³", MARGIN, 18, { continued: true });
    doc.fillColor("#a0aec0").fontSize(11).font("Helvetica")
      .text(`   EB-1A · EB-2 NIW · O-1A`, { continued: false });
    doc.fillColor("white").fontSize(13).font("Helvetica")
      .text(`${roadmap.visaCategory} — Strategic Profile Assessment & Roadmap to Approval`, MARGIN, 42);

    doc.moveDown(2);

    // ── Subtitle ──
    doc.fillColor(GRAY_HEX).fontSize(14).font("Helvetica-Bold")
      .text(`Prepared for: ${prospectName} | ${roadmap.generatedDate}`, { align: "center" });
    doc.moveDown(1.5);

    // ── Executive Summary Stats ──
    const stats = [
      { value: String(roadmap.executiveSummary.strongCriteria), label: "Strong Criteria" },
      { value: String(roadmap.executiveSummary.partialCriteria), label: "Partial Criteria" },
      { value: roadmap.executiveSummary.yearsExperience, label: "Years Experience" },
      { value: roadmap.executiveSummary.approvalRateContext, label: "Approval Context" },
    ];
    const statW = (WIDTH - 30) / 4;
    const statY = doc.y;
    stats.forEach((s, i) => {
      const x = MARGIN + i * (statW + 10);
      doc.rect(x, statY, statW, 55).fill(hexColor(INDIGO_LIGHT));
      doc.fillColor(INDIGO_HEX).fontSize(16).font("Helvetica-Bold")
        .text(s.value, x + 5, statY + 8, { width: statW - 10, align: "center" });
      doc.fillColor(hexColor(GRAY_MED)).fontSize(8).font("Helvetica")
        .text(s.label, x + 5, statY + 30, { width: statW - 10, align: "center" });
    });
    doc.y = statY + 65;
    doc.moveDown(1);

    // ── Section 1: Visa Overview ──
    sectionHeader("★", `SECTION 1 — WHAT IS ${roadmap.visaCategory}?`);
    bodyText(roadmap.visaOverview.whatItIs);
    doc.moveDown(0.5);
    doc.fillColor(INDIGO_HEX).fontSize(10).font("Helvetica-Bold").text("How to qualify:");
    doc.moveDown(0.2);
    roadmap.visaOverview.howToQualify.forEach((item) => bulletItem(item));
    doc.moveDown(1);

    // ── Section 2: Criteria Assessment ──
    sectionHeader("■", "SECTION 2 — CRITERIA ASSESSMENT");
    bodyText(`Assessed against ${prospectName}'s documented profile. You must satisfy the required criteria threshold to file.`);
    doc.moveDown(0.5);

    const statusColors: Record<string, string> = {
      strong: "#059669",
      partial: "#d97706",
      weak: "#dc2626",
      not_applicable: "#6b7280",
    };

    roadmap.criteriaAssessment.forEach((c) => {
      checkPageBreak(80);
      const color = statusColors[c.status] ?? "#6b7280";
      doc.rect(MARGIN, doc.y, WIDTH, 1).fill("#e9ecef");
      doc.moveDown(0.3);
      doc.fillColor(color).fontSize(10).font("Helvetica-Bold")
        .text(`[${c.status.toUpperCase()}]`, { continued: true });
      doc.fillColor(GRAY_HEX).text(`  ${c.criterion}`, { font: "Helvetica-Bold" });
      doc.fillColor(hexColor(GRAY_MED)).fontSize(9).font("Helvetica")
        .text(`Current: ${c.currentEvidence}`, { indent: 10, lineGap: 1 });
      if (c.gaps) {
        doc.fillColor("#dc2626").text(`Gap: ${c.gaps}`, { indent: 10, lineGap: 1 });
      }
      doc.fillColor(INDIGO_HEX).text(`Action: ${c.actionRequired}`, { indent: 10, lineGap: 1 });
      doc.moveDown(0.4);
    });

    doc.moveDown(0.5);

    // ── Section 3: Roadmap Phases ──
    sectionHeader("►", "SECTION 3 — STEP-BY-STEP ROADMAP TO FILING");
    roadmap.roadmapPhases.forEach((phase) => {
      checkPageBreak(100);
      doc.moveDown(0.3);
      doc.rect(MARGIN, doc.y, WIDTH, 22).fill("#f8f9fb");
      doc.fillColor(INDIGO_HEX).fontSize(11).font("Helvetica-Bold")
        .text(`Phase ${phase.phaseNumber} — ${phase.title.replace(/^Phase \d+ — /, "")}`, MARGIN + 8, doc.y - 18);
      doc.fillColor(hexColor(GRAY_MED)).fontSize(9).font("Helvetica")
        .text(`${phase.timeline} | ${phase.urgency}`, MARGIN + 8, doc.y - 6);
      doc.moveDown(0.6);
      phase.steps.forEach((step) => bulletItem(step));
      doc.moveDown(0.5);
    });

    // ── Section 4: Profile Rarity ──
    sectionHeader("●", "SECTION 4 — PROFILE RARITY & COMPETITIVE LANDSCAPE");
    const rStats = roadmap.profileRarity.stats;
    const rsW = (WIDTH - (rStats.length - 1) * 10) / Math.max(rStats.length, 1);
    const rsY = doc.y;
    rStats.forEach((s, i) => {
      const x = MARGIN + i * (rsW + 10);
      doc.rect(x, rsY, rsW, 50).fill(hexColor(INDIGO_LIGHT));
      doc.fillColor(INDIGO_HEX).fontSize(13).font("Helvetica-Bold")
        .text(s.value, x + 5, rsY + 7, { width: rsW - 10, align: "center" });
      doc.fillColor(hexColor(GRAY_MED)).fontSize(7.5).font("Helvetica")
        .text(s.label, x + 5, rsY + 26, { width: rsW - 10, align: "center" });
      doc.fillColor(hexColor(GRAY_MED)).fontSize(7).font("Helvetica")
        .text(s.sublabel, x + 5, rsY + 37, { width: rsW - 10, align: "center" });
    });
    doc.y = rsY + 60;
    doc.moveDown(0.5);
    bodyText(roadmap.profileRarity.competitiveAdvantage);
    doc.moveDown(1);

    // ── Section 5: Risks ──
    sectionHeader("⚠", "SECTION 5 — RISKS & MITIGATION STRATEGY");
    const risksPerRow = 2;
    const riskW = (WIDTH - 15) / risksPerRow;
    for (let i = 0; i < roadmap.risksAndMitigation.length; i += risksPerRow) {
      const rowRisks = roadmap.risksAndMitigation.slice(i, i + risksPerRow);
      const riskY = doc.y;
      const riskH = 90;
      checkPageBreak(riskH + 20);
      rowRisks.forEach((r, j) => {
        const x = MARGIN + j * (riskW + 15);
        const color = r.severity === "High" ? "#dc2626" : r.severity === "Medium" ? "#d97706" : "#6b7280";
        doc.rect(x, riskY, riskW, riskH).fill("#f8f9fb");
        doc.fillColor(color).fontSize(9).font("Helvetica-Bold")
          .text(`${r.severity} Risk: ${r.risk}`, x + 8, riskY + 8, { width: riskW - 16 });
        doc.fillColor(GRAY_HEX).fontSize(8).font("Helvetica")
          .text(r.description, x + 8, doc.y + 2, { width: riskW - 16, lineGap: 1 });
        doc.fillColor(INDIGO_HEX).fontSize(8).font("Helvetica-Bold")
          .text("Mitigation: ", x + 8, doc.y + 3, { continued: true, width: riskW - 16 });
        doc.fillColor(GRAY_HEX).font("Helvetica").text(r.mitigation, { lineGap: 1 });
      });
      doc.y = riskY + riskH + 12;
    }
    doc.moveDown(0.5);

    // ── Section 6: Confidence Analysis ──
    sectionHeader("▲", "SECTION 6 — APPROVAL CONFIDENCE ANALYSIS");
    const ca = roadmap.confidenceAnalysis;

    const halfW = (WIDTH - 15) / 2;
    const confY = doc.y;
    checkPageBreak(100);

    // Current
    doc.rect(MARGIN, confY, halfW, 85).fill("#fef2f2");
    doc.fillColor("#dc2626").fontSize(11).font("Helvetica-Bold")
      .text("CURRENT AS-IS PROFILE", MARGIN + 8, confY + 8, { width: halfW - 16 });
    doc.fontSize(22).text(`${ca.currentConfidenceLow}–${ca.currentConfidenceHigh}%`, MARGIN + 8, confY + 26, { width: halfW - 16, align: "center" });
    doc.fontSize(8).text("Estimated Approval Confidence", MARGIN + 8, confY + 53, { width: halfW - 16, align: "center" });
    doc.fillColor("#7f1d1d").fontSize(8).font("Helvetica-Bold")
      .text(ca.currentLabel, MARGIN + 8, confY + 64, { width: halfW - 16, align: "center" });

    // Post
    const pX = MARGIN + halfW + 15;
    doc.rect(pX, confY, halfW, 85).fill("#f0fdf4");
    doc.fillColor("#059669").fontSize(11).font("Helvetica-Bold")
      .text("POST-GUIDANCE PROFILE", pX + 8, confY + 8, { width: halfW - 16 });
    doc.fontSize(22).text(`${ca.postConfidenceLow}–${ca.postConfidenceHigh}%`, pX + 8, confY + 26, { width: halfW - 16, align: "center" });
    doc.fontSize(8).text("Estimated Approval Confidence", pX + 8, confY + 53, { width: halfW - 16, align: "center" });
    doc.fillColor("#14532d").fontSize(8).font("Helvetica-Bold")
      .text(ca.postLabel, pX + 8, confY + 64, { width: halfW - 16, align: "center" });

    doc.y = confY + 95;
    doc.fillColor(INDIGO_HEX).fontSize(10).font("Helvetica-Bold")
      .text(ca.upliftMessage, { align: "center" });
    doc.moveDown(0.8);

    // Metrics comparison table
    const allKeys = Object.keys(ca.currentMetrics);
    doc.fillColor(GRAY_HEX).fontSize(10).font("Helvetica-Bold").text("Factor-by-factor comparison:");
    doc.moveDown(0.3);
    allKeys.forEach((key) => {
      checkPageBreak(18);
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
      const curr = ca.currentMetrics[key] ?? "—";
      const post = ca.postMetrics[key] ?? "—";
      const rowY = doc.y;
      doc.rect(MARGIN, rowY, WIDTH, 16).fill(allKeys.indexOf(key) % 2 === 0 ? "#f8f9fb" : "white");
      doc.fillColor(GRAY_HEX).fontSize(8.5).font("Helvetica")
        .text(label, MARGIN + 6, rowY + 3, { width: WIDTH / 3, lineBreak: false });
      doc.fillColor("#dc2626").font("Helvetica")
        .text(curr, MARGIN + WIDTH / 3 + 6, rowY + 3, { width: WIDTH / 3, lineBreak: false });
      doc.fillColor("#059669").font("Helvetica")
        .text(post, MARGIN + (2 * WIDTH) / 3 + 6, rowY + 3, { width: WIDTH / 3, lineBreak: false });
      doc.y = rowY + 18;
    });

    doc.moveDown(2);

    // ── Footer ──
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(hexColor(GRAY_MED)).fontSize(8).font("Helvetica")
        .text(
          `Pinnacle³ Advisory · pinnaclecube.com · Generated ${roadmap.generatedDate} · Page ${i + 1} of ${range.count}`,
          MARGIN,
          doc.page.height - 35,
          { align: "center", width: WIDTH },
        );
    }

    doc.end();
  });
}

// ─── Word Generator ───────────────────────────────────────────────────────────

async function generateDocx(roadmap: RoadmapData, prospectName: string): Promise<Buffer> {
  const INDIGO_HEX_DOCX = "1E2D6B";

  function heading1(text: string) {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 150 },
    });
  }

  function heading2(text: string) {
    return new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
    });
  }

  function para(text: string, bold = false) {
    return new Paragraph({
      children: [new TextRun({ text, bold, size: 20 })],
      spacing: { after: 80 },
    });
  }

  function bullet(text: string) {
    return new Paragraph({
      children: [new TextRun({ text: `✓  ${text}`, size: 20 })],
      spacing: { after: 60 },
      indent: { left: 360 },
    });
  }

  function divider() {
    return new Paragraph({
      border: { bottom: { color: "E9ECEF", style: BorderStyle.SINGLE, size: 2 } },
      spacing: { after: 100 },
    });
  }

  const criteriaRows = roadmap.criteriaAssessment.map((c) =>
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c.criterion, bold: true, size: 18 })] })],
          width: { size: 2500, type: WidthType.DXA },
          shading: { fill: "F0F4FF", type: ShadingType.CLEAR, color: "auto" },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c.status.toUpperCase(), bold: true, size: 18, color: c.status === "strong" ? "059669" : c.status === "partial" ? "D97706" : "DC2626" })] })],
          width: { size: 1200, type: WidthType.DXA },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c.currentEvidence, size: 18 })] })],
          width: { size: 3000, type: WidthType.DXA },
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: c.actionRequired, size: 18 })] })],
          width: { size: 3000, type: WidthType.DXA },
        }),
      ],
    })
  );

  const criteriaTable = new Table({
    rows: [
      new TableRow({
        children: ["Criterion", "Status", "Current Evidence", "Action Required"].map((h) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 18 })] })],
            shading: { fill: INDIGO_HEX_DOCX, type: ShadingType.CLEAR, color: "auto" },
          })
        ),
        tableHeader: true,
      }),
      ...criteriaRows,
    ],
    width: { size: 9638, type: WidthType.DXA },
  });

  const sections: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: "Pinnacle³", bold: true, size: 44, color: INDIGO_HEX_DOCX })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [new TextRun({ text: `${roadmap.visaCategory} — Strategic Profile Assessment & Roadmap`, size: 28, color: INDIGO_HEX_DOCX })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Prepared for: ${prospectName} | ${roadmap.generatedDate}`, size: 22, color: "6B7280" })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),

    heading1(`Section 1 — What is ${roadmap.visaCategory}?`),
    para(roadmap.visaOverview.whatItIs),
    para("How to Qualify:", true),
    ...roadmap.visaOverview.howToQualify.map(bullet),
    divider(),

    heading1("Section 2 — Criteria Assessment"),
    para(`Assessed against ${prospectName}'s documented profile.`),
    criteriaTable,
    divider(),

    heading1("Section 3 — Step-by-Step Roadmap"),
    ...roadmap.roadmapPhases.flatMap((phase) => [
      heading2(`${phase.title} | ${phase.timeline} | ${phase.urgency}`),
      ...phase.steps.map(bullet),
    ]),
    divider(),

    heading1("Section 4 — Profile Rarity & Competitive Landscape"),
    para(roadmap.profileRarity.competitiveAdvantage),
    ...roadmap.profileRarity.stats.map((s) =>
      para(`${s.value} — ${s.label}: ${s.sublabel}`)
    ),
    divider(),

    heading1("Section 5 — Risks & Mitigation Strategy"),
    ...roadmap.risksAndMitigation.flatMap((r) => [
      para(`${r.severity} Risk: ${r.risk}`, true),
      para(r.description),
      para(`Mitigation: ${r.mitigation}`),
    ]),
    divider(),

    heading1("Section 6 — Approval Confidence Analysis"),
    para(`Current Profile: ${roadmap.confidenceAnalysis.currentConfidenceLow}–${roadmap.confidenceAnalysis.currentConfidenceHigh}% — ${roadmap.confidenceAnalysis.currentLabel}`, true),
    para(`After Pinnacle³ Guidance (${roadmap.confidenceAnalysis.timelineMonths} months): ${roadmap.confidenceAnalysis.postConfidenceLow}–${roadmap.confidenceAnalysis.postConfidenceHigh}% — ${roadmap.confidenceAnalysis.postLabel}`, true),
    para(roadmap.confidenceAnalysis.upliftMessage),
  ];

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  return Packer.toBuffer(doc);
}

// ─── Email: Roadmap delivery ──────────────────────────────────────────────────

async function sendRoadmapEmail(
  to: string,
  firstName: string,
  visaCategory: string,
  pdfBuffer: Buffer,
  fileName: string,
): Promise<void> {
  const { getUncachableResendClient } = await import("../services/resend");
  const FROM = "Pinnacle³ <support@pinnaclecube.com>";
  const APP_URL = process.env.FRONTEND_URL ?? "https://pinnaclecube.com";

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6fa;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6fa;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.06);">
        <tr><td style="background:#1E2D6B;padding:28px 40px;">
          <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.5px;">Pinnacle³</span>
          <span style="color:#a0aec0;font-size:13px;margin-left:10px;">EB-1A · EB-2 NIW · O-1A</span>
        </td></tr>
        <tr><td style="padding:40px 40px 32px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">Your ${visaCategory} Strategic Roadmap</h1>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">Hi ${firstName},</p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
            Your personalized <strong>${visaCategory} Strategic Profile Assessment & Roadmap</strong> is attached to this email as a PDF.
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
            Your roadmap includes a full criteria assessment based on your background, a phase-by-phase action plan, 
            a risk and mitigation analysis, and an approval confidence projection — giving you a clear, 
            concrete path to a compelling petition.
          </p>
          <table cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-left:4px solid #1E2D6B;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 24px;width:100%;">
            <tr><td>
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#1E2D6B;">WHAT'S IN YOUR ROADMAP</p>
              <p style="margin:0;font-size:14px;color:#374151;line-height:1.9;">
                ★ Criteria assessment (what you have, what you need)<br>
                ► Step-by-step phased action plan<br>
                ⚠ Risk identification and mitigation strategy<br>
                ▲ Approval confidence projection (current vs. post-guidance)
              </p>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
            <tr><td style="background:#1E2D6B;border-radius:7px;padding:13px 28px;">
              <a href="${APP_URL}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Explore Pinnacle³ Advisory</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8f9fb;padding:20px 40px;border-top:1px solid #e9ecef;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.8;">
            Questions about your roadmap? Reply to this email — we read every one.<br>
            Pinnacle³ · <a href="${APP_URL}" style="color:#1E2D6B;text-decoration:none;">pinnaclecube.com</a> · 470 Olde Worthington Rd, Westerville, OH 43082
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { client } = await getUncachableResendClient();
    const { error } = await client.emails.send({
      from: FROM,
      to: [to],
      subject: `Your ${visaCategory} Strategic Roadmap — Pinnacle³`,
      html,
      text: `Hi ${firstName},\n\nYour personalized ${visaCategory} Strategic Roadmap is attached.\n\nQuestions? Reply to this email.\n\nPinnacle³ · pinnaclecube.com`,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });
    if (error) {
      console.error("[adminRoadmap] Resend error:", error);
      throw new Error(JSON.stringify(error));
    }
  } catch (err) {
    console.error("[adminRoadmap] Failed to send roadmap email:", err);
    throw err;
  }
}

export default router;
