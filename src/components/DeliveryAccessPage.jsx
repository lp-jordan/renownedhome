import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

function normalizeLinkUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  try {
    return new URL(value).toString();
  } catch {
    // Fall through to site-relative normalization.
  }

  try {
    if (value.startsWith("/")) {
      return new URL(value, window.location.origin).toString();
    }

    if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(value)) {
      return new URL(`https://${value}`).toString();
    }

    return new URL(value.replace(/^\.?\//, ""), `${window.location.origin}/`).toString();
  } catch {
    return value;
  }
}

export default function DeliveryAccessPage() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [access, setAccess] = useState(null);
  const additionalLinkUrl = normalizeLinkUrl(access?.tier?.additionalLinkUrl);

  useSeo(
    access ? `${access.project.title} - Delivery` : "Comic Delivery",
    access?.project?.description || "Access your delivered comics.",
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
          <p className="delivery-access__eyebrow">{access.tier?.name || "Your Delivery"}</p>
          <h1 className="delivery-card__title">{access.project.title}</h1>
          <p className="delivery-card__byline">from {access.project.creatorName}</p>
          {access.tier?.message ? (
            <p className="delivery-card__message">
              <em>{access.tier.message}</em>
            </p>
          ) : null}
          {access.project.description ? (
            <p className="delivery-card__description">{access.project.description}</p>
          ) : null}
          {access.files?.length ? (
            <div className="delivery-mini-list">
              {access.files.map((file) => (
                <div key={file.id} className="delivery-mini-list__item">
                  <strong>{file.originalFilename}</strong>
                  <span>
                    Version {file.versionNumber} | {formatFileSize(file.fileSizeBytes)}
                  </span>
                  <div className="delivery-inline-actions">
                    <a className="button-primary" href={file.actions.downloadUrl}>
                      Download
                    </a>
                    <Link className="button-secondary" to={file.actions.readUrl}>
                      Read In Browser
                    </Link>
                    {additionalLinkUrl ? (
                      <a
                        className="button-secondary"
                        href={additionalLinkUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {access.tier.additionalLinkLabel || "Open Link"}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="delivery-card__footnote">No files are assigned to this tier yet.</p>
          )}
          <p className="delivery-card__footnote">
            This link is tied to {access.backer.email}. Save the email if you want easy access
            later.
          </p>
        </div>
      </section>
    </main>
  );
}
