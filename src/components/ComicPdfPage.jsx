import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function ComicPdfPage({
  pdfUrl,
  currentPage,
  width,
  onLoadSuccess,
  loading,
}) {
  return (
    <Document
      file={pdfUrl}
      loading={loading}
      onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
      className="comic-reader__document"
    >
      <Page
        pageNumber={currentPage}
        width={width}
        renderAnnotationLayer={false}
        renderTextLayer={false}
        loading={loading}
      />
    </Document>
  );
}
