# Export branding assets

Drop a file named **`venakan-logo.png`** in this directory to brand the
generated Word (.docx) and PDF program exports (see `api/export-program.ts`).

- The logo is placed on a **dark ink (`#0F172A`) banner** at the top of the
  cover page and as a running header, so use a **white / reversed** or
  **transparent** PNG that reads correctly on a dark background.
- A roughly landscape logo (e.g. ~600×160 px) works best in the banner.

If `venakan-logo.png` is absent, exports fall back to a styled
"Venakan **Learn**" text wordmark (ink + emerald) — no build step required.
