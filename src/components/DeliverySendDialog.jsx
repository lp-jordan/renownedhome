import { useEffect, useMemo, useState } from "react";

function describeTarget(target) {
  if (!target) return "";
  if (target.kind === "all-unsent") return "Send to everyone who hasn't been emailed yet";
  if (target.kind === "resend-all") return "Resend to every backer, including already-emailed";
  if (target.kind === "selected") return `Send to ${target.backerIds.length} selected backer${target.backerIds.length === 1 ? "" : "s"}`;
  return "";
}

export default function DeliverySendDialog({
  open,
  target,
  detail,
  coverUrl,
  onClose,
  onSend,
  onTest,
}) {
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [testStatus, setTestStatus] = useState("");

  useEffect(() => {
    if (open) {
      setBusy(false);
      setError("");
      setTestStatus("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !busy) onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const recipients = useMemo(() => {
    if (!detail || !target) return [];
    if (target.kind === "all-unsent") return detail.backers.filter((b) => !b.lastEmailedAt);
    if (target.kind === "resend-all") return detail.backers;
    if (target.kind === "selected") {
      const set = new Set(target.backerIds);
      return detail.backers.filter((b) => set.has(b.id));
    }
    return [];
  }, [detail, target]);

  const sampleRecipients = recipients.slice(0, 5);
  const moreCount = Math.max(recipients.length - sampleRecipients.length, 0);

  if (!open || !detail || !target) return null;

  async function handleSend() {
    setBusy(true);
    setError("");
    try {
      await onSend(target);
    } catch (sendError) {
      setError(sendError?.message || "Send failed.");
      setBusy(false);
    }
  }

  async function handleTest() {
    if (!testTo) {
      setTestStatus("Enter an email first.");
      return;
    }
    setBusy(true);
    setTestStatus("Sending test…");
    setError("");
    try {
      await onTest(testTo);
      setTestStatus(`Test sent to ${testTo}.`);
    } catch (testError) {
      setTestStatus(testError?.message || "Test send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="delivery-dialog" role="dialog" aria-modal="true" aria-label="Send delivery emails">
      <div className="delivery-dialog__backdrop" onClick={busy ? undefined : onClose} />
      <div className="delivery-dialog__panel delivery-dialog__panel--send">
        <div className="delivery-dialog__header">
          <div>
            <p className="editor-header__eyebrow">Send delivery emails</p>
            <h3>{describeTarget(target)}</h3>
          </div>
          <button className="button-secondary" type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>

        <div className="delivery-send-dialog__grid">
          <div className="delivery-send-dialog__panel">
            <span className="delivery-send-dialog__label">Recipients</span>
            <strong className="delivery-send-dialog__count">{recipients.length}</strong>
            {recipients.length ? (
              <ul className="delivery-send-dialog__list">
                {sampleRecipients.map((b) => (
                  <li key={b.id}>{b.email}</li>
                ))}
                {moreCount ? <li>…and {moreCount} more</li> : null}
              </ul>
            ) : (
              <p className="status-line">No recipients match this target.</p>
            )}
          </div>

          <div className="delivery-send-dialog__panel">
            <span className="delivery-send-dialog__label">Email preview</span>
            <div className="delivery-send-dialog__preview">
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" />
              ) : (
                <div className="delivery-send-dialog__cover-placeholder">No cover</div>
              )}
              <div>
                <strong>{detail.project.title}</strong>
                <p>From {detail.project.creatorName}</p>
                {detail.project.shortMessage ? (
                  <p className="delivery-send-dialog__message">{detail.project.shortMessage}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="delivery-send-dialog__test">
          <label>
            <span>Test-send to yourself first</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(event) => setTestTo(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            className="button-secondary button-compact"
            type="button"
            onClick={handleTest}
            disabled={busy || !testTo}
          >
            Send test
          </button>
          {testStatus ? <p className="status-line">{testStatus}</p> : null}
        </div>

        {error ? <p className="delivery-dialog__error">{error}</p> : null}

        <div className="delivery-dialog__actions">
          <button className="button-secondary" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="button-primary"
            type="button"
            onClick={handleSend}
            disabled={busy || !recipients.length}
          >
            {busy ? "Sending…" : `Send ${recipients.length || ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
