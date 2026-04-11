import { useEffect, useMemo, useRef, useState } from "react";

const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 };

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCrop(crop) {
  if (!crop) {
    return FULL_CROP;
  }

  const x = clamp(Number(crop.x) || 0, 0, 0.99);
  const y = clamp(Number(crop.y) || 0, 0, 0.99);
  const width = clamp(Number(crop.width) || 1, 0.01, 1 - x);
  const height = clamp(Number(crop.height) || 1, 0.01, 1 - y);
  return { x, y, width, height };
}

function getPointerCrop(event, element, startPoint) {
  const rect = element.getBoundingClientRect();
  const currentX = clamp((event.clientX - rect.left) / rect.width, 0, 1);
  const currentY = clamp((event.clientY - rect.top) / rect.height, 0, 1);
  const left = Math.min(startPoint.x, currentX);
  const top = Math.min(startPoint.y, currentY);
  const right = Math.max(startPoint.x, currentX);
  const bottom = Math.max(startPoint.y, currentY);

  return normalizeCrop({
    x: left,
    y: top,
    width: Math.max(right - left, 0.01),
    height: Math.max(bottom - top, 0.01),
  });
}

function buildDraft(variant) {
  if (!variant) {
    return {
      id: "",
      label: "",
      crop: FULL_CROP,
    };
  }

  return {
    id: variant.id || "",
    label: variant.label || "",
    crop: normalizeCrop(variant.metadata?.crop),
  };
}

function formatVariantMeta(variant) {
  const width = variant?.metadata?.width;
  const height = variant?.metadata?.height;
  return width && height ? `${width}x${height}` : "Saved version";
}

