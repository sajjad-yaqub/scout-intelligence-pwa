// Extracts text from a resume PDF in the browser so the file never leaves the device.
export async function readResumePDF(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map(item => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join("\n\n").replace(/[ \t]+/g, " ").trim().slice(0, 30000);
}
