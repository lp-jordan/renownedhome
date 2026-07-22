import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import AssetVariantEditorModal from "./AssetVariantEditorModal";
import { AssetField, AssetPickerModal, isImageAsset, isPdfAsset } from "./AssetField";
import DeliveryAdmin from "./DeliveryAdmin";
import ShareLinksAdmin from "./ShareLinksAdmin";
import FunnelAdmin from "./FunnelAdmin";
import { usePageSeo } from "../lib/seo";
import { useAutosave } from "../hooks/useAutosave";

function formatDateTime(dateString) {
  if (!dateString) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatLetterPreview(message) {
  const normalized = (message || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "No message provided.";
  }

  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function formatRelativeTime(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [
    { limit: 60, value: diffMinutes, unit: "minute" },
    { limit: 1440, value: Math.round(diffMinutes / 60), unit: "hour" },
    { limit: 43200, value: Math.round(diffMinutes / 1440), unit: "day" },
    { limit: 525600, value: Math.round(diffMinutes / 43200), unit: "month" },
  ];
  const match = ranges.find((range) => Math.abs(diffMinutes) < range.limit);

  if (match) {
    return formatter.format(match.value, match.unit);
  }

  return formatter.format(Math.round(diffMinutes / 525600), "year");
}

function Field({ label, value, onChange, multiline = false }) {
  return (
    <label className={`field ${multiline ? "field--multiline" : ""}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea rows={4} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

// Sale toggle shared by issue prices and the bundle price: enabling it and
// saving derives a discounted Stripe Price from the current base price
// server-side (see ensureSalePrice in server.js) — the base price is never
// edited or deleted, so toggling off always reverts cleanly.
function SaleFields({ sale, onChange }) {
  const current = sale || { enabled: false, percent: 20 };
  return (
    <div className="editor-card__sale" style={{ marginTop: "12px" }}>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={Boolean(current.enabled)}
          onChange={(e) => onChange({ ...current, enabled: e.target.checked })}
        />
        <span>Sale</span>
      </label>
      {current.enabled ? (
        <div className="delivery-form-grid" style={{ marginTop: "8px" }}>
          <Field
            label="Percent off"
            value={String(current.percent ?? 20)}
            onChange={(v) => onChange({ ...current, percent: Number(v) || 0 })}
          />
        </div>
      ) : null}
      {current.enabled && current.priceId && current.percentApplied === current.percent ? (
        <p className="editor-card__hint">Sale price is live in Stripe.</p>
      ) : current.enabled ? (
        <p className="editor-card__hint">Save to create the discounted Stripe price.</p>
      ) : null}
    </div>
  );
}

function normalizeFolderName(value) {
  return String(value || "").trim();
}

function AssetListField({ label, values, onChange, assets, helperText }) {
  const imageAssets = assets.filter(isImageAsset);
  const [pickerState, setPickerState] = useState({ open: false, index: -1, mode: "replace" });

  function updateItem(index, nextValue) {
    onChange(
      values.map((value, currentIndex) => (currentIndex === index ? nextValue : value)).filter(Boolean)
    );
  }

  function removeItem(index) {
    onChange(values.filter((_, currentIndex) => currentIndex !== index));
  }

  function addItem(value) {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    onChange([...values, trimmed]);
  }

  return (
    <div className="asset-list-field">
      <div className="asset-list-field__header">
        <h3>{label}</h3>
        <span>{values.length} selected</span>
      </div>
      <div className="asset-list-field__items">
        {values.map((value, index) => (
          <div key={`${value}-${index}`} className="asset-list-field__item">
            <div className="asset-media-row">
              <div className="asset-media-row__header">
                <span>{label} {index + 1}</span>
              </div>
              <button
                className={`asset-field__preview-button asset-media-row__thumb ${value ? "" : "is-empty"}`}
                type="button"
                onClick={() => setPickerState({ open: true, index, mode: "replace" })}
              >
                {value ? (
                  <img className="asset-list-field__preview" src={value} alt={`${label} ${index + 1}`} />
                ) : (
                  <span className="asset-field__empty">Click to choose from library</span>
                )}
              </button>
              <div className="asset-media-row__inline-actions">
                <button className="asset-media-row__link" type="button" onClick={() => removeItem(index)}>
                  Remove item
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="asset-list-field__add">
        <button
          className="button-secondary"
          type="button"
          onClick={() => setPickerState({ open: true, index: -1, mode: "add" })}
        >
          Add from library
        </button>
      </div>
      {helperText ? <p className="field-help">{helperText}</p> : null}
      <AssetPickerModal
        title={pickerState.mode === "add" ? `Add ${label}` : `Choose ${label}`}
        assets={imageAssets}
        isOpen={pickerState.open}
        onClose={() => setPickerState({ open: false, index: -1, mode: "replace" })}
        onPick={(nextValue) => {
          if (pickerState.mode === "add") {
            addItem(nextValue);
            return;
          }
          if (pickerState.index >= 0) {
            updateItem(pickerState.index, nextValue);
          }
        }}
      />
    </div>
  );
}

function ImageReplaceRow({ label, value, assets, onReplace, buttonLabel = "Replace" }) {
  const imageAssets = assets.filter(isImageAsset);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="workspace-image-row">
      <div className="workspace-image-row__copy">
        <h3>{label}</h3>
        {value ? (
          <img className="workspace-image-row__preview" src={value} alt={label} />
        ) : (
          <div className="workspace-image-row__empty">No image assigned</div>
        )}
      </div>
      <button className="button-primary workspace-image-row__button" type="button" onClick={() => setPickerOpen(true)}>
        {buttonLabel}
      </button>
      <AssetPickerModal
        title={`Choose ${label}`}
        assets={imageAssets}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(nextValue) => {
          onReplace(nextValue);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function IssueGalleryManager({
  featuredImage,
  galleryImages,
  assets,
  onChangeFeatured,
  onChangeGallery,
}) {
  const imageAssets = assets.filter(isImageAsset);
  const [pickerOpen, setPickerOpen] = useState(false);
  const managedImages = uniqueItems([featuredImage, ...galleryImages]);

  function addGalleryImage(value) {
    onChangeGallery(uniqueItems([...managedImages, value]));
  }

  function removeGalleryImage(value) {
    onChangeGallery(managedImages.filter((image) => image !== value));
    if (featuredImage === value) {
      onChangeFeatured("");
    }
  }

  return (
    <div className="workspace-gallery-manager">
      <div className="workspace-gallery-manager__header">
        <div>
          <h3>Issue Images</h3>
          <p className="field-help">These images power both the bottom gallery and the reader. Mark one as featured to use it at the top of the issue page.</p>
        </div>
        <button className="button-secondary" type="button" onClick={() => setPickerOpen(true)}>
          Add image
        </button>
      </div>
      <div className="workspace-gallery-manager__items">
        {managedImages.map((image, index) => (
          <div key={`${image}-${index}`} className="workspace-gallery-item">
            <div className="workspace-gallery-item__media">
              <img className="workspace-gallery-item__preview" src={image} alt={`Gallery image ${index + 1}`} />
              <div className="workspace-gallery-item__overlay">
                <button
                  className={`workspace-gallery-item__pill ${featuredImage === image ? "is-active" : ""}`}
                  type="button"
                  onClick={() => onChangeFeatured(featuredImage === image ? "" : image)}
                  aria-label={featuredImage === image ? "Remove featured image" : "Make featured image"}
                  title={featuredImage === image ? "Featured image" : "Make featured"}
                >
                  {featuredImage === image ? "Featured" : "Feature"}
                </button>
                <button
                  className="workspace-gallery-item__pill"
                  type="button"
                  onClick={() => removeGalleryImage(image)}
                  aria-label="Remove image"
                  title="Remove image"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        {!managedImages.length ? (
          <p className="workspace-empty-state">No issue images yet. Add one from the library to populate the issue page and reader.</p>
        ) : null}
      </div>
      <AssetPickerModal
        title="Add issue image"
        assets={imageAssets}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(nextValue) => {
          addGalleryImage(nextValue);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function EditorHeader({ title, subtitle, status, onSave }) {
  return (
    <div className="editor-header">
      <div>
        <p className="editor-header__eyebrow">Admin</p>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="editor-header__actions">
        <span className={`status-pill ${status.includes("Error") ? "status-pill--error" : ""}`}>
          {status}
        </span>
        <button className="button-primary" type="button" onClick={onSave}>
          Save now
        </button>
      </div>
    </div>
  );
}

function AccordionSection({ title, summary, defaultOpen = false, children, helperText }) {
  return (
    <details className="editor-section" open={defaultOpen}>
      <summary className="editor-section__summary">
        <span className="editor-section__title-wrap">
          <span className="editor-section__title">{title}</span>
          {summary ? <span className="editor-section__summary-text">{summary}</span> : null}
        </span>
      </summary>
      <div className="editor-section__body">
        {helperText ? <p className="field-help">{helperText}</p> : null}
        {children}
      </div>
    </details>
  );
}

const HOME_PANEL_ORDER = ["/read", "/meet", "/letters", "/shop"];
const HOME_PANEL_DEFAULTS = {
  "/read": { label: "Read", href: "/read", size: "wide" },
  "/meet": { label: "Meet", href: "/meet", size: "wide-half" },
  "/letters": { label: "Letters", href: "/letters", size: "standard" },
  "/shop": { label: "Shop", href: "/shop", size: "standard" },
};

function getHomePanels(page) {
  const existingPanels = Array.isArray(page?.content?.panels) ? page.content.panels : [];

  return HOME_PANEL_ORDER.map((href) => {
    const existing = existingPanels.find((panel) => panel.href === href);
    return {
      ...HOME_PANEL_DEFAULTS[href],
      ...existing,
    };
  });
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function PageEditor({ pages, assets, onSave, title = "Pages", teamMembers = [], onSaveTeamMember }) {
  const selectedPage = pages[0];
  const [draft, setDraft] = useState(selectedPage);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    setDraft(selectedPage);
    setSaveStatus("");
  }, [selectedPage]);

  async function saveNextDraft(nextDraft, statusLabel = "Image updated.") {
    setDraft(nextDraft);
    setSaveStatus("Updating image...");
    try {
      await onSave(nextDraft);
      setSaveStatus(statusLabel);
    } catch (error) {
      setSaveStatus(error.message || "Unable to update image.");
    }
  }

  function buildDraft(path, value) {
    const next = structuredClone(draft);
    let cursor = next;
    for (let index = 0; index < path.length - 1; index += 1) {
      cursor = cursor[path[index]];
    }
    cursor[path[path.length - 1]] = value;
    return next;
  }

  async function update(path, value, statusLabel) {
    if (!draft) {
      return;
    }

    await saveNextDraft(buildDraft(path, value), statusLabel);
  }

  async function updateHomePanelImage(panelHref, image) {
    if (!draft) {
      return;
    }

    const nextDraft = structuredClone(draft);
    const panels = Array.isArray(nextDraft.content?.panels) ? nextDraft.content.panels : [];
    const existingIndex = panels.findIndex((panel) => panel.href === panelHref);

    if (existingIndex >= 0) {
      panels[existingIndex] = {
        ...panels[existingIndex],
        ...HOME_PANEL_DEFAULTS[panelHref],
        image,
      };
    } else {
      panels.push({
        ...HOME_PANEL_DEFAULTS[panelHref],
        image,
      });
    }

    nextDraft.content.panels = panels;
    await saveNextDraft(nextDraft, `${HOME_PANEL_DEFAULTS[panelHref].label} image updated.`);
  }

  if (!draft) {
    return null;
  }

  const homePanels = draft.slug === "/" ? getHomePanels(draft) : [];

  return (
    <section className="workspace-detail">
      <header className="workspace-detail__header">
        <div className="workspace-detail__heading">
          <h1>{draft.title || title}</h1>
          <p>
            <span>{draft.slug || "/"}</span>
            <span className="workspace-detail__meta-sep">
              {draft.status === "published" ? "Published" : "Draft"}
            </span>
          </p>
        </div>
      </header>

      <p className="workspace-inline-note">
        This page is managed in code. Only images can be updated here.
      </p>
      {saveStatus ? <p className="workspace-inline-note">{saveStatus}</p> : null}

      <div className="workspace-read-view">
        <section className="workspace-read-section">
          <h2>Hero</h2>
          <div className="workspace-read-copy">
            <p className="workspace-read-copy__title">{draft.hero?.title || draft.title}</p>
            {draft.hero?.subtitle ? <p>{draft.hero.subtitle}</p> : null}
            {draft.hero?.intro ? <p>{draft.hero.intro}</p> : null}
          </div>
        </section>

        <section className="workspace-read-section">
          <h2>Images</h2>
          <div className="workspace-image-list">
            <ImageReplaceRow
              label="Background Image"
              value={draft.hero?.backgroundImage || ""}
              assets={assets}
              onReplace={(value) => update(["hero", "backgroundImage"], value, "Background image updated.")}
            />
            {draft.hero?.titleImage ? (
              <ImageReplaceRow
                label="Title Image"
                value={draft.hero.titleImage}
                assets={assets}
                onReplace={(value) => update(["hero", "titleImage"], value, "Title image updated.")}
              />
            ) : null}
            {homePanels.map((panel) => (
              <ImageReplaceRow
                key={panel.href}
                label={`${panel.label} Image`}
                value={panel.image || ""}
                assets={assets}
                onReplace={(value) => updateHomePanelImage(panel.href, value)}
              />
            ))}
            {teamMembers.length > 0 && teamMembers.map((member) => (
              <ImageReplaceRow
                key={member.id}
                label={member.name}
                value={member.image || ""}
                assets={assets}
                onReplace={async (value) => {
                  setSaveStatus("Updating photo...");
                  try {
                    await onSaveTeamMember({ ...member, image: value });
                    setSaveStatus(`${member.name} photo updated.`);
                  } catch (error) {
                    setSaveStatus(error.message || "Unable to update photo.");
                  }
                }}
              />
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function IssueEditor({ issues, assets, onSave, title = "Issues" }) {
  const selected = issues[0];
  const [draft, setDraft] = useState(selected);
  const [saveStatus, setSaveStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(selected);
    setSaveStatus("");
  }, [selected?.id]);

  function setShopField(field, value) {
    setDraft((d) => ({ ...d, shop: { ...(d.shop || {}), [field]: value } }));
  }

  async function save() {
    if (!draft || isSaving) return;
    setIsSaving(true);
    setSaveStatus("Saving…");
    try {
      await onSave(draft);
      setSaveStatus("Saved.");
    } catch (err) {
      setSaveStatus(err.message || "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveImageUpdate(nextDraft) {
    setDraft(nextDraft);
    setSaveStatus("Saving…");
    try {
      await onSave(nextDraft);
      setSaveStatus("Saved.");
    } catch (err) {
      setSaveStatus(err.message || "Save failed.");
    }
  }

  if (!draft) return null;

  const shop = draft.shop || {};

  return (
    <section className="workspace-detail">
        <header className="workspace-detail__header">
          <div className="workspace-detail__heading">
            <h1>{draft.title}</h1>
            <p>
              <span>{draft.slug}</span>
              <span className="workspace-detail__meta-sep">
                {draft.status === "published" ? "Published" : "Draft"}
              </span>
            </p>
          </div>
          <div className="workspace-detail__actions">
            {saveStatus && <span className="status-line">{saveStatus}</span>}
            <button type="button" className="button-primary" onClick={save} disabled={isSaving}>
              Save
            </button>
          </div>
        </header>

        <div className="workspace-read-view">

          {/* Content */}
          <section className="workspace-read-section">
            <h2>Content</h2>
            <div className="editor-card">
              <AssetField
                label="Cover image (used on buy page and issue cards)"
                value={draft.coverImage || ""}
                assets={assets}
                filter="image"
                onChange={(v) => saveImageUpdate({ ...draft, coverImage: v, featuredImage: v })}
              />
            </div>
            <div className="editor-card">
              <h3 className="editor-card__label">Home carousel crop position</h3>
              <p className="editor-card__hint">
                The homepage carousel crops the cover to a 16:9 strip. Drag to move the crop up or down if it's cutting off the wrong part of the art.
              </p>
              <div className="cover-focal-editor">
                <div
                  className="cover-focal-editor__preview"
                  style={{
                    backgroundImage: draft.coverImage ? `url(${draft.coverImage})` : "none",
                    backgroundPositionY: `${Number.isFinite(draft.carouselFocalY) ? draft.carouselFocalY : 22}%`,
                  }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Number.isFinite(draft.carouselFocalY) ? draft.carouselFocalY : 22}
                  onChange={(e) => setDraft((d) => ({ ...d, carouselFocalY: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="editor-card">
              <div className="delivery-form-grid">
                <Field label="Title" value={draft.title || ""} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} />
                <Field label="Short label (e.g. Chapter 1)" value={draft.shortLabel || ""} onChange={(v) => setDraft((d) => ({ ...d, shortLabel: v }))} />
                <Field label="Release date" value={draft.releaseDate || ""} onChange={(v) => setDraft((d) => ({ ...d, releaseDate: v }))} />
                <Field label="Writer" value={draft.writer || ""} onChange={(v) => setDraft((d) => ({ ...d, writer: v }))} />
                <Field label="Artist" value={draft.artist || ""} onChange={(v) => setDraft((d) => ({ ...d, artist: v }))} />
                <Field label="Colorist" value={draft.colorist || ""} onChange={(v) => setDraft((d) => ({ ...d, colorist: v }))} />
              </div>
              <div className="delivery-form-grid delivery-form-grid--full" style={{ marginTop: "12px" }}>
                <Field label="Description" value={draft.description || ""} multiline onChange={(v) => setDraft((d) => ({ ...d, description: v }))} />
              </div>
              <div className="delivery-form-grid delivery-form-grid--full" style={{ marginTop: "12px" }}>
                <Field
                  label="Home carousel blurb (shown under the cover on the homepage; falls back to the first line of the description if empty)"
                  value={draft.homeHook || ""}
                  multiline
                  onChange={(v) => setDraft((d) => ({ ...d, homeHook: v }))}
                />
              </div>
            </div>
            <div className="editor-card">
              <h3 className="editor-card__label">Preview / Reader</h3>
              <div className="delivery-form-grid">
                <Field label="Preview button label" value={draft.previewLabel || ""} onChange={(v) => setDraft((d) => ({ ...d, previewLabel: v }))} />
                <Field label="Preview URL" value={draft.previewUrl || ""} onChange={(v) => setDraft((d) => ({ ...d, previewUrl: v }))} />
                <Field label="Reader button label" value={draft.readerLabel || ""} onChange={(v) => setDraft((d) => ({ ...d, readerLabel: v }))} />
                <Field label="Reader PDF URL" value={draft.readerPdfUrl || ""} onChange={(v) => setDraft((d) => ({ ...d, readerPdfUrl: v }))} />
              </div>
              <label className="checkbox-row" style={{ marginTop: "12px" }}>
                <input
                  type="checkbox"
                  checked={Boolean(draft.isFree)}
                  onChange={(e) => setDraft((d) => ({ ...d, isFree: e.target.checked }))}
                />
                <span>Free to read in full (no preview paywall)</span>
              </label>
              {!draft.isFree ? (
                <div className="delivery-form-grid" style={{ marginTop: "12px" }}>
                  <Field
                    label="Preview page limit"
                    value={String(draft.previewPageLimit ?? 5)}
                    onChange={(v) => setDraft((d) => ({ ...d, previewPageLimit: Number(v) || 5 }))}
                  />
                </div>
              ) : null}
            </div>
            <div className="editor-card">
              <h3 className="editor-card__label">Status</h3>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={draft.status === "published"}
                  onChange={(e) => setDraft((d) => ({ ...d, status: e.target.checked ? "published" : "draft" }))}
                />
                <span>Published</span>
              </label>
            </div>
          </section>

          {/* Images */}
          <section className="workspace-read-section">
            <h2>Images</h2>
            <IssueGalleryManager
              featuredImage={draft.featuredImage || draft.coverImage || ""}
              galleryImages={draft.heroAssets || []}
              assets={assets}
              onChangeFeatured={(value) => saveImageUpdate({ ...draft, featuredImage: value, coverImage: value })}
              onChangeGallery={(value) => saveImageUpdate({ ...draft, heroAssets: value })}
            />
          </section>

          {/* Shop */}
          <section className="workspace-read-section">
            <h2>Shop</h2>

            <div className="editor-card">
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(shop.listedInShop)}
                  onChange={(e) => setShopField("listedInShop", e.target.checked)}
                />
                <span>Listed in shop</span>
              </label>
            </div>

            <div className="editor-card">
              <h3 className="editor-card__label">Digital</h3>
              <p className="editor-card__hint">
                Price is pulled live from Stripe — {shop.digitalPriceId ? (shop.digitalPrice || "not found in Stripe") : "set a Price ID to show a price"}.
              </p>
              <div className="delivery-form-grid">
                <Field
                  label="Stripe Price ID"
                  value={shop.digitalPriceId || ""}
                  onChange={(v) => setShopField("digitalPriceId", v)}
                />
              </div>
              <div className="delivery-form-grid delivery-form-grid--full" style={{ marginTop: "12px" }}>
                <AssetField
                  label="Digital PDF asset"
                  value={shop.digitalAssetId || ""}
                  assets={assets}
                  filter="pdf"
                  onChange={(v) => setShopField("digitalAssetId", v)}
                />
              </div>
              <SaleFields sale={shop.digitalSale} onChange={(next) => setDraft((d) => ({ ...d, shop: { ...(d.shop || {}), digitalSale: next } }))} />
            </div>

            <div className="editor-card">
              <h3 className="editor-card__label">Physical</h3>
              <p className="editor-card__hint">
                Price is pulled live from Stripe — {shop.physicalPriceId ? (shop.physicalPrice || "not found in Stripe") : "set a Price ID to show a price"}.
              </p>
              <div className="delivery-form-grid">
                <Field
                  label="Stripe Price ID"
                  value={shop.physicalPriceId || ""}
                  onChange={(v) => setShopField("physicalPriceId", v)}
                />
                <Field
                  label="Stock remaining (blank = unlimited)"
                  value={shop.physicalStock != null ? String(shop.physicalStock) : ""}
                  onChange={(v) => setShopField("physicalStock", v.trim() === "" ? null : Math.max(Math.trunc(Number(v)) || 0, 0))}
                />
              </div>
              <SaleFields sale={shop.physicalSale} onChange={(next) => setDraft((d) => ({ ...d, shop: { ...(d.shop || {}), physicalSale: next } }))} />
            </div>

            <div className="editor-card">
              <h3 className="editor-card__label">External URL</h3>
              <p className="editor-card__hint">Used as the buy button link when no Stripe Price ID is set — for pre-launch pages, Kickstarter campaigns, etc.</p>
              <Field
                label="URL"
                value={shop.externalUrl || ""}
                onChange={(v) => setShopField("externalUrl", v)}
              />
            </div>
          </section>

        </div>
      </section>
  );
}

function LettersAdmin({ letters, onSave }) {
  const activeLetters = letters
    .filter((letter) => letter.status !== "archived")
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const archivedLetters = letters
    .filter((letter) => letter.status === "archived")
    .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  const pendingLetters = activeLetters.filter((letter) => letter.status !== "approved" && letter.status !== "rejected");
  const defaultLetter = activeLetters[0] || letters[0];
  const [selectedId, setSelectedId] = useState(defaultLetter?.id || "");
  const [showArchived, setShowArchived] = useState(false);
  const selected =
    activeLetters.find((letter) => letter.id === selectedId) ||
    archivedLetters.find((letter) => letter.id === selectedId) ||
    activeLetters[0] ||
    archivedLetters[0] ||
    letters[0];
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState(selected?.editorReply || "");
  const [moderatedView, setModeratedView] = useState("approved");
  const replyRef = useRef(null);

  useEffect(() => {
    if (!letters.length) {
      if (selectedId) {
        setSelectedId("");
      }
      return;
    }

    const letterStillExists =
      activeLetters.some((letter) => letter.id === selectedId) ||
      archivedLetters.some((letter) => letter.id === selectedId);

    if (!selected || !letterStillExists) {
      setSelectedId(defaultLetter?.id || activeLetters[0]?.id || archivedLetters[0]?.id || letters[0]?.id || "");
    }
  }, [activeLetters, archivedLetters, defaultLetter, letters, selected, selectedId]);

  useEffect(() => {
    setDraft(selected);
    setReplyText(selected?.editorReply || "");
  }, [selected]);

  const autosave = useAutosave({
    draft,
    enabled: false,
    resetKey: selectedId,
    save: onSave,
  });

  async function persistDraft(nextDraft) {
    setDraft(nextDraft);
    autosave.setStatus("Saving...");

    try {
      await onSave(nextDraft);
      autosave.setStatus("Saved");
    } catch (error) {
      autosave.setStatus(error.message || "Error");
    }
  }

  if (!draft) {
    return null;
  }

  const filteredLetters = activeLetters.filter((letter) =>
    [letter.name, letter.email, letter.message, letter.issueLabel]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );
  const filteredPendingLetters = filteredLetters.filter(
    (letter) => letter.status !== "approved" && letter.status !== "rejected"
  );
  const filteredModeratedLetters = filteredLetters.filter((letter) => letter.status === moderatedView);
  const filteredArchivedLetters = archivedLetters.filter((letter) =>
    [letter.name, letter.email, letter.message, letter.issueLabel]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  async function handleReplySend() {
    await persistDraft({
      ...draft,
      editorReply: replyText,
    });
  }

  async function handleStatusChange(status) {
    await persistDraft({
      ...draft,
      status,
      featured: status === "approved" ? draft.featured : false,
      publishedAt:
        status === "approved" ? draft.publishedAt || new Date().toISOString() : draft.publishedAt,
    });
  }

  async function handleFeatureChange(featured) {
    await persistDraft({
      ...draft,
      status: "approved",
      featured,
      publishedAt: draft.publishedAt || new Date().toISOString(),
    });
  }

  async function handleArchive() {
    setShowArchived(true);
    await persistDraft({
      ...draft,
      status: "archived",
    });
  }

  return (
    <section className="workspace-grid">
      <aside className="workspace-list">
        <label className="workspace-search">
          <span>Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search letters"
          />
        </label>
        <div className="workspace-list__items workspace-list__items--letters">
          {filteredPendingLetters.map((letter) => (
            <button
              key={letter.id}
              type="button"
              className={`workspace-list__item workspace-list__item--letter ${selectedId === letter.id ? "is-active" : ""}`}
              onClick={() => setSelectedId(letter.id)}
            >
              <div className="workspace-list__item-row">
                <strong>{letter.name || "Anonymous"}</strong>
                <span>{formatRelativeTime(letter.createdAt)}</span>
              </div>
              <p>{formatLetterPreview(letter.message)}</p>
            </button>
          ))}
          <div className="workspace-list__divider">
            <div className="workspace-list__divider-line" />
            <div className="workspace-list__toggle">
              <button
                type="button"
                className={moderatedView === "approved" ? "is-active" : ""}
                onClick={() => setModeratedView("approved")}
              >
                Approved
              </button>
              <button
                type="button"
                className={moderatedView === "rejected" ? "is-active" : ""}
                onClick={() => setModeratedView("rejected")}
              >
                Denied
              </button>
            </div>
          </div>
          {filteredModeratedLetters.map((letter) => (
            <button
              key={letter.id}
              type="button"
              className={`workspace-list__item workspace-list__item--letter ${selectedId === letter.id ? "is-active" : ""}`}
              onClick={() => setSelectedId(letter.id)}
            >
              <div className="workspace-list__item-row">
                <strong>{letter.name || "Anonymous"}</strong>
                <span>{formatRelativeTime(letter.createdAt)}</span>
              </div>
              <p>{formatLetterPreview(letter.message)}</p>
            </button>
          ))}
          {showArchived ? (
            <>
              <div className="workspace-list__divider workspace-list__divider--archived">
                <div className="workspace-list__divider-line" />
                <div className="workspace-list__section-label">Archived</div>
              </div>
              {filteredArchivedLetters.map((letter) => (
                <button
                  key={letter.id}
                  type="button"
                  className={`workspace-list__item workspace-list__item--letter ${selectedId === letter.id ? "is-active" : ""}`}
                  onClick={() => setSelectedId(letter.id)}
                >
                  <div className="workspace-list__item-row">
                    <strong>{letter.name || "Anonymous"}</strong>
                    <span>{formatRelativeTime(letter.createdAt)}</span>
                  </div>
                  <p>{formatLetterPreview(letter.message)}</p>
                </button>
              ))}
            </>
          ) : null}
          {!filteredPendingLetters.length && !filteredModeratedLetters.length ? (
            <p className="workspace-empty-state">No letters match that search.</p>
          ) : null}
        </div>
        <div className="workspace-list__footer">
          <button
            className="workspace-list__archived-button"
            type="button"
            onClick={() => setShowArchived((current) => !current)}
          >
            {showArchived ? "Hide archived" : "Archived"}
          </button>
        </div>
      </aside>

      <section className="workspace-detail">
        <header className="workspace-detail__header">
          <div className="workspace-detail__heading">
            <h1>{draft.name || "Anonymous"}</h1>
            {draft.location ? <p>{draft.location}</p> : null}
          </div>
          <div className="workspace-detail__actions">
            <button className="button-primary" type="button" onClick={() => replyRef.current?.focus()}>
              Reply
            </button>
            <button className="button-secondary" type="button" onClick={handleArchive}>
              Archive
            </button>
          </div>
        </header>

        <div className="workspace-read-view">
          <article className="workspace-letter-body">
            {draft.message
              ?.split(/\n{2,}/)
              .filter(Boolean)
              .map((paragraph, index) => <p key={`${draft.id}-paragraph-${index}`}>{paragraph}</p>)}
          </article>

          <div className="workspace-divider" />

          <section className="workspace-reply">
            <div className="workspace-reply__header">
              <h2>Reply</h2>
              {autosave.status ? <span>{autosave.status}</span> : null}
            </div>
            <textarea
              ref={replyRef}
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void handleReplySend();
                }
              }}
              placeholder="Write a reply..."
            />
            <div className="workspace-reply__actions">
              <button className="button-primary" type="button" onClick={handleReplySend}>
                Send
              </button>
            </div>
          </section>

          <section className="workspace-moderation">
            <div className="workspace-moderation__actions">
              <button
                className={`button-secondary ${draft.status === "approved" ? "is-selected" : ""}`}
                type="button"
                onClick={() => handleStatusChange("approved")}
              >
                Approve
              </button>
              <button
                className={`button-secondary ${draft.status === "rejected" ? "is-selected" : ""}`}
                type="button"
                onClick={() => handleStatusChange("rejected")}
              >
                Deny
              </button>
              <div className="workspace-moderation__status">
                <span className={`workspace-badge workspace-badge--${draft.status || "pending"}`}>
                  {draft.status || "pending"}
                </span>
              </div>
            </div>
            <label className={`workspace-toggle ${draft.status === "approved" ? "" : "is-disabled"}`}>
              <input
                type="checkbox"
                checked={Boolean(draft.featured)}
                disabled={draft.status !== "approved"}
                onChange={(event) => handleFeatureChange(event.target.checked)}
              />
              <span>Feature on letters page</span>
            </label>
          </section>
        </div>
      </section>
    </section>
  );
}
function SimpleCollectionEditor({
  title,
  subtitle,
  items,
  assets,
  onSave,
  onDelete,
  fields,
  itemLabel,
  showSelector = true,
  showHeader = true,
  createItem,
  createLabel,
  deleteLabel,
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id || "");
  const selected = items.find((entry) => entry.id === selectedId) || items[0];
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    if (!items.length) {
      setSelectedId("");
      return;
    }

    if (!items.some((entry) => entry.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    setDraft(selected);
  }, [selected]);

  const autosave = useAutosave({
    draft,
    enabled: Boolean(draft),
    resetKey: selectedId,
    save: onSave,
  });

  async function handleCreate() {
    if (!createItem) {
      return;
    }

    const nextItem = createItem();
    setSelectedId(nextItem.id);
    await onSave(nextItem);
  }

  async function handleDelete() {
    if (!draft || !onDelete) {
      return;
    }

    const fallback = items.find((entry) => entry.id !== draft.id);
    setSelectedId(fallback?.id || "");
    await onDelete(draft.id);
  }

  return (
    <section className="editor-shell">
      {showHeader ? (
        <EditorHeader title={title} subtitle={subtitle} status={autosave.status} onSave={autosave.saveNow} />
      ) : (
        <div className="editor-card editor-card--full">
          <h3>{title}</h3>
          <p className="field-help">Status: {autosave.status}</p>
        </div>
      )}
      {createItem ? (
        <div className="page-surface__actions">
          <button className="button-secondary" type="button" onClick={handleCreate}>
            {createLabel || `Add ${itemLabel}`}
          </button>
          {draft && onDelete ? (
            <button className="button-secondary" type="button" onClick={handleDelete}>
              {deleteLabel || `Delete ${itemLabel}`}
            </button>
          ) : null}
        </div>
      ) : null}
      {showSelector ? (
        <label className="control-row">
          <span>{itemLabel}</span>
          <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name || item.label || item.sourcePath}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!draft ? (
        <div className="editor-card editor-card--full">
          <p className="field-help">No {title.toLowerCase()} yet. Use the add button to create the first one.</p>
        </div>
      ) : null}
      {draft ? (
      <div className="editor-grid">
        <div className="editor-card">
          {fields.map((field) =>
            field.type === "checkbox" ? (
              <label key={field.key} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={Boolean(draft[field.key])}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.checked }))
                  }
                />
                <span>{field.label}</span>
              </label>
            ) : field.type === "image" ? (
              <AssetField
                key={field.key}
                label={field.label}
                value={String(draft[field.key] ?? "")}
                assets={assets}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    [field.key]: value,
                  }))
                }
              />
            ) : (
              <Field
                key={field.key}
                label={field.label}
                value={String(draft[field.key] ?? "")}
                multiline={field.multiline}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    [field.key]: field.numeric ? Number(value) || 0 : value,
                  }))
                }
              />
            )
          )}
        </div>
      </div>
      ) : null}
    </section>
  );
}

const DEFAULT_READ_FUNNEL_SETTINGS = {
  tipUrl: "",
  currentIssueNumber: 3,
  totalIssues: 6,
  introHeading: "",
  introBody: "",
  introImages: [],
};

function withSettingsDefaults(siteSettings) {
  return {
    ...siteSettings,
    readFunnel: { ...DEFAULT_READ_FUNNEL_SETTINGS, ...(siteSettings.readFunnel || {}) },
  };
}

function SettingsEditor({
  siteSettings,
  assets,
  onSave,
  title = "Settings",
  subtitle = "",
}) {
  const [draft, setDraft] = useState(() => withSettingsDefaults(siteSettings));
  const [navText, setNavText] = useState(JSON.stringify(siteSettings.nav, null, 2));

  useEffect(() => {
    setDraft(withSettingsDefaults(siteSettings));
    setNavText(JSON.stringify(siteSettings.nav, null, 2));
  }, [siteSettings]);

  const autosave = useAutosave({ draft, enabled: true, resetKey: "settings", save: onSave });

  return (
    <section className="editor-shell">
      <EditorHeader title={title} subtitle={subtitle} status={autosave.status} onSave={autosave.saveNow} />
      <div className="editor-grid">
        <div className="editor-card">
          <Field label="Brand name" value={draft.brandName} onChange={(value) => setDraft((current) => ({ ...current, brandName: value }))} />
          <Field label="Site title suffix" value={draft.siteTitleSuffix} onChange={(value) => setDraft((current) => ({ ...current, siteTitleSuffix: value }))} />
          <AssetField label="Default share image" value={draft.defaultOgImage} assets={assets} onChange={(value) => setDraft((current) => ({ ...current, defaultOgImage: value }))} />
        </div>
        <div className="editor-card">
          <h3>Home splash</h3>
          <AssetField label="Logo image" value={draft.homeSplash.logoUrl} assets={assets} onChange={(value) => setDraft((current) => ({ ...current, homeSplash: { ...current.homeSplash, logoUrl: value } }))} />
          <Field label="Subtitle" value={draft.homeSplash.subtitle} onChange={(value) => setDraft((current) => ({ ...current, homeSplash: { ...current.homeSplash, subtitle: value } }))} />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.homeSplash.enabled}
              onChange={(event) => setDraft((current) => ({ ...current, homeSplash: { ...current.homeSplash, enabled: event.target.checked } }))}
            />
            <span>Splash enabled</span>
          </label>
        </div>
        <div className="editor-card">
          <h3>Announcement</h3>
          <Field label="Label" value={draft.announcement.label} onChange={(value) => setDraft((current) => ({ ...current, announcement: { ...current.announcement, label: value } }))} />
          <Field label="CTA label" value={draft.announcement.ctaLabel} onChange={(value) => setDraft((current) => ({ ...current, announcement: { ...current.announcement, ctaLabel: value } }))} />
          <Field label="CTA URL" value={draft.announcement.ctaUrl} onChange={(value) => setDraft((current) => ({ ...current, announcement: { ...current.announcement, ctaUrl: value } }))} />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.announcement.enabled}
              onChange={(event) => setDraft((current) => ({ ...current, announcement: { ...current.announcement, enabled: event.target.checked } }))}
            />
            <span>Announcement enabled</span>
          </label>
        </div>
        <div className="editor-card">
          <h3>Read funnel (/read)</h3>
          <Field
            label="Intro heading"
            value={draft.readFunnel.introHeading}
            onChange={(value) => setDraft((current) => ({ ...current, readFunnel: { ...current.readFunnel, introHeading: value } }))}
          />
          <Field
            label="Intro body"
            multiline
            value={draft.readFunnel.introBody}
            onChange={(value) => setDraft((current) => ({ ...current, readFunnel: { ...current.readFunnel, introBody: value } }))}
          />
          <AssetListField
            label="Intro photo"
            values={draft.readFunnel.introImages}
            assets={assets}
            onChange={(values) => setDraft((current) => ({ ...current, readFunnel: { ...current.readFunnel, introImages: values } }))}
          />
          <Field
            label="Tip URL (Buy Me a Coffee, etc.)"
            value={draft.readFunnel.tipUrl}
            onChange={(value) => setDraft((current) => ({ ...current, readFunnel: { ...current.readFunnel, tipUrl: value } }))}
          />
          <Field
            label="Current issue number"
            value={draft.readFunnel.currentIssueNumber}
            onChange={(value) => setDraft((current) => ({ ...current, readFunnel: { ...current.readFunnel, currentIssueNumber: Number(value) || current.readFunnel.currentIssueNumber } }))}
          />
          <Field
            label="Total issues planned"
            value={draft.readFunnel.totalIssues}
            onChange={(value) => setDraft((current) => ({ ...current, readFunnel: { ...current.readFunnel, totalIssues: Number(value) || current.readFunnel.totalIssues } }))}
          />
        </div>
        <div className="editor-card editor-card--full">
          <h3>Navigation JSON</h3>
          <textarea
            rows={8}
            value={navText}
            onChange={(event) => {
              const value = event.target.value;
              setNavText(value);
              try {
                setDraft((current) => ({ ...current, nav: JSON.parse(value) }));
                autosave.setStatus("Saving...");
              } catch {
                autosave.setStatus("Invalid JSON");
              }
            }}
          />
        </div>
      </div>
    </section>
  );
}

function AssetsEditor({
  assets,
  assetFolders,
  onUpload,
  onDelete,
  onSaveAsset,
  onSaveAssetFolders,
  onCreateVariant,
  onUpdateVariant,
  onDeleteVariant,
}) {
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadPhase, setUploadPhase] = useState("idle");
  const [uploadFileLabel, setUploadFileLabel] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [variantAssetId, setVariantAssetId] = useState("");
  const [activeFolderId, setActiveFolderId] = useState("all");
  const [draggedAssetIds, setDraggedAssetIds] = useState([]);
  const [dragOverFolderId, setDragOverFolderId] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [lastSelectedId, setLastSelectedId] = useState("");
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState(false);
  // Tracks whether a drag just ended so folder onClick doesn't fire immediately after drop.
  const justDraggedRef = useRef(false);

  const [assetTypeFilter, setAssetTypeFilter] = useState("images");
  const imageAssets = assets.filter(isImageAsset);
  const persistedFolders = (assetFolders || [])
    .map((folder, index) => ({
      id: folder.id,
      name: folder.name,
      sortOrder: Number.isFinite(Number(folder.sortOrder)) ? Number(folder.sortOrder) : index,
    }))
    .filter((folder) => folder.id && folder.name)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const activeVariantAsset =
    imageAssets.find((asset) => asset.id === variantAssetId) || null;
  const typeFilteredAssets = assets.filter((a) => {
    if (assetTypeFilter === "images") return isImageAsset(a);
    if (assetTypeFilter === "pdfs") return isPdfAsset(a);
    return true;
  });
  const folderedAssets = typeFilteredAssets.map((asset) => ({
    ...asset,
    folderId: asset.metadata?.folderId || "",
  }));
  const activeFolderAssets = folderedAssets.filter((asset) => {
    if (activeFolderId === "all") return true;
    if (activeFolderId === "unfiled") return !asset.folderId;
    return asset.folderId === activeFolderId;
  });
  const activeFolderAssetIds = activeFolderAssets.map((a) => a.id);
  const selectedInView = selectedAssetIds.filter((id) => activeFolderAssetIds.includes(id));

  useEffect(() => {
    if (activeFolderId === "all" || activeFolderId === "unfiled") return;
    if (!persistedFolders.some((folder) => folder.id === activeFolderId)) {
      setActiveFolderId("all");
    }
  }, [activeFolderId, persistedFolders]);

  // Clear selection when folder changes.
  useEffect(() => {
    setSelectedAssetIds([]);
    setLastSelectedId("");
  }, [activeFolderId]);

  function handleAssetClick(assetId, event) {
    if (event.shiftKey && lastSelectedId) {
      const ids = activeFolderAssetIds;
      const anchorIdx = ids.indexOf(lastSelectedId);
      const clickIdx = ids.indexOf(assetId);
      const [start, end] = anchorIdx < clickIdx ? [anchorIdx, clickIdx] : [clickIdx, anchorIdx];
      const range = ids.slice(start, end + 1);
      setSelectedAssetIds((current) => [...new Set([...current, ...range])]);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      setSelectedAssetIds((current) =>
        current.includes(assetId)
          ? current.filter((id) => id !== assetId)
          : [...current, assetId]
      );
      setLastSelectedId(assetId);
      return;
    }
    setSelectedAssetIds([assetId]);
    setLastSelectedId(assetId);
  }

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file instanceof File && file.size);
    if (!files.length) {
      setUploadStatus("Choose at least one file first.");
      setUploadProgress(null);
      setUploadPhase("idle");
      setUploadFileLabel("");
      return;
    }

    setUploadStatus(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`);
    setUploadProgress(null);
    setUploadPhase("uploading");
    setUploadFileLabel("");
    try {
      await onUpload({
        files,
        onFileChange: ({ file, fileIndex, fileCount }) => {
          setUploadFileLabel(file?.name || "");
          setUploadStatus(
            `Uploading file ${fileIndex + 1} of ${fileCount}: ${file?.name || "image"}`
          );
        },
        onProgress: ({ percent, filePercent, file, fileIndex, fileCount }) => {
          setUploadFileLabel(file?.name || "");
          setUploadProgress(percent);
          if (typeof filePercent === "number" && typeof percent === "number") {
            setUploadStatus(
              `Uploading file ${fileIndex + 1} of ${fileCount}: ${file?.name || "image"} (${filePercent}% file, ${percent}% batch)`
            );
          } else {
            setUploadStatus(
              `Uploading file ${fileIndex + 1} of ${fileCount}: ${file?.name || "image"}`
            );
          }
        },
        onPhaseChange: ({ phase, file, fileIndex, fileCount }) => {
          setUploadPhase(phase);
          setUploadFileLabel(file?.name || "");
          if (phase === "processing") {
            setUploadProgress(100);
            setUploadStatus(
              `Processing file ${fileIndex + 1} of ${fileCount}: ${file?.name || "image"}`
            );
          }
        },
      });
      setUploadProgress(null);
      setUploadPhase("done");
      setUploadFileLabel("");
      setUploadStatus(`Uploaded ${files.length} file${files.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setUploadProgress(null);
      setUploadPhase("idle");
      setUploadFileLabel("");
      setUploadStatus(error.message || "Upload failed.");
    }
  }

  async function handleInputChange(event) {
    await uploadFiles(event.target.files);
    event.target.value = "";
  }

  async function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    await uploadFiles(event.dataTransfer?.files);
  }

  async function handleDeleteAsset(asset) {
    setUploadStatus(`Deleting ${asset.label}...`);
    setUploadProgress(null);
    setUploadPhase("idle");
    setUploadFileLabel("");
    try {
      await onDelete(asset.id);
      setSelectedAssetIds((current) => current.filter((id) => id !== asset.id));
      setUploadStatus(`${asset.label} deleted.`);
    } catch (error) {
      setUploadStatus(error.message || "Unable to delete asset.");
    }
  }

  async function handleDeleteSelected() {
    if (!selectedInView.length) return;
    setUploadStatus(`Deleting ${selectedInView.length} asset${selectedInView.length === 1 ? "" : "s"}...`);
    try {
      for (const id of selectedInView) {
        await onDelete(id);
      }
      setSelectedAssetIds([]);
      setUploadStatus(`Deleted ${selectedInView.length} asset${selectedInView.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setUploadStatus(error.message || "Unable to delete assets.");
    }
  }

  async function assignAssetsToFolder(assetIds, folderId) {
    const nextFolderId = folderId === "unfiled" ? "" : folderId;
    const toMove = assetIds.filter((id) => {
      const asset = imageAssets.find((a) => a.id === id);
      return asset && (asset.metadata?.folderId || "") !== nextFolderId;
    });
    if (!toMove.length) return;

    setUploadStatus(`Moving ${toMove.length} asset${toMove.length === 1 ? "" : "s"}...`);
    try {
      for (const id of toMove) {
        const asset = imageAssets.find((a) => a.id === id);
        if (!asset) continue;
        await onSaveAsset({
          ...asset,
          metadata: { ...(asset.metadata || {}), folderId: nextFolderId },
        });
      }
      setUploadStatus(
        toMove.length === 1
          ? nextFolderId ? "Asset moved." : "Asset moved to unfiled."
          : nextFolderId ? `${toMove.length} assets moved.` : `${toMove.length} assets moved to unfiled.`
      );
    } catch (error) {
      setUploadStatus(error.message || "Unable to move assets.");
    }
  }

  async function handleMoveSelectedToFolder(folderId) {
    if (!selectedInView.length) return;
    await assignAssetsToFolder(selectedInView, folderId);
  }

  async function handleCreateFolder() {
    const name = normalizeFolderName(window.prompt("Folder name"));
    if (!name) return;

    if (persistedFolders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) {
      setUploadStatus("A folder with that name already exists.");
      return;
    }

    const nextFolders = [
      ...persistedFolders,
      { id: `asset-folder-${crypto.randomUUID()}`, name, sortOrder: persistedFolders.length },
    ];

    try {
      await onSaveAssetFolders(nextFolders);
      setActiveFolderId(nextFolders[nextFolders.length - 1].id);
      setUploadStatus(`Created ${name}.`);
    } catch (error) {
      setUploadStatus(error.message || "Unable to create folder.");
    }
  }

  async function handleDeleteFolder() {
    if (activeFolderId === "all" || activeFolderId === "unfiled") return;

    const folder = persistedFolders.find((entry) => entry.id === activeFolderId);
    if (!folder) return;

    if (!deleteFolderConfirm) {
      setDeleteFolderConfirm(true);
      return;
    }

    setDeleteFolderConfirm(false);
    try {
      const assetsInFolder = imageAssets.filter((asset) => asset.metadata?.folderId === folder.id);
      for (const asset of assetsInFolder) {
        await onSaveAsset({
          ...asset,
          metadata: { ...(asset.metadata || {}), folderId: "" },
        });
      }
      await onSaveAssetFolders(
        persistedFolders
          .filter((entry) => entry.id !== folder.id)
          .map((entry, index) => ({ ...entry, sortOrder: index }))
      );
      setActiveFolderId("all");
      setUploadStatus(`Deleted ${folder.name}.`);
    } catch (error) {
      setUploadStatus(error.message || "Unable to delete folder.");
    }
  }

  function renderAssetCard(asset) {
    const isSelected = selectedAssetIds.includes(asset.id);
    return (
      <div
        key={asset.id}
        className={`asset-gallery-card asset-gallery-card--library${isSelected ? " is-selected" : ""}`}
        draggable
        onClick={(event) => handleAssetClick(asset.id, event)}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          const ids = isSelected && selectedAssetIds.length > 1 ? selectedAssetIds : [asset.id];
          setDraggedAssetIds(ids);
          if (!isSelected) { setSelectedAssetIds([asset.id]); setLastSelectedId(asset.id); }
        }}
        onDragEnd={() => { setDraggedAssetIds([]); }}
      >
        {isPdfAsset(asset) ? (
          <div className="asset-gallery-card__pdf-thumb">
            <span className="asset-gallery-card__pdf-badge">PDF</span>
            <span className="asset-gallery-card__pdf-filename">{asset.label || asset.metadata?.fileName || "Untitled"}</span>
          </div>
        ) : (
          <img src={asset.url} alt={asset.label} className="asset-gallery-card__image" draggable={false} />
        )}
        <div className="asset-gallery-card__overlay">
          <div className="asset-gallery-card__actions">
            <button
              className="button-secondary asset-gallery-card__delete"
              type="button"
              onClick={(event) => { event.stopPropagation(); setVariantAssetId(asset.id); }}
            >Crop</button>
            <button
              className="button-secondary asset-gallery-card__delete"
              type="button"
              onClick={(event) => { event.stopPropagation(); void handleDeleteAsset(asset); }}
            >Delete</button>
          </div>
        </div>
        {draggedAssetIds.includes(asset.id) && draggedAssetIds.length > 1 ? (
          <span className="asset-gallery-card__drag-count">{draggedAssetIds.length}</span>
        ) : null}
      </div>
    );
  }

  return (
    <section className="editor-shell">
      <EditorHeader title="Assets" subtitle="" status="Library" onSave={() => {}} />
      <section className="asset-upload-stage">
        <label
          className={`upload-dropzone ${dragActive ? "is-dragging" : ""}`}
          onDragEnter={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDrop={handleDrop}
        >
          <input name="files" type="file" multiple accept="image/*,application/pdf" onChange={handleInputChange} />
          <span className="upload-dropzone__eyebrow">Upload assets</span>
          <span className="upload-dropzone__title">Drop images or PDFs anywhere in this zone</span>
          <span className="upload-dropzone__copy">Or click to browse files from your computer. Uploads start immediately.</span>
        </label>
        {uploadStatus ? <p className="status-line">{uploadStatus}</p> : null}
        {uploadPhase !== "idle" && uploadPhase !== "done" ? (
          <div
            className="asset-upload-progress"
            aria-label={
              typeof uploadProgress === "number"
                ? `Upload progress ${uploadProgress}%`
                : uploadFileLabel
                  ? `Uploading ${uploadFileLabel}`
                  : "Upload in progress"
            }
          >
            <div
              className={`asset-upload-progress__bar ${typeof uploadProgress === "number" ? "" : "is-indeterminate"}`}
              style={typeof uploadProgress === "number" ? { width: `${uploadProgress}%` } : undefined}
            />
          </div>
        ) : null}
      </section>
      <div className="editor-grid">
        <div className="editor-card editor-card--full">
          <div className="asset-library">
            <div className="asset-library__header">
              <h3>Library</h3>
              <p className="field-help">{imageAssets.length} uploaded image{imageAssets.length === 1 ? "" : "s"}</p>
            </div>
            <div className="asset-library__layout">
              <aside className="asset-folder-panel">
                <div className="asset-folder-panel__header">
                  <strong>Folders</strong>
                  <div className="asset-folder-panel__actions">
                    <button className="button-secondary button-compact" type="button" onClick={handleCreateFolder}>
                      Add
                    </button>
                    {deleteFolderConfirm ? (
                      <>
                        <button
                          className="button-secondary button-compact asset-folder-panel__confirm-yes"
                          type="button"
                          onClick={handleDeleteFolder}
                        >
                          Confirm
                        </button>
                        <button
                          className="button-secondary button-compact"
                          type="button"
                          onClick={() => setDeleteFolderConfirm(false)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="button-secondary button-compact"
                        type="button"
                        onClick={handleDeleteFolder}
                        disabled={activeFolderId === "all" || activeFolderId === "unfiled"}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <div className="asset-folder-list">
                  {[{ id: "all", name: "All assets" }, { id: "unfiled", name: "Unfiled" }, ...persistedFolders].map((folder) => (
                    <div
                      key={folder.id}
                      className={`asset-folder-list__item${activeFolderId === folder.id ? " is-active" : ""}${dragOverFolderId === folder.id ? " is-drop-target" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (justDraggedRef.current) return;
                        setActiveFolderId(folder.id);
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setActiveFolderId(folder.id); }}
                      onDragOver={(event) => {
                        if (!draggedAssetIds.length || folder.id === "all") return;
                        event.preventDefault();
                        setDragOverFolderId(folder.id);
                      }}
                      onDragEnter={(event) => {
                        if (!draggedAssetIds.length || folder.id === "all") return;
                        event.preventDefault();
                        setDragOverFolderId(folder.id);
                      }}
                      onDragLeave={(event) => {
                        // Only clear if leaving the folder item itself, not a child.
                        if (!event.currentTarget.contains(event.relatedTarget)) {
                          setDragOverFolderId("");
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!draggedAssetIds.length || folder.id === "all") return;
                        justDraggedRef.current = true;
                        setTimeout(() => { justDraggedRef.current = false; }, 200);
                        void assignAssetsToFolder(draggedAssetIds, folder.id);
                        setDraggedAssetIds([]);
                        setDragOverFolderId("");
                      }}
                    >
                      <span className="asset-folder-list__item-name">{folder.name}</span>
                      <small>
                        {folder.id === "all"
                          ? imageAssets.length
                          : folder.id === "unfiled"
                            ? folderedAssets.filter((asset) => !asset.folderId).length
                            : folderedAssets.filter((asset) => asset.folderId === folder.id).length}
                      </small>
                    </div>
                  ))}
                </div>
              </aside>
              <div className="asset-gallery-pane">
                <div className="asset-type-filter">
                  {["images", "pdfs", "all"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`asset-type-filter__btn ${assetTypeFilter === type ? "is-active" : ""}`}
                      onClick={() => { setAssetTypeFilter(type); setSelectedAssetIds([]); }}
                    >
                      {type === "images" ? "Images" : type === "pdfs" ? "PDFs" : "All"}
                    </button>
                  ))}
                </div>
                {selectedInView.length > 0 ? (
                  <div className="asset-selection-bar">
                    <span>{selectedInView.length} selected</span>
                    <div className="asset-selection-bar__actions">
                      {persistedFolders.length > 0 ? (
                        <select
                          className="asset-selection-bar__move"
                          defaultValue=""
                          onChange={async (event) => {
                            const folderId = event.target.value;
                            if (!folderId) return;
                            event.target.value = "";
                            await handleMoveSelectedToFolder(folderId);
                          }}
                        >
                          <option value="" disabled>Move to folder…</option>
                          <option value="unfiled">Unfiled</option>
                          {persistedFolders.map((folder) => (
                            <option key={folder.id} value={folder.id}>{folder.name}</option>
                          ))}
                        </select>
                      ) : null}
                      <button
                        className="button-secondary button-compact"
                        type="button"
                        onClick={() => setSelectedAssetIds([])}
                      >
                        Clear
                      </button>
                      <button
                        className="button-secondary button-compact asset-selection-bar__delete"
                        type="button"
                        onClick={handleDeleteSelected}
                      >
                        Delete {selectedInView.length}
                      </button>
                    </div>
                  </div>
                ) : null}
                {assetTypeFilter === "all" && activeFolderAssets.some(isImageAsset) && activeFolderAssets.some(isPdfAsset) ? (
                  <>
                    <p className="asset-section-label">Images</p>
                    <div className="asset-gallery-grid">
                      {activeFolderAssets.filter(isImageAsset).map((asset) => renderAssetCard(asset))}
                    </div>
                    <p className="asset-section-label asset-section-label--pdfs">PDFs</p>
                    <div className="asset-gallery-grid">
                      {activeFolderAssets.filter(isPdfAsset).map((asset) => renderAssetCard(asset))}
                    </div>
                  </>
                ) : (
                <div className="asset-gallery-grid">
                  {activeFolderAssets.map((asset) => renderAssetCard(asset))}
                </div>
                )}
                {!assets.length ? <p className="field-help">No assets uploaded yet.</p> : null}
                {assets.length && !activeFolderAssets.length ? (
                  <p className="field-help">No assets in this folder yet.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      <AssetVariantEditorModal
        asset={activeVariantAsset}
        isOpen={Boolean(activeVariantAsset)}
        onClose={() => setVariantAssetId("")}
        onCreateVariant={onCreateVariant}
        onUpdateVariant={onUpdateVariant}
        onDeleteVariant={onDeleteVariant}
      />
    </section>
  );
}


function PageWorkspace({
  pages,
  assets,
  teamMembers,
  onSavePage,
  onSaveTeamMember,
}) {
  const entries = [
    ...pages.filter((page) => page.slug !== "/connect").map((page) => ({
      id: `page:${page.id}`,
      type: "page",
      title: page.title,
      subtitle: page.slug,
      page,
    })),
  ];

  const [selectedEntryId, setSelectedEntryId] = useState(entries[0]?.id || "");
  const [search, setSearch] = useState("");
  const filteredEntries = entries.filter((entry) =>
    [entry.title, entry.subtitle, entry.type].join(" ").toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedEntry =
    entries.find((entry) => entry.id === selectedEntryId) || filteredEntries[0] || entries[0] || null;

  useEffect(() => {
    if (filteredEntries.some((entry) => entry.id === selectedEntryId) || entries.some((entry) => entry.id === selectedEntryId)) {
      return;
    }
    setSelectedEntryId(filteredEntries[0]?.id || entries[0]?.id || "");
  }, [entries, filteredEntries, selectedEntryId]);

  if (!selectedEntry) {
    return <div className="state-shell">No page entries available.</div>;
  }

  const selectedPage = selectedEntry.type === "page" ? selectedEntry.page : null;

  return (
    <section className="workspace-grid">
      <aside className="workspace-list">
        <label className="workspace-search">
          <span>Search</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pages"
          />
        </label>
        <div className="workspace-list__items">
          {filteredEntries.map((entry) => (
            <button
              key={entry.id}
              className={`workspace-list__item workspace-list__item--page ${entry.id === selectedEntry.id ? "is-active" : ""}`}
              type="button"
              onClick={() => setSelectedEntryId(entry.id)}
            >
              <strong>{entry.title}</strong>
              <span>{entry.subtitle}</span>
            </button>
          ))}
          {!filteredEntries.length ? <p className="workspace-empty-state">No pages match that search.</p> : null}
        </div>
      </aside>
      <div className="workspace-main">
        {selectedPage ? (
          <PageEditor
            pages={[selectedPage]}
            assets={assets}
            onSave={onSavePage}
            title={selectedPage.title}
            teamMembers={selectedPage.slug === "/meet" ? teamMembers : []}
            onSaveTeamMember={onSaveTeamMember}
          />
        ) : null}
      </div>
    </section>
  );
}
function formatShippingAddress(address) {
  if (!address) return "—";
  const { line1, city, state, postal_code: postalCode } = address;
  return [line1, [city, state, postalCode].filter(Boolean).join(", ")].filter(Boolean).join(", ") || "—";
}

function formatAdminDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCents(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

const ORDER_STATUS_LABELS = {
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  disputed: "Disputed",
};

function OrderStatusBadge({ status }) {
  const label = ORDER_STATUS_LABELS[status];
  if (!label) return <span className="field-help">Paid</span>;
  return <span className={`status-badge status-badge--${status.replace(/_/g, "-")}`}>{label}</span>;
}

// Merges Orders (Stripe purchases) + Share Links (one-off PDF sends) into one
// fulfillment view, since both are "who got what" — reads both existing
// endpoints and renders one table with a type badge, no new backend for the merge.
function OrdersAdmin({ assets = [] }) {
  const [orders, setOrders] = useState(null);
  const [shareLinks, setShareLinks] = useState([]);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  async function load() {
    try {
      const [ordersResult, shareLinksResult] = await Promise.all([
        api.getOrders(),
        api.listShareLinks(),
      ]);
      setOrders(ordersResult.orders || []);
      setShareLinks(shareLinksResult.shareLinks || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function markShipped(orderId) {
    setUpdatingId(orderId);
    try {
      await api.updateOrderFulfillment(orderId, "shipped");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId("");
    }
  }

  if (error) return <div className="admin-empty-state">{error}</div>;
  if (!orders) return <div className="admin-empty-state">Loading orders…</div>;

  const rows = [
    ...orders.map((order) => ({
      key: `order-${order.id}`,
      date: order.created_at,
      email: order.customer_email,
      items: order.items || [],
      shipping: order.shipping_address,
      total: (order.items || []).reduce((sum, i) => sum + (i.pricePaid || 0), 0),
      type: (order.items || []).some((item) => item.format === "physical") ? "Physical" : "Digital",
      order,
    })),
    ...shareLinks.map((link) => ({
      key: `share-${link.id}`,
      date: link.createdAt,
      email: "",
      items: [{ issueId: link.id, issueTitle: link.label || link.filename, format: "shared" }],
      shipping: null,
      total: null,
      type: "Shared",
      order: null,
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!rows.length) return <div className="admin-empty-state">No orders or share links yet.</div>;

  return (
    <div className="admin-orders">
      <div className="admin-workspace-header">
        <h2>Orders</h2>
        <p className="field-help">
          {orders.length} order{orders.length !== 1 ? "s" : ""} · {shareLinks.length} share link{shareLinks.length !== 1 ? "s" : ""}
        </p>
        <button type="button" className="button-secondary button-compact" onClick={load}>
          Refresh
        </button>
      </div>
      <table className="orders-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Email</th>
            <th>Items</th>
            <th>Shipping</th>
            <th>Total</th>
            <th>Status</th>
            <th>Fulfillment</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="orders-table__date">{formatAdminDate(row.date)}</td>
              <td><span className={`type-badge type-badge--${row.type.toLowerCase()}`}>{row.type}</span></td>
              <td className="orders-table__email">{row.email || "—"}</td>
              <td className="orders-table__items">
                {row.items.map((item, index) => (
                  <span key={`${row.key}-${item.issueId || index}`} className="orders-table__item-badge">
                    {item.issueTitle} {item.format !== "shared" ? <em>{item.format}</em> : null}
                  </span>
                ))}
              </td>
              <td className="orders-table__shipping">{row.shipping ? formatShippingAddress(row.shipping) : "—"}</td>
              <td className="orders-table__total">{row.total != null ? formatCents(row.total) : "—"}</td>
              <td>{row.order ? <OrderStatusBadge status={row.order.status} /> : <span className="field-help">—</span>}</td>
              <td>
                {row.order && row.type === "Physical" ? (
                  row.order.fulfillment_status === "shipped" ? (
                    <span className="status-badge status-badge--shipped">Shipped</span>
                  ) : (
                    <button
                      type="button"
                      className="button-secondary button-compact"
                      disabled={updatingId === row.order.id}
                      onClick={() => markShipped(row.order.id)}
                    >
                      {updatingId === row.order.id ? "Saving…" : "Mark shipped"}
                    </button>
                  )
                ) : (
                  <span className="field-help">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AccordionSection title="Manage Share Links" summary="Upload a new PDF, or edit/delete existing links">
        <ShareLinksAdmin assets={assets} />
      </AccordionSection>
    </div>
  );
}

function DashboardAdmin() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  async function load() {
    try {
      setStats(await api.getDashboard());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function markShipped(orderId) {
    setUpdatingId(orderId);
    try {
      await api.updateOrderFulfillment(orderId, "shipped");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId("");
    }
  }

  if (error) return <div className="admin-empty-state">{error}</div>;
  if (!stats) return <div className="admin-empty-state">Loading dashboard…</div>;

  return (
    <div className="admin-orders">
      <div className="admin-workspace-header">
        <h2>Dashboard</h2>
      </div>

      <div className="dashboard-stat-grid">
        <div className="dashboard-stat-card">
          <span className="dashboard-stat-card__label">Revenue this week</span>
          <span className="dashboard-stat-card__value">{formatCents(stats.revenueWeek)}</span>
        </div>
        <div className="dashboard-stat-card">
          <span className="dashboard-stat-card__label">Revenue this month</span>
          <span className="dashboard-stat-card__value">{formatCents(stats.revenueMonth)}</span>
        </div>
        <div className="dashboard-stat-card">
          <span className="dashboard-stat-card__label">Free → paid conversion</span>
          <span className="dashboard-stat-card__value">{stats.conversionRate}%</span>
          <span className="dashboard-stat-card__hint">{stats.payingCustomers} paying of {stats.leadsCount} leads</span>
        </div>
      </div>

      <section className="dashboard-section">
        <h3>Units sold by issue</h3>
        {stats.unitsByIssue.length ? (
          <table className="orders-table">
            <thead><tr><th>Issue</th><th>Units</th></tr></thead>
            <tbody>
              {stats.unitsByIssue.map((row) => (
                <tr key={row.issueId}>
                  <td>{row.issueTitle}</td>
                  <td>{row.units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin-empty-state">No sales yet.</p>
        )}
      </section>

      <section className="dashboard-section">
        <h3>Physical orders needing action</h3>
        {stats.physicalPending.length ? (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Email</th>
                <th>Items</th>
                <th>Shipping</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.physicalPending.map((order) => (
                <tr key={order.id}>
                  <td className="orders-table__date">{formatAdminDate(order.created_at)}</td>
                  <td className="orders-table__email">{order.customer_email}</td>
                  <td className="orders-table__items">
                    {(order.items || []).map((item, index) => (
                      <span key={`${order.id}-${item.issueId || index}`} className="orders-table__item-badge">
                        {item.issueTitle} <em>{item.format}</em>
                      </span>
                    ))}
                  </td>
                  <td className="orders-table__shipping">{formatShippingAddress(order.shipping_address)}</td>
                  <td>
                    <button
                      type="button"
                      className="button-secondary button-compact"
                      disabled={updatingId === order.id}
                      onClick={() => markShipped(order.id)}
                    >
                      {updatingId === order.id ? "Saving…" : "Mark shipped"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin-empty-state">Nothing pending — all physical orders shipped.</p>
        )}
      </section>
    </div>
  );
}

function CustomerDetail({ email, onBack }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setDetail(null);
    setError("");
    api.getCustomer(email).then(setDetail).catch((err) => setError(err.message));
  }, [email]);

  return (
    <div className="admin-orders">
      <div className="admin-workspace-header">
        <button type="button" className="shop-workspace__back" onClick={onBack}>
          ← Back to customers
        </button>
        <h2>{email}</h2>
      </div>
      {error ? <p className="status-line status-line--error">{error}</p> : null}
      {!detail ? (
        <p className="admin-empty-state">Loading…</p>
      ) : (
        <>
          <section className="dashboard-section">
            <h3>Owned digital issues</h3>
            {detail.owned.length ? (
              <ul className="customer-owned-list">
                {detail.owned.map((item) => (
                  <li key={item.issueId}>{item.issueTitle}</li>
                ))}
              </ul>
            ) : (
              <p className="field-help">No digital issues owned.</p>
            )}
          </section>
          <section className="dashboard-section">
            <h3>Order history</h3>
            <table className="orders-table">
              <thead><tr><th>Date</th><th>Items</th></tr></thead>
              <tbody>
                {detail.orders.map((order) => (
                  <tr key={order.id}>
                    <td className="orders-table__date">{formatAdminDate(order.created_at)}</td>
                    <td className="orders-table__items">
                      {(order.items || []).map((item, index) => (
                        <span key={`${order.id}-${item.issueId || index}`} className="orders-table__item-badge">
                          {item.issueTitle} <em>{item.format}</em>
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function CustomersAdmin() {
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState("");
  const [selectedEmail, setSelectedEmail] = useState("");

  useEffect(() => {
    api.getCustomers()
      .then((result) => setCustomers(result.customers || []))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="admin-empty-state">{error}</div>;
  if (!customers) return <div className="admin-empty-state">Loading customers…</div>;

  if (selectedEmail) {
    return <CustomerDetail email={selectedEmail} onBack={() => setSelectedEmail("")} />;
  }

  if (!customers.length) return <div className="admin-empty-state">No customers yet.</div>;

  return (
    <div className="admin-orders">
      <div className="admin-workspace-header">
        <h2>Customers</h2>
        <p className="field-help">{customers.length} customer{customers.length !== 1 ? "s" : ""}</p>
      </div>
      <table className="orders-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Orders</th>
            <th>Lifetime value</th>
            <th>Last order</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr
              key={customer.email}
              className="customers-table__row"
              onClick={() => setSelectedEmail(customer.email)}
            >
              <td className="orders-table__email">{customer.email}</td>
              <td>{customer.orderCount}</td>
              <td>{formatCents(customer.lifetimeValue)}</td>
              <td className="orders-table__date">{formatAdminDate(customer.lastOrderAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Email captures: reader soft-email-gate (Phase 3, tied to an issue) and the
// site-wide footer capture (Phase "Brand pages", no issue), newest first.
// View + delete only — leads come from visitors, not admin-authored records.
function LeadsAdmin({ leads, issues, onDelete }) {
  const sorted = [...leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!sorted.length) {
    return <div className="admin-empty-state">No leads captured yet.</div>;
  }

  return (
    <div className="admin-orders">
      <div className="admin-workspace-header">
        <h2>Leads</h2>
        <p className="field-help">{sorted.length} lead{sorted.length !== 1 ? "s" : ""}</p>
      </div>
      <table className="orders-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Email</th>
            <th>Source</th>
            <th>Issue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((lead) => {
            const issue = issues.find((entry) => entry.slug === lead.issueSlug);
            const date = new Date(lead.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            return (
              <tr key={lead.id}>
                <td className="orders-table__date">{date}</td>
                <td className="orders-table__email">{lead.email}</td>
                <td>{lead.source === "footer" ? "Footer" : "Reader gate"}</td>
                <td>{issue?.title || lead.issueSlug || "—"}</td>
                <td>
                  <button type="button" className="button-secondary" onClick={() => onDelete(lead.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BundleEditor({ bundle, issues, onSave, onCreatePrice }) {
  const [draft, setDraft] = useState(bundle);
  const [amountInput, setAmountInput] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingPrice, setIsCreatingPrice] = useState(false);

  useEffect(() => {
    setDraft(bundle);
    setSaveStatus("");
  }, [bundle?.id]);

  if (!draft) return null;

  function toggleIssue(issueId, checked) {
    setDraft((d) => ({
      ...d,
      includedIssueIds: checked
        ? [...(d.includedIssueIds || []), issueId]
        : (d.includedIssueIds || []).filter((id) => id !== issueId),
    }));
  }

  async function handleCreatePrice() {
    const dollars = Number(amountInput);
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    setIsCreatingPrice(true);
    try {
      const { priceId } = await onCreatePrice(Math.round(dollars * 100));
      setDraft((d) => ({ ...d, digitalPriceId: priceId }));
    } catch (err) {
      setSaveStatus(err.message || "Failed to create Stripe price.");
    } finally {
      setIsCreatingPrice(false);
    }
  }

  async function save() {
    if (isSaving) return;
    setIsSaving(true);
    setSaveStatus("Saving…");
    try {
      await onSave(draft);
      setSaveStatus("Saved.");
    } catch (err) {
      setSaveStatus(err.message || "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="editor-card">
      <h3 className="editor-card__label">Bundle</h3>
      <div className="delivery-form-grid">
        <Field label="Title" value={draft.title || ""} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} />
      </div>

      <h3 className="editor-card__label" style={{ marginTop: "16px" }}>
        Included issues
      </h3>
      {issues.map((issue) => (
        <label key={issue.id} className="checkbox-row">
          <input
            type="checkbox"
            checked={(draft.includedIssueIds || []).includes(issue.id)}
            onChange={(e) => toggleIssue(issue.id, e.target.checked)}
          />
          <span>{issue.title}</span>
        </label>
      ))}

      <h3 className="editor-card__label" style={{ marginTop: "16px" }}>
        Price
      </h3>
      <p className="editor-card__hint">
        Price is pulled live from Stripe —{" "}
        {draft.digitalPriceId ? draft.digitalPrice || "not found in Stripe" : "create or set a Price ID"}.
      </p>
      <div className="delivery-form-grid">
        <Field
          label="Stripe Price ID"
          value={draft.digitalPriceId || ""}
          onChange={(v) => setDraft((d) => ({ ...d, digitalPriceId: v }))}
        />
      </div>
      <div className="delivery-form-grid" style={{ marginTop: "8px" }}>
        <Field label="Create price: amount ($)" value={amountInput} onChange={setAmountInput} />
      </div>
      <button
        type="button"
        className="button-secondary"
        onClick={handleCreatePrice}
        disabled={isCreatingPrice}
        style={{ marginTop: "8px" }}
      >
        {isCreatingPrice ? "Creating…" : "Create Stripe Price"}
      </button>

      <SaleFields sale={draft.digitalSale} onChange={(next) => setDraft((d) => ({ ...d, digitalSale: next }))} />

      <div className="workspace-detail__actions" style={{ marginTop: "16px" }}>
        {saveStatus && <span className="status-line">{saveStatus}</span>}
        <button type="button" className="button-primary" onClick={save} disabled={isSaving}>
          Save
        </button>
      </div>
    </div>
  );
}

function IssuesWorkspace({ issues, assets, bundle, onSaveIssue, onSaveBundle, onCreateBundlePrice }) {
  const sorted = [...issues].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const [selectedId, setSelectedId] = useState(null);
  const [flagshipStatus, setFlagshipStatus] = useState("");
  const selected = sorted.find((i) => i.id === selectedId);

  // Only one issue may be flagship at a time: pin the clicked issue, then
  // unpin whichever issue previously held it (each a separate PUT, since the
  // API saves one issue per call).
  async function handleSetFlagship(issue) {
    if (issue.isFlagship || flagshipStatus === "Saving…") return;
    setFlagshipStatus("Saving…");
    const previous = sorted.find((i) => i.isFlagship && i.id !== issue.id);
    try {
      await onSaveIssue({ ...issue, isFlagship: true });
      if (previous) {
        await onSaveIssue({ ...previous, isFlagship: false });
      }
      setFlagshipStatus("");
    } catch (err) {
      setFlagshipStatus(err.message || "Couldn't update.");
    }
  }

  if (selected) {
    return (
      <div className="shop-workspace">
        <button type="button" className="shop-workspace__back" onClick={() => setSelectedId(null)}>
          ← Back to products
        </button>
        <IssueEditor
          key={selected.id}
          issues={[selected]}
          assets={assets}
          onSave={onSaveIssue}
        />
      </div>
    );
  }

  return (
    <div className="shop-workspace">
      <header className="shop-workspace__header">
        <h1>Products</h1>
        <p>
          Click a product to edit its shop settings, pricing, and digital PDF. Star an issue to feature its art
          as the homepage background.
          {flagshipStatus ? <span className="status-line" style={{ marginLeft: "8px" }}>{flagshipStatus}</span> : null}
        </p>
      </header>
      <BundleEditor bundle={bundle} issues={sorted} onSave={onSaveBundle} onCreatePrice={onCreateBundlePrice} />
      <div className="shop-product-list">
        {sorted.map((issue) => (
          <div key={issue.id} className="shop-product-row">
            <button
              type="button"
              className={`shop-product-row__flagship ${issue.isFlagship ? "is-active" : ""}`}
              onClick={() => handleSetFlagship(issue)}
              aria-pressed={Boolean(issue.isFlagship)}
              title={issue.isFlagship ? "Featured as homepage background" : "Set as homepage background"}
            >
              ★
            </button>
            <button
              type="button"
              className="shop-product-row__main"
              onClick={() => setSelectedId(issue.id)}
            >
              <span className="shop-product-row__title">{issue.title}</span>
              <span className={`shop-product-row__badge ${issue.shop?.listedInShop ? "shop-product-row__badge--listed" : ""}`}>
                {issue.shop?.listedInShop ? "Listed" : "Unlisted"}
              </span>
              <span className="shop-product-row__arrow">→</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage({ refreshBootstrap, session, refreshSession }) {
  const [loginState, setLoginState] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [activeGroup, setActiveGroup] = useState("dashboard");
  const [activeSubTab, setActiveSubTab] = useState("orders");

  usePageSeo({
    seo: {
      title: "Admin - Renowned",
      description: "Renowned admin dashboard",
      canonicalUrl: "",
      noindex: true,
      ogImage: "",
    },
  });

  useEffect(() => {
    if (!session.authenticated) {
      setAdminData(null);
      return;
    }

    async function loadAdmin() {
      try {
        setAdminData(await api.getAdminData());
      } catch (error) {
        setAdminError(error.message || "Unable to load admin data.");
      }
    }

    loadAdmin();
  }, [session.authenticated]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginError("");
    try {
      await api.login(loginState);
      await refreshSession();
      setAdminData(await api.getAdminData());
    } catch (error) {
      setLoginError(error.message || "Login failed.");
    }
  }

  async function handleLogout() {
    await api.logout();
    setAdminData(null);
    await refreshSession();
  }

  async function syncAfterSave(nextAdminData) {
    setAdminData(nextAdminData);
    await refreshBootstrap();
  }

  if (!session.authenticated) {
    return (
      <main className="admin-auth">
        <div className="admin-auth__card">
          <h1>Admin Login</h1>
          <form onSubmit={handleLogin}>
            <Field label="Username" value={loginState.username} onChange={(value) => setLoginState((current) => ({ ...current, username: value }))} />
            <Field label="Password" value={loginState.password} onChange={(value) => setLoginState((current) => ({ ...current, password: value }))} />
            <button className="button-primary" type="submit">Login</button>
            {loginError ? <p className="status-line status-line--error">{loginError}</p> : null}
          </form>
        </div>
      </main>
    );
  }

  if (!adminData) {
    return <div className="state-shell">{adminError || "Loading admin..."}</div>;
  }

  const navGroups = [
    { key: "dashboard", label: "Dashboard" },
    {
      key: "orders",
      label: "Orders",
      subTabs: [
        ["orders", "Orders"],
        ["delivery", "Delivery"],
      ],
    },
    { key: "products", label: "Products" },
    { key: "funnel", label: "Funnel" },
    {
      key: "customers",
      label: "Customers",
      subTabs: [
        ["customers", "Customers"],
        ["leads", "Leads"],
      ],
    },
    {
      key: "content",
      label: "Content",
      subTabs: [
        ["pages", "Pages"],
        ["letters", "Letters"],
        ["assets", "Assets"],
        ["redirects", "Redirects"],
      ],
    },
    { key: "settings", label: "Settings" },
  ];

  const activeGroupConfig = navGroups.find((group) => group.key === activeGroup);

  function selectGroup(group) {
    setActiveGroup(group.key);
    setActiveSubTab(group.subTabs ? group.subTabs[0][0] : "");
  }

  return (
    <main className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="brand-mark brand-mark--sidebar" to="/" aria-label="Back to site">
            ←
          </Link>
        <nav className="admin-sidebar__nav" aria-label="Primary">
          {navGroups.map((group) => (
            <button
              key={group.key}
              className={`admin-tab ${activeGroup === group.key ? "is-active" : ""}`}
              onClick={() => selectGroup(group)}
              type="button"
            >
              {group.label}
            </button>
          ))}
        </nav>
        <button className="admin-tab admin-tab--ghost" onClick={handleLogout} type="button">Logout</button>
      </aside>
      <section className="admin-main">
        {activeGroupConfig?.subTabs ? (
          <nav className="admin-subnav" aria-label="Secondary">
            {activeGroupConfig.subTabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`admin-subnav__pill ${activeSubTab === key ? "is-active" : ""}`}
                onClick={() => setActiveSubTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        ) : null}

        {activeGroup === "dashboard" ? <DashboardAdmin /> : null}
        {activeGroup === "funnel" ? <FunnelAdmin /> : null}

        {activeGroup === "orders" && activeSubTab === "orders" ? <OrdersAdmin assets={adminData.assets || []} /> : null}
        {activeGroup === "orders" && activeSubTab === "delivery" ? <DeliveryAdmin /> : null}

        {activeGroup === "products" ? (
          <IssuesWorkspace
            issues={adminData.issues || []}
            assets={adminData.assets || []}
            bundle={adminData.bundle}
            onSaveIssue={async (issue) => syncAfterSave(await api.saveIssue(issue))}
            onSaveBundle={async (bundle) => syncAfterSave(await api.saveBundle(bundle))}
            onCreateBundlePrice={(unitAmountCents) => api.createBundlePrice(unitAmountCents)}
          />
        ) : null}

        {activeGroup === "customers" && activeSubTab === "customers" ? <CustomersAdmin /> : null}
        {activeGroup === "customers" && activeSubTab === "leads" ? (
          <LeadsAdmin
            leads={adminData.leads || []}
            issues={adminData.issues || []}
            onDelete={async (leadId) => syncAfterSave(await api.deleteLead(leadId))}
          />
        ) : null}

        {activeGroup === "content" && activeSubTab === "pages" ? (
          <PageWorkspace
            pages={adminData.pages}
            assets={adminData.assets}
            teamMembers={adminData.teamMembers || []}
            onSavePage={async (page) => syncAfterSave(await api.savePage(page))}
            onSaveTeamMember={async (member) => syncAfterSave(await api.saveTeamMember(member))}
          />
        ) : null}
        {activeGroup === "content" && activeSubTab === "letters" ? (
          <LettersAdmin
            letters={adminData.lettersSubmissions}
            onSave={async (letter) => syncAfterSave(await api.saveLetter(letter))}
          />
        ) : null}
        {activeGroup === "content" && activeSubTab === "assets" ? (
          <AssetsEditor
            assets={adminData.assets}
            assetFolders={adminData.assetFolders || []}
            onUpload={async (payload) => syncAfterSave(await api.uploadAssets(payload))}
            onSaveAsset={async (asset) => syncAfterSave(await api.saveAsset(asset))}
            onSaveAssetFolders={async (folders) => syncAfterSave(await api.saveAssetFolders(folders))}
            onDelete={async (assetId) => syncAfterSave(await api.deleteAsset(assetId))}
            onCreateVariant={async (assetId, variant) =>
              syncAfterSave(await api.createAssetVariant(assetId, variant))
            }
            onUpdateVariant={async (assetId, variantId, variant) =>
              syncAfterSave(await api.updateAssetVariant(assetId, variantId, variant))
            }
            onDeleteVariant={async (assetId, variantId) =>
              syncAfterSave(await api.deleteAssetVariant(assetId, variantId))
            }
          />
        ) : null}
        {activeGroup === "content" && activeSubTab === "redirects" ? (
          <SimpleCollectionEditor
            title="Redirects"
            items={adminData.redirects}
            assets={adminData.assets}
            onSave={async (redirect) => syncAfterSave(await api.saveRedirect(redirect))}
            onDelete={async (redirectId) => syncAfterSave(await api.deleteRedirect(redirectId))}
            itemLabel="Redirect"
            createItem={() => {
              const nextNumber = adminData.redirects.length + 1;
              return {
                id: `redirect-${crypto.randomUUID()}`,
                sourcePath: `/new-redirect-${nextNumber}`,
                destination: "https://example.com",
                type: "302",
                active: true,
              };
            }}
            createLabel="Add redirect"
            deleteLabel="Delete redirect"
            fields={[
              { key: "sourcePath", label: "Source path" },
              { key: "destination", label: "Destination" },
              { key: "type", label: "Redirect type" },
              { key: "active", label: "Active", type: "checkbox" },
            ]}
          />
        ) : null}

        {activeGroup === "settings" ? (
          <SettingsEditor
            siteSettings={adminData.siteSettings}
            assets={adminData.assets}
            onSave={async (siteSettings) => syncAfterSave(await api.saveSiteSettings(siteSettings))}
            title="Settings"
          />
        ) : null}
      </section>
    </main>
  );
}



