import { useEffect } from "react";
import InlinePdfReader from "./InlinePdfReader";

export default function DeliveryPdfDialog({ open, file, pdfUrl, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !file) return null;

  return (
    <div className="delivery-dialog" role="dialog" aria-modal="true" aria-label={file.originalFilename}>
      <div className="delivery-dialog__backdrop" onClick={onClose} />
      <div className="delivery-dialog__panel delivery-dialog__panel--reader">
        <div className="delivery-dialog__header">
          <div>
            <p className="editor-header__eyebrow">PDF preview</p>
            <h3>{file.originalFilename}</h3>
          </div>
          <button className="button-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="delivery-dialog__reader-frame">
          <InlinePdfReader pdfUrl={pdfUrl} pages={file.readerPages || []} />
        </div>
      </div>
    </div>
  );
}
