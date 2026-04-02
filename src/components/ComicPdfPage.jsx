import { Document, Page, pdfjs } from "react-pdf";
import pdfWorker from "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function ComicPdfPage({
  pdfFile,
  currentPage,
  width,
  onLoadSuccess,
  loading,
  onLoadError,
  preloadPageNumbers = [],
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
        key={currentPage}
        pageNumber={currentPage}
        width={width}
        devicePixelRatio={1}
        renderMode="canvas"
        renderAnnotationLayer={false}
        renderTextLayer={false}
        loading={loading}
      />
      {preloadPageNumbers.length ? (
        <div className="comic-reader__preload" aria-hidden="true">
          {preloadPageNumbers.map((pageNumber) => (
            <Page
              key={`preload-${pageNumber}`}
              pageNumber={pageNumber}
              width={Math.min(width, 280)}
              devicePixelRatio={1}
              renderMode="canvas"
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={null}
            />
          ))}
        </div>
      ) : null}
    </Document>
  );
}
