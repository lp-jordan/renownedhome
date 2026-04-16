import { Suspense, lazy, useEffect, useRef, useState } from "react";

const ComicPdfPage = lazy(() => import("./ComicPdfPage"));
const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

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
  const gestureRef = useRef({ startX: 0, startY: 0, active: false });
  const touchHandledRef = useRef(false);
  const autoHideTimerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [stageWidth, setStageWidth] = useState(() => {
    if (compact) return 360;
    if (typeof window !== "undefined" && window.innerWidth < 900) {
      return Math.max(220, window.innerWidth - 80);
    }
    return 720;
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(false);
  const [isWideSpread, setIsWideSpread] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const useImagePages = pages.length > 0;

  useEffect(() => {
    setCurrentPage(1);
    setPageCount(0);
  }, [pages, pdfUrl]);

  useEffect(() => {
    setZoom(MIN_ZOOM);
  }, [isFullscreen, currentPage, isWideSpread]);

  useEffect(() => {
    if (useImagePages) {
      setPdfFile(null);
      setLoadError("");
      setPageCount(pages.length);
      return undefined;
    }

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
  }, [isFullscreen, pages.length, pdfUrl, useImagePages]);

  useEffect(() => {
    if (!useImagePages || !pages.length) {
      return undefined;
    }

    const preloadTargets = [pages[currentPage], pages[currentPage + 1]].filter(
      (page) => page?.url,
    );

    const images = preloadTargets.map((page) => {
      const image = new window.Image();
      image.src = page.url;
      return image;
    });

    return () => {
      images.forEach((image) => {
        image.src = "";
      });
    };
  }, [currentPage, pages, useImagePages]);

  useEffect(() => {
    function updateStageWidth() {
      if (!stageRef.current) {
        return;
      }

      const padding = isFullscreen ? 12 : compact ? 20 : 28;
      const availableWidth = Math.max(220, stageRef.current.clientWidth - padding);
      const nextWideSpread =
        !compact && isFullscreen && stageRef.current.clientWidth >= 960;
      setIsWideSpread(nextWideSpread);
      setStageWidth(nextWideSpread ? Math.max(160, Math.floor((availableWidth - 18) / 2)) : availableWidth);
    }

    updateStageWidth();
    window.addEventListener("resize", updateStageWidth);
    return () => window.removeEventListener("resize", updateStageWidth);
  }, [compact, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      setIsChromeVisible(false);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Briefly show controls so user knows they can tap to toggle them.
    setIsChromeVisible(true);
    autoHideTimerRef.current = setTimeout(() => {
      autoHideTimerRef.current = null;
      setIsChromeVisible(false);
    }, 2000);

    return () => {
      document.body.style.overflow = previousOverflow;
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
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

  function revealChrome() {
    setIsChromeVisible(true);
  }

  function goToPrevious() {
    setCurrentPage((page) => {
      const step = isWideSpread ? 2 : 1;
      if (isWideSpread && page <= 2) {
        return 1;
      }
      return Math.max(page - step, 1);
    });
  }

  function goToNext() {
    setCurrentPage((page) => {
      const step = isWideSpread ? 2 : 1;
      const nextPage = page + step;
      if (isWideSpread && page === 1) {
        return Math.min(2, pageCount || 2);
      }
      return Math.min(nextPage, pageCount || nextPage);
    });
  }

  function toggleFullscreen() {
    setIsFullscreen((current) => !current);
    setZoom(MIN_ZOOM);
  }

  function toggleChrome() {
    // Cancel any pending auto-hide so it doesn't interfere with manual toggles.
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    setIsChromeVisible((current) => !current);
  }

  function handleFrameToggle() {
    toggleChrome();
  }

  function handleFrameClick() {
    // Suppress the synthetic click that fires after a touch tap to avoid a
    // double-toggle (onTouchEnd already handled it).
    if (touchHandledRef.current) return;
    toggleChrome();
  }

  function handleTouchStart(event) {
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      active: true,
    };
  }

  function handleTouchEnd(event) {
    const touch = event.changedTouches?.[0];
    if (!touch || !gestureRef.current.active) {
      return;
    }

    const deltaX = touch.clientX - gestureRef.current.startX;
    const deltaY = touch.clientY - gestureRef.current.startY;
    gestureRef.current.active = false;

    if (
      zoom <= MIN_ZOOM &&
      Math.abs(deltaX) > 50 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.4
    ) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrevious();
      }
      return;
    }

    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      // Mark as touch-handled so the subsequent synthetic click is suppressed.
      touchHandledRef.current = true;
      setTimeout(() => { touchHandledRef.current = false; }, 400);
      handleFrameToggle();
    }
  }

  function zoomIn() {
    setZoom((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(2))));
  }

  function zoomOut() {
    setZoom((current) => Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(2))));
  }

  function resetZoom() {
    setZoom(MIN_ZOOM);
  }

  const visiblePageNumbers = (() => {
    if (!isWideSpread || pageCount <= 1) {
      return [currentPage];
    }

    if (currentPage <= 1) {
      return [1];
    }

    const leftPage = currentPage % 2 === 0 ? currentPage : Math.max(currentPage - 1, 2);
    const rightPage = leftPage + 1;
    return rightPage <= pageCount ? [leftPage, rightPage] : [leftPage];
  })();

  const preloadPageNumbers =
    pageCount && visiblePageNumbers[visiblePageNumbers.length - 1] < pageCount
      ? isWideSpread
        ? [
            visiblePageNumbers[visiblePageNumbers.length - 1] + 1,
            visiblePageNumbers[visiblePageNumbers.length - 1] + 2,
          ].filter((pageNumber) => pageNumber <= pageCount)
        : [visiblePageNumbers[visiblePageNumbers.length - 1] + 1]
      : [];
  const visibleImagePages = visiblePageNumbers
    .map((pageNumber) => ({
      pageNumber,
      page: pages[pageNumber - 1] || null,
    }))
    .filter(({ page }) => page?.url);
  const currentImagePage = visibleImagePages[0]?.page || pages[currentPage - 1] || null;
  const shouldUseImagePages =
    useImagePages &&
    visibleImagePages.length === visiblePageNumbers.length &&
    visibleImagePages.length > 0;
  const shouldUseImageFallback =
    !shouldUseImagePages &&
    !pdfFile &&
    Boolean(currentImagePage?.url) &&
    (!pdfUrl || Boolean(loadError));
  const pageLabel =
    visiblePageNumbers.length > 1
      ? `Pages ${visiblePageNumbers[0]}-${visiblePageNumbers[visiblePageNumbers.length - 1]}${pageCount ? ` of ${pageCount}` : ""}`
      : `Page ${visiblePageNumbers[0]}${pageCount ? ` of ${pageCount}` : ""}`;
  const rootClassName = `inline-pdf-reader ${compact ? "inline-pdf-reader--compact" : ""} ${
    isFullscreen ? "inline-pdf-reader--fullscreen" : ""
  } ${isWideSpread ? "inline-pdf-reader--spread" : ""}
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
        </div>
      ) : null}
      <div
        className="inline-pdf-reader__frame"
        ref={stageRef}
        onClick={isFullscreen ? handleFrameClick : undefined}
        onTouchStart={isFullscreen ? handleTouchStart : undefined}
        onTouchEnd={isFullscreen ? handleTouchEnd : undefined}
      >
        {!isFullscreen ? (
          <button
            type="button"
            className="inline-pdf-reader__corner-button"
            onClick={toggleFullscreen}
          >
            Fullscreen
          </button>
        ) : null}
        {shouldUseImagePages ? (
          <div
            className={`inline-pdf-reader__viewport ${
              isFullscreen && zoom > MIN_ZOOM ? "is-zoomed" : ""
            }`}
          >
            <div
              className="inline-pdf-reader__zoom-surface"
              style={isFullscreen ? { transform: `scale(${zoom})` } : undefined}
            >
              <div
                className={`inline-pdf-reader__image-spread ${
                  visibleImagePages.length > 1 ? "inline-pdf-reader__image-spread--double" : ""
                }`}
              >
                {visibleImagePages.map(({ pageNumber, page }) => (
                  <img
                    key={pageNumber}
                    className="inline-pdf-reader__image"
                    src={page.url}
                    alt={`Page ${pageNumber}`}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : pdfFile ? (
          <div
            className={`inline-pdf-reader__viewport ${
              isFullscreen && zoom > MIN_ZOOM ? "is-zoomed" : ""
            }`}
          >
            <div
              className="inline-pdf-reader__zoom-surface"
              style={isFullscreen ? { transform: `scale(${zoom})` } : undefined}
            >
              <Suspense fallback={<ReaderLoading />}>
                <ComicPdfPage
                  pdfFile={pdfFile}
                  currentPage={currentPage}
                  pageNumbers={visiblePageNumbers}
                  width={stageWidth}
                  loading={<ReaderLoading />}
                  onLoadSuccess={setPageCount}
                  onLoadError={(error) =>
                    setLoadError(error?.message || "Failed to load PDF file.")
                  }
                  preloadPageNumbers={preloadPageNumbers}
                />
              </Suspense>
            </div>
          </div>
        ) : shouldUseImageFallback ? (
          <div className="inline-pdf-reader__viewport">
            <div className="inline-pdf-reader__zoom-surface">
              <img
                className="inline-pdf-reader__image"
                src={currentImagePage.url}
                alt={pageLabel}
              />
            </div>
          </div>
        ) : loadError ? (
          <div className="inline-pdf-reader__error">{loadError}</div>
        ) : (
          <ReaderLoading />
        )}
      </div>
      <div className="inline-pdf-reader__footer">
        <button
          type="button"
          className="inline-pdf-reader__nav-button"
          onClick={goToPrevious}
          disabled={visiblePageNumbers[0] <= 1}
        >
          Prev
        </button>
        <div className="inline-pdf-reader__meta" aria-live="polite">
          <span>{pageLabel}</span>
        </div>
        <div className="inline-pdf-reader__controls">
          {isFullscreen ? (
            <>
              <button
                type="button"
                className="inline-pdf-reader__nav-button"
                onClick={zoomOut}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >
                -
              </button>
              <button
                type="button"
                className="inline-pdf-reader__nav-button inline-pdf-reader__zoom-indicator"
                onClick={resetZoom}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                className="inline-pdf-reader__nav-button"
                onClick={zoomIn}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >
                +
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="inline-pdf-reader__nav-button"
            onClick={goToNext}
            disabled={pageCount ? visiblePageNumbers[visiblePageNumbers.length - 1] >= pageCount : false}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
