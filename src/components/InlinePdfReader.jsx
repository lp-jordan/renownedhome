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
  const gestureRef = useRef({ startX: 0, startY: 0, active: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [stageWidth, setStageWidth] = useState(compact ? 360 : 720);
  const [pdfFile, setPdfFile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChromeVisible, setIsChromeVisible] = useState(false);
  const [isWideSpread, setIsWideSpread] = useState(false);
  const useImagePages = pages.length > 0 && !isFullscreen;

  useEffect(() => {
    setCurrentPage(1);
    setPageCount(0);
  }, [pages, pdfUrl]);

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
    if (!useImagePages || !pages.length || !pages[currentPage]) {
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
    setIsChromeVisible(false);
  }

  function toggleChrome() {
    setIsChromeVisible((current) => !current);
  }

  function handleFrameToggle() {
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

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrevious();
      }
      return;
    }

    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      handleFrameToggle();
    }
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
  const currentImagePage = pages[currentPage - 1] || null;
  const shouldUseImagePages = useImagePages && Boolean(currentImagePage?.url);
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
        onClick={isFullscreen ? handleFrameToggle : undefined}
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
          <img
            className="inline-pdf-reader__image"
            src={currentImagePage.url}
            alt={pageLabel}
          />
        ) : pdfFile ? (
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
        ) : shouldUseImageFallback ? (
          <img
            className="inline-pdf-reader__image"
            src={currentImagePage.url}
            alt={pageLabel}
          />
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
