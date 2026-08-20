import { looksLikeSectionHeader } from "@/lib/resumeText";
import type { ResumeTemplateId } from "@/lib/resumeTemplates";

const TEMPLATE_STYLES: Record<ResumeTemplateId, { body: string; header: string; spacing: string }> = {
  classic: {
    body: "font-serif",
    header: "mb-2 mt-5 border-b border-border/70 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground first:mt-0",
    spacing: "leading-relaxed",
  },
  modern: {
    body: "font-sans",
    header: "mb-2 mt-5 border-l-4 border-primary pl-2 text-xs font-semibold uppercase tracking-wide text-primary first:mt-0",
    spacing: "leading-relaxed",
  },
  minimal: {
    body: "font-sans",
    header: "mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wider text-foreground first:mt-0",
    spacing: "leading-snug",
  },
};

/** A read-only, document-styled render of a tailored résumé's plain text —
 * not a rich/structured editor. Editing always happens on the underlying
 * plain text (see the Edit toggle in JobDetailDialog). */
export function TailoredResumePreview({ text, template = "classic" }: { text: string; template?: ResumeTemplateId }) {
  const lines = text.split("\n");
  const style = TEMPLATE_STYLES[template];

  return (
    <div className="rounded-xl border border-border/60 bg-card px-6 py-8 shadow-sm sm:px-10">
      <div className={`mx-auto max-w-2xl text-sm text-foreground/90 ${style.body} ${style.spacing}`}>
        {lines.map((line, index) => {
          if (looksLikeSectionHeader(line)) {
            return (
              <p key={index} className={style.header}>
                {line.trim()}
              </p>
            );
          }
          return (
            <p key={index} className="whitespace-pre-wrap">
              {line || " "}
            </p>
          );
        })}
      </div>
    </div>
  );
}
