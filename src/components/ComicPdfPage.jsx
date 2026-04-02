import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function ComicPdfPage({
  pdfFile,
  currentPage,
  width,
  onLoadSuccess,
  loading,
  onLoadError,
}) {
  return (
    <Document
      file={pdfFile}
      loading={loading}
      onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
      onLoadError={onLoadError}
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
