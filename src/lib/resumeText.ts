// Shared line-based heuristic for rendering a tailored résumé's plain
// text as a document — used by both TailoredResumePreview (on-screen) and
// tailoredResumePdf (PDF export) so the two always agree on what counts as
// a section header. Not a real document parser: the model is instructed
// (see FORMAT in TAILOR_RESUME_INSTRUCTIONS, careerCoach.ts) to keep the
// source résumé's own section headers, so a short, all-caps-ish line with
// no terminal punctuation is a safe signal without needing structured data
// back from the model.
export function looksLikeSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/[.,;:!?]$/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const upperRatio = (trimmed.match(/[A-Z]/g)?.length ?? 0) / letters.length;
  return upperRatio > 0.7;
}