export default function AssetVariantEditorModal({
  asset,
  isOpen,
  onClose,
  onCreateVariant,
  onUpdateVariant,
  onDeleteVariant,
}) {
  const [draft, setDraft] = useState(buildDraft(null));
  const [activeVariantId, setActiveVariantId] = useState("");
  const [status, setStatus] = useState("");
  const [dragState, setDragState] = useState(null);
  const previewRef = useRef(null);
  const sourceType = asset?.metadata?.contentType || "";
  const supportsCropping = ["image/jpeg", "image/png", "image/webp"].includes(sourceType);
  const variants = useMemo(() => asset?.variants || [], [asset]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("");
      setDragState(null);
      return;
    }

    const initialVariant = variants[0] || null;
    setActiveVariantId(initialVariant?.id || "");
    setDraft(buildDraft(initialVariant));
    setStatus("");
  }, [isOpen, variants, asset?.id]);

  if (!isOpen || !asset) {
    return null;
  }

  function updateCrop(nextCrop) {
    setDraft((current) => ({
      ...current,
      crop: normalizeCrop(nextCrop),
    }));
  }

  async function handleSave() {
    const payload = {
      label: draft.label.trim(),
      crop: draft.crop,
    };

    if (!payload.label) {
      setStatus("Add a version name before saving.");
      return;
    }

    setStatus(draft.id ? "Updating version..." : "Saving version...");
    try {
      if (draft.id) {
        await onUpdateVariant(asset.id, draft.id, payload);
        setStatus("Version updated.");
      } else {
        await onCreateVariant(asset.id, payload);
        setStatus("Version saved.");
      }
    } catch (error) {
      setStatus(error.message || "Unable to save version.");
    }
  }

  async function handleDelete() {
    if (!draft.id) {
      setDraft(buildDraft(null));
      setActiveVariantId("");
      setStatus("Unsaved version cleared.");
      return;
    }

    setStatus("Deleting version...");
    try {
      await onDeleteVariant(asset.id, draft.id);
      setDraft(buildDraft(null));
      setActiveVariantId("");
      setStatus("Version deleted.");
    } catch (error) {
      setStatus(error.message || "Unable to delete version.");
    }
  }

  return (
    <div className="asset-gallery-modal" role="dialog" aria-modal="true">
      <div className="asset-gallery-modal__backdrop" onClick={onClose} />
      <div className="asset-gallery-modal__panel asset-gallery-modal__panel--wide">
        <div className="asset-gallery-modal__header">
          <div>
            <p className="editor-header__eyebrow">Image versions</p>
            <h3>{asset.label}</h3>
            <p className="field-help">
              Keep one source image and save named cropped versions inside it.
            </p>
          </div>
          <button className="button-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="asset-variant-editor">
          <div className="asset-variant-editor__canvas">
            <div
              ref={previewRef}
              className={`asset-crop-surface ${supportsCropping ? "" : "is-disabled"}`}
              onPointerDown={(event) => {
                if (!supportsCropping || !previewRef.current) {
                  return;
                }

                const rect = previewRef.current.getBoundingClientRect();
                const startPoint = {
                  x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
                  y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
                };
                previewRef.current.setPointerCapture?.(event.pointerId);
                setDragState({ pointerId: event.pointerId, startPoint });
                updateCrop({ x: startPoint.x, y: startPoint.y, width: 0.01, height: 0.01 });
              }}
              onPointerMove={(event) => {
                if (!dragState || !previewRef.current) {
                  return;
                }
                updateCrop(getPointerCrop(event, previewRef.current, dragState.startPoint));
              }}
              onPointerUp={(event) => {
                if (!dragState || !previewRef.current) {
                  return;
                }
                previewRef.current.releasePointerCapture?.(dragState.pointerId);
                updateCrop(getPointerCrop(event, previewRef.current, dragState.startPoint));
                setDragState(null);
              }}
            >
              <img src={asset.url} alt={asset.label} className="asset-crop-surface__image" />
              {supportsCropping ? (
                <div
                  className="asset-crop-surface__selection"
                  style={{
                    left: `${draft.crop.x * 100}%`,
                    top: `${draft.crop.y * 100}%`,
                    width: `${draft.crop.width * 100}%`,
                    height: `${draft.crop.height * 100}%`,
                  }}
                />
              ) : null}
            </div>
            {supportsCropping ? (
              <p className="field-help">
                Drag on the image to draw a crop box, then fine-tune with the sliders.
              </p>
            ) : (
              <p className="field-help">
                Cropped versions are currently supported for JPG, PNG, and WEBP source images.
              </p>
            )}
          </div>

          <div className="asset-variant-editor__controls">
            <div className="asset-variant-editor__section">
              <div className="asset-variant-editor__section-header">
                <h4>Saved versions</h4>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => {
                    setActiveVariantId("");
                    setDraft(buildDraft(null));
                    setStatus("");
                  }}
                >
                  New version
                </button>
              </div>
              <div className="asset-variant-list">
                <button
                  className={`asset-variant-item ${activeVariantId === "" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setActiveVariantId("");
                    setDraft(buildDraft(null));
                    setStatus("");
                  }}
                >
                  <div className="asset-variant-item__thumb asset-variant-item__thumb--source">
                    <img src={asset.url} alt={`${asset.label} original`} />
                  </div>
                  <div className="asset-variant-item__copy">
                    <strong>Original source</strong>
                    <span>{asset.metadata?.width}x{asset.metadata?.height}</span>
                  </div>
                </button>
                {variants.map((variant) => (
                  <button
                    key={variant.id}
                    className={`asset-variant-item ${activeVariantId === variant.id ? "is-active" : ""}`}
                    type="button"
                    onClick={() => {
                      setActiveVariantId(variant.id);
                      setDraft(buildDraft(variant));
                      setStatus("");
                    }}
                  >
                    <div className="asset-variant-item__thumb">
                      <img src={variant.url} alt={variant.label} />
                    </div>
                    <div className="asset-variant-item__copy">
                      <strong>{variant.label}</strong>
                      <span>{formatVariantMeta(variant)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="asset-variant-editor__section">
              <h4>{draft.id ? "Edit version" : "New version"}</h4>
              <label className="field">
                <span>Version name</span>
                <input
                  value={draft.label}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, label: event.target.value }))
                  }
                  placeholder="Issue gallery crop"
                />
              </label>

              {["x", "y", "width", "height"].map((key) => (
                <label key={key} className="field asset-range-field">
                  <span>{key === "x" ? "Left" : key === "y" ? "Top" : key === "width" ? "Width" : "Height"}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="0.5"
                    value={Math.round(draft.crop[key] * 1000) / 10}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value) / 100;
                      setDraft((current) => {
                        const nextCrop = { ...current.crop, [key]: nextValue };
                        return { ...current, crop: normalizeCrop(nextCrop) };
                      });
                    }}
                    disabled={!supportsCropping}
                  />
                  <span className="asset-range-field__value">
                    {Math.round(draft.crop[key] * 1000) / 10}%
                  </span>
                </label>
              ))}

              <div className="asset-variant-editor__actions">
                <button className="button-primary" type="button" onClick={handleSave} disabled={!supportsCropping}>
                  {draft.id ? "Update version" : "Save version"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, crop: FULL_CROP }))}
                  disabled={!supportsCropping}
                >
                  Reset crop
                </button>
                <button className="button-secondary" type="button" onClick={handleDelete}>
                  {draft.id ? "Delete version" : "Clear draft"}
                </button>
              </div>
              {status ? <p className="status-line">{status}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
