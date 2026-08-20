import { jsPDF } from "jspdf";
import { normalizeForPdfFont } from "@/lib/coverLetterPdf";
import { looksLikeSectionHeader } from "@/lib/resumeText";
import { RESUME_TEMPLATE_META, type ResumeTemplateId } from "@/lib/resumeTemplates";

const MARGIN_PT = 54; // 0.75in — a résumé needs to fit more per page than a letter
const BODY_FONT_SIZE_PT = 10.5;
const HEADER_FONT_SIZE_PT = 10.5;
const LINE_HEIGHT_PT = BODY_FONT_SIZE_PT * 1.35;
const HEADER_SPACE_BEFORE_PT = LINE_HEIGHT_PT * 0.9;
const HEADER_SPACE_AFTER_PT = LINE_HEIGHT_PT * 0.3;

/**
 * Renders a tailored résumé's plain text into a print-ready PDF, styled
 * per the chosen template (see resumeTemplates.ts) — same line-based
 * section-header heuristic as TailoredResumePreview, so the PDF matches
 * what the user already reviewed on screen. jsPDF's built-in fonts only
 * cover Times/Helvetica/Courier, so "template" here controls font choice
 * and header treatment, not a fully custom layout.
 */
export function downloadTailoredResumePdf(rawText: string, fileName: string, template: ResumeTemplateId = "classic") {
  const text = normalizeForPdfFont(rawText);
  const meta = RESUME_TEMPLATE_META[template];
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN_PT * 2;

  let y = MARGIN_PT;
  const ensureSpace = (needed = LINE_HEIGHT_PT) => {
    if (y + needed > pageHeight - MARGIN_PT) {
      doc.addPage();
      y = MARGIN_PT;
    }
  };

  const lines = text.split("\n");
  let isFirstHeader = true;
  lines.forEach((rawLine) => {
    if (looksLikeSectionHeader(rawLine)) {
      if (!isFirstHeader) y += HEADER_SPACE_BEFORE_PT;
      isFirstHeader = false;
      ensureSpace(HEADER_FONT_SIZE_PT + HEADER_SPACE_AFTER_PT);
      doc.setFont(meta.pdfFont, "bold");
      doc.setFontSize(HEADER_FONT_SIZE_PT);
      const headerText = rawLine.trim().toUpperCase();
      doc.text(headerText, MARGIN_PT, y);
      // A rule under the header, same as the on-screen preview's
      // border-bottom (Classic/Minimal) or left accent bar look (Modern
      // approximated here as a short accent tick, since jsPDF has no easy
      // equivalent of a left border on text).
      if (template === "modern") {
        doc.setLineWidth(2);
        doc.line(MARGIN_PT - 8, y - HEADER_FONT_SIZE_PT + 2, MARGIN_PT - 8, y + 2);
      } else if (template !== "minimal") {
        doc.setLineWidth(0.75);
        doc.line(MARGIN_PT, y + 3, pageWidth - MARGIN_PT, y + 3);
      }
      y += HEADER_SPACE_AFTER_PT + LINE_HEIGHT_PT * 0.4;
      return;
    }

    doc.setFont(meta.pdfFont, "normal");
    doc.setFontSize(BODY_FONT_SIZE_PT);
    const wrapped = doc.splitTextToSize(rawLine || " ", maxWidth) as string[];
    wrapped.forEach((line) => {
      ensureSpace();
      doc.text(line, MARGIN_PT, y);
      y += LINE_HEIGHT_PT;
    });
  });

  doc.save(fileName);
}
