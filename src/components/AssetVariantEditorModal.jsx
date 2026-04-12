import { useEffect, useMemo, useRef, useState } from "react";

const DRAG_THRESHOLD_PX = 6;
const MIN_CROP_SIZE = 0.01;
const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCrop(crop) {
  if (!crop) {
    return null;
  }

  const x = clamp(Number(crop.x) || 0, 0, 0.99);
  const y = clamp(Number(crop.y) || 0, 0, 0.99);
  const width = clamp(Number(crop.width) || 1, 0.01, 1 - x);
  const height = clamp(Number(crop.height) || 1, 0.01, 1 - y);
  return { x, y, width, height };
}

function cropsDiffer(a, b) {
  const na = normalizeCrop(a);
  const nb = normalizeCrop(b);
  if (!na && !nb) return false;
  if (!na || !nb) return true;
  return (
    Math.abs(na.x - nb.x) > 0.0001 ||
    Math.abs(na.y - nb.y) > 0.0001 ||
    Math.abs(na.width - nb.width) > 0.0001 ||
    Math.abs(na.height - nb.height) > 0.0001
  );
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

function getPointerPoint(event, element, renderedBounds) {
  const rect = element.getBoundingClientRect();
  if (renderedBounds) {
    return {
      x: clamp((event.clientX - rect.left - renderedBounds.left) / renderedBounds.width, 0, 1),
      y: clamp((event.clientY - rect.top - renderedBounds.top) / renderedBounds.height, 0, 1),
    };
  }
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

// Returns the rendered image bounds (in pixels, relative to the container) accounting
// for object-fit: contain letterboxing. Returns null if dimensions aren't known.
function getImageRenderedBounds(container, naturalWidth, naturalHeight) {
  if (!container || !naturalWidth || !naturalHeight) {
    return null;
  }
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  if (!cw || !ch) {
    return null;
  }
  const naturalRatio = naturalWidth / naturalHeight;
  const containerRatio = cw / ch;
  if (naturalRatio > containerRatio) {
    // Wider than container ratio → fills width, bars top/bottom
    const w = cw;
    const h = cw / naturalRatio;
    return { left: 0, top: (ch - h) / 2, width: w, height: h };
  }
  // Taller than container ratio → fills height, bars left/right
  const h = ch;
  const w = ch * naturalRatio;
  return { left: (cw - w) / 2, top: 0, width: w, height: h };
}

function applyDragToCrop(dragState, point) {
  if (!dragState) {
    return null;
  }

  if (dragState.mode === "draw") {
    return getPointerCrop(
      { clientX: point.clientX, clientY: point.clientY },
      { getBoundingClientRect: () => dragState.rect },
      dragState.startPoint
    );
  }

  if (dragState.mode === "move") {
    return {
      ...dragState.startCrop,
      x: clamp(dragState.startCrop.x + (point.x - dragState.startPoint.x), 0, 1 - dragState.startCrop.width),
      y: clamp(dragState.startCrop.y + (point.y - dragState.startPoint.y), 0, 1 - dragState.startCrop.height),
    };
  }

  let left = dragState.startCrop.x;
  let top = dragState.startCrop.y;
  let right = dragState.startCrop.x + dragState.startCrop.width;
  let bottom = dragState.startCrop.y + dragState.startCrop.height;
  const { handle } = dragState;

  if (handle.includes("w")) {
    left = clamp(dragState.startCrop.x + (point.x - dragState.startPoint.x), 0, right - MIN_CROP_SIZE);
  }
  if (handle.includes("e")) {
    right = clamp(
      dragState.startCrop.x + dragState.startCrop.width + (point.x - dragState.startPoint.x),
      left + MIN_CROP_SIZE,
      1
    );
  }
  if (handle.includes("n")) {
    top = clamp(dragState.startCrop.y + (point.y - dragState.startPoint.y), 0, bottom - MIN_CROP_SIZE);
  }
  if (handle.includes("s")) {
    bottom = clamp(
      dragState.startCrop.y + dragState.startCrop.height + (point.y - dragState.startPoint.y),
      top + MIN_CROP_SIZE,
      1
    );
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function buildDraft(variant) {
  if (!variant) {
    return {
      id: "",
      label: "",
      crop: null,
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
  const [imageDimensions, setImageDimensions] = useState(null);
  const previewRef = useRef(null);
  const imageRef = useRef(null);
  // Tracks which asset.id we have already initialized for, preventing the useEffect
  // from resetting the draft whenever variants updates after a save.
  const initializedForRef = useRef(null);
  // Set to true immediately after a successful create so the variants-watch effect
  // can select the newly prepended variant once the parent propagates the change.
  const pendingNewVariantRef = useRef(false);

  const sourceType = asset?.metadata?.contentType || "";
  const supportsCropping = ["image/jpeg", "image/png", "image/webp"].includes(sourceType);
  const variants = useMemo(() => asset?.variants || [], [asset]);

  // Initialize (or reset) state when the modal opens for a new asset.
  // The initializedForRef guard prevents re-initialization when variants updates
  // after a save, which would discard the user's active editing session.
  useEffect(() => {
    if (!isOpen) {
      setStatus("");
      setDragState(null);
      setImageDimensions(null);
      initializedForRef.current = null;
      pendingNewVariantRef.current = false;
      return;
    }

    const key = asset?.id || "";
    if (initializedForRef.current === key) {
      // Already initialized for this asset — variants updated after a save, don't reset.
      return;
    }
    initializedForRef.current = key;

    const initialVariant = variants[0] || null;
    setActiveVariantId(initialVariant?.id || "");
    setDraft(buildDraft(initialVariant));
    setStatus("");
    setImageDimensions(null);
  }, [isOpen, variants, asset?.id]);

  // After a successful create, the parent prepends the new variant to asset.variants.
  // When variants updates, select that new variant so the user sees it as active.
  useEffect(() => {
    if (!pendingNewVariantRef.current || !variants.length) {
      return;
    }
    pendingNewVariantRef.current = false;
    const newVariant = variants[0];
    setActiveVariantId(newVariant.id);
    setDraft(buildDraft(newVariant));
  }, [variants]);

  if (!isOpen || !asset) {
    return null;
  }

  // Returns true if the current draft has changes relative to its saved state.
  function hasDraftChanges() {
    if (!draft.id) {
      // New unsaved draft — has changes if anything has been drawn or typed.
      return Boolean(draft.crop || draft.label.trim());
    }
    const saved = variants.find((v) => v.id === draft.id);
    if (!saved) return false;
    if (draft.label !== (saved.label || "")) return true;
    return cropsDiffer(draft.crop, saved.metadata?.crop);
  }

  // Shows a browser confirm if there are unsaved changes. Returns true to proceed.
  function guardUnsaved() {
    if (!hasDraftChanges()) return true;
    return window.confirm("You have unsaved changes. Switch anyway?");
  }

  function updateCrop(nextCrop) {
    setDraft((current) => ({
      ...current,
      crop: normalizeCrop(nextCrop),
    }));
  }

  function beginInteraction(event, mode, handle = "") {
    if (!supportsCropping || !previewRef.current) {
      return;
    }

    if ((mode === "move" || mode === "resize") && !draft.crop) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const containerRect = previewRef.current.getBoundingClientRect();
    // Use imageDimensions state (not imageRef.current) for consistency with the overlay renderer.
    const renderedBounds = getImageRenderedBounds(
      previewRef.current,
      imageDimensions?.naturalWidth,
      imageDimensions?.naturalHeight
    );
    // Absolute screen rect of the rendered image area (for draw mode)
    const imageRect = renderedBounds
      ? {
          left: containerRect.left + renderedBounds.left,
          top: containerRect.top + renderedBounds.top,
          right: containerRect.left + renderedBounds.left + renderedBounds.width,
          bottom: containerRect.top + renderedBounds.top + renderedBounds.height,
          width: renderedBounds.width,
          height: renderedBounds.height,
        }
      : containerRect;
    const startPoint = getPointerPoint(event, previewRef.current, renderedBounds);
    previewRef.current.setPointerCapture?.(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      mode,
      handle,
      rect: imageRect,
      renderedBounds,
      startPoint,
      startCrop: draft.crop,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    });
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

    if (!payload.crop) {
      setStatus("Draw a crop selection before saving.");
      return;
    }

    setStatus(draft.id ? "Updating version..." : "Saving version...");
    try {
      if (draft.id) {
        await onUpdateVariant(asset.id, draft.id, payload);
        setStatus("Version updated.");
      } else {
        await onCreateVariant(asset.id, payload);
        // Signal the variants-watch effect to select the newly created variant
        // once the parent propagates the updated asset.variants array.
        pendingNewVariantRef.current = true;
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

    if (!window.confirm(`Delete "${draft.label || "this version"}"? This cannot be undone.`)) {
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
              onPointerDown={(event) => beginInteraction(event, "draw")}
              onPointerMove={(event) => {
                if (!dragState || !previewRef.current) {
                  return;
                }

                const moved =
                  dragState.moved ||
                  Math.abs(event.clientX - dragState.startClientX) >= DRAG_THRESHOLD_PX ||
                  Math.abs(event.clientY - dragState.startClientY) >= DRAG_THRESHOLD_PX;

                if (!moved) {
                  return;
                }

                if (!dragState.moved) {
                  setDragState((current) => (current ? { ...current, moved: true } : current));
                }

                updateCrop(
                  applyDragToCrop(dragState, {
                    ...getPointerPoint(event, previewRef.current, dragState.renderedBounds),
                    clientX: event.clientX,
                    clientY: event.clientY,
                  })
                );
              }}
              onPointerUp={(event) => {
                if (!dragState || !previewRef.current) {
                  return;
                }
                previewRef.current.releasePointerCapture?.(dragState.pointerId);
                if (dragState.moved) {
                  updateCrop(
                    applyDragToCrop(dragState, {
                      ...getPointerPoint(event, previewRef.current, dragState.renderedBounds),
                      clientX: event.clientX,
                      clientY: event.clientY,
                    })
                  );
                }
                setDragState(null);
              }}
              onPointerCancel={() => {
                setDragState(null);
              }}
            >
              <img
                ref={imageRef}
                src={asset.url}
                alt={asset.label}
                className="asset-crop-surface__image"
                onLoad={(event) => {
                  setImageDimensions({
                    naturalWidth: event.target.naturalWidth,
                    naturalHeight: event.target.naturalHeight,
                  });
                }}
              />
              {supportsCropping && draft.crop ? (() => {
                const bounds = getImageRenderedBounds(
                  previewRef.current,
                  imageDimensions?.naturalWidth,
                  imageDimensions?.naturalHeight
                );
                const cw = previewRef.current?.clientWidth || 1;
                const ch = previewRef.current?.clientHeight || 1;
                const overlayStyle = bounds
                  ? {
                      left: `${((bounds.left + draft.crop.x * bounds.width) / cw) * 100}%`,
                      top: `${((bounds.top + draft.crop.y * bounds.height) / ch) * 100}%`,
                      width: `${(draft.crop.width * bounds.width / cw) * 100}%`,
                      height: `${(draft.crop.height * bounds.height / ch) * 100}%`,
                    }
                  : {
                      left: `${draft.crop.x * 100}%`,
                      top: `${draft.crop.y * 100}%`,
                      width: `${draft.crop.width * 100}%`,
                      height: `${draft.crop.height * 100}%`,
                    };
                return (
                <div
                  className="asset-crop-surface__selection"
                  style={overlayStyle}
                >
                  <div
                    className="asset-crop-surface__selection-body"
                    onPointerDown={(event) => beginInteraction(event, "move")}
                  />
                  {RESIZE_HANDLES.map((handle) => (
                    <button
                      key={handle}
                      className={`asset-crop-surface__handle asset-crop-surface__handle--${handle}`}
                      type="button"
                      aria-label={`Resize crop ${handle}`}
                      onPointerDown={(event) => beginInteraction(event, "resize", handle)}
                    />
                  ))}
                </div>
                );
              })() : null}
            </div>
            {supportsCropping ? (
              <p className="field-help">
                Drag on the image to draw. Drag inside the box to move it, or drag the handles to resize.
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
                    if (!guardUnsaved()) return;
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
                    if (!guardUnsaved()) return;
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
                      if (!guardUnsaved()) return;
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
                    value={draft.crop ? Math.round(draft.crop[key] * 1000) / 10 : 0}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value) / 100;
                      if (!draft.crop) {
                        return;
                      }
                      setDraft((current) => {
                        const nextCrop = { ...current.crop, [key]: nextValue };
                        return { ...current, crop: normalizeCrop(nextCrop) };
                      });
                    }}
                    disabled={!supportsCropping || !draft.crop}
                  />
                  <span className="asset-range-field__value">
                    {draft.crop ? `${Math.round(draft.crop[key] * 1000) / 10}%` : "--"}
                  </span>
                </label>
              ))}

              <div className="asset-variant-editor__actions">
                <button className="button-primary" type="button" onClick={handleSave} disabled={!supportsCropping || !draft.crop}>
                  {draft.id ? "Update version" : "Save version"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, crop: null }))}
                  disabled={!supportsCropping || !draft.crop}
                >
                  Clear crop
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
