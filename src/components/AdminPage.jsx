import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import DeliveryAdmin from "./DeliveryAdmin";
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

function formatAssetMeta(asset) {
  const parts = [];
  const fileName = asset.metadata?.fileName || asset.metadata?.category || "Uploaded asset";
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

function isImageAsset(asset) {
  const contentType = asset?.metadata?.contentType || "";
  if (contentType.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(asset?.url || "");
}

function AssetPickerModal({ title, assets, isOpen, onClose, onPick }) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const filteredAssets = assets.filter((asset) =>
    [asset.label, asset.url, asset.metadata?.fileName, asset.metadata?.category]
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
              key={asset.id}
              className="asset-gallery-card"
              type="button"
              onClick={() => {
                onPick(asset.url);
                onClose();
              }}
            >
              <img src={asset.url} alt={asset.label} className="asset-gallery-card__image" />
              <span className="asset-gallery-card__title">{asset.label}</span>
              <span className="asset-gallery-card__meta">
                {formatAssetMeta(asset)}
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

function AssetField({
  label,
  value,
  onChange,
  assets,
  helperText = "",
}) {
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

const HOME_PANEL_ORDER = ["/read", "/meet", "/letters", "/buy"];
const HOME_PANEL_DEFAULTS = {
  "/read": { label: "Read", href: "/read", size: "wide" },
  "/meet": { label: "Meet", href: "/meet", size: "wide-half" },
  "/letters": { label: "Letters", href: "/letters", size: "standard" },
  "/buy": { label: "Buy", href: "/buy", size: "standard" },
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

function PageEditor({ pages, assets, onSave, title = "Pages" }) {
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
          </div>
        </section>
      </div>
    </section>
  );
}

function IssueEditor({ issues, assets, onSave, title = "Issues" }) {
  const selectedIssue = issues[0];
  const [draft, setDraft] = useState(selectedIssue);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    setDraft(selectedIssue);
    setSaveStatus("");
  }, [selectedIssue]);

  async function saveNextDraft(nextDraft, statusLabel) {
    setDraft(nextDraft);
    setSaveStatus("Updating image...");
    try {
      await onSave(nextDraft);
      setSaveStatus(statusLabel);
    } catch (error) {
      setSaveStatus(error.message || "Unable to update image.");
    }
  }

  async function update(path, value, statusLabel) {
    if (!draft) {
      return;
    }

    const nextDraft = structuredClone(draft);
    let cursor = nextDraft;
    for (let index = 0; index < path.length - 1; index += 1) {
      cursor = cursor[path[index]];
    }
    cursor[path[path.length - 1]] = value;
    await saveNextDraft(nextDraft, statusLabel);
  }

  if (!draft) {
    return null;
  }

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
          <h2>Images</h2>
          <div className="workspace-image-list">
            <IssueGalleryManager
              featuredImage={draft.featuredImage || draft.coverImage || ""}
              galleryImages={draft.heroAssets || []}
              assets={assets}
              onChangeFeatured={(value) => update(["featuredImage"], value, "Featured image updated.")}
              onChangeGallery={(value) => update(["heroAssets"], value, "Issue images updated.")}
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

function SettingsEditor({
  siteSettings,
  assets,
  onSave,
  title = "Settings",
  subtitle = "",
}) {
  const [draft, setDraft] = useState(siteSettings);
  const [navText, setNavText] = useState(JSON.stringify(siteSettings.nav, null, 2));

  useEffect(() => {
    setDraft(siteSettings);
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
  onUpload,
  onDelete,
  storage,
}) {
  const [uploadStatus, setUploadStatus] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const imageAssets = assets.filter(isImageAsset);

  async function uploadFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file instanceof File && file.size);
    if (!files.length) {
      setUploadStatus("Choose at least one file first.");
      return;
    }

    setUploadStatus(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`);
    try {
      await onUpload({ files });
      setUploadStatus(`Uploaded ${files.length} file${files.length === 1 ? "" : "s"}.`);
    } catch (error) {
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
    try {
      await onDelete(asset.id);
      setUploadStatus(`${asset.label} deleted.`);
    } catch (error) {
      setUploadStatus(error.message || "Unable to delete asset.");
    }
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
          <input name="files" type="file" multiple onChange={handleInputChange} />
          <span className="upload-dropzone__eyebrow">Upload images</span>
          <span className="upload-dropzone__title">Drop images anywhere in this zone</span>
          <span className="upload-dropzone__copy">Or click to browse files from your computer. Uploads start immediately.</span>
        </label>
        {uploadStatus ? <p className="status-line">{uploadStatus}</p> : null}
      </section>
      <div className="editor-grid">
        <div className="editor-card editor-card--full">
          <div className="asset-library">
            <div className="asset-library__header">
              <h3>Library</h3>
              <p className="field-help">{imageAssets.length} uploaded image{imageAssets.length === 1 ? "" : "s"}</p>
            </div>
            <div className="asset-gallery-grid">
              {imageAssets.map((asset) => (
                <div key={asset.id} className="asset-gallery-card asset-gallery-card--library">
                  <img src={asset.url} alt={asset.label} className="asset-gallery-card__image" />
                  <div className="asset-gallery-card__overlay">
                    <div className="asset-gallery-card__copy">
                    <span className="asset-gallery-card__title">{asset.label}</span>
                    <span className="asset-gallery-card__meta">{formatAssetMeta(asset)}</span>
                      </div>
                    <button
                      className="button-secondary asset-gallery-card__delete"
                      type="button"
                      onClick={() => handleDeleteAsset(asset)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!imageAssets.length ? <p className="field-help">No uploaded images are in the library yet.</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function PageWorkspace({
  pages,
  issues,
  assets,
  onSavePage,
  onSaveIssue,
}) {
  const entries = [
    ...pages.map((page) => ({
      id: `page:${page.id}`,
      type: "page",
      title: page.title,
      subtitle: page.slug,
      page,
    })),
    ...issues
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((issue) => ({
        id: `issue:${issue.id}`,
        type: "issue",
        title: issue.title,
        subtitle: issue.slug,
        issue,
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
  const selectedIssue = selectedEntry.type === "issue" ? selectedEntry.issue : null;

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
          />
        ) : null}
        {selectedIssue ? (
          <IssueEditor
            issues={[selectedIssue]}
            assets={assets}
            onSave={onSaveIssue}
            title={selectedIssue.title}
          />
        ) : null}
      </div>
    </section>
  );
}
export default function AdminPage({ refreshBootstrap, session, refreshSession }) {
  const [loginState, setLoginState] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [activeTab, setActiveTab] = useState("letters");

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

  const tabs = [
    ["delivery", "Delivery"],
    ["pages", "Pages"],
    ["letters", "Letters"],
    ["assets", "Assets"],
    ["general", "Settings"],
  ];

  return (
    <main className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="brand-mark brand-mark--sidebar" to="/" aria-label="Back to site">
            ←
          </Link>
        <nav className="admin-sidebar__nav" aria-label="Primary">
          {tabs.map(([key, label]) => (
            <button key={key} className={`admin-tab ${activeTab === key ? "is-active" : ""}`} onClick={() => setActiveTab(key)} type="button">
              {label}
            </button>
          ))}
        </nav>
        <button className="admin-tab admin-tab--ghost" onClick={handleLogout} type="button">Logout</button>
      </aside>
      <section className="admin-main">
        {activeTab === "letters" ? (
          <LettersAdmin
            letters={adminData.lettersSubmissions}
            onSave={async (letter) => syncAfterSave(await api.saveLetter(letter))}
          />
        ) : null}
        {activeTab === "delivery" ? <DeliveryAdmin /> : null}
        {activeTab === "pages" ? (
          <PageWorkspace
            pages={adminData.pages}
            issues={adminData.issues}
            letters={adminData.lettersSubmissions}
            assets={adminData.assets}
            onSavePage={async (page) => syncAfterSave(await api.savePage(page))}
            onSaveIssue={async (issue) => syncAfterSave(await api.saveIssue(issue))}
          />
        ) : null}
        {activeTab === "redirects" ? (
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
        {activeTab === "assets" ? <AssetsEditor assets={adminData.assets} onUpload={async (payload) => syncAfterSave(await api.uploadAssets(payload))} onDelete={async (assetId) => syncAfterSave(await api.deleteAsset(assetId))} storage={adminData.storage} /> : null}
        {activeTab === "general" ? <SettingsEditor siteSettings={adminData.siteSettings} assets={adminData.assets} onSave={async (siteSettings) => syncAfterSave(await api.saveSiteSettings(siteSettings))} title="Settings" /> : null}
      </section>
    </main>
  );
}



