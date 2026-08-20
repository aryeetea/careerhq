// A line-based heuristic, not a real document parser: the model is
// instructed (see FORMAT in TAILOR_RESUME_INSTRUCTIONS, careerCoach.ts) to
// keep the source résumé's own section headers, so a short, all-caps-ish
// line with no terminal punctuation is a safe signal for "this is a
// section header" without needing any structured data back from the model.
// Everything else renders as plain, whitespace-preserved body text. This
// deliberately stays a light visual read, not a rich/structured editor —
// editing always happens on the underlying plain text (see the Edit
// toggle in JobDetailDialog).
function looksLikeSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/[.,;:!?]$/.test(trimmed)) return false;
  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;
  const upperRatio = (trimmed.match(/[A-Z]/g)?.length ?? 0) / letters.length;
  return upperRatio > 0.7;
}

export function TailoredResumePreview({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="rounded-xl border border-border/60 bg-card px-6 py-8 shadow-sm sm:px-10">
      <div className="mx-auto max-w-2xl text-sm leading-relaxed text-foreground/90">
        {lines.map((line, index) => {
          if (looksLikeSectionHeader(line)) {
            return (
              <p key={index} className="mb-2 mt-5 border-b border-border/70 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground first:mt-0">
                {line.trim()}
              </p>
            );
          }
          return (
            <p key={index} className="whitespace-pre-wrap">
              {line || " "}
            </p>
          );
        })}
      </div>
    </div>
  );
}
