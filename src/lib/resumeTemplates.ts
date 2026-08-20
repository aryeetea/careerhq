export type ResumeTemplateId = "classic" | "modern" | "minimal";

export const RESUME_TEMPLATE_META: Record<ResumeTemplateId, { label: string; description: string; pdfFont: "times" | "helvetica" }> = {
  classic: { label: "Classic", description: "Serif, traditional résumé look.", pdfFont: "times" },
  modern: { label: "Modern", description: "Clean sans-serif with a colored accent.", pdfFont: "helvetica" },
  minimal: { label: "Minimal", description: "Compact spacing, sans-serif.", pdfFont: "helvetica" },
};

export const RESUME_TEMPLATE_IDS = Object.keys(RESUME_TEMPLATE_META) as ResumeTemplateId[];
