import { useEffect, useMemo, useRef, useState } from "react";

const DRAG_THRESHOLD_PX = 4;
const MIN_CROP_SIZE = 0.01;
const RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCrop(crop) {
  if (!crop) return null;
  const x = clamp(Number(crop.x) || 0, 0, 0.99);
  const y = clamp(Number(crop.y) || 0, 0, 0.99);
  const width = clamp(Number(crop.width) || 0.01, MIN_CROP_SIZE, 1 - x);
  const height = clamp(Number(crop.height) || 0.01, MIN_CROP_SIZE, 1 - y);
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

// Compute normalized [0,1] point within the canvas element from a pointer event.
// Uses a stored rect for a consistent reference frame throughout a drag.
function pointInCanvas(clientX, clientY, canvasRect) {
  return {
    x: clamp((clientX - canvasRect.left) / canvasRect.width, 0, 1),
    y: clamp((clientY - canvasRect.top) / canvasRect.height, 0, 1),
  };
}

function applyDragToCrop(dragState, currentPoint) {
  if (!dragState) return null;
  const { mode, startPoint, startCrop, handle } = dragState;

  if (mode === "draw") {
    const left = Math.min(startPoint.x, currentPoint.x);
    const top = Math.min(startPoint.y, currentPoint.y);
    const right = Math.max(startPoint.x, currentPoint.x);
    const bottom = Math.max(startPoint.y, currentPoint.y);
    return normalizeCrop({ x: left, y: top, width: right - left, height: bottom - top });
  }

  if (mode === "move") {
    return normalizeCrop({
      ...startCrop,
      x: startCrop.x + (currentPoint.x - startPoint.x),
      y: startCrop.y + (currentPoint.y - startPoint.y),
    });
  }

  // resize
  let left = startCrop.x;
  let top = startCrop.y;
  let right = startCrop.x + startCrop.width;
  let bottom = startCrop.y + startCrop.height;
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;

  if (handle.includes("w")) left = clamp(left + dx, 0, right - MIN_CROP_SIZE);
  if (handle.includes("e")) right = clamp(right + dx, left + MIN_CROP_SIZE, 1);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, 1);

  return normalizeCrop({ x: left, y: top, width: right - left, height: bottom - top });
}

