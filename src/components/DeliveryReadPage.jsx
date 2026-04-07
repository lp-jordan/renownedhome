import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import InlinePdfReader from "./InlinePdfReader";

export default function DeliveryReadPage() {
  const { token = "", fileId = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [access, setAccess] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const result = await api.getDeliveryAccess(token);
        setAccess(result);
      } catch (loadError) {
        setError(loadError.message || "This reader is unavailable.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  const activeFile =
    access?.files?.find((file) => file.id === fileId) || access?.files?.[0] || null;

  if (loading) {
    return <div className="state-shell">Loading your comic...</div>;
  }

  if (error || !activeFile) {
    return (
      <main className="delivery-reader-page delivery-reader-page--empty">
        <section className="delivery-reader-page__card">
          <h1>Reader unavailable</h1>
          <p>{error || "This file could not be loaded."}</p>
          <Link className="button-secondary" to={`/a/${token}`}>
            Back to delivery page
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="delivery-reader-page">
      <div className="delivery-reader-page__header">
        <div>
          <p className="delivery-access__eyebrow">{access?.tier?.name || "Digital Reader"}</p>
          <h1>{activeFile.originalFilename}</h1>
        </div>
        <div className="delivery-reader-page__actions">
          <Link className="button-secondary" to={`/a/${token}`}>
            Back
          </Link>
          <a className="button-primary" href={activeFile.actions.downloadUrl}>
            Download PDF
          </a>
        </div>
      </div>
      <InlinePdfReader
        className="delivery-reader-page__reader"
        pdfUrl={activeFile.actions.readerUrl}
        pages={activeFile.readerPages || []}
      />
    </main>
  );
}
