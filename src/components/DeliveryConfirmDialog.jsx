import { useEffect, useRef, useState } from "react";

export default function DeliveryConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onClose,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef(null);

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError("");
      const id = setTimeout(() => confirmRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !busy) {
        onClose?.();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function handleConfirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm?.();
    } catch (confirmError) {
      setError(confirmError?.message || "Action failed.");
      setBusy(false);
    }
  }

  return (
    <div className="delivery-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="delivery-dialog__backdrop" onClick={busy ? undefined : onClose} />
      <div className="delivery-dialog__panel delivery-dialog__panel--narrow">
        <h3 className="delivery-dialog__title">{title}</h3>
        {body ? <div className="delivery-dialog__body">{body}</div> : null}
        {error ? <p className="delivery-dialog__error">{error}</p> : null}
        <div className="delivery-dialog__actions">
          <button
            className="button-secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            className={destructive ? "button-danger" : "button-primary"}
            type="button"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