function buildDraft(variant) {
  if (!variant) return { id: "", label: "", crop: null };
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
  const canvasRef = useRef(null);
  // Tracks which asset.id we've initialized for — prevents useEffect from
  // resetting the draft whenever variants updates after a save.
  const initializedForRef = useRef(null);
  // Set true after a successful create so the variants-watch effect can
  // select the newly prepended variant when the parent propagates the update.
  const pendingNewVariantRef = useRef(false);

  const sourceType = asset?.metadata?.contentType || "";
  const supportsCropping = ["image/jpeg", "image/png", "image/webp"].includes(sourceType);
  const variants = useMemo(() => asset?.variants || [], [asset]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("");
      setDragState(null);
      initializedForRef.current = null;
      pendingNewVariantRef.current = false;
      return;
    }
    const key = asset?.id || "";
    if (initializedForRef.current === key) return;
    initializedForRef.current = key;
    const initialVariant = variants[0] || null;
    setActiveVariantId(initialVariant?.id || "");
    setDraft(buildDraft(initialVariant));
    setStatus("");
  }, [isOpen, variants, asset?.id]);

  // After a successful create the parent prepends the new variant.
  // Select it once the variants array updates.
  useEffect(() => {
    if (!pendingNewVariantRef.current || !variants.length) return;
    pendingNewVariantRef.current = false;
    const newVariant = variants[0];
    setActiveVariantId(newVariant.id);
    setDraft(buildDraft(newVariant));
  }, [variants]);

  if (!isOpen || !asset) return null;

  function hasDraftChanges() {
    if (!draft.id) return Boolean(draft.crop || draft.label.trim());
    const saved = variants.find((v) => v.id === draft.id);
    if (!saved) return false;
    if (draft.label !== (saved.label || "")) return true;
    return cropsDiffer(draft.crop, saved.metadata?.crop);
  }

  function guardUnsaved() {
    if (!hasDraftChanges()) return true;
    return window.confirm("You have unsaved changes. Switch anyway?");
  }

  function updateCrop(nextCrop) {
    setDraft((current) => ({ ...current, crop: normalizeCrop(nextCrop) }));
  }

  function beginInteraction(event, mode, handle = "") {
    if (!supportsCropping || !canvasRef.current) return;
    if ((mode === "move" || mode === "resize") && !draft.crop) return;

    event.preventDefault();
    event.stopPropagation();

    const canvasRect = canvasRef.current.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;

    const startPoint = pointInCanvas(event.clientX, event.clientY, canvasRect);
    canvasRef.current.setPointerCapture?.(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      mode,
      handle,
      canvasRect,   // frozen at drag-start for a consistent reference frame
      startPoint,
      startCrop: draft.crop,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    });
  }

  function handlePointerMove(event) {
    if (!dragState) return;

    const moved =
      dragState.moved ||
      Math.abs(event.clientX - dragState.startClientX) >= DRAG_THRESHOLD_PX ||
      Math.abs(event.clientY - dragState.startClientY) >= DRAG_THRESHOLD_PX;

    if (!moved) return;
    if (!dragState.moved) setDragState((s) => s ? { ...s, moved: true } : s);

    const current = pointInCanvas(event.clientX, event.clientY, dragState.canvasRect);
    updateCrop(applyDragToCrop(dragState, current));
  }

  function handlePointerUp(event) {
    if (!dragState) return;
    canvasRef.current?.releasePointerCapture?.(dragState.pointerId);
    if (dragState.moved) {
      const current = pointInCanvas(event.clientX, event.clientY, dragState.canvasRect);
      updateCrop(applyDragToCrop(dragState, current));
    }
    setDragState(null);
  }

  async function handleSave() {
    const payload = { label: draft.label.trim(), crop: draft.crop };
    if (!payload.label) { setStatus("Add a version name before saving."); return; }
    if (!payload.crop) { setStatus("Draw a crop selection before saving."); return; }

    setStatus(draft.id ? "Updating version..." : "Saving version...");
    try {
      if (draft.id) {
        await onUpdateVariant(asset.id, draft.id, payload);
        setStatus("Version updated.");
      } else {
        await onCreateVariant(asset.id, payload);
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
    if (!window.confirm(`Delete "${draft.label || "this version"}"? This cannot be undone.`)) return;
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
          <button className="button-secondary" type="button" onClick={onClose}>Close</button>
        </div>

        <div className="asset-variant-editor">
          <div className="asset-variant-editor__canvas">
            {/* Outer container — centers the canvas and provides a border */}
            <div className={`asset-crop-surface ${supportsCropping ? "" : "is-disabled"}`}>
              {/*
                Inner canvas — sizes EXACTLY to the image's rendered dimensions.
                No object-fit letterboxing: the image uses width/height auto with max
                constraints, so the element IS the rendered content. Overlay percentages
                therefore map 1:1 to image fractions with zero ambiguity.
              */}
              <div
                ref={canvasRef}
                className="asset-crop-surface__canvas"
                onPointerDown={(e) => beginInteraction(e, "draw")}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => setDragState(null)}
              >
                <img
                  src={asset.url}
                  alt={asset.label}
                  className="asset-crop-surface__image"
                  draggable={false}
                />
                {supportsCropping && draft.crop && (
                  <div
                    className="asset-crop-surface__selection"
                    style={{
                      left: `${draft.crop.x * 100}%`,
                      top: `${draft.crop.y * 100}%`,
                      width: `${draft.crop.width * 100}%`,
                      height: `${draft.crop.height * 100}%`,
                    }}
                  >
                    <div
                      className="asset-crop-surface__selection-body"
                      onPointerDown={(e) => beginInteraction(e, "move")}
                    />
                    {RESIZE_HANDLES.map((handle) => (
                      <button
                        key={handle}
                        className={`asset-crop-surface__handle asset-crop-surface__handle--${handle}`}
                        type="button"
                        aria-label={`Resize crop ${handle}`}
                        onPointerDown={(e) => beginInteraction(e, "resize", handle)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            {supportsCropping ? (
              <p className="field-help">
                Drag on the image to draw a crop. Drag inside the box to move it, or drag the handles to resize.
              </p>
            ) : (
              <p className="field-help">
                Cropped versions are supported for JPG, PNG, and WEBP images.
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
                  onChange={(e) => setDraft((c) => ({ ...c, label: e.target.value }))}
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
                    onChange={(e) => {
                      if (!draft.crop) return;
                      const nextValue = Number(e.target.value) / 100;
                      setDraft((c) => ({ ...c, crop: normalizeCrop({ ...c.crop, [key]: nextValue }) }));
                    }}
                    disabled={!supportsCropping || !draft.crop}
                  />
                  <span className="asset-range-field__value">
                    {draft.crop ? `${Math.round(draft.crop[key] * 1000) / 10}%` : "--"}
                  </span>
                </label>
              ))}

              <div className="asset-variant-editor__actions">
                <button
                  className="button-primary"
                  type="button"
                  onClick={handleSave}
                  disabled={!supportsCropping || !draft.crop}
                >
                  {draft.id ? "Update version" : "Save version"}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setDraft((c) => ({ ...c, crop: null }))}
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
