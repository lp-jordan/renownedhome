import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = units[0];
  for (let i = 0; i < units.length; i++) {
    unit = units[i];
    if (size < 1024 || i === units.length - 1) break;
    size /= 1024;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function statusClass(text) {
  if (!text) return "status-line";
  const lower = text.toLowerCase();
  if (/error|failed|invalid/.test(lower)) return "status-line status-line--error";
  if (/uploaded|copied|deleted/.test(lower)) return "status-line status-line--success";
  return "status-line";
}

export default function ShareLinksAdmin() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadPhase, setUploadPhase] = useState(null);
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const fileInputRef = useRef(null);

  async function loadLinks() {
    try {
      const result = await api.listShareLinks();
      setLinks(result.shareLinks || []);
    } catch (err) {
      setStatus(`Error loading links: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLinks(); }, []);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("Uploading...");
    setUploadProgress(null);
    setUploadPhase("uploading");

    try {
      const result = await api.uploadShareLink(
        file,
        { label: label.trim(), message: message.trim() },
        {
          onProgress: ({ percent }) => setUploadProgress(percent),
          onPhaseChange: (phase) => setUploadPhase(phase),
        }
      );

      if (!result?.shareLink) {
        throw new Error("Unexpected response from server.");
      }

      setLinks((prev) => [result.shareLink, ...prev]);
      setLabel("");
      setMessage("");
      setStatus("Uploaded! Link generated.");
      await copyToClipboard(`${window.location.origin}/share/${result.shareLink.token}`);
    } catch (err) {
      setStatus(`Upload error: ${err.message}`);
    } finally {
      setUploadProgress(null);
      setUploadPhase(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Link copied to clipboard!");
    } catch {
      setStatus(`Link ready: ${text}`);
    }
  }

  async function handleDelete(link) {
    if (pendingDelete !== link.id) {
      setPendingDelete(link.id);
      return;
    }
    try {
      await api.deleteShareLink(link.id);
      setLinks((prev) => prev.filter((l) => l.id !== link.id));
      setStatus("Deleted.");
    } catch (err) {
      setStatus(`Delete error: ${err.message}`);
    } finally {
      setPendingDelete(null);
    }
  }

  const shareUrl = (token) => `${window.location.origin}/share/${token}`;

  return (
    <div className="editor-card delivery-section">
      <div className="delivery-section__header">
        <h2>Share Links</h2>
      </div>

      <section style={{ marginBottom: "2rem" }}>
        <h3 style={{ marginBottom: "0.75rem", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7 }}>New Share Link</h3>
        <div className="delivery-form-grid">
          <label>
            <span>Label</span>
            <input
              value={label}
              placeholder="e.g. Issue 2 for Jordan"
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="delivery-form-grid__full">
            <span>Message (shown on access page)</span>
            <textarea
              rows={3}
              value={message}
              placeholder="Hey! Here's your copy of Issue #2. Hope you enjoy it."
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
        </div>
        <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            className="button-primary"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadPhase != null}
          >
            {uploadPhase ? "Uploading..." : "Choose PDF & Generate Link"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {uploadPhase === "uploading" && uploadProgress != null && (
            <div className="asset-upload-progress" style={{ flex: 1 }}>
              <div
                className="asset-upload-progress__bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          {uploadPhase === "processing" && (
            <span className="status-line">Processing...</span>
          )}
        </div>
        {status ? <p className={statusClass(status)} style={{ marginTop: "0.5rem" }}>{status}</p> : null}
      </section>

      <section>
        <h3 style={{ marginBottom: "0.75rem", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7 }}>
          Active Links {links.length > 0 ? `(${links.length})` : ""}
        </h3>

        {loading ? (
          <p className="status-line">Loading...</p>
        ) : links.length === 0 ? (
          <p className="status-line">No share links yet. Upload a PDF above to create one.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {links.map((link) => (
              <li key={link.id} style={{ background: "var(--surface-2, rgba(255,255,255,0.05))", borderRadius: "6px", padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "0.95rem" }}>{link.label || link.filename}</strong>
                  <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>{formatDate(link.createdAt)} · {formatFileSize(link.fileSize)}</span>
                </div>
                {link.message ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.8, fontStyle: "italic" }}>&ldquo;{link.message}&rdquo;</p>
                ) : null}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                  <button
                    className="button-secondary button-compact"
                    type="button"
                    onClick={() => copyToClipboard(shareUrl(link.token))}
                  >
                    Copy Link
                  </button>
                  <a
                    className="button-secondary button-compact"
                    href={shareUrl(link.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    Preview
                  </a>
                  {pendingDelete === link.id ? (
                    <>
                      <button
                        className="button-secondary button-compact delivery-confirm-yes"
                        type="button"
                        onClick={() => handleDelete(link)}
                      >
                        Confirm Delete
                      </button>
                      <button
                        className="button-secondary button-compact"
                        type="button"
                        onClick={() => setPendingDelete(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="button-secondary button-compact"
                      type="button"
                      onClick={() => handleDelete(link)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
