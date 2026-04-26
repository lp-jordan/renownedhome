import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useSeo } from "../lib/seo";

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

export default function ShareAccessPage() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [link, setLink] = useState(null);

  useSeo(
    link ? link.label : "Shared File",
    link?.message || "A file has been shared with you.",
    "",
    true,
    ""
  );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await api.getShareLink(token);
        setLink(result);
      } catch (err) {
        setError(err.message || "This link is invalid or has been removed.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="delivery-shell">
        <div className="delivery-loading">Loading&hellip;</div>
      </div>
    );
  }

  if (error || !link) {
    return (
      <div className="delivery-shell">
        <div className="delivery-not-found">
          <h1>Link not found</h1>
          <p>{error || "This link is invalid or has been removed."}</p>
        </div>
      </div>
    );
  }

  const downloadUrl = `/api/share/${encodeURIComponent(token)}/download`;

  return (
    <div className="delivery-shell">
      <div className="delivery-access-card">
        <h1 className="delivery-access-card__title">{link.label}</h1>

        {link.message ? (
          <p className="delivery-access-card__message">{link.message}</p>
        ) : null}

        <div className="delivery-access-card__files">
          <a
            className="delivery-file-row delivery-file-row--download"
            href={downloadUrl}
            download={link.filename}
          >
            <span className="delivery-file-row__name">{link.filename}</span>
            {link.fileSize ? (
              <span className="delivery-file-row__meta">{formatFileSize(link.fileSize)}</span>
            ) : null}
            <span className="delivery-file-row__action button-primary">Download PDF</span>
          </a>
        </div>
      </div>
    </div>
  );
}
