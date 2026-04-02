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

function getWorkflowState(detail) {
  const hasCover = Boolean(detail?.currentCover);
  const hasPdf = Boolean(detail?.currentPdf);
  const hasBackers = Boolean(detail?.backers?.length);

  let currentStep = "upload";
  if (!hasCover || !hasPdf) {
    currentStep = "upload";
  } else if (!hasBackers) {
    currentStep = "backers";
  } else if (!detail?.project?.lastDeliveredAt) {
    currentStep = "delivery";
  } else {
    currentStep = "done";
  }

  return {
    hasCover,
    hasPdf,
    hasBackers,
    isReady: hasPdf && hasBackers,
    currentStep,
  };
}

function SummaryRow({ label, value }) {
  return (
    <div className="delivery-summary-card__row">
      <span className="delivery-summary-card__row-label">{label}</span>
      <strong className="delivery-summary-card__row-value">{value}</strong>
    </div>
  );
}

function fileRoute(fileId) {
  return `/api/delivery/files/${encodeURIComponent(fileId)}`;
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
  const [projectStatus, setProjectStatus] = useState("");
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

  async function loadProjectDetail(projectId) {
    if (!projectId) {
      setDetail(null);
      return;
    }

    setDetailStatus("Loading project...");
    try {
      const nextDetail = await api.getDeliveryProject(projectId);
      setDetail(nextDetail);
      setDetailStatus("");
    } catch (loadError) {
      setDetailStatus(loadError.message || "Unable to load project detail.");
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
    setProjectStatus("Creating project...");
    try {
      const response = await api.createDeliveryProject(projectForm);
      setProjectForm(emptyProjectForm());
      setProjectStatus("Project created.");
      setShowProjectForm(false);
      const nextProjects = await loadDashboard();
      const projectId = response.project.id || nextProjects[0]?.id || "";
      setSelectedProjectId(projectId);
      await loadProjectDetail(projectId);
    } catch (createError) {
      setProjectStatus(createError.message || "Unable to create project.");
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
        `Imported ${result.summary.importedCount} backers. Skipped ${result.summary.skippedExistingCount} existing email${result.summary.skippedExistingCount === 1 ? "" : "s"}.`
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
      setDetailStatus("Create or select a project first.");
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
      setDetailStatus(kind === "cover" ? "Cover updated." : "PDF updated.");
    } catch (uploadError) {
      setDetailStatus(uploadError.message || "Upload failed.");
    }
  }

  async function handleSendEmails() {
    if (!selectedProjectId) {
      setSendStatus("Choose a project first.");
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
      setDetailStatus("Choose a project first.");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${detail.project.title}" and all of its uploaded media from storage? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setDetailStatus("Deleting project and bucket files...");
    try {
      await api.deleteDeliveryProject(selectedProjectId);
      const nextProjects = await loadDashboard();
      const nextProjectId = nextProjects[0]?.id || "";
      setSelectedProjectId(nextProjectId);
      setCsvText("");
      setImportStatus("");
      setSendStatus("");
      if (nextProjectId) {
        await loadProjectDetail(nextProjectId);
        setDetailStatus("Project deleted.");
      } else {
        setDetail(null);
        setDetailStatus("Project deleted.");
      }
    } catch (deleteError) {
      setDetailStatus(deleteError.message || "Project deletion failed.");
    }
  }

  async function handleDeleteFile(file) {
    if (!selectedProjectId || !file) {
      return;
    }

    const isActivePdf = file.kind === "pdf" && detail?.project?.activePdfFileId === file.id;
    const isActiveCover = file.kind === "cover" && detail?.project?.coverFileId === file.id;
    const confirmed = window.confirm(
      isActivePdf
        ? `Delete ${file.originalFilename}? If another PDF version exists it will become active; otherwise the project will have no active PDF.`
        : isActiveCover
          ? `Delete ${file.originalFilename}? The project will have no cover image until you upload a new one.`
          : `Delete ${file.originalFilename} from the project and bucket storage?`
    );
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

  if (loading) {
    return <div className="state-shell">Loading delivery workspace...</div>;
  }

  if (error) {
    return <div className="state-shell">{error}</div>;
  }

  const workflow = getWorkflowState(detail);
  const publicLink =
    detail?.currentPdf && detail?.backers?.[0]?.accessToken
      ? `/a/${detail.backers[0].accessToken}`
      : "";
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;
  const summaryStatus = workflow.isReady ? "Ready" : "Needs Setup";
  const coverUrl = detail?.currentCover ? fileRoute(detail.currentCover.id) : "";
  const pdfUrl = detail?.currentPdf ? fileRoute(detail.currentPdf.id) : "";
  const pdfReaderUrl = detail?.currentPdf
    ? `/api/delivery/files/${encodeURIComponent(detail.currentPdf.id)}/content`
    : "";

  return (
    <section className="editor-shell delivery-workspace delivery-workspace--streamlined">
      <div className="delivery-header delivery-header--compact">
        <div>
          <p className="editor-header__eyebrow">Delivery</p>
          <h1>Backer Delivery</h1>
        </div>
        <div className="delivery-header__actions">
          {projects.length ? (
            <label className="delivery-project-picker">
              <span>Project</span>
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
            {showProjectForm ? "Close" : "New Project"}
          </button>
        </div>
      </div>

      {showProjectForm || !projects.length ? (
        <section className="editor-card delivery-section">
          <div className="delivery-section__header">
            <h2>Create Project</h2>
          </div>
          <form className="delivery-form-grid" onSubmit={handleCreateProject}>
            <label>
              <span>Project title</span>
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
              <span>Short note</span>
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
                Create Project
              </button>
            </div>
            {projectStatus ? <p className="status-line">{projectStatus}</p> : null}
          </form>
        </section>
      ) : null}

      {detail ? (
        <div className="delivery-layout">
          <div className="delivery-primary">
            <div className="delivery-progress">
              <div className={`delivery-progress__step ${workflow.currentStep === "upload" ? "is-active" : workflow.hasCover && workflow.hasPdf ? "is-done" : ""}`}>
                Upload Files
              </div>
              <div className={`delivery-progress__step ${workflow.currentStep === "backers" ? "is-active" : workflow.hasBackers ? "is-done" : ""}`}>
                Add Backers
              </div>
              <div className={`delivery-progress__step ${workflow.currentStep === "delivery" ? "is-active" : detail.project.lastDeliveredAt ? "is-done" : ""}`}>
                Send Emails
              </div>
              <div className={`delivery-progress__step ${workflow.currentStep === "done" ? "is-active is-done" : detail.project.lastDeliveredAt ? "is-done" : ""}`}>
                Done
              </div>
            </div>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Project Setup</h2>
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
                  <span className="delivery-upload-card__label">Main PDF</span>
                  {pdfUrl ? (
                    <>
                      <div className="delivery-pdf-frame">
                        <InlinePdfReader
                          pdfUrl={pdfReaderUrl}
                          compact
                        />
                      </div>
                      <p className="delivery-upload-card__meta">
                        {detail.currentPdf.originalFilename} · {formatFileSize(detail.currentPdf.fileSizeBytes)}
                      </p>
                    </>
                  ) : (
                    <p className="delivery-upload-card__empty">No PDF uploaded yet.</p>
                  )}
                  <form onSubmit={(event) => handleUpload("pdf", event)}>
                    <label className="button-primary button-compact delivery-upload-button">
                      <span>{pdfUrl ? "Replace PDF" : "Upload PDF"}</span>
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
              {detailStatus ? <p className="status-line">{detailStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Add Backers</h2>
              </div>
              <p className="status-line">Paste emails or a one-column CSV list, then import them into this project.</p>
              <label>
                <span>Backer emails</span>
                <textarea
                  rows={9}
                  value={csvText}
                  onChange={(event) => setCsvText(event.target.value)}
                  placeholder={"email\nreader@example.com\nshop@example.com"}
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
              {detail.backers.length ? (
                <div className="delivery-email-list">
                  {detail.backers.map((backer) => (
                    <div key={backer.id} className="delivery-email-list__item">
                      {backer.email}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="status-line">Add backers first and they will appear here.</p>
              )}
              <button
                className="button-primary"
                type="button"
                onClick={handleSendEmails}
                disabled={!detail.backers.length || !detail.currentPdf}
              >
                Send Emails To Backers
              </button>
              <p className="status-line">
                Each backer will receive a private access link.
              </p>
              {sendStatus ? <p className="status-line">{sendStatus}</p> : null}
            </section>

            <section className="editor-card delivery-section">
              <div className="delivery-section__header">
                <h2>Preview Access Page</h2>
              </div>
              {publicLink ? (
                <>
                  <div className="delivery-inline-actions">
                    <a className="button-primary" href={publicLink} target="_blank" rel="noreferrer">
                      Open Access Page
                    </a>
                  </div>
                  <p className="status-line">Example link: {publicLink}</p>
                </>
              ) : (
                <p className="status-line">
                  This becomes available after a PDF and at least one backer are in place.
                </p>
              )}
            </section>
          </div>

          <aside className="delivery-secondary">
            <section className="editor-card delivery-summary-card">
              <div className="delivery-section__header">
                <h2>Project Summary</h2>
              </div>
              <p className="delivery-summary-card__title">{selectedProject?.title || detail.project.title}</p>
              <SummaryRow label="Status" value={summaryStatus} />
              <SummaryRow label="Backers" value={detail.backers.length} />
              <SummaryRow label="Files" value={`${detail.files.length} uploaded`} />
              <SummaryRow label="Creator" value={detail.project.creatorName} />
              <button className="button-secondary button-compact" type="button" onClick={handleDeleteProject}>
                Delete Project
              </button>
            </section>

            <section className="editor-card delivery-summary-card">
              <div className="delivery-section__header">
                <h2>Files</h2>
              </div>
              {detail.files.length ? (
                <div className="delivery-mini-list">
                  {detail.files.map((file) => (
                    <div key={file.id} className="delivery-mini-list__item">
                      <div className="delivery-mini-list__item-header">
                        <strong>{file.kind.toUpperCase()}</strong>
                        <button
                          className="button-secondary button-compact"
                          type="button"
                          onClick={() => handleDeleteFile(file)}
                        >
                          Delete
                        </button>
                      </div>
                      <span>{file.originalFilename}</span>
                      <span>
                        v{file.versionNumber} | {formatFileSize(file.fileSizeBytes)}
                        {file.isActive ? " | active" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="status-line">No files uploaded yet.</p>
              )}
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
