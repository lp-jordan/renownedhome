import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import InlinePdfReader from "./InlinePdfReader";
import { api } from "../lib/api";
import { createFunnelTracker } from "../lib/funnelAnalytics";
import { useSeo } from "../lib/seo";

const FUNNEL_ID = "read-issue-1";
const DEFAULT_READ_FUNNEL_SETTINGS = {
  tipUrl: "",
  howdyText: "Howdy.",
  introHeading: "Hi, I'm Jordan.",
  introBody: "",
  introImage1: "",
  introImage2: "",
  creditLine: "",
  chapterHeading: "Chapter One",
  chapterSubtitle: "",
  endHeading: "The story's not over.",
  endBody: "",
};

function sortByOrder(items) {
  return [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function findIssue(bootstrap, slug) {
  return bootstrap.issues.find((issue) => issue.slug === slug) || null;
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function getIssueFeaturedImage(issue) {
  return issue.featuredImage || issue.coverImage || issue.heroAssets?.[0] || "";
}

function getIssueReaderImages(issue) {
  return uniqueItems([getIssueFeaturedImage(issue), ...(issue.heroAssets || [])]);
}

// Fires onVisible once, the first time this section scrolls into view —
// used purely for funnel drop-off tracking, no visual effect.
function VisibilityTrigger({ onVisible, className = "", children }) {
  const ref = useRef(null);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisibleRef.current?.();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export default function ReadFunnelPage({ bootstrap }) {
  const issue = findIssue(bootstrap, "/issue-1");
  const teamMembers = sortByOrder(bootstrap.teamMembers || []);
  const collaborators = teamMembers.filter((member) => member.id !== "team-jordan");
  const readFunnel = { ...DEFAULT_READ_FUNNEL_SETTINGS, ...(bootstrap.siteSettings?.readFunnel || {}) };
  const readerPages = issue ? getIssueReaderImages(issue).map((url) => ({ url })) : [];

  const trackerRef = useRef(null);
  if (!trackerRef.current) {
    trackerRef.current = createFunnelTracker(FUNNEL_ID);
  }
  const seenSectionsRef = useRef(new Set());
  const mountedAtRef = useRef(Date.now());

  useSeo(
    "Read Renowned #1 Free | Renowned",
    "Read the full first issue of Renowned free — a new case from Jordan Johnson, Azrael Maxim, and Maja Opacic.",
    typeof window !== "undefined" ? `${window.location.origin}/read` : "",
    false,
    issue ? getIssueFeaturedImage(issue) : ""
  );

  useEffect(() => {
    function recordTimeAndFlush() {
      const seconds = Math.round((Date.now() - mountedAtRef.current) / 1000);
      trackerRef.current.track("time_on_page", { seconds });
      trackerRef.current.flush(true);
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        recordTimeAndFlush();
      }
    }
    window.addEventListener("pagehide", recordTimeAndFlush);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", recordTimeAndFlush);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  function trackSectionView(section) {
    if (seenSectionsRef.current.has(section)) {
      return;
    }
    seenSectionsRef.current.add(section);
    trackerRef.current.track("section_view", { section });
  }

  function handleReaderPageChange(page, pageCount) {
    trackerRef.current.track("reader_page", { page, pageCount });
  }

  function handleReaderReady(pageCount) {
    trackerRef.current.track("reader_ready", { pageCount });
  }

  function handleCtaClick(target) {
    trackerRef.current.track("cta_click", { target });
    trackerRef.current.flush(true);
  }

  return (
    <main className="page-stack page-stack--subpage read-funnel">
      <VisibilityTrigger onVisible={() => trackSectionView("intro")} className="section-shell read-funnel__howdy">
        <p>{readFunnel.howdyText}</p>
      </VisibilityTrigger>

      <section className="section-shell read-funnel__personal">
        <div className="read-funnel__personal-copy">
          <h1>{readFunnel.introHeading}</h1>
          {readFunnel.introBody ? <p>{readFunnel.introBody}</p> : null}
        </div>
        {readFunnel.introImage1 || readFunnel.introImage2 ? (
          <div className="read-funnel__personal-photos">
            {readFunnel.introImage1 ? (
              <img className="read-funnel__personal-photo read-funnel__personal-photo--1" src={readFunnel.introImage1} alt="" />
            ) : null}
            {readFunnel.introImage2 ? (
              <img className="read-funnel__personal-photo read-funnel__personal-photo--2" src={readFunnel.introImage2} alt="" />
            ) : null}
          </div>
        ) : null}
      </section>

      {readFunnel.creditLine ? (
        <section className="section-shell read-funnel__credit">
          <p>{readFunnel.creditLine}</p>
        </section>
      ) : null}

      {collaborators.length ? (
        <VisibilityTrigger onVisible={() => trackSectionView("team")} className="section-shell read-funnel__team">
          <div className="team-stack read-funnel__team-row">
            {collaborators.map((member) => (
              <article key={member.id} className="team-feature read-funnel__team-card">
                <img className="team-feature__portrait" src={member.image} alt={member.name} />
                <div className="team-feature__body">
                  <p className="team-feature__eyebrow">{member.role}</p>
                  <h3>{member.name}</h3>
                  <p>{member.bio}</p>
                </div>
              </article>
            ))}
          </div>
        </VisibilityTrigger>
      ) : null}

      <section className="section-shell read-funnel__mailing-strip">
        <MailingListForm onSubmitted={() => handleCtaClick("mailing")} />
      </section>

      <VisibilityTrigger onVisible={() => trackSectionView("reader")} className="section-shell read-funnel__reader-section">
        <div className="read-funnel__reader-heading">
          <h2>{readFunnel.chapterHeading}</h2>
          {readFunnel.chapterSubtitle ? <p>{readFunnel.chapterSubtitle}</p> : null}
        </div>
        {readerPages.length ? (
          <div className="read-funnel__reader">
            <InlinePdfReader
              pages={readerPages}
              onPageChange={handleReaderPageChange}
              onReady={handleReaderReady}
            />
          </div>
        ) : (
          <p className="read-funnel__reader-unavailable">
            This issue isn&rsquo;t ready to read yet &mdash; check back soon.
          </p>
        )}
      </VisibilityTrigger>

      <VisibilityTrigger onVisible={() => trackSectionView("cta")} className="section-shell read-funnel__cta">
        <h2>{readFunnel.endHeading}</h2>
        <div className="read-funnel__cta-row">
          {readFunnel.endBody ? <p className="read-funnel__cta-copy">{readFunnel.endBody}</p> : null}
          <div className="read-funnel__cta-links">
            <Link className="button-primary" to="/shop" onClick={() => handleCtaClick("buy")}>
              Shop the series
            </Link>
            {readFunnel.tipUrl ? (
              <a
                className="button-secondary"
                href={readFunnel.tipUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => handleCtaClick("tip")}
              >
                Tip the team
              </a>
            ) : null}
          </div>
        </div>
      </VisibilityTrigger>
    </main>
  );
}

function MailingListForm({ onSubmitted }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    if (status === "submitting") {
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      await api.submitLead({ email, source: "read-funnel" });
      setStatus("success");
      onSubmitted?.();
    } catch (err) {
      setStatus("error");
      setError(err.message || "Something went wrong.");
    }
  }

  if (status === "success") {
    return <p className="read-funnel__mailing-success">You&rsquo;re on the list &mdash; thank you.</p>;
  }

  return (
    <form className="read-funnel__mailing-form" onSubmit={handleSubmit}>
      <span className="read-funnel__mailing-label">Get notified when issue 3 drops</span>
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="read-funnel__mailing-input"
      />
      <button type="submit" className="button-secondary" disabled={status === "submitting"}>
        {status === "submitting" ? "Joining…" : "Join"}
      </button>
      {error ? <p className="read-funnel__mailing-error">{error}</p> : null}
    </form>
  );
}
