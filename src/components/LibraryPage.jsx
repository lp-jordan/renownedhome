import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import InlinePdfReader from "./InlinePdfReader";
import { useSeo } from "../lib/seo";

// Library (Phase 5): magic-link, passwordless, email-keyed. Signed-out state
// is an email form that requests a sign-in link; ?token=... in the URL (from
// the email) is exchanged for a session cookie. Signed-in state lists every
// digital issue the email owns, readable in-browser and downloadable.

function getIssueReaderImages(issue) {
  if (!issue) {
    return [];
  }
  const featured = issue.featuredImage || issue.coverImage || issue.heroAssets?.[0] || "";
  return [...new Set([featured, ...(issue.heroAssets || [])].filter(Boolean))];
}

export default function LibraryPage({ bootstrap }) {
  const location = useLocation();
  const navigate = useNavigate();
  const claimToken = new URLSearchParams(location.search).get("token") || "";
  const [state, setState] = useState({ status: claimToken ? "claiming" : "loading" });
  const [readerItem, setReaderItem] = useState(null);
  // Carries a claim-failure message across the token-stripping navigation
  // (which re-runs the effect below and reloads the signed-out state).
  const claimNoticeRef = useRef("");

  useSeo("Your Library - Renowned", "Everything you own, ready to read.", "", true);

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/library", { credentials: "include" });
      if (res.status === 401) {
        setState({ status: "signed-out", notice: claimNoticeRef.current });
        claimNoticeRef.current = "";
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not load your library.");
      }
      setState({ status: "ready", library: data });
    } catch (err) {
      setState({ status: "error", message: err.message });
    }
  }, []);

  // Runs whenever ?token= changes, not just on mount, so in-app navigation to
  // a magic link (e.g. the dev-mode link) claims it too. A successful or
  // failed claim strips the token from the URL, which re-runs this effect and
  // loads the (now signed-in or still signed-out) library.
  useEffect(() => {
    let cancelled = false;

    async function claim() {
      setState({ status: "claiming" });
      try {
        const res = await fetch("/api/library/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: claimToken }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          claimNoticeRef.current = data.error || "This link has expired. Request a new one.";
        }
      } catch {
        claimNoticeRef.current = "Sign-in failed. Request a new link.";
      }
      if (!cancelled) {
        navigate("/library", { replace: true });
      }
    }

    if (claimToken) {
      claim();
    } else {
      loadLibrary();
    }

    return () => {
      cancelled = true;
    };
  }, [claimToken, loadLibrary, navigate]);

  async function handleLogout() {
    await fetch("/api/library/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setState({ status: "signed-out" });
  }

  return (
    <main className="page-stack page-stack--subpage">
      <section className="section-shell section-shell--narrow section-shell--subpage library-shell">
        {state.status === "loading" || state.status === "claiming" ? (
          <div className="state-shell">
            {state.status === "claiming" ? "Signing you in…" : "Loading your library…"}
          </div>
        ) : state.status === "error" ? (
          <div className="empty-state">{state.message}</div>
        ) : state.status === "signed-out" ? (
          <LibraryRequestLink notice={state.notice} />
        ) : (
          <LibraryContents
            library={state.library}
            issues={bootstrap.issues}
            onRead={setReaderItem}
            onLogout={handleLogout}
          />
        )}
      </section>
      {readerItem ? (
        <LibraryReaderOverlay
          item={readerItem}
          issue={bootstrap.issues.find((issue) => issue.id === readerItem.issueId)}
          onClose={() => setReaderItem(null)}
        />
      ) : null}
    </main>
  );
}

function LibraryRequestLink({ notice }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ phase: "idle" });

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }
    setStatus({ phase: "sending" });
    try {
      const res = await fetch("/api/library/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not send the link.");
      }
      setStatus({ phase: "sent", devLink: data.devLink });
    } catch (err) {
      setStatus({ phase: "error", message: err.message });
    }
  }

  if (status.phase === "sent") {
    return (
      <div className="library-signin">
        <h1>Check your email.</h1>
        <p className="library-signin__copy">
          If you've bought from us, a sign-in link is on its way. It works once and expires in 30
          minutes.
        </p>
        {status.devLink ? (
          <p className="library-signin__dev">
            Dev mode (email not configured): <Link to={status.devLink}>open your sign-in link</Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="library-signin">
      <h1>Your issues, easy-peasy.</h1>
      <p className="library-signin__copy">
        Enter the email you used at checkout and we'll send you a sign-in link.
      </p>
      {notice ? <p className="library-signin__notice">{notice}</p> : null}
      <form className="library-signin__form" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="button-primary" disabled={status.phase === "sending"}>
          {status.phase === "sending" ? "Sending…" : "Email Me a Link"}
        </button>
      </form>
      {status.phase === "error" ? <p className="library-signin__notice">{status.message}</p> : null}
    </div>
  );
}

function LibraryContents({ library, issues, onRead, onLogout }) {
  const items = library.items || [];

  return (
    <>
      <div className="library-header">
        <h1>Your Library</h1>
      </div>
      {items.length ? (
        <div className="library-grid">
          {items.map((item) => {
            const issue = issues.find((entry) => entry.id === item.issueId);
            const canRead = Boolean(item.downloadUrl || getIssueReaderImages(issue).length);
            return (
              <article key={item.issueId} className="library-item">
                <div className="library-item__media">
                  {item.coverImage ? (
                    <img src={item.coverImage} alt={`${item.issueTitle} cover`} />
                  ) : (
                    <div className="library-item__placeholder">{item.issueTitle}</div>
                  )}
                </div>
                <p className="library-item__title">{item.issueTitle}</p>
                <div className="library-item__actions">
                  {canRead ? (
                    <button type="button" className="button-primary" onClick={() => onRead(item)}>
                      Read
                    </button>
                  ) : null}
                  {item.downloadUrl ? (
                    <a className="button-secondary" href={item.downloadUrl} download>
                      Download
                    </a>
                  ) : !canRead ? (
                    <p className="library-item__pending">
                      {item.hasAsset ? "Preparing your file — check back shortly." : "File coming soon."}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          Nothing here yet — digital issues you buy will land in this library automatically.
        </div>
      )}
      <div className="library-footer">
        <Link className="button-secondary" to="/shop">
          Shop for More
        </Link>
      </div>
      <p className="library-account">
        {library.email}'s library ·{" "}
        <button type="button" className="library-account__logout" onClick={onLogout}>
          Sign out
        </button>
      </p>
    </>
  );
}

// Same modal shell as the issue reader (Phase 3); the paging surface is
// InlinePdfReader with the owned PDF when we have it, falling back to the
// issue's page images.
function LibraryReaderOverlay({ item, issue, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";

    function handleKeydown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [onClose]);

  const fallbackPages = item.downloadUrl ? [] : getIssueReaderImages(issue).map((url) => ({ url }));

  return (
    <div className="comic-reader comic-reader--redesign comic-reader--chrome-visible">
      <div className="comic-reader__veil" onClick={onClose} />
      <div className="comic-reader__shell">
        <header className="comic-reader__topbar">
          <p>{item.issueTitle}</p>
          <button type="button" className="comic-reader__close" onClick={onClose} aria-label="Close reader">
            Close
          </button>
        </header>
        <div className="comic-reader__stage comic-reader__stage--inline">
          <InlinePdfReader pdfUrl={item.downloadUrl || undefined} pages={fallbackPages} />
        </div>
      </div>
    </div>
  );
}
