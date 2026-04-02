import { Suspense, lazy, useEffect, useRef, useState } from "react";

const ComicPdfPage = lazy(() => import("./ComicPdfPage"));

function ReaderLoading() {
  return (
    <div className="inline-pdf-reader__loading" aria-hidden="true">
      <span />
    </div>
  );
}

export default function InlinePdfReader({
  title,
  pdfUrl,
  className = "",
  compact = false,
}) {
  const stageRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [stageWidth, setStageWidth] = useState(compact ? 360 : 720);

  useEffect(() => {
    setCurrentPage(1);
    setPageCount(0);
  }, [pdfUrl]);

  useEffect(() => {
    function updateStageWidth() {
      if (!stageRef.current) {
        return;
      }

      const padding = compact ? 20 : 28;
      setStageWidth(Math.max(220, stageRef.current.clientWidth - padding));
    }

    updateStageWidth();
    window.addEventListener("resize", updateStageWidth);
    return () => window.removeEventListener("resize", updateStageWidth);
  }, [compact]);

  function goToPrevious() {
    setCurrentPage((page) => Math.max(page - 1, 1));
  }

  function goToNext() {
    setCurrentPage((page) => Math.min(page + 1, pageCount || page + 1));
  }

  return (
    <div
      className={`inline-pdf-reader ${compact ? "inline-pdf-reader--compact" : ""} ${className}`.trim()}
    >
      <div className="inline-pdf-reader__frame" ref={stageRef}>
        <Suspense fallback={<ReaderLoading />}>
          <ComicPdfPage
            pdfUrl={pdfUrl}
            currentPage={currentPage}
            width={stageWidth}
            loading={<ReaderLoading />}
            onLoadSuccess={setPageCount}
          />
        </Suspense>
      </div>
      <div className="inline-pdf-reader__footer">
        <div className="inline-pdf-reader__meta">
          <span>{title}</span>
          <span>
            Page {currentPage}
            {pageCount ? ` of ${pageCount}` : ""}
          </span>
        </div>
        <div className="inline-pdf-reader__controls">
          <button
            type="button"
            className="button-secondary button-compact"
            onClick={goToPrevious}
            disabled={currentPage <= 1}
          >
            Prev
          </button>
          <button
            type="button"
            className="button-secondary button-compact"
            onClick={goToNext}
            disabled={pageCount ? currentPage >= pageCount : false}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
