/**
 * legalPdfTemplate.ts — Pinnacle³
 *
 * All petition PDFs are produced from this single template factory.
 * Uses PDFKit with bufferPages=true so page-number footers can be
 * written retrospectively after all content is rendered.
 */

import PDFDocument from "pdfkit";
import {
  LEGAL_DISCLAIMER,
  AI_DISCLAIMER,
  DOCUMENT_DRAFT_WARNING,
  RECO_LETTER_NOTE,
} from "@workspace/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocType =
  | "criteria_exhibit"
  | "recommendation_letter"
  | "exhibit_index"
  | "cover_letter"
  | "o1_itinerary";

export interface DocumentMetadata {
  clientName: string;
  clientEmail: string;
  generatedAt: Date;
  staffName?: string;
  visaPath: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72; // 1-inch margins
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function measureBoxHeight(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  padding: number,
  width: number,
  fontSize: number,
): number {
  const savedFont = doc.currentLineHeight(true);
  const lines = doc.heightOfString(text, { width: width - padding * 2, fontSize });
  void savedFont;
  return lines + padding * 2 + 4;
}

function drawBox(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: string,
  strokeColor?: string,
  lineWidth = 1,
): void {
  doc.save();
  if (strokeColor) {
    doc.rect(x, y, w, h).lineWidth(lineWidth).fillAndStroke(fillColor, strokeColor);
  } else {
    doc.rect(x, y, w, h).fill(fillColor);
  }
  doc.restore();
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function addFooter(
  doc: InstanceType<typeof PDFDocument>,
  pageNum: number,
  totalPages: number,
): void {
  const footerY = PAGE_HEIGHT - MARGIN + 20;
  doc.save();
  doc.font("Helvetica").fontSize(7).fillColor("#555555");
  doc.text("Pinnacle³ — Not Legal Advice", MARGIN, footerY, { lineBreak: false });
  doc.text(`Page ${pageNum} of ${totalPages}`, MARGIN, footerY, {
    width: CONTENT_WIDTH,
    align: "center",
    lineBreak: false,
  });
  doc.text("AI-assisted — verify content", MARGIN, footerY, {
    width: CONTENT_WIDTH,
    align: "right",
    lineBreak: false,
  });
  doc.restore();
}

// ─── Main factory ─────────────────────────────────────────────────────────────

export function createDocument(
  docType: DocType,
  title: string,
  metadata: DocumentMetadata,
): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    bufferPages: true,
    info: {
      Title: title,
      Author: "Pinnacle³ — AI-Assisted Draft",
      Subject: `${metadata.visaPath.toUpperCase()} Petition Document`,
      Creator: "Pinnacle³ Platform",
    },
  });

  let currentY = MARGIN;

  // ── 1. Cover-letter-only: red-bordered DRAFT WARNING ──────────────────────
  if (docType === "cover_letter") {
    const warnPad = 10;
    const warnText = DOCUMENT_DRAFT_WARNING;
    doc.font("Helvetica-Bold").fontSize(9);
    const warnTextH = doc.heightOfString(warnText, { width: CONTENT_WIDTH - warnPad * 2 });
    const warnH = warnTextH + warnPad * 2 + 14;

    drawBox(doc, MARGIN, currentY, CONTENT_WIDTH, warnH, "#fff5f5", "#cc0000", 2);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#cc0000")
      .text("⚠  DRAFT WARNING", MARGIN + warnPad, currentY + warnPad);
    doc.font("Helvetica").fontSize(8).fillColor("#333333")
      .text(warnText, MARGIN + warnPad, currentY + warnPad + 14, {
        width: CONTENT_WIDTH - warnPad * 2,
      });
    currentY += warnH + 10;
  }

  // ── 2. Gray disclaimer block (all docs) ───────────────────────────────────
  const pad = 10;
  doc.font("Helvetica").fontSize(8);
  const legalH = doc.heightOfString(LEGAL_DISCLAIMER, { width: CONTENT_WIDTH - pad * 2 });
  const aiH = doc.heightOfString(AI_DISCLAIMER, { width: CONTENT_WIDTH - pad * 2 });
  const boxH = pad * 2 + 12 + legalH + 10 + 12 + aiH + 4;

  drawBox(doc, MARGIN, currentY, CONTENT_WIDTH, boxH, "#f5f5f5");

  doc.font("Helvetica-Bold").fontSize(9).fillColor("#222222")
    .text("IMPORTANT NOTICE", MARGIN + pad, currentY + pad);
  doc.font("Helvetica").fontSize(8).fillColor("#333333")
    .text(LEGAL_DISCLAIMER, MARGIN + pad, currentY + pad + 12, {
      width: CONTENT_WIDTH - pad * 2,
    });
  const aiLabelY = currentY + pad + 12 + legalH + 8;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#222222")
    .text("AI-GENERATED CONTENT", MARGIN + pad, aiLabelY);
  doc.font("Helvetica").fontSize(8).fillColor("#333333")
    .text(AI_DISCLAIMER, MARGIN + pad, aiLabelY + 12, {
      width: CONTENT_WIDTH - pad * 2,
    });
  currentY += boxH + 10;

  // ── 3. Reco-letter-only: amber note ───────────────────────────────────────
  if (docType === "recommendation_letter") {
    doc.font("Helvetica").fontSize(8);
    const recoH = doc.heightOfString(RECO_LETTER_NOTE, { width: CONTENT_WIDTH - pad * 2 });
    const amberH = recoH + pad * 2 + 14;

    drawBox(doc, MARGIN, currentY, CONTENT_WIDTH, amberH, "#fff8e1", "#f9a825", 1);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#7a5c00")
      .text("NOTE TO RECOMMENDER", MARGIN + pad, currentY + pad);
    doc.font("Helvetica").fontSize(8).fillColor("#5a4300")
      .text(RECO_LETTER_NOTE, MARGIN + pad, currentY + pad + 14, {
        width: CONTENT_WIDTH - pad * 2,
      });
    currentY += amberH + 10;
  }

  // ── 4. Document title ─────────────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#1E2D6B")
    .text(title, MARGIN, currentY, { width: CONTENT_WIDTH, align: "center" });
  currentY += 28;

  // ── 5. Metadata line ──────────────────────────────────────────────────────
  const metaLine = [
    `Client: ${metadata.clientName}`,
    `Visa: ${metadata.visaPath.toUpperCase()}`,
    `Generated: ${metadata.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
  ].join("  |  ");
  doc.font("Helvetica").fontSize(8).fillColor("#666666")
    .text(metaLine, MARGIN, currentY, { width: CONTENT_WIDTH, align: "center" });
  currentY += 20;

  // ── 6. Divider ────────────────────────────────────────────────────────────
  doc.save().moveTo(MARGIN, currentY).lineTo(MARGIN + CONTENT_WIDTH, currentY)
    .lineWidth(0.5).strokeColor("#999999").stroke().restore();

  return doc;
}

// ─── Content helpers (exported) ───────────────────────────────────────────────

export function addSectionHeading(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
): void {
  doc.moveDown(0.8);
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#1E2D6B").text(text, { underline: false });
  doc.moveDown(0.2);
  const y = doc.y;
  doc.save()
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_WIDTH, y)
    .lineWidth(0.5)
    .strokeColor("#1E2D6B")
    .stroke()
    .restore();
  doc.moveDown(0.3);
}

export function addBodyText(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
): void {
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor("#222222").text(text, {
    width: CONTENT_WIDTH,
    align: "justify",
    lineGap: 2,
  });
}

export function addEvidenceTable(
  doc: InstanceType<typeof PDFDocument>,
  items: Array<{ exhibit_ref: string; document_title: string; significance: string }>,
): void {
  if (!items || items.length === 0) return;

  doc.moveDown(0.5);

  const cols = {
    ref: { x: MARGIN, w: 60 },
    title: { x: MARGIN + 60, w: 180 },
    sig: { x: MARGIN + 240, w: CONTENT_WIDTH - 240 },
  };

  const headerY = doc.y;
  const rowH = 16;
  const headerH = rowH + 4;

  // Header background
  drawBox(doc, MARGIN, headerY, CONTENT_WIDTH, headerH, "#1E2D6B");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff");
  doc.text("Exhibit", cols.ref.x + 4, headerY + 5, { width: cols.ref.w - 4, lineBreak: false });
  doc.text("Document Title", cols.title.x + 4, headerY + 5, { width: cols.title.w - 4, lineBreak: false });
  doc.text("Significance", cols.sig.x + 4, headerY + 5, { width: cols.sig.w - 4, lineBreak: false });

  let rowY = headerY + headerH;

  items.forEach((item, idx) => {
    const sigH = doc.heightOfString(item.significance ?? "", {
      width: cols.sig.w - 8,
      fontSize: 9,
    });
    const titleH = doc.heightOfString(item.document_title ?? "", {
      width: cols.title.w - 8,
      fontSize: 9,
    });
    const thisRowH = Math.max(rowH, sigH + 8, titleH + 8);

    const bg = idx % 2 === 0 ? "#f9f9f9" : "#ffffff";
    drawBox(doc, MARGIN, rowY, CONTENT_WIDTH, thisRowH, bg);

    // Cell borders
    doc.save()
      .rect(MARGIN, rowY, CONTENT_WIDTH, thisRowH)
      .lineWidth(0.3)
      .strokeColor("#cccccc")
      .stroke()
      .restore();

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1E2D6B")
      .text(item.exhibit_ref ?? "", cols.ref.x + 4, rowY + 5, { width: cols.ref.w - 4, lineBreak: false });
    doc.font("Helvetica").fontSize(9).fillColor("#222222")
      .text(item.document_title ?? "", cols.title.x + 4, rowY + 5, { width: cols.title.w - 8 });
    doc.text(item.significance ?? "", cols.sig.x + 4, rowY + 5, { width: cols.sig.w - 8 });

    rowY += thisRowH;
    doc.y = rowY;
  });

  doc.moveDown(0.5);
}

export function addPageBreak(doc: InstanceType<typeof PDFDocument>): void {
  doc.addPage();
}

export async function finalizePdf(
  doc: InstanceType<typeof PDFDocument>,
): Promise<Buffer> {
  // Retrospectively add page-numbered footers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    addFooter(doc, i + 1, range.count);
  }
  doc.flushPages();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
