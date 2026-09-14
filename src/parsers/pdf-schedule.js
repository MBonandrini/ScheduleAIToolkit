/**
 * Lightweight PDF schedule text extraction used by Measurement alignment.
 * It depends on a readable PDF text layer; scanned-image PDFs require OCR.
 */
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.min.mjs";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.worker.min.mjs";
export async function extractPdfScheduleText(file, {
  maxPages = 300
}
= {
}) {
  if (!file)throw new Error("PDF schedule file is unavailable.");
  const pdfjs = await import(PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const bytes = new Uint8Array(await file.arrayBuffer()),
  pdf = await pdfjs.getDocument( {
    data: bytes
  }).promise,
  out = [];
  const count = Math.min(pdf.numPages, maxPages);
  for (let pageNo = 1; pageNo<=count; pageNo++) {
    const page = await pdf.getPage(pageNo),
    content = await page.getTextContent(),
    items = (content.items || []).filter(x => x.str?.trim()).map(x => ( {
      text: x.str.trim(), x: Number(x.transform?.[4] || 0), y: Number(x.transform?.[5] || 0)
    }));
    items.sort((a, b) => Math.abs(b.y - a.y)>2? b.y - a.y: a.x - b.x);
    const lines = [];
    for (const it of items) {
      let line = lines.find(x => Math.abs(x.y - it.y)<=2.2);
      if (!line) {
        line = {
          y: it.y,
          items: []
        };
        lines.push(line)
      }
      line.items.push(it)
    }
    lines.sort((a, b) => b.y - a.y);
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      out.push(line.items.map(x => x.text).join(" ").replace(/\s+/g, " ").trim())
    }
  }
  return out.filter(Boolean).join("\n");
}
