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
  pdfUrl,
  pages = [],
  className = "",
  compact = false,
}) {
  const readerRef = useRef(null);
  const stageRef = useRef(null);
  const chromeTimerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [stageWidth, setStageWidth] = useState(compact ? 360 : 720);
  const [pdfFile, setPdfFile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(true);

  useEffect(() => {
    setCurrentPage(1);
    setPageCount(0);
  }, [pages, pdfUrl]);

  useEffect(() => {
    if (!pdfUrl) {
      setPdfFile(null);
      setLoadError(pages.length ? "" : "PDF file is unavailable.");
      setPageCount(pages.length);
      return undefined;
    }

    const controller = new AbortController();

    async function loadPdfFile() {
      try {
        setLoadError("");
        setPdfFile(null);
        const response = await fetch(pdfUrl, {
          credentials: "include",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to load PDF file.");
        }

        const buffer = await response.arrayBuffer();
        setPdfFile({ data: new Uint8Array(buffer) });
        setLoadError("");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setLoadError(error.message || "Failed to load PDF file.");
        setPdfFile(null);
        setPageCount(pages.length);
      }
    }

    loadPdfFile();

    return () => controller.abort();
  }, [pages.length, pdfUrl]);

  useEffect(() => {
    if (pdfFile || !pages.length || !pages[currentPage]) {
      return undefined;
    }

    const preloadPage = pages[currentPage];
    if (!preloadPage?.url) {
      return undefined;
    }

    const image = new window.Image();
    image.src = preloadPage.url;
    return () => {
      image.src = "";
    };
  }, [currentPage, pages]);

  useEffect(() => {
    function updateStageWidth() {
      if (!stageRef.current) {
        return;
      }

      const padding = isFullscreen ? 12 : compact ? 20 : 28;
      setStageWidth(Math.max(220, stageRef.current.clientWidth - padding));
    }

    updateStageWidth();
    window.addEventListener("resize", updateStageWidth);
    return () => window.removeEventListener("resize", updateStageWidth);
  }, [compact, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setIsChromeVisible(true);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    async function syncNativeFullscreen() {
      if (!readerRef.current) {
        return;
      }

      if (!isFullscreen) {
        if (document.fullscreenElement === readerRef.current) {
          try {
            await document.exitFullscreen();
          } catch {
            // Ignore browser fullscreen exit failures.
          }
        }
        return;
      }

      if (!document.fullscreenEnabled || document.fullscreenElement === readerRef.current) {
        return;
      }

      try {
        await readerRef.current.requestFullscreen();
      } catch {
        // CSS fullscreen fallback remains active.
      }
    }

    syncNativeFullscreen();
  }, [isFullscreen]);

  useEffect(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isFullscreen]);

  useEffect(() => {
    window.clearTimeout(chromeTimerRef.current);
    if (!isFullscreen || !isChromeVisible) {
      return undefined;
    }

    chromeTimerRef.current = window.setTimeout(() => {
      setIsChromeVisible(false);
    }, 2200);

    return () => window.clearTimeout(chromeTimerRef.current);
  }, [currentPage, isChromeVisible, isFullscreen]);

  function revealChrome() {
    setIsChromeVisible(true);
  }

  function goToPrevious() {
    revealChrome();
    setCurrentPage((page) => Math.max(page - 1, 1));
  }

  function goToNext() {
    revealChrome();
    setCurrentPage((page) => Math.min(page + 1, pageCount || page + 1));
  }

  function toggleFullscreen() {
    setIsFullscreen((current) => !current);
    setIsChromeVisible(true);
  }

  function toggleChrome() {
    setIsChromeVisible((current) => !current);
  }

  function handleTapZone(direction) {
    if (direction === "prev") {
      goToPrevious();
      return;
    }

    if (direction === "next") {
      goToNext();
      return;
    }

    toggleChrome();
  }

  const preloadPageNumbers =
    pageCount && currentPage < pageCount ? [currentPage + 1] : [];
  const currentImagePage = pages[currentPage - 1] || null;
  const shouldUseImageFallback =
    !pdfFile && Boolean(currentImagePage?.url) && (!pdfUrl || Boolean(loadError));
  const rootClassName = `inline-pdf-reader ${compact ? "inline-pdf-reader--compact" : ""} ${
    isFullscreen ? "inline-pdf-reader--fullscreen" : ""
  } ${isChromeVisible ? "inline-pdf-reader--chrome-visible" : "inline-pdf-reader--chrome-hidden"} ${className}`.trim();

  return (
    <div className={rootClassName} ref={readerRef}>
      {isFullscreen ? (
        <div className="inline-pdf-reader__topbar">
          <button
            type="button"
            className="inline-pdf-reader__nav-button"
            onClick={toggleFullscreen}
          >
            Back
          </button>
          <div className="inline-pdf-reader__topbar-meta" aria-live="polite">
            <span>
              Page {currentPage}
              {pageCount ? ` of ${pageCount}` : ""}
            </span>
          </div>
        </div>
      ) : null}
      <div className="inline-pdf-reader__frame" ref={stageRef}>
        {pdfFile ? (
          <Suspense fallback={<ReaderLoading />}>
            <ComicPdfPage
              pdfFile={pdfFile}
              currentPage={currentPage}
              width={stageWidth}
              loading={<ReaderLoading />}
              onLoadSuccess={setPageCount}
              onLoadError={(error) =>
                setLoadError(error?.message || "Failed to load PDF file.")
              }
              preloadPageNumbers={preloadPageNumbers}
            />
          </Suspense>
        ) : shouldUseImageFallback ? (
          <img
            className="inline-pdf-reader__image"
            src={currentImagePage.url}
            alt={`Page ${currentPage}`}
          />
        ) : loadError ? (
          <div className="inline-pdf-reader__error">{loadError}</div>
        ) : (
          <ReaderLoading />
        )}
        {isFullscreen && !loadError ? (
          <div className="inline-pdf-reader__tap-zones" aria-hidden="true">
            <button
              type="button"
              className="inline-pdf-reader__tap-zone inline-pdf-reader__tap-zone--prev"
              onClick={() => handleTapZone("prev")}
              disabled={currentPage <= 1}
              tabIndex={-1}
            >
              <span>Prev</span>
            </button>
            <button
              type="button"
              className="inline-pdf-reader__tap-zone inline-pdf-reader__tap-zone--center"
              onClick={() => handleTapZone("toggle")}
              tabIndex={-1}
            >
              <span>Menu</span>
            </button>
            <button
              type="button"
              className="inline-pdf-reader__tap-zone inline-pdf-reader__tap-zone--next"
              onClick={() => handleTapZone("next")}
              disabled={pageCount ? currentPage >= pageCount : false}
              tabIndex={-1}
            >
              <span>Next</span>
            </button>
          </div>
        ) : null}
      </div>
      <div className="inline-pdf-reader__footer">
        <button
          type="button"
          className="inline-pdf-reader__nav-button"
          onClick={goToPrevious}
          disabled={currentPage <= 1}
        >
          Prev
        </button>
        <div className="inline-pdf-reader__meta" aria-live="polite">
          <span>
            Page {currentPage}
            {pageCount ? ` of ${pageCount}` : ""}
          </span>
        </div>
        <div className="inline-pdf-reader__controls">
          <button
            type="button"
            className="inline-pdf-reader__nav-button"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
          <button
            type="button"
            className="inline-pdf-reader__nav-button"
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
