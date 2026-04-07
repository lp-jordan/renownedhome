import { useEffect, useState } from "react";
import { api } from "../lib/api";
import InlinePdfReader from "./InlinePdfReader";

function emptyProjectForm() {
  return {
    title: "",
    creatorName: "Renowned",
    slug: "",
    shortMessage: "",
    description: "",
  };
}

function createTierDraft(index = 0, fileIds = []) {
  return {
    id: `new-tier-${Date.now()}-${index}`,
    name: `Tier ${index + 1}`,
    messageOverride: "",
    fileIds,
    isNew: true,
  };
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = units[0];
  for (let index = 0; index < units.length; index += 1) {
    unit = units[index];
    if (size < 1024 || index === units.length - 1) {
      break;
    }
    size /= 1024;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function fileRoute(fileId) {
  return `/api/delivery/files/${encodeURIComponent(fileId)}`;
}

function SummaryRow({ label, value }) {
  return (
    <div className="delivery-summary-card__row">
      <span className="delivery-summary-card__row-label">{label}</span>
      <strong className="delivery-summary-card__row-value">{value}</strong>
    </div>
  );
}

export default function DeliveryAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [projectForm, setProjectForm] = useState(emptyProjectForm());
  const [configForm, setConfigForm] = useState(emptyProjectForm());
  const [tiersDraft, setTiersDraft] = useState([]);
  const [projectStatus, setProjectStatus] = useState("");
  const [configStatus, setConfigStatus] = useState("");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [sendStatus, setSendStatus] = useState("");

  async function loadDashboard() {
    const [nextSummary, nextProjects] = await Promise.all([
      api.getDeliverySummary(),
      api.getDeliveryProjects(),
    ]);
    setSummary(nextSummary);
    setProjects(nextProjects.projects);
    return nextProjects.projects;
  }

  function syncConfig(nextDetail) {
    setConfigForm({
      title: nextDetail.project.title || "",
      creatorName: nextDetail.project.creatorName || "",
      slug: nextDetail.project.slug || "",
      shortMessage: nextDetail.project.shortMessage || "",
      description: nextDetail.project.description || "",
    });
    setTiersDraft(
      (nextDetail.tiers || []).map((tier) => ({
        id: tier.id,
        name: tier.name || "",
        messageOverride: tier.messageOverride || "",
        fileIds: [...(tier.fileIds || [])],
        backerCount: tier.backerCount || 0,
      }))
    );
  }

  async function loadProjectDetail(projectId) {
    if (!projectId) {
      setDetail(null);
      setTiersDraft([]);
      return;
    }

    setDetailStatus("Loading campaign...");
    try {
      const nextDetail = await api.getDeliveryProject(projectId);
      setDetail(nextDetail);
      syncConfig(nextDetail);
      setDetailStatus("");
    } catch (loadError) {
      setDetailStatus(loadError.message || "Unable to load campaign detail.");
      setDetail(null);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const nextProjects = await loadDashboard();
      if (nextProjects.length) {
        const projectId = selectedProjectId || nextProjects[0].id;
        setSelectedProjectId(projectId);
        await loadProjectDetail(projectId);
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load delivery admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreateProject(event) {
    event.preventDefault();
    setProjectStatus("Creating campaign...");
    try {
      const response = await api.createDeliveryProject(projectForm);
      setProjectForm(emptyProjectForm());
      setProjectStatus("Campaign created.");
      setShowProjectForm(false);
      const nextProjects = await loadDashboard();
      const projectId = response.project.id || nextProjects[0]?.id || "";
      setSelectedProjectId(projectId);
      await loadProjectDetail(projectId);
    } catch (createError) {
      setProjectStatus(createError.message || "Unable to create campaign.");
    }
  }

  async function handleSaveConfig() {
    if (!selectedProjectId) {
      setConfigStatus("Choose a campaign first.");
      return;
    }

    setConfigStatus("Saving campaign...");
    try {
      const payload = {
        ...configForm,
        tiers: tiersDraft.map((tier, index) => ({
          id: tier.isNew ? undefined : tier.id,
          name: tier.name,
          messageOverride: tier.messageOverride,
          fileIds: tier.fileIds,
          sortOrder: index,
        })),
      };
      const nextDetail = await api.updateDeliveryProject(selectedProjectId, payload);
      setDetail(nextDetail);
      syncConfig(nextDetail);
      setConfigStatus("Campaign saved.");
      await loadDashboard();
    } catch (saveError) {
      setConfigStatus(saveError.message || "Campaign save failed.");
    }
  }

  async function handleImportBackers() {
    if (!selectedProjectId || !csvText.trim()) {
      setImportStatus("Paste at least one email first.");
      return;
    }

    setImportStatus("Importing backers...");
    try {
      const result = await api.importDeliveryBackers(selectedProjectId, csvText);
      setImportStatus(
        `Imported ${result.summary.importedCount}. Skipped ${result.summary.skippedExistingCount} existing and ${result.summary.skippedUnknownTierCount} unknown-tier row${result.summary.skippedUnknownTierCount === 1 ? "" : "s"}.`
      );
      setCsvText("");
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
    } catch (importError) {
      setImportStatus(importError.message || "Backer import failed.");
    }
  }

  async function handleUpload(kind, event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!selectedProjectId) {
      setDetailStatus("Create or select a campaign first.");
      return;
    }

    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setDetailStatus("Choose a file first.");
      return;
    }

    setDetailStatus(kind === "cover" ? "Uploading cover..." : "Uploading PDF...");
    try {
      if (kind === "cover") {
        await api.uploadDeliveryCover(selectedProjectId, file);
      } else {
        await api.uploadDeliveryPdf(selectedProjectId, file);
      }
      formElement.reset();
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
      setDetailStatus(kind === "cover" ? "Cover updated." : "PDF uploaded.");
    } catch (uploadError) {
      setDetailStatus(uploadError.message || "Upload failed.");
    }
  }

  async function handleSendEmails() {
    if (!selectedProjectId) {
      setSendStatus("Choose a campaign first.");
      return;
    }

    setSendStatus("Sending delivery emails...");
    try {
      const result = await api.sendDeliveryEmails(selectedProjectId);
      setSendStatus(
        `Sent ${result.sentCount} email${result.sentCount === 1 ? "" : "s"}.${
          result.failedCount ? ` ${result.failedCount} failed.` : ""
        }`
      );
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
    } catch (sendError) {
      setSendStatus(sendError.message || "Email sending failed.");
    }
  }

  async function handleDeleteProject() {
    if (!selectedProjectId || !detail) {
      setDetailStatus("Choose a campaign first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${detail.project.title}" and all of its uploaded media from storage? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setDetailStatus("Deleting campaign and bucket files...");
    try {
      await api.deleteDeliveryProject(selectedProjectId);
      const nextProjects = await loadDashboard();
      const nextProjectId = nextProjects[0]?.id || "";
      setSelectedProjectId(nextProjectId);
      setCsvText("");
      setImportStatus("");
      setSendStatus("");
      setConfigStatus("");
      if (nextProjectId) {
        await loadProjectDetail(nextProjectId);
      } else {
        setDetail(null);
      }
      setDetailStatus("Campaign deleted.");
    } catch (deleteError) {
      setDetailStatus(deleteError.message || "Campaign deletion failed.");
    }
  }

  async function handleDeleteFile(file) {
    if (!selectedProjectId || !file) {
      return;
    }

    const confirmed = window.confirm(`Delete ${file.originalFilename} from this campaign?`);
    if (!confirmed) {
      return;
    }

    setDetailStatus(`Deleting ${file.kind === "pdf" ? "PDF" : "cover"}...`);
    try {
      await api.deleteDeliveryFile(selectedProjectId, file.id);
      await loadDashboard();
      await loadProjectDetail(selectedProjectId);
      setDetailStatus(`${file.kind === "pdf" ? "PDF" : "Cover"} deleted.`);
    } catch (deleteError) {
      setDetailStatus(deleteError.message || "File deletion failed.");
    }
  }

  function handleTierChange(index, key, value) {
    setTiersDraft((current) =>
      current.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, [key]: value } : tier
      )
    );
  }

  function toggleTierFile(index, fileId) {
    setTiersDraft((current) =>
      current.map((tier, tierIndex) => {
        if (tierIndex !== index) {
          return tier;
        }
        const nextFileIds = tier.fileIds.includes(fileId)
          ? tier.fileIds.filter((id) => id !== fileId)
          : [...tier.fileIds, fileId];
        return { ...tier, fileIds: nextFileIds };
      })
    );
  }

  function addTier() {
    setTiersDraft((current) => [
      ...current,
      createTierDraft(
        current.length,
        detail?.files?.map((file) => file.id) || []
      ),
    ]);
  }

  function removeTier(index) {
    setTiersDraft((current) => current.filter((_, tierIndex) => tierIndex !== index));
  }

  if (loading) {
    return <div className="state-shell">Loading delivery workspace...</div>;
  }

  if (error) {
    return <div className="state-shell">{error}</div>;
  }

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const coverUrl = detail?.currentCover ? fileRoute(detail.currentCover.id) : "";
  const firstPreviewTier = tiersDraft.find((tier) =>
    detail?.backers?.some((backer) => backer.tierId === tier.id)
  );

  return (
    <section className="editor-shell delivery-workspace delivery-workspace--streamlined">
      <div className="delivery-header delivery-header--compact">
        <div>
          <p className="editor-header__eyebrow">Delivery</p>
          <h1>Campaign Delivery</h1>
        </div>
        <div className="delivery-header__actions">
          {projects.length ? (
            <label className="delivery-project-picker">
              <span>Campaign</span>
              <select
                value={selectedProjectId}
                onChange={async (event) => {
                  const projectId = event.target.value;
                  setSelectedProjectId(projectId);
                  await loadProjectDetail(projectId);
                }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            className="button-primary"
            type="button"
            onClick={() => setShowProjectForm((current) => !current)}
          >
            {showProjectForm ? "Close" : "New Campaign"}
          </button>
        </div>
      </div>

      {showProjectForm || !projects.length ? (
        <section className="editor-card delivery-section">
          <div className="delivery-section__header">
            <h2>Create Campaign</h2>
          </div>
          <form className="delivery-form-grid" onSubmit={handleCreateProject}>
            <label>
              <span>Campaign title</span>
              <input
                value={projectForm.title}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Creator name</span>
              <input
                value={projectForm.creatorName}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, creatorName: event.target.value }))
                }
              />
            </label>
            <label className="delivery-form-grid__full">
              <span>Default message</span>
              <textarea
                rows={3}
                value={projectForm.shortMessage}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, shortMessage: event.target.value }))
                }
              />
            </label>
            <label className="delivery-form-grid__full">
              <span>Description</span>
              <textarea
                rows={4}
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <label className="delivery-form-grid__full">
              <span>Slug override</span>
              <input
                value={projectForm.slug}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, slug: event.target.value }))
                }
              />
            </label>
            <div className="delivery-inline-actions delivery-form-grid__full">
              <button className="button-primary" type="submit">
                Create Campaign
              </button>
            </div>
            {projectStatus ? <p className="status-line">{projectStatus}</p> : null}
          </form>
        </section>
      ) : null}

      {detail ? (
        <div className="delivery-layout">
          <div className="delivery-primary">
            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Campaign Setup</h2>
              </div>
              <div className="delivery-form-grid">
                <label>
                  <span>Campaign title</span>
                  <input
                    value={configForm.title}
                    onChange={(event) =>
                      setConfigForm((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </label>
                <label>
                  <span>Creator name</span>
                  <input
                    value={configForm.creatorName}
                    onChange={(event) =>
                      setConfigForm((current) => ({ ...current, creatorName: event.target.value }))
                    }
                  />
                </label>
                <label className="delivery-form-grid__full">
                  <span>Default message</span>
                  <textarea
                    rows={3}
                    value={configForm.shortMessage}
                    onChange={(event) =>
                      setConfigForm((current) => ({ ...current, shortMessage: event.target.value }))
                    }
                  />
                </label>
                <label className="delivery-form-grid__full">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={configForm.description}
                    onChange={(event) =>
                      setConfigForm((current) => ({ ...current, description: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="delivery-inline-actions">
                <button className="button-primary" type="button" onClick={handleSaveConfig}>
                  Save Campaign
                </button>
              </div>
              {configStatus ? <p className="status-line">{configStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Assets</h2>
              </div>
              <div className="delivery-upload-grid">
                <div className="delivery-upload-card">
                  <span className="delivery-upload-card__label">Cover image</span>
                  {coverUrl ? (
                    <>
                      <img className="delivery-cover-preview" src={coverUrl} alt={`${detail.project.title} cover`} />
                      <p className="delivery-upload-card__meta">{detail.currentCover.originalFilename}</p>
                    </>
                  ) : (
                    <p className="delivery-upload-card__empty">No cover uploaded yet.</p>
                  )}
                  <form onSubmit={(event) => handleUpload("cover", event)}>
                    <label className="button-secondary button-compact delivery-upload-button">
                      <span>{coverUrl ? "Replace Image" : "Upload Image"}</span>
                      <input
                        className="delivery-upload-input"
                        name="file"
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          if (event.target.files?.length) {
                            event.target.form?.requestSubmit();
                          }
                        }}
                      />
                    </label>
                  </form>
                </div>

                <div className="delivery-upload-card">
                  <span className="delivery-upload-card__label">PDF library</span>
                  <p className="delivery-upload-card__meta">
                    {detail.files.length} PDF{detail.files.length === 1 ? "" : "s"} uploaded
                  </p>
                  <form onSubmit={(event) => handleUpload("pdf", event)}>
                    <label className="button-primary button-compact delivery-upload-button">
                      <span>Upload PDF</span>
                      <input
                        className="delivery-upload-input"
                        name="file"
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={(event) => {
                          if (event.target.files?.length) {
                            event.target.form?.requestSubmit();
                          }
                        }}
                      />
                    </label>
                  </form>
                </div>
              </div>
              {detail.files.length ? (
                <div className="delivery-mini-list">
                  {detail.files.map((file) => (
                    <div key={file.id} className="delivery-mini-list__item">
                      <div className="delivery-mini-list__item-header">
                        <strong>{file.originalFilename}</strong>
                        <button
                          className="button-secondary button-compact"
                          type="button"
                          onClick={() => handleDeleteFile(file)}
                        >
                          Delete
                        </button>
                      </div>
                      <div className="delivery-pdf-frame">
                        <InlinePdfReader
                          pdfUrl={fileRoute(file.id) + "/content"}
                          pages={file.readerPages || []}
                          compact
                        />
                      </div>
                      <span>
                        v{file.versionNumber} | {formatFileSize(file.fileSizeBytes)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {detailStatus ? <p className="status-line">{detailStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Tiers</h2>
              </div>
              <p className="status-line">
                Each tier can override the campaign message and choose which PDFs appear behind its private link.
              </p>
              <div className="delivery-mini-list">
                {tiersDraft.map((tier, index) => (
                  <div key={tier.id} className="delivery-mini-list__item">
                    <div className="delivery-mini-list__item-header">
                      <strong>Tier {index + 1}</strong>
                      <button
                        className="button-secondary button-compact"
                        type="button"
                        onClick={() => removeTier(index)}
                        disabled={tiersDraft.length <= 1 || tier.backerCount > 0}
                      >
                        Remove
                      </button>
                    </div>
                    <label>
                      <span>Name</span>
                      <input
                        value={tier.name}
                        onChange={(event) => handleTierChange(index, "name", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Tier-specific message override</span>
                      <textarea
                        rows={3}
                        value={tier.messageOverride}
                        onChange={(event) =>
                          handleTierChange(index, "messageOverride", event.target.value)
                        }
                      />
                    </label>
                    <div className="delivery-mini-list">
                      {detail.files.map((file) => (
                        <label key={file.id} className="workspace-toggle">
                          <input
                            type="checkbox"
                            checked={tier.fileIds.includes(file.id)}
                            onChange={() => toggleTierFile(index, file.id)}
                          />
                          <span>{file.originalFilename}</span>
                        </label>
                      ))}
                    </div>
                    <span>{tier.backerCount || 0} backer{tier.backerCount === 1 ? "" : "s"} in this tier</span>
                  </div>
                ))}
              </div>
              <div className="delivery-inline-actions">
                <button className="button-secondary" type="button" onClick={addTier}>
                  Add Tier
                </button>
                <button className="button-primary" type="button" onClick={handleSaveConfig}>
                  Save Tier Setup
                </button>
              </div>
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Import Backers</h2>
              </div>
              <p className="status-line">Use `email,tier` rows. Tier names can match the labels above.</p>
              <label>
                <span>Backer CSV</span>
                <textarea
                  rows={9}
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                  placeholder={"email,tier\nreader@example.com,Issue 2 only\ncollector@example.com,Issues 1 + 2"}
                />
              </label>
              <div className="delivery-inline-actions">
                <button className="button-primary" type="button" onClick={handleImportBackers}>
                  Import
                </button>
              </div>
              {importStatus ? <p className="status-line">{importStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Send Delivery</h2>
              </div>
              {detail.tiers.length ? (
                <div className="delivery-mini-list">
                  {detail.tiers.map((tier) => (
                    <div key={tier.id} className="delivery-mini-list__item">
                      <strong>{tier.name}</strong>
                      <span>{tier.backerCount} backer{tier.backerCount === 1 ? "" : "s"}</span>
                      <span>{(tier.fileIds || []).length} accessible PDF{(tier.fileIds || []).length === 1 ? "" : "s"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="status-line">Add tiers first.</p>
              )}
              <button
                className="button-primary"
                type="button"
                onClick={handleSendEmails}
                disabled={!detail.backers.length || !detail.files.length}
              >
                Send Emails To Backers
              </button>
              <p className="status-line">Each backer gets one private campaign link filtered by their tier.</p>
              {sendStatus ? <p className="status-line">{sendStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Tier Preview</h2>
              </div>
              {detail.tiers.length ? (
                <div className="delivery-mini-list">
                  {detail.tiers.map((tier) => {
                    const previewBacker = detail.backers.find((backer) => backer.tierId === tier.id);
                    return (
                      <div key={tier.id} className="delivery-mini-list__item">
                        <strong>{tier.name}</strong>
                        <span>{tier.messageOverride || detail.project.shortMessage || "Uses default message."}</span>
                        {previewBacker ? (
                          <a href={`/a/${previewBacker.accessToken}`} target="_blank" rel="noreferrer">
                            Open preview
                          </a>
                        ) : (
                          <span>Add one backer to preview this tier</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {!firstPreviewTier ? (
                <p className="status-line">Import at least one backer into a tier to preview the public page.</p>
              ) : null}
            </section>
          </div>

          <aside className="delivery-secondary">
            <section className="editor-card delivery-summary-card">
              <div className="delivery-section__header">
                <h2>Campaign Summary</h2>
              </div>
              <p className="delivery-summary-card__title">{selectedProject?.title || detail.project.title}</p>
              <SummaryRow label="Status" value={detail.project.status || "draft"} />
              <SummaryRow label="Backers" value={detail.backers.length} />
              <SummaryRow label="PDFs" value={detail.files.length} />
              <SummaryRow label="Tiers" value={detail.tiers.length} />
              <button className="button-secondary button-compact" type="button" onClick={handleDeleteProject}>
                Delete Campaign
              </button>
            </section>

            <section className="editor-card delivery-summary-card">
              <div className="delivery-section__header">
                <h2>Backers</h2>
              </div>
              <p className="status-line">{detail.backers.length} total</p>
              <details className="delivery-disclosure">
                <summary>View list</summary>
                <div className="delivery-mini-list">
                  {detail.backers.map((backer) => (
                    <div key={backer.id} className="delivery-mini-list__item">
                      <strong>{backer.email}</strong>
                      <span>{backer.tierName || "Unassigned tier"}</span>
                      <a href={`/a/${backer.accessToken}`} target="_blank" rel="noreferrer">
                        Open page
                      </a>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          </aside>
        </div>
      ) : null}

      {summary?.storage ? (
        <p className="status-line delivery-footer-note">
          Storage: {summary.storage.database}. Uploads:{" "}
          {summary.storage.uploadsConfigured ? "bucket ready" : "not configured"}.
        </p>
      ) : null}
    </section>
  );
}
