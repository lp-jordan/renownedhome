import { useEffect, useRef, useState } from "react";

function PopoverButton({ label, disabled, children, onClose }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handler(event) {
      if (ref.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  function close() {
    setOpen(false);
    onClose?.();
  }

  return (
    <div className="delivery-bulkbar__pop" ref={ref}>
      <button
        type="button"
        className="delivery-bulkbar__btn"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className="delivery-bulkbar__pop-panel" role="menu">
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}

export default function DeliveryBulkBar({
  innerRef,
  selectedCount,
  tiers,
  files,
  onMoveToTier,
  onAddAddon,
  onSendSelected,
  onDeleteSelected,
  onClearSelection,
}) {
  if (!selectedCount) return null;

  return (
    <div className="delivery-bulkbar" role="region" aria-label="Bulk actions" ref={innerRef}>
      <div className="delivery-bulkbar__count">
        <strong>{selectedCount}</strong>
        <span>selected</span>
      </div>

      <div className="delivery-bulkbar__group">
        <PopoverButton label="Move to" disabled={!tiers.length}>
          {(close) => (
            <ul className="delivery-bulkbar__menu">
              {tiers.map((tier) => (
                <li key={tier.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onMoveToTier(tier.id);
                      close();
                    }}
                  >
                    {tier.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverButton>

        <PopoverButton label="Add add-on" disabled={!files.length}>
          {(close) => (
            <ul className="delivery-bulkbar__menu">
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    type="button"
                    title={file.originalFilename}
                    onClick={() => {
                      onAddAddon(file.id);
                      close();
                    }}
                  >
                    {file.originalFilename}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PopoverButton>

        <button className="delivery-bulkbar__btn" type="button" onClick={onSendSelected}>
          Send email
        </button>

        <button
          className="delivery-bulkbar__btn delivery-bulkbar__btn--danger"
          type="button"
          onClick={onDeleteSelected}
        >
          Delete
        </button>
      </div>

      <button
        className="delivery-bulkbar__close"
        type="button"
        onClick={onClearSelection}
        aria-label="Clear selection"
      >
        ✕
      </button>
    </div>
  );
}
