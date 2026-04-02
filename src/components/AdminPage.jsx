import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import DeliveryAdmin from "./DeliveryAdmin";
import { usePageSeo } from "../lib/seo";
import { useAutosave } from "../hooks/useAutosave";

function formatMonth(dateString) {
  if (!dateString) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(dateString));
}

function Field({ label, value, onChange, multiline = false }) {
  return (
    <label>
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

function AssetField({
  label,
  value,
  onChange,
  assets,
  helperText = "Paste a URL or choose from the asset library.",
}) {
  const imageAssets = assets.filter(isImageAsset);

  return (
    <div className="asset-field">
      <Field label={label} value={value} onChange={onChange} />
      <label className="asset-field__picker">
        <span>{label} from library</span>
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) {
              onChange(event.target.value);
            }
            event.target.value = "";
          }}
        >
          <option value="">Choose an existing image...</option>
          {imageAssets.map((asset) => (
            <option key={asset.id} value={asset.url}>
              {asset.label}
            </option>
          ))}
        </select>
      </label>
      {helperText ? <p className="field-help">{helperText}</p> : null}
      {value ? <img className="asset-field__preview" src={value} alt={label} /> : null}
    </div>
  );
}

function AssetListField({ label, values, onChange, assets, helperText }) {
  const imageAssets = assets.filter(isImageAsset);

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
            <Field
              label={`${label} ${index + 1}`}
              value={value}
              onChange={(nextValue) => updateItem(index, nextValue)}
            />
            <label className="asset-field__picker">
              <span>Replace from library</span>
              <select
                value=""
                onChange={(event) => {
                  if (event.target.value) {
                    updateItem(index, event.target.value);
                  }
                  event.target.value = "";
                }}
              >
                <option value="">Choose an existing image...</option>
                {imageAssets.map((asset) => (
                  <option key={asset.id} value={asset.url}>
                    {asset.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="asset-list-field__actions">
              <button className="button-secondary" type="button" onClick={() => removeItem(index)}>
                Remove
              </button>
            </div>
            {value ? <img className="asset-list-field__preview" src={value} alt={`${label} ${index + 1}`} /> : null}
          </div>
        ))}
      </div>
      <div className="asset-list-field__add">
        <label className="asset-field__picker">
          <span>Add from library</span>
          <select
            value=""
            onChange={(event) => {
              addItem(event.target.value);
              event.target.value = "";
            }}
          >
            <option value="">Choose an existing image...</option>
            {imageAssets.map((asset) => (
              <option key={asset.id} value={asset.url}>
                {asset.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button-secondary"
          type="button"
          onClick={() => onChange([...values, ""])}
        >
          Add manual URL
        </button>
      </div>
      {helperText ? <p className="field-help">{helperText}</p> : null}
    </div>
  );
}

function EditorHeader({ title, subtitle, status, onSave }) {
  return (
    <div className="editor-header">
      <div>
        <p className="editor-header__eyebrow">Admin</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
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

function PageEditor({ pages, assets, onSave }) {
  const [selectedId, setSelectedId] = useState(pages[0]?.id || "");
  const selectedPage = pages.find((page) => page.id === selectedId) || pages[0];
  const [draft, setDraft] = useState(selectedPage);
  const [contentText, setContentText] = useState(
    JSON.stringify(selectedPage?.content || {}, null, 2)
  );

  useEffect(() => {
    setDraft(selectedPage);
    setContentText(JSON.stringify(selectedPage?.content || {}, null, 2));
  }, [selectedPage]);

  const autosave = useAutosave({
    draft,
    enabled: Boolean(draft),
    resetKey: selectedId,
    save: onSave,
  });

  function update(path, value) {
    setDraft((current) => {
      const next = structuredClone(current);
      let cursor = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  }

  if (!draft) {
    return null;
  }

  return (
    <section className="editor-shell">
      <EditorHeader
        title="Pages"
        subtitle="Edit public page content, hero fields, and SEO."
        status={autosave.status}
        onSave={autosave.saveNow}
      />
      <label className="control-row">
        <span>Current page</span>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title}
            </option>
          ))}
        </select>
      </label>
      <div className="editor-grid">
        <div className="editor-card">
          <h3>Basics</h3>
          <Field label="Title" value={draft.title} onChange={(value) => update(["title"], value)} />
          <Field label="Slug" value={draft.slug} onChange={(value) => update(["slug"], value)} />
          <Field label="Status" value={draft.status} onChange={(value) => update(["status"], value)} />
        </div>
        <div className="editor-card">
          <h3>SEO</h3>
          <Field
            label="SEO Title"
            value={draft.seo.title}
            onChange={(value) => update(["seo", "title"], value)}
          />
          <Field
            label="Description"
            value={draft.seo.description}
            multiline
            onChange={(value) => update(["seo", "description"], value)}
          />
          <Field
            label="Canonical"
            value={draft.seo.canonicalUrl}
            onChange={(value) => update(["seo", "canonicalUrl"], value)}
          />
          <AssetField
            label="OG image"
            value={draft.seo.ogImage}
            assets={assets}
            onChange={(value) => update(["seo", "ogImage"], value)}
          />
        </div>
        <div className="editor-card">
          <h3>Hero</h3>
          <Field
            label="Title"
            value={draft.hero.title || ""}
            onChange={(value) => update(["hero", "title"], value)}
          />
          <Field
            label="Subtitle"
            value={draft.hero.subtitle || ""}
            multiline
            onChange={(value) => update(["hero", "subtitle"], value)}
          />
          <Field
            label="Kicker"
            value={draft.hero.kicker || ""}
            onChange={(value) => update(["hero", "kicker"], value)}
          />
          <Field
            label="Intro"
            value={draft.hero.intro || ""}
            multiline
            onChange={(value) => update(["hero", "intro"], value)}
          />
          <AssetField
            label="Background image"
            value={draft.hero.backgroundImage || ""}
            assets={assets}
            onChange={(value) => update(["hero", "backgroundImage"], value)}
          />
          <AssetField
            label="Title image"
            value={draft.hero.titleImage || ""}
            assets={assets}
            onChange={(value) => update(["hero", "titleImage"], value)}
          />
          <Field
            label="CTA label"
            value={draft.hero.ctaLabel || ""}
            onChange={(value) => update(["hero", "ctaLabel"], value)}
          />
          <Field
            label="CTA URL"
            value={draft.hero.ctaUrl || ""}
            onChange={(value) => update(["hero", "ctaUrl"], value)}
          />
        </div>
        <div className="editor-card editor-card--full">
          <h3>Structured content JSON</h3>
          <textarea
            rows={18}
            value={contentText}
            onChange={(event) => {
              const value = event.target.value;
              setContentText(value);
              try {
                update(["content"], JSON.parse(value));
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

function IssueEditor({ issues, assets, onSave }) {
  const [selectedId, setSelectedId] = useState(issues[0]?.id || "");
  const selectedIssue = issues.find((issue) => issue.id === selectedId) || issues[0];
  const [draft, setDraft] = useState(selectedIssue);

  useEffect(() => {
    setDraft(selectedIssue);
  }, [selectedIssue]);

  const autosave = useAutosave({
    draft,
    enabled: Boolean(draft),
    resetKey: selectedId,
    save: onSave,
  });

  function update(path, value) {
    setDraft((current) => {
      const next = structuredClone(current);
      let cursor = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  }

  if (!draft) {
    return null;
  }

  return (
    <section className="editor-shell">
      <EditorHeader
        title="Issues"
        subtitle="Shared issue and one-shot page model."
        status={autosave.status}
        onSave={autosave.saveNow}
      />
      <label className="control-row">
        <span>Current issue</span>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {issues.map((issue) => (
            <option key={issue.id} value={issue.id}>
              {issue.title}
            </option>
          ))}
        </select>
      </label>
      <div className="editor-grid">
        <div className="editor-card">
          <h3>Basics</h3>
          <Field label="Title" value={draft.title} onChange={(value) => update(["title"], value)} />
          <Field label="Slug" value={draft.slug} onChange={(value) => update(["slug"], value)} />
          <Field label="Type" value={draft.type} onChange={(value) => update(["type"], value)} />
          <Field label="Status" value={draft.status} onChange={(value) => update(["status"], value)} />
          <Field
            label="Sort order"
            value={String(draft.sortOrder)}
            onChange={(value) => update(["sortOrder"], Number(value) || 0)}
          />
        </div>
        <div className="editor-card">
          <h3>Meta</h3>
          <Field label="Release date" value={draft.releaseDate || ""} onChange={(value) => update(["releaseDate"], value)} />
          <Field label="Writer" value={draft.writer} onChange={(value) => update(["writer"], value)} />
          <Field label="Artist" value={draft.artist} onChange={(value) => update(["artist"], value)} />
          <Field label="Colorist" value={draft.colorist} onChange={(value) => update(["colorist"], value)} />
          <Field label="Preview label" value={draft.previewLabel || ""} onChange={(value) => update(["previewLabel"], value)} />
          <Field label="Preview URL" value={draft.previewUrl || ""} onChange={(value) => update(["previewUrl"], value)} />
          <Field label="Reader label" value={draft.readerLabel || ""} onChange={(value) => update(["readerLabel"], value)} />
          <Field label="Reader PDF URL" value={draft.readerPdfUrl || ""} onChange={(value) => update(["readerPdfUrl"], value)} />
          <AssetField label="Cover image" value={draft.coverImage || ""} assets={assets} onChange={(value) => update(["coverImage"], value)} />
        </div>
        <div className="editor-card">
          <h3>SEO</h3>
          <Field label="SEO Title" value={draft.seo.title} onChange={(value) => update(["seo", "title"], value)} />
          <Field label="Description" value={draft.seo.description} multiline onChange={(value) => update(["seo", "description"], value)} />
          <Field label="Canonical" value={draft.seo.canonicalUrl} onChange={(value) => update(["seo", "canonicalUrl"], value)} />
          <AssetField label="OG image" value={draft.seo.ogImage} assets={assets} onChange={(value) => update(["seo", "ogImage"], value)} />
        </div>
        <div className="editor-card editor-card--full">
          <h3>Description</h3>
          <textarea rows={10} value={draft.description} onChange={(event) => update(["description"], event.target.value)} />
        </div>
        <div className="editor-card editor-card--full">
          <AssetListField
            label="Hero assets"
            values={draft.heroAssets || []}
            assets={assets}
            onChange={(value) => update(["heroAssets"], value)}
            helperText="Set the issue carousel images from the existing asset library or add a manual URL."
          />
        </div>
        <div className="editor-card editor-card--full">
          <AssetListField
            label="Reader page images"
            values={draft.readerImages || []}
            assets={assets}
            onChange={(value) => update(["readerImages"], value)}
            helperText="Use this when you want the public reader to render image pages from stored assets."
          />
        </div>
      </div>
    </section>
  );
}

function LettersAdmin({ issues, letters, onSave }) {
  const [selectedId, setSelectedId] = useState(letters[0]?.id || "");
  const selected = letters.find((letter) => letter.id === selectedId) || letters[0];
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    setDraft(selected);
  }, [selected]);

  const autosave = useAutosave({
    draft,
    enabled: Boolean(draft),
    resetKey: selectedId,
    save: onSave,
  });

  if (!draft) {
    return null;
  }

  return (
    <section className="editor-shell">
      <EditorHeader title="Letters" subtitle="Moderate and feature reader submissions." status={autosave.status} onSave={autosave.saveNow} />
      <label className="control-row">
        <span>Submission</span>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
          {letters.map((letter) => (
            <option key={letter.id} value={letter.id}>
              {letter.name} - {formatMonth(letter.createdAt)}
            </option>
          ))}
        </select>
      </label>
      <div className="editor-grid">
        <div className="editor-card">
          <Field label="Name" value={draft.name} onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
          <Field label="Email" value={draft.email || ""} onChange={(value) => setDraft((current) => ({ ...current, email: value }))} />
          <label>
            <span>Issue</span>
            <select value={draft.issueSlug} onChange={(event) => setDraft((current) => ({ ...current, issueSlug: event.target.value }))}>
              {issues.map((issue) => (
                <option key={issue.id} value={issue.slug}>
                  {issue.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.value,
                  publishedAt:
                    event.target.value === "approved" && !current.publishedAt
                      ? new Date().toISOString()
                      : current.publishedAt,
                }))
              }
            >
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.featured}
              onChange={(event) => setDraft((current) => ({ ...current, featured: event.target.checked }))}
            />
            <span>Featured</span>
          </label>
        </div>
        <div className="editor-card editor-card--full">
          <Field label="Letter" value={draft.message} multiline onChange={(value) => setDraft((current) => ({ ...current, message: value }))} />
        </div>
        <div className="editor-card editor-card--full">
          <Field label="Editor reply" value={draft.editorReply || ""} multiline onChange={(value) => setDraft((current) => ({ ...current, editorReply: value }))} />
        </div>
      </div>
    </section>
  );
}

function SimpleCollectionEditor({ title, subtitle, items, assets, onSave, fields, itemLabel }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id || "");
  const selected = items.find((entry) => entry.id === selectedId) || items[0];
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    setDraft(selected);
  }, [selected]);

  const autosave = useAutosave({
    draft,
    enabled: Boolean(draft),
    resetKey: selectedId,
    save: onSave,
  });

  if (!draft) {
    return null;
  }

  return (
    <section className="editor-shell">
      <EditorHeader title={title} subtitle={subtitle} status={autosave.status} onSave={autosave.saveNow} />
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
    </section>
  );
}

function SettingsEditor({ siteSettings, assets, onSave }) {
  const [draft, setDraft] = useState(siteSettings);
  const [navText, setNavText] = useState(JSON.stringify(siteSettings.nav, null, 2));

  useEffect(() => {
    setDraft(siteSettings);
    setNavText(JSON.stringify(siteSettings.nav, null, 2));
  }, [siteSettings]);

  const autosave = useAutosave({ draft, enabled: true, resetKey: "settings", save: onSave });

  return (
    <section className="editor-shell">
      <EditorHeader title="Settings" subtitle="Shared brand and announcement configuration." status={autosave.status} onSave={autosave.saveNow} />
      <div className="editor-grid">
        <div className="editor-card">
          <Field label="Brand name" value={draft.brandName} onChange={(value) => setDraft((current) => ({ ...current, brandName: value }))} />
          <Field label="Site title suffix" value={draft.siteTitleSuffix} onChange={(value) => setDraft((current) => ({ ...current, siteTitleSuffix: value }))} />
          <AssetField label="Default OG image" value={draft.defaultOgImage} assets={assets} onChange={(value) => setDraft((current) => ({ ...current, defaultOgImage: value }))} />
        </div>
        <div className="editor-card">
          <h3>Home splash</h3>
          <AssetField label="Logo URL" value={draft.homeSplash.logoUrl} assets={assets} onChange={(value) => setDraft((current) => ({ ...current, homeSplash: { ...current.homeSplash, logoUrl: value } }))} />
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

function AssetsEditor({ assets, onSave, onCreateUrl, onUpload, storage }) {
  const [selectedId, setSelectedId] = useState(assets[0]?.id || "");
  const selected = assets.find((asset) => asset.id === selectedId) || assets[0];
  const [draft, setDraft] = useState(selected);
  const [urlForm, setUrlForm] = useState({ label: "", url: "", category: "general" });
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    setDraft(selected);
  }, [selected]);

  const autosave = useAutosave({ draft, enabled: Boolean(draft), resetKey: selectedId, save: onSave });

  async function handleRegisterUrl(event) {
    event.preventDefault();
    setUploadStatus("Saving asset URL...");
    try {
      await onCreateUrl(urlForm);
      setUrlForm({ label: "", url: "", category: "general" });
      setUploadStatus("Asset URL saved.");
    } catch (error) {
      setUploadStatus(error.message || "Unable to save URL.");
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = form
      .getAll("files")
      .filter((file) => file instanceof File && file.size);
    if (!files.length) {
      setUploadStatus("Choose at least one file first.");
      return;
    }
    setUploadStatus(`Uploading ${files.length} file${files.length === 1 ? "" : "s"}...`);
    try {
      await onUpload({
        files,
        label: String(form.get("label") || ""),
        category: String(form.get("category") || "upload"),
      });
      event.currentTarget.reset();
      setUploadStatus(`Uploaded ${files.length} file${files.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setUploadStatus(error.message || "Upload failed.");
    }
  }

  return (
    <section className="editor-shell">
      <EditorHeader title="Assets" subtitle="Register external URLs now and switch to bucket uploads when ready." status={autosave.status} onSave={autosave.saveNow} />
      <div className="editor-grid">
        <div className="editor-card">
          <h3>Register external URL</h3>
          <form onSubmit={handleRegisterUrl}>
            <Field label="Label" value={urlForm.label} onChange={(value) => setUrlForm((current) => ({ ...current, label: value }))} />
            <Field label="URL" value={urlForm.url} onChange={(value) => setUrlForm((current) => ({ ...current, url: value }))} />
            <Field label="Category" value={urlForm.category} onChange={(value) => setUrlForm((current) => ({ ...current, category: value }))} />
            <button className="button-primary" type="submit">Save URL</button>
          </form>
        </div>
        <div className="editor-card">
          <h3>Upload to bucket</h3>
          <p className="status-line">{storage.bucketConfigured ? "Bucket storage is configured." : "Bucket storage is not configured yet. External URL mode is active."}</p>
          <form onSubmit={handleUpload}>
            <label><span>Label override (single upload only)</span><input name="label" /></label>
            <label><span>Category</span><input name="category" defaultValue="upload" /></label>
            <label><span>Files</span><input name="files" type="file" multiple /></label>
            <button className="button-primary" type="submit">Upload selected files</button>
          </form>
          {uploadStatus ? <p className="status-line">{uploadStatus}</p> : null}
        </div>
        {draft ? (
          <>
            <div className="editor-card">
              <label className="control-row">
                <span>Selected asset</span>
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field label="Label" value={draft.label} onChange={(value) => setDraft((current) => ({ ...current, label: value }))} />
              <Field label="URL" value={draft.url} onChange={(value) => setDraft((current) => ({ ...current, url: value }))} />
              <Field label="Storage type" value={draft.storageType} onChange={(value) => setDraft((current) => ({ ...current, storageType: value }))} />
            </div>
            <div className="editor-card">
              <h3>Asset preview</h3>
              {isImageAsset(draft) ? <img className="asset-preview" src={draft.url} alt={draft.label} /> : <p className="field-help">Preview is shown for image assets. Current asset URL: {draft.url}</p>}
            </div>
          </>
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
  const [activeTab, setActiveTab] = useState("delivery");

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
          <p>Sign in with your configured admin credentials.</p>
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
    ["issues", "Issues"],
    ["letters", "Letters"],
    ["redirects", "Redirects"],
    ["team", "Team"],
    ["socials", "Socials"],
    ["settings", "Settings"],
    ["assets", "Assets"],
  ];

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand-mark" to="/">Back to site</Link>
        <p className="admin-sidebar__status">
          Storage: {adminData.storage.database}
          <br />
          Uploads: {adminData.storage.bucketConfigured ? "bucket ready" : "URL mode"}
          <br />
          Public origin: {adminData.storage.publicSiteOrigin}
          <br />
          S3 core: {adminData.storage.bucketVars?.S3_BUCKET ? "bucket " : "no-bucket "}
          {adminData.storage.bucketVars?.S3_REGION ? "region " : "no-region "}
          {adminData.storage.bucketVars?.S3_ACCESS_KEY_ID ? "key " : "no-key "}
          {adminData.storage.bucketVars?.S3_SECRET_ACCESS_KEY ? "secret" : "no-secret"}
          <br />
          S3 endpoint: {adminData.storage.bucketVars?.S3_ENDPOINT ? "present" : "missing"}
          <br />
          Resend: {adminData.storage.resendConfigured ? "ready" : "not ready"}
        </p>
        {tabs.map(([key, label]) => (
          <button key={key} className={`admin-tab ${activeTab === key ? "is-active" : ""}`} onClick={() => setActiveTab(key)} type="button">
            {label}
          </button>
        ))}
        <button className="admin-tab admin-tab--ghost" onClick={handleLogout} type="button">Logout</button>
      </aside>
      <section className="admin-main">
        {activeTab === "delivery" ? <DeliveryAdmin /> : null}
        {activeTab === "pages" ? <PageEditor pages={adminData.pages} assets={adminData.assets} onSave={async (page) => syncAfterSave(await api.savePage(page))} /> : null}
        {activeTab === "issues" ? <IssueEditor issues={adminData.issues} assets={adminData.assets} onSave={async (issue) => syncAfterSave(await api.saveIssue(issue))} /> : null}
        {activeTab === "letters" ? <LettersAdmin issues={adminData.issues} letters={adminData.lettersSubmissions} onSave={async (letter) => syncAfterSave(await api.saveLetter(letter))} /> : null}
        {activeTab === "redirects" ? <SimpleCollectionEditor title="Redirects" subtitle="Preserve legacy and external URLs." items={adminData.redirects} assets={adminData.assets} onSave={async (redirect) => syncAfterSave(await api.saveRedirect(redirect))} itemLabel="Redirect" fields={[{ key: "sourcePath", label: "Source path" }, { key: "destination", label: "Destination" }, { key: "type", label: "Redirect type" }, { key: "active", label: "Active", type: "checkbox" }]} /> : null}
        {activeTab === "team" ? <SimpleCollectionEditor title="Team" subtitle="Manage the Meet page profiles." items={adminData.teamMembers} assets={adminData.assets} onSave={async (teamMember) => syncAfterSave(await api.saveTeamMember(teamMember))} itemLabel="Team member" fields={[{ key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "image", label: "Image URL", type: "image" }, { key: "bio", label: "Bio", multiline: true }, { key: "sortOrder", label: "Sort order", numeric: true }]} /> : null}
        {activeTab === "socials" ? <SimpleCollectionEditor title="Socials" subtitle="Manage social links and icons." items={adminData.socialLinks} assets={adminData.assets} onSave={async (socialLink) => syncAfterSave(await api.saveSocialLink(socialLink))} itemLabel="Social link" fields={[{ key: "personName", label: "Person" }, { key: "label", label: "Label" }, { key: "url", label: "URL" }, { key: "iconUrl", label: "Icon URL", type: "image" }, { key: "sortOrder", label: "Sort order", numeric: true }]} /> : null}
        {activeTab === "settings" ? <SettingsEditor siteSettings={adminData.siteSettings} assets={adminData.assets} onSave={async (siteSettings) => syncAfterSave(await api.saveSiteSettings(siteSettings))} /> : null}
        {activeTab === "assets" ? <AssetsEditor assets={adminData.assets} onSave={async (asset) => syncAfterSave(await api.saveAsset(asset))} onCreateUrl={async (payload) => syncAfterSave(await api.registerAssetUrl(payload))} onUpload={async (payload) => syncAfterSave(await api.uploadAssets(payload))} storage={adminData.storage} /> : null}
      </section>
    </main>
  );
}
