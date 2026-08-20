import { jsPDF } from "jspdf";

const MARGIN_PT = 72; // 1 inch — standard letter margin
const FONT_SIZE_PT = 11;
const LINE_HEIGHT_PT = FONT_SIZE_PT * 1.4;

// jsPDF's built-in fonts (Times/Helvetica/Courier) only implement
// WinAnsiEncoding (roughly Latin-1) — they have no glyphs for the
// typographic characters an LLM routinely writes (smart quotes, em/en/non-
// breaking dashes, ellipsis, bullets). Feeding those straight to doc.text()
// doesn't just drop the glyph: it throws off splitTextToSize's width
// measurement for the rest of that line, which is what produced the
// stretched, margin-overflowing line seen in testing (a real cover letter
// that included a non-breaking hyphen in "hands-on").
//
// Every dash variant is mapped explicitly by code point — NOT left to the
// generic fallback below — because dropping one silently glues two words
// together with no space ("hands-on" -> "handson"), which is a far worse,
// easy-to-miss failure in a document someone is about to send to an
// employer. Confirmed by testing: an earlier version of this function
// mapped only the en/em dash and used a blanket "strip anything
// non-Latin-1" fallback, which silently deleted a non-breaking hyphen
// (U+2011) and produced exactly that bug.
//
// Any remaining character the fallback can't identify becomes a plain
// space rather than being deleted, for the same reason: a stray extra
// space is harmless, a vanished character is not.
// Exported so other plain-text-to-PDF exporters (see tailoredResumePdf.ts)
// can reuse the same font-safety normalization instead of duplicating it.
export function normalizeForPdfFont(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'") // smart single quotes / low-9 quote
    .replace(/[“”„‟]/g, '"') // smart double quotes / low-9 quote
    .replace(/[‐‑‒–—―]/g, "-") // hyphen, non-breaking hyphen, figure/en/em dash, horizontal bar
    .replace(/­/g, "") // soft hyphen — invisible hint, safe to drop outright
    .replace(/…/g, "...") // ellipsis
    .replace(/[   ]/g, " ") // non-breaking / figure / narrow no-break space
    .replace(/[•●▪◦‣]/g, "-") // bullet variants
    .replace(/[​‌‍﻿]/g, "") // zero-width characters — genuinely invisible, safe to drop
    .replace(/[^\x00-\xFF]/g, " "); // anything else the font can't render — a space, never a silent deletion
}

/**
 * Renders a cover letter's plain text into a simple, print-ready PDF and
 * triggers a browser download. No layout library beyond jsPDF itself —
 * the letter is just wrapped body text with paragraph spacing preserved,
 * which is all a cover letter needs.
 */
export function downloadCoverLetterPdf(rawCoverLetter: string, fileName: string) {
  const coverLetter = normalizeForPdfFont(rawCoverLetter);
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
