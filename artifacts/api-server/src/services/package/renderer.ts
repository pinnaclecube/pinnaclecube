/**
 * renderer.ts — Evidence Package module, stage 6 render (spec section 4 stage 6 + §7).
 *
 * Converts a generated content object to a .docx in the EB-1A house style
 * (packageTemplateConfig layer 4), embedding page images as captioned figures,
 * with the running header derived from the exhibit code. Enforces the two
 * renderer checks from spec §7.2 (unsourced-metric, review-notes-overlap) and
 * returns the flags it raises. Pure: no DB, no model — unit-checkable offline.
 */

import {
  Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer,
  AlignmentType, PageNumber, HeadingLevel,
} from "docx";
import {
  EB1A_HOUSE_STYLE as HS, describeExhibitCode, type DocRole,
} from "@workspace/shared";

export interface PlanFlag { kind: string; message: string; severity: "info" | "warning" | "error" }
export interface FigureInput { caption: string; png: Buffer }
export interface RenderMeta {
  applicantName: string;
  criterionName?: string;
  generatedAt: Date;
  displayNumber?: number;
  approved?: boolean;
}

export type RenderContent =
  | { kind: "sub_exhibit"; sourceSummary: string; relevanceNote: string }
  | { kind: "criterion"; regulation?: string; regulatoryStandard: string; evidenceSummary: string; argument: string; conclusion: string }
  | { kind: "final_merits"; regulation?: string; introduction: string; criteriaMet: string; totalityArgument: string; conclusion: string; indexRows?: { displayNumber: number; code: string; title: string; criterion?: string }[] }
  | { kind: "index"; rows: { displayNumber: number; code: string; title: string; criterion?: string }[] };

export interface RenderResult { buffer: Buffer; flags: PlanFlag[]; checkedText: string }

const HALF = (pt: number) => pt * 2; // docx font size unit = half-points
const TWIP_INCH = 1440;
const PX_PER_INCH = 96;

// ─── §7.2 renderer checks (pure) ───────────────────────────────────────────────

const CITATION_RE = /\[Exhibit\s+[A-Za-z0-9]+\]/i;
// Quantitative claims (not bare years): percentages, ranks, grouped numbers, or a
// number followed by a counted noun.
const METRIC_RE = /(\d+(?:\.\d+)?\s*%|#\s?\d+|\branked\s+\d+|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s*(?:x|times|citations?|users?|hospitals?|countries|papers?|reviews?|patents?|downloads?)\b)/i;

export function unsourcedMetricCheck(text: string): PlanFlag[] {
  const flags: PlanFlag[] = [];
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const s = raw.trim();
    if (!s) continue;
    if (METRIC_RE.test(s) && !CITATION_RE.test(s)) {
      flags.push({ kind: "unsourced_metric", message: `metric without an exhibit citation: "${s.slice(0, 120)}"`, severity: "warning" });
    }
  }
  return flags;
}

function shingles(text: string, n = 6): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

export function reviewNotesOverlapCheck(text: string, reviewNotes: string | null | undefined): PlanFlag[] {
  if (!reviewNotes?.trim()) return [];
  const noteShingles = shingles(reviewNotes);
  if (noteShingles.size === 0) return [];
  const bodyShingles = shingles(text);
  for (const sh of noteShingles) {
    if (bodyShingles.has(sh)) {
      return [{ kind: "review_notes_overlap", message: `generated prose copies staff review notes: "${sh}"`, severity: "error" }];
    }
  }
  return [];
}

// ─── docx building blocks (house style) ────────────────────────────────────────

function heading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { after: HS.paraSpacingAfterPt * 20, before: HS.paraSpacingAfterPt * 20 },
    children: [new TextRun({ text, bold: true, size: HALF(HS.headingSizesPt.h2), font: HS.bodyFont })],
  });
}

function body(text: string): Paragraph[] {
  return text.split(/\n{2,}/).map((para) =>
    new Paragraph({
      spacing: { after: HS.paraSpacingAfterPt * 20, line: Math.round(HS.lineSpacing * 240) },
      children: [new TextRun({ text: para.trim(), size: HALF(HS.bodySizePt), font: HS.bodyFont })],
    }),
  );
}

function titleBlock(code: string, meta: RenderMeta): Paragraph[] {
  const d = describeExhibitCode(code);
  const out: Paragraph[] = [
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: d.headerTitle, bold: true, size: HALF(HS.headingSizesPt.h1), color: HS.accentColor.replace("#", ""), font: HS.bodyFont })],
    }),
  ];
  const sub: string[] = [];
  if (meta.criterionName && d.role !== "index" && d.role !== "final_merits") sub.push(meta.criterionName);
  sub.push(meta.applicantName);
  sub.push(meta.generatedAt.toISOString().slice(0, 10));
  out.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: sub.join("  ·  "), size: HALF(HS.bodySizePt - 1), font: HS.bodyFont, color: "666666" })] }));
  if (!meta.approved) {
    out.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: HS.draftWatermark, bold: true, color: "CC0000", size: HALF(HS.bodySizePt - 1), font: HS.bodyFont })] }));
  }
  return out;
}

function pngDimensions(buf: Buffer): { width: number; height: number } {
  // PNG: width at byte 16, height at byte 20 (big-endian uint32).
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  return { width: 800, height: 600 };
}

