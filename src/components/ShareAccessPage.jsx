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
    return <div className="state-shell">Loading&hellip;</div>;
  }

  if (error || !link) {
    return (
      <main className="delivery-access">
        <section className="delivery-card delivery-card--centered">
          <p className="delivery-access__eyebrow">Shared File</p>
          <h1>Link not found</h1>
          <p>{error || "This link is invalid or has been removed."}</p>
        </section>
      </main>
    );
  }

  const downloadUrl = `/api/share/${encodeURIComponent(token)}/download`;

  return (
    <main className="delivery-access">
      <section className="delivery-card delivery-card--centered">
        <div className="delivery-card__content">
          <p className="delivery-access__eyebrow">Shared File</p>
          <h1 className="delivery-card__title">{link.label}</h1>
          {link.message ? (
            <p className="delivery-card__message">
              <em>{link.message}</em>
            </p>
          ) : null}
          <div className="delivery-mini-list">
            <div className="delivery-mini-list__item">
              <strong>{link.filename}</strong>
              {link.fileSize ? <span>{formatFileSize(link.fileSize)}</span> : null}
              <div className="delivery-inline-actions">
                <a className="button-primary" href={downloadUrl} download={link.filename}>
                  Download PDF
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
