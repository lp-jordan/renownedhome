import { useEffect, useState } from "react";

export function formatAssetMeta(asset) {
  const parts = [];
  const fileName = asset.metadata?.fileName || asset.label || asset.metadata?.category || "Uploaded asset";
  const width = asset.metadata?.width;
  const height = asset.metadata?.height;

  parts.push(fileName);

  if (width && height) {
    parts.push(`${width}x${height}`);
  }

  if (asset.metadata?.normalized) {
    parts.push("optimized");
  }

  return parts.join(" | ");
}

export function isImageAsset(asset) {
  const contentType = asset?.metadata?.contentType || "";
  if (contentType.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(asset?.url || "");
}

function getAssetSelectionItems(assets) {
  return assets.flatMap((asset) => {
    const sourceItem = {
      key: `${asset.id}:source`,
      url: asset.url,
      label: asset.label,
      meta: `${formatAssetMeta(asset)} | Original`,
      previewUrl: asset.url,
      sourceLabel: asset.label,
    };
    const variantItems = (asset.variants || []).map((variant) => ({
      key: `${asset.id}:variant:${variant.id}`,
      url: variant.url,
      label: `${asset.label} - ${variant.label}`,
      meta: `${formatAssetMeta(variant)} | Version of ${asset.label}`,
      previewUrl: variant.url,
      sourceLabel: asset.label,
    }));

    return [sourceItem, ...variantItems];
  });
}

export function AssetPickerModal({ title, assets, isOpen, onClose, onPick }) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const filteredAssets = getAssetSelectionItems(assets).filter((asset) =>
    [asset.label, asset.url, asset.meta, asset.sourceLabel]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <div className="asset-gallery-modal" role="dialog" aria-modal="true">
      <div className="asset-gallery-modal__backdrop" onClick={onClose} />
      <div className="asset-gallery-modal__panel">
        <div className="asset-gallery-modal__header">
          <div>
            <p className="editor-header__eyebrow">Asset library</p>
            <h3>{title}</h3>
            <p className="field-help">Choose any uploaded image from the media library.</p>
          </div>
          <button className="button-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="asset-picker__search">
          <span>Search images</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search asset library"
          />
        </label>
        <div className="asset-gallery-grid">
          {filteredAssets.map((asset) => (
            <button
              key={asset.key}
              className="asset-gallery-card"
              type="button"
              onClick={() => {
                onPick(asset.url);
                onClose();
              }}
            >
              <img src={asset.previewUrl} alt={asset.label} className="asset-gallery-card__image" />
              <span className="asset-gallery-card__title">{asset.label}</span>
              <span className="asset-gallery-card__meta">
                {asset.meta}
              </span>
            </button>
          ))}
        </div>
        {!filteredAssets.length ? (
          <p className="field-help">No images match that search right now.</p>
        ) : null}
      </div>
    </div>
  );
}

export function AssetField({ label, value, onChange, assets, helperText = "" }) {
  const imageAssets = assets.filter(isImageAsset);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="asset-field">
      <div className="asset-media-row">
        <div className="asset-media-row__header">
          <span>{label}</span>
        </div>
        <button
          className={`asset-field__preview-button asset-media-row__thumb ${value ? "" : "is-empty"}`}
          type="button"
          onClick={() => setPickerOpen(true)}
        >
          {value ? (
            <img className="asset-field__preview" src={value} alt={label} />
          ) : (
            <span className="asset-field__empty">Click to choose from library</span>
          )}
        </button>
      </div>
      {helperText ? <p className="field-help">{helperText}</p> : null}
      <AssetPickerModal
        title={`Choose ${label}`}
        assets={imageAssets}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={onChange}
      />
    </div>
  );
}
