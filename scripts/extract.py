#!/usr/bin/env python3
"""
extract.py — Evidence Package module, stage 3 extractor (spec section 4 stage 3).

Standalone and side-effect-light: given one input file and an output directory,
it produces the document's text, one PNG page image per page, and an OCR
confidence for any page whose embedded text is below a threshold. It prints a
single JSON object to stdout and never raises to the caller — on failure it
prints {"ok": false, "error": "..."}.

Pipeline (per spec):
  - office docs (.docx/.doc/.pptx/.xlsx/.odt/…) -> PDF via LibreOffice (soffice)
  - PDF                                         -> text via pdfplumber, pages
                                                   rasterized via poppler pdftoppm
  - image files                                 -> used directly as one page
  - any page with < MIN_TEXT_CHARS of embedded   -> OCR with tesseract
    text                                           (pytesseract), confidence kept

Usage:
  python3 extract.py <input_file> <out_dir> [--dpi 150] [--min-text-chars 20]

Safety: invoke with the process cwd set to a trusted directory (e.g. the output
dir), never the untrusted input's directory, and pass the input as an absolute
path. This script lives in scripts/ (separate from any downloaded file), so no
planted module in the input's directory is ever placed on sys.path — the caller
(extractor.ts) sets cwd accordingly.
"""

import sys
import os
import json
import glob
import subprocess
import tempfile

DPI = 150
MIN_TEXT_CHARS = 20

OFFICE_EXT = {
    ".doc", ".docx", ".odt", ".rtf", ".ppt", ".pptx", ".odp",
    ".xls", ".xlsx", ".ods", ".csv",
}
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".webp"}


def _soffice_to_pdf(src: str, out_dir: str) -> str:
    """Convert an office document to PDF with a private LibreOffice profile
    (avoids the shared-profile lock when runs overlap). Returns the PDF path.
    The UserInstallation profile must be an ABSOLUTE file:// URI — a relative
    path makes soffice hang."""
    src = os.path.abspath(src)
    out_dir = os.path.abspath(out_dir)
    profile = os.path.join(out_dir, "_lo_profile")  # absolute (out_dir is absolute)
    cmd = [
        "soffice", "--headless", "--norestore",
        "-env:UserInstallation=file://" + profile,
        "--convert-to", "pdf", "--outdir", out_dir, src,
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    produced = os.path.join(out_dir, os.path.splitext(os.path.basename(src))[0] + ".pdf")
    if not os.path.exists(produced):
        found = glob.glob(os.path.join(out_dir, "*.pdf"))
        if not found:
            raise RuntimeError("LibreOffice produced no PDF")
        produced = found[0]
    return produced


def _rasterize(pdf_path: str, out_dir: str, dpi: int) -> list:
    """Rasterize every PDF page to PNG with poppler pdftoppm. Returns ordered
    list of PNG paths."""
    prefix = os.path.join(out_dir, "page")
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(dpi), pdf_path, prefix],
        check=True, capture_output=True, timeout=180,
    )
    return sorted(glob.glob(prefix + "-*.png"))


def _ocr_image(png_path: str):
    """OCR a page image; return (text, mean_confidence 0-100 or None)."""
    import pytesseract
    from PIL import Image
    from pytesseract import Output

    with Image.open(png_path) as im:
        data = pytesseract.image_to_data(im, output_type=Output.DICT)
    words, confs = [], []
    for txt, conf in zip(data.get("text", []), data.get("conf", [])):
        if txt and txt.strip():
            words.append(txt)
            try:
                c = float(conf)
            except (TypeError, ValueError):
                c = -1.0
            if c >= 0:
                confs.append(c)
    text = " ".join(words).strip()
    confidence = round(sum(confs) / len(confs), 1) if confs else None
    return text, confidence


def _process_pdf(pdf_path: str, out_dir: str, dpi: int, min_chars: int) -> dict:
    import pdfplumber

    page_texts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_texts.append((page.extract_text() or "").strip())

    images = _rasterize(pdf_path, out_dir, dpi)
    pages, full_text, ocr_confidences = [], [], []
    count = max(len(page_texts), len(images))
    for i in range(count):
        embedded = page_texts[i] if i < len(page_texts) else ""
        img = images[i] if i < len(images) else None
        ocr_applied, ocr_conf, text = False, None, embedded
        if len(embedded) < min_chars and img:
            ocr_text, ocr_conf = _ocr_image(img)
            ocr_applied = True
            if ocr_conf is not None:
                ocr_confidences.append(ocr_conf)
            if len(ocr_text) > len(embedded):
                text = ocr_text
        full_text.append(text)
        pages.append({
            "index": i,
            "image": os.path.basename(img) if img else None,
            "textChars": len(text),
            "ocr": {"applied": ocr_applied, "confidence": ocr_conf},
        })
    joined = "\n\n".join(t for t in full_text if t)
    return {
        "pages": pages,
        "text": joined,
        "charCount": len(joined),
        "ocrConfidences": ocr_confidences,
    }


def _process_image(img_path: str, out_dir: str) -> dict:
    from PIL import Image

    page_png = os.path.join(out_dir, "page-1.png")
    with Image.open(img_path) as im:
        im.convert("RGB").save(page_png, "PNG")
    text, conf = _ocr_image(page_png)
    return {
        "pages": [{
            "index": 0,
            "image": os.path.basename(page_png),
            "textChars": len(text),
            "ocr": {"applied": True, "confidence": conf},
        }],
        "text": text,
        "charCount": len(text),
        "ocrConfidences": [conf] if conf is not None else [],
    }


def main() -> int:
    args = [a for a in sys.argv[1:]]
    dpi, min_chars = DPI, MIN_TEXT_CHARS
    positional = []
    i = 0
    while i < len(args):
        if args[i] == "--dpi":
            dpi = int(args[i + 1]); i += 2
        elif args[i] == "--min-text-chars":
            min_chars = int(args[i + 1]); i += 2
        else:
            positional.append(args[i]); i += 1
    if len(positional) < 2:
        print(json.dumps({"ok": False, "error": "usage: extract.py <input> <out_dir>"}))
        return 2

    src, out_dir = positional[0], positional[1]
    os.makedirs(out_dir, exist_ok=True)
    ext = os.path.splitext(src)[1].lower()

    try:
        if not os.path.exists(src):
            raise FileNotFoundError(src)
        if ext in IMAGE_EXT:
            method = "image"
            result = _process_image(src, out_dir)
        elif ext in OFFICE_EXT:
            method = "office->pdf"
            with tempfile.TemporaryDirectory(dir=out_dir) as conv:
                pdf = _soffice_to_pdf(src, conv)
                result = _process_pdf(pdf, out_dir, dpi, min_chars)
        elif ext == ".pdf":
            method = "pdf"
            result = _process_pdf(src, out_dir, dpi, min_chars)
        else:
            print(json.dumps({"ok": False, "error": f"unsupported extension: {ext}", "method": "unsupported"}))
            return 0
        result.update({"ok": True, "method": method, "pageCount": len(result["pages"])})
        print(json.dumps(result))
        return 0
    except subprocess.TimeoutExpired:
        print(json.dumps({"ok": False, "error": "conversion/rasterization timed out", "method": ext}))
        return 0
    except Exception as exc:  # never raise to the caller
        print(json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}", "method": ext}))
        return 0


if __name__ == "__main__":
    sys.exit(main())
