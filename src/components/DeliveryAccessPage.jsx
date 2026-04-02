import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useSeo } from "../lib/seo";

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

export default function DeliveryAccessPage() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [access, setAccess] = useState(null);

  useSeo(
    access ? `${access.project.title} - Delivery` : "Comic Delivery",
    access?.project?.description || "Access your delivered comic.",
    "",
    true,
    access?.assets?.coverUrl || ""
  );

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await api.getDeliveryAccess(token);
        setAccess(result);
      } catch (loadError) {
        setError(loadError.message || "This delivery link is unavailable.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  if (loading) {
    return <div className="state-shell">Loading your delivery...</div>;
  }

  if (error || !access) {
    return (
      <main className="delivery-access">
        <section className="delivery-card delivery-card--centered">
          <p className="delivery-access__eyebrow">Delivery Link</p>
          <h1>This link is not available.</h1>
          <p>{error || "The file could not be found."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="delivery-access">
      <section className="delivery-card">
        <div className="delivery-card__media">
          {access.assets.coverUrl ? (
            <img src={access.assets.coverUrl} alt={`${access.project.title} cover`} />
          ) : (
            <div className="delivery-card__placeholder">Cover</div>
          )}
        </div>
        <div className="delivery-card__content">
          <p className="delivery-access__eyebrow">Your Digital Copy Is Ready</p>
          <h1>{access.project.title}</h1>
          <p className="delivery-card__byline">from {access.project.creatorName}</p>
          {access.project.shortMessage ? (
            <p className="delivery-card__message">{access.project.shortMessage}</p>
          ) : null}
          {access.project.description ? (
            <p className="delivery-card__description">{access.project.description}</p>
          ) : null}
          <div className="delivery-card__actions">
            <a className="button-primary" href={access.actions.downloadUrl}>
              Download PDF
            </a>
            <a className="button-secondary" href={access.actions.readUrl} target="_blank" rel="noreferrer">
              Read In Browser
            </a>
          </div>
          {access.file ? (
            <div className="delivery-card__meta">
              <span>{access.file.originalFilename}</span>
              <span>Version {access.file.versionNumber}</span>
              <span>{formatFileSize(access.file.fileSizeBytes)}</span>
            </div>
          ) : null}
          <p className="delivery-card__footnote">
            This link is tied to {access.backer.email}. Save the email if you want easy access
            later.
          </p>
        </div>
      </section>
    </main>
  );
}