function figureParagraphs(fig: FigureInput, code: string, index: number): Paragraph[] {
  const { width, height } = pngDimensions(fig.png);
  const maxPx = HS.figureMaxWidthInches * PX_PER_INCH;
  const scale = width > maxPx ? maxPx / width : 1;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const captionText = HS.figureCaptionFormat
    .replace("{code}", code).replace("{k}", String(index + 1))
    .replace("{source}", fig.caption.split(" — ")[0] ?? fig.caption)
    .replace("{desc}", fig.caption.split(" — ")[1] ?? "");
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [new ImageRun({ type: "png", data: fig.png, transformation: { width: w, height: h } })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: HS.paraSpacingAfterPt * 20 },
      children: [new TextRun({ text: captionText, italics: HS.figureCaptionItalic, size: HALF(HS.figureCaptionSizePt), font: HS.bodyFont, color: "444444" })],
    }),
  ];
}

function runningHeader(code: string, meta: RenderMeta): Header {
  const d = describeExhibitCode(code);
  const parts = [d.headerTitle];
  if (meta.criterionName && d.role === "sub_exhibit") parts.push(meta.criterionName);
  return new Header({
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: parts.join(" · "), size: HALF(9), font: HS.bodyFont, color: "888888" })] })],
  });
}

function runningFooter(code: string, meta: RenderMeta): Footer {
  const text = HS.footerFormat.replace("{displayNumber}", meta.displayNumber != null ? String(meta.displayNumber) : code).replace("{code}", code);
  const [pre, post] = text.split("{page}");
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: pre.replace("{pages}", ""), size: HALF(8), font: HS.bodyFont, color: "888888" }),
        new TextRun({ children: [PageNumber.CURRENT], size: HALF(8), font: HS.bodyFont, color: "888888" }),
        new TextRun({ text: (post ?? "").replace("{pages}", ""), size: HALF(8), font: HS.bodyFont, color: "888888" }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: HALF(8), font: HS.bodyFont, color: "888888" }),
      ],
    })],
  });
}

function sectionBody(content: RenderContent, code: string, figures: FigureInput[]): { children: Paragraph[]; checkedText: string } {
  const children: Paragraph[] = [];
  const narrative: string[] = [];
  const add = (hdr: string, text?: string) => { children.push(heading(hdr)); if (text) { children.push(...body(text)); narrative.push(text); } };

  if (content.kind === "sub_exhibit") {
    add("Summary of Evidence", content.sourceSummary);
    children.push(heading("Supporting Documents"));
    figures.forEach((f, i) => children.push(...figureParagraphs(f, code, i)));
    add("Relevance", content.relevanceNote);
  } else if (content.kind === "criterion") {
    children.push(heading("Regulatory Standard"));
    if (content.regulation) children.push(...body(content.regulation));
    children.push(...body(content.regulatoryStandard)); narrative.push(content.regulatoryStandard);
    add("Evidence Submitted", content.evidenceSummary);
    add("Argument", content.argument);
    add("Conclusion", content.conclusion);
  } else if (content.kind === "final_merits") {
    add("Introduction", content.introduction);
    add("Criteria Met", content.criteriaMet);
    add("Final Merits Determination", content.totalityArgument);
    if (content.indexRows && content.indexRows.length > 0) {
      children.push(heading("Index of Exhibits"));
      for (const r of content.indexRows) {
        children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `Exhibit ${r.displayNumber} (${r.code}) — ${r.title}${r.criterion ? ` [${r.criterion}]` : ""}`, size: HALF(HS.bodySizePt), font: HS.bodyFont })] }));
      }
    }
    add("Conclusion", content.conclusion);
  } else {
    children.push(heading("Index of Exhibits"));
    for (const r of content.rows) {
      children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `Exhibit ${r.displayNumber} (${r.code}) — ${r.title}${r.criterion ? ` [${r.criterion}]` : ""}`, size: HALF(HS.bodySizePt), font: HS.bodyFont })] }));
    }
  }
  return { children, checkedText: narrative.join("\n\n") };
}

export async function renderExhibitDocx(opts: {
  role: DocRole;
  exhibitCode: string;
  content: RenderContent;
  meta: RenderMeta;
  figures?: FigureInput[];
  reviewNotes?: string | null;
}): Promise<RenderResult> {
  const { exhibitCode, content, meta } = opts;
  const figures = opts.figures ?? [];
  const sec = sectionBody(content, exhibitCode, figures);

  const flags: PlanFlag[] = [
    ...unsourcedMetricCheck(sec.checkedText),
    ...reviewNotesOverlapCheck(sec.checkedText, opts.reviewNotes),
  ];

  const doc = new Document({
    styles: { default: { document: { run: { font: HS.bodyFont, size: HALF(HS.bodySizePt) } } } },
    sections: [{
      properties: { page: { margin: { top: TWIP_INCH, bottom: TWIP_INCH, left: TWIP_INCH, right: TWIP_INCH } } },
      headers: { default: runningHeader(exhibitCode, meta) },
      footers: { default: runningFooter(exhibitCode, meta) },
      children: [...titleBlock(exhibitCode, meta), ...sec.children],
    }],
  });

  const buffer = Buffer.from(await Packer.toBuffer(doc));
  return { buffer, flags, checkedText: sec.checkedText };
}
