import { Document, Page, pdfjs } from "react-pdf";
import pdfWorker from "react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function ComicPdfPage({
  pdfFile,
  currentPage,
  pageNumbers,
  width,
  onLoadSuccess,
  loading,
  onLoadError,
  preloadPageNumbers = [],
}) {
  const devicePixelRatio =
    typeof window === "undefined"
      ? 1.5
      : Math.min(window.devicePixelRatio || 1, 2);

  return (
    <Document
      file={pdfFile}
      loading={loading}
      onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
      onLoadError={onLoadError}
      className="comic-reader__document"
    >
      <div className={`comic-reader__spread${(pageNumbers || []).length > 1 ? " comic-reader__spread--double" : ""}`}>
        {(pageNumbers?.length ? pageNumbers : [currentPage]).map((pageNumber) => (
          <Page
            key={pageNumber}
            pageNumber={pageNumber}
            width={width}
            devicePixelRatio={devicePixelRatio}
            renderMode="canvas"
            renderAnnotationLayer={false}
            renderTextLayer={false}
            loading={loading}
          />
        ))}
      </div>
      {preloadPageNumbers.length ? (
        <div className="comic-reader__preload" aria-hidden="true">
          {preloadPageNumbers.map((pageNumber) => (
            <Page
              key={`preload-${pageNumber}`}
              pageNumber={pageNumber}
              width={Math.min(width, 280)}
              devicePixelRatio={devicePixelRatio}
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
