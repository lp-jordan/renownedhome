import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import InlinePdfReader from "./InlinePdfReader";
import { api } from "../lib/api";
import { createFunnelTracker } from "../lib/funnelAnalytics";
import { useSeo } from "../lib/seo";

const FUNNEL_ID = "read-issue-1";
const DEFAULT_READ_FUNNEL_SETTINGS = {
  tipUrl: "",
  currentIssueNumber: 3,
  totalIssues: 6,
  introHeading: "Before you dive in…",
  introBody: "",
  introImages: [],
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

function SectionHeadingLite({ kicker, title }) {
  return (
    <div className="section-heading">
      {kicker ? <p>{kicker}</p> : null}
      <h2>{title}</h2>
    </div>
  );
}

export default function ReadFunnelPage({ bootstrap }) {
  const issue = findIssue(bootstrap, "/issue-1");
  const teamMembers = sortByOrder(bootstrap.teamMembers || []);
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
    "Read the full first issue of Renowned free — a new case from Jordan Johnson, Azrael Aguiar, and Maja Opacic.",
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
      <VisibilityTrigger onVisible={() => trackSectionView("intro")} className="section-shell read-funnel__intro">
        <p className="issue-hero__eyebrow">Renowned</p>
        <h1>{readFunnel.introHeading}</h1>
        {readFunnel.introBody ? <p className="read-funnel__intro-copy">{readFunnel.introBody}</p> : null}
        {readFunnel.introImages.length ? (
          <div className="read-funnel__intro-photos">
            {readFunnel.introImages.map((url) => (
              <img key={url} src={url} alt="" />
            ))}
          </div>
        ) : null}
      </VisibilityTrigger>

      {teamMembers.length ? (
        <VisibilityTrigger onVisible={() => trackSectionView("team")} className="section-shell read-funnel__team">
          <SectionHeadingLite kicker="The Team" title="Who's behind this" />
          <div className="team-stack team-stack--combined">
            {teamMembers.map((member) => (
              <article key={member.id} className="team-feature">
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

      <VisibilityTrigger onVisible={() => trackSectionView("reader")} className="section-shell read-funnel__reader-section">
        <SectionHeadingLite kicker={issue?.title || "Issue One"} title="Read the full issue" />
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
        <p className="issue-hero__eyebrow">Thanks for reading</p>
        <h2>That&rsquo;s issue one.</h2>
        <p className="read-funnel__cta-copy">
          Renowned is funded issue-by-issue &mdash; six parts total. We&rsquo;re currently working
          on issue {readFunnel.currentIssueNumber} of {readFunnel.totalIssues}. If you want to see
          it through, here&rsquo;s how you can help.
        </p>
        <div className="read-funnel__cta-actions">
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
        <MailingListForm onSubmitted={() => handleCtaClick("mailing")} />
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
      <label htmlFor="read-funnel-email">Get notified when issue 3 drops</label>
      <div className="read-funnel__mailing-row">
        <input
          id="read-funnel-email"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="button-secondary" disabled={status === "submitting"}>
          {status === "submitting" ? "Joining…" : "Join"}
        </button>
      </div>
      {error ? <p className="read-funnel__mailing-error">{error}</p> : null}
    </form>
  );
}
