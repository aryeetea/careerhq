import { jsPDF } from "jspdf";

const MARGIN_PT = 72; // 1 inch — standard letter margin
const FONT_SIZE_PT = 11;
const LINE_HEIGHT_PT = FONT_SIZE_PT * 1.4;

/**
 * Renders a cover letter's plain text into a simple, print-ready PDF and
 * triggers a browser download. No layout library beyond jsPDF itself —
 * the letter is just wrapped body text with paragraph spacing preserved,
 * which is all a cover letter needs.
 */
export function downloadCoverLetterPdf(coverLetter: string, fileName: string) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN_PT * 2;

  doc.setFont("times", "normal");
  doc.setFontSize(FONT_SIZE_PT);

  let y = MARGIN_PT;
  const ensureSpace = () => {
    if (y > pageHeight - MARGIN_PT) {
      doc.addPage();
      y = MARGIN_PT;
    }
  };

  // Blank lines separate paragraphs — keep that spacing rather than
  // collapsing the letter into one wrapped block. Single line breaks
  // within a paragraph (e.g. a header block: name / date / address) are
  // preserved too, each wrapped on its own.
  const paragraphs = coverLetter.split(/\n{2,}/);
  paragraphs.forEach((paragraph, index) => {
    paragraph.split("\n").forEach((rawLine) => {
      const wrapped = doc.splitTextToSize(rawLine, maxWidth) as string[];
      wrapped.forEach((line) => {
        ensureSpace();
        doc.text(line, MARGIN_PT, y);
        y += LINE_HEIGHT_PT;
      });
    });
    if (index < paragraphs.length - 1) y += LINE_HEIGHT_PT;
  });

  doc.save(fileName);
}
