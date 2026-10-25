/**
 * letterDocxService.ts — Pinnacle³
 *
 * Step 4 — render a finalized letter draft (Markdown) to a clean professional
 * DOCX (Times New Roman 12pt, letter spacing). Handles headings, bold/italic,
 * bullet lists, and preserves intra-paragraph line breaks (e.g. the signature
 * block). No Markdown artifacts in the output. Uses the installed `docx` lib.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  type IParagraphOptions,
} from "docx";

// Inline **bold** / *italic* → TextRuns (markers stripped).
function inlineRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push(new TextRun(text.slice(last, m.index)));
    if (m[2] !== undefined || m[4] !== undefined) {
      runs.push(new TextRun({ text: m[2] ?? m[4] ?? "", bold: true }));
    } else {
      runs.push(new TextRun({ text: m[3] ?? m[5] ?? "", italics: true }));
    }
    last = re.lastIndex;
  }
  if (last < text.length) runs.push(new TextRun(text.slice(last)));
  if (runs.length === 0) runs.push(new TextRun(text));
  return runs;
}

// A paragraph whose lines are joined with soft line breaks (preserves e.g. the
// signature block). First line's runs, then each subsequent line after a break.
function multiLineRuns(lines: string[]): TextRun[] {
  const runs: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) runs.push(new TextRun({ break: 1 }));
    runs.push(...inlineRuns(line));
  });
  return runs;
}

const PARA_SPACING: IParagraphOptions["spacing"] = { after: 200, line: 276 }; // ~10pt after, 1.15

export async function markdownToLetterDocx(markdown: string): Promise<Buffer> {
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .replace(/```[a-z]*\n?|```/gi, "") // strip stray code fences
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

    // Heading block (single line starting with #).
    const h = lines.length === 1 ? /^(#{1,3})\s+(.*)$/.exec(lines[0]) : null;
    if (h) {
      paragraphs.push(
        new Paragraph({
          children: inlineRuns(h[2]),
          heading: h[1].length === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 120 },
        }),
      );
      continue;
    }

    // Bullet list block (every line is a - / * item).
    const isBullets = lines.length > 0 && lines.every((l) => /^[-*]\s+/.test(l));
    if (isBullets) {
      for (const l of lines) {
        paragraphs.push(
          new Paragraph({
            children: inlineRuns(l.replace(/^[-*]\s+/, "")),
            bullet: { level: 0 },
            spacing: { after: 80 },
          }),
        );
      }
      continue;
    }

    // Regular paragraph (preserve intra-block line breaks).
    paragraphs.push(new Paragraph({ children: multiLineRuns(lines), spacing: PARA_SPACING }));
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 24 } }, // 24 half-pts = 12pt
      },
    },
    sections: [{ children: paragraphs }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
