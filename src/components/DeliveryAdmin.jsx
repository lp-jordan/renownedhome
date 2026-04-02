import { useEffect, useState } from "react";
import { api } from "../lib/api";

function emptyProjectForm() {
  return {
    title: "",
    creatorName: "Renowned",
    slug: "",
    shortMessage: "",
    description: "",
  };
}

export default function DeliveryAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectForm, setProjectForm] = useState(emptyProjectForm());
  const [projectStatus, setProjectStatus] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewStatus, setPreviewStatus] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextSummary, nextProjects] = await Promise.all([
        api.getDeliverySummary(),
        api.getDeliveryProjects(),
      ]);
      setSummary(nextSummary);
      setProjects(nextProjects.projects);
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
      setProjects((current) => [response.project, ...current]);
      setProjectForm(emptyProjectForm());
      setProjectStatus("Project created.");
      const nextSummary = await api.getDeliverySummary();
      setSummary(nextSummary);
    } catch (createError) {
      setProjectStatus(createError.message || "Unable to create project.");
    }
  }

  async function handlePreviewImport(event) {
    event.preventDefault();
    setPreviewStatus("Checking CSV...");
    try {
      const nextPreview = await api.previewDeliveryImport(csvText);
      setPreview(nextPreview);
      setPreviewStatus("Preview ready.");
    } catch (previewError) {
      setPreviewStatus(previewError.message || "Preview failed.");
    }
  }

  if (loading) {
    return <div className="state-shell">Loading delivery workspace...</div>;
  }

  if (error) {
    return <div className="state-shell">{error}</div>;
  }

  return (
    <section className="editor-shell">
      <div className="editor-header">
        <div>
          <p className="editor-header__eyebrow">Delivery</p>
          <h1>Backer Delivery</h1>
          <p>
            This is the new fulfillment workspace. It is isolated from the page CMS and designed
            to grow into its own product surface later.
          </p>
        </div>
      </div>

      <div className="editor-grid">
        <div className="editor-card">
          <h3>Module status</h3>
          <p className="status-line">
            Storage: {summary?.storage?.database || "unknown"}
            <br />
            Uploads: {summary?.storage?.uploadsConfigured ? "bucket ready" : "not configured"}
            <br />
            Delivery links: {summary?.storage?.deliveryMode || "pending"}
          </p>
          <p className="status-line">
            Projects: {summary?.summary?.totalProjects || 0}
            <br />
            Ready: {summary?.summary?.readyProjects || 0}
            <br />
            Delivered: {summary?.summary?.deliveredProjects || 0}
            <br />
            Backers: {summary?.summary?.totalBackers || 0}
            <br />
            Downloads: {summary?.summary?.totalDownloads || 0}
          </p>
        </div>

        <div className="editor-card">
          <h3>Create project</h3>
          <form onSubmit={handleCreateProject}>
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
            <label>
              <span>Slug override</span>
              <input
                value={projectForm.slug}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, slug: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Short note</span>
              <textarea
                rows={3}
                value={projectForm.shortMessage}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, shortMessage: event.target.value }))
                }
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                rows={4}
                value={projectForm.description}
                onChange={(event) =>
                  setProjectForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </label>
            <button className="button-primary" type="submit">
              Create delivery project
            </button>
            {projectStatus ? <p className="status-line">{projectStatus}</p> : null}
          </form>
        </div>

        <div className="editor-card editor-card--full">
          <h3>Current projects</h3>
          {projects.length ? (
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Backers</th>
                    <th>Emailed</th>
                    <th>Downloads</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td>{project.title}</td>
                      <td>{project.status}</td>
                      <td>{project.backerCount}</td>
                      <td>{project.emailedCount}</td>
                      <td>{project.downloadCount}</td>
                      <td>{new Date(project.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="status-line">No delivery projects yet. Create the first one here.</p>
          )}
        </div>

        <div className="editor-card editor-card--full">
          <h3>Backer CSV preview</h3>
          <p className="status-line">
            Paste a draft CSV here to validate the import flow before we wire in persistent backer
            creation and email sending.
          </p>
          <form onSubmit={handlePreviewImport}>
            <label>
              <span>CSV text</span>
              <textarea
                rows={10}
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
                placeholder={"email\nreader@example.com\nshop@example.com"}
              />
            </label>
            <button className="button-primary" type="submit">
              Preview import
            </button>
            {previewStatus ? <p className="status-line">{previewStatus}</p> : null}
          </form>

          {preview ? (
            <div className="editor-grid" style={{ marginTop: "1rem" }}>
              <div className="editor-card">
                <h3>Summary</h3>
                <p className="status-line">
                  Total rows: {preview.summary.totalRows}
                  <br />
                  Valid: {preview.summary.validCount}
                  <br />
                  Invalid: {preview.summary.invalidCount}
                  <br />
                  Duplicates: {preview.summary.duplicateCount}
                </p>
              </div>
              <div className="editor-card">
                <h3>Valid emails</h3>
                <p className="status-line">
                  {preview.validRows.slice(0, 8).map((row) => row.email).join(", ") || "None"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
