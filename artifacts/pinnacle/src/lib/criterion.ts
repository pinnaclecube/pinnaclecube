/** Human label for a normalized criterion_folder key (e.g. "scholarly_articles"). */
export function criterionLabel(key: string | null | undefined): string {
  if (!key || key === "unclassified") return "Unclassified";
  return key
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
