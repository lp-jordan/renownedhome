import { useRef, useState } from "react";

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = units[0];
  for (let i = 0; i < units.length; i += 1) {
    unit = units[i];
    if (size < 1024 || i === units.length - 1) break;
    size /= 1024;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function fileRoute(fileId) {
  return `/api/delivery/files/${encodeURIComponent(fileId)}`;
}

function PdfThumb({ file, onClick }) {
  const firstPage = file.readerPages?.[0]?.url || "";
  return (
    <button
      type="button"
      className="delivery-thumb"
      onClick={onClick}
      title={`Preview ${file.originalFilename}`}
    >
      {firstPage ? (
        <img src={firstPage} alt="" loading="lazy" />
      ) : (
        <span className="delivery-thumb__placeholder">PDF</span>
      )}
    </button>
  );
}

export default function DeliveryAssets({
  cover,
  coverUrl,
  files,
  onUploadCover,
  onUploadPdfs,
  onOpenPdf,
  onRequestDelete,
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState("");
  const dropZoneRef = useRef(null);

  async function handleCoverChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setStatus("Uploading cover…");
    try {
      await onUploadCover(file);
      setStatus("Cover updated.");
    } catch (error) {
      setStatus(error?.message || "Cover upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePdfPick(event) {
    const list = Array.from(event.target.files || []).filter(Boolean);
    event.target.value = "";
    if (!list.length) return;
    await runPdfUpload(list);
  }

  async function runPdfUpload(list) {
    const pdfs = list.filter((file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf");
    if (!pdfs.length) {
      setStatus("Only PDF files are accepted.");
      return;
    }
    setIsUploading(true);
    setStatus(pdfs.length === 1 ? "Uploading PDF…" : `Uploading ${pdfs.length} PDFs…`);
    try {
      await onUploadPdfs(pdfs);
      setStatus(pdfs.length === 1 ? "PDF uploaded." : `${pdfs.length} PDFs uploaded.`);
    } catch (error) {
      setStatus(error?.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    if (!isUploading) setDragActive(true);
  }
  function handleDragLeave(event) {
    if (event.target === dropZoneRef.current) setDragActive(false);
  }
  async function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    if (isUploading) return;
    const list = Array.from(event.dataTransfer?.files || []);
    if (list.length) await runPdfUpload(list);
  }

  return (
    <section className="editor-card delivery-section">
      <div className="delivery-section__header">
        <h2>Assets</h2>
      </div>

      <div className="delivery-assets-grid">
        <div className="delivery-cover-card">
          <span className="delivery-upload-card__label">Cover image</span>
          {coverUrl ? (
            <>
              <img className="delivery-cover-preview" src={coverUrl} alt="Cover" />
              <p className="delivery-upload-card__meta">{cover?.originalFilename}</p>
            </>
          ) : (
            <div className="delivery-cover-placeholder">No cover yet</div>
          )}
          <label className={`button-secondary button-compact delivery-upload-button${isUploading ? " is-disabled" : ""}`}>
            <span>{coverUrl ? "Replace image" : "Upload image"}</span>
            <input
              className="delivery-upload-input"
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={handleCoverChange}
            />
          </label>
        </div>

        <div
          ref={dropZoneRef}
          className={`delivery-pdf-dropzone${dragActive ? " is-active" : ""}${isUploading ? " is-disabled" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="delivery-pdf-dropzone__head">
            <span className="delivery-upload-card__label">PDF library</span>
            <span className="delivery-upload-card__meta">
              {files.length} file{files.length === 1 ? "" : "s"}
            </span>
          </div>
          <p className="delivery-pdf-dropzone__hint">
            Drop PDFs here or
            <label className={`delivery-pdf-dropzone__pick${isUploading ? " is-disabled" : ""}`}>
              {" "}browse{" "}
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                disabled={isUploading}
                onChange={handlePdfPick}
              />
            </label>
            to upload.
          </p>
          {files.length ? (
            <div className="delivery-thumb-grid">
              {files.map((file) => (
                <div key={file.id} className="delivery-thumb-card">
                  <PdfThumb file={file} onClick={() => onOpenPdf(file)} />
                  <div className="delivery-thumb-card__body">
                    <strong title={file.originalFilename}>{file.originalFilename}</strong>
                    <span>
                      v{file.versionNumber} · {formatFileSize(file.fileSizeBytes)}
                    </span>
                    <div className="delivery-thumb-card__actions">
                      <a
                        className="delivery-thumb-card__link"
                        href={fileRoute(file.id) + "/content"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                      <button
                        className="delivery-thumb-card__link delivery-thumb-card__link--danger"
                        type="button"
                        onClick={() => onRequestDelete(file)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {status ? <p className="status-line">{status}</p> : null}
    </section>
  );
}
