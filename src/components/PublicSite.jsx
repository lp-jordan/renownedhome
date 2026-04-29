import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { api } from "../lib/api";
import DeliveryAccessPage from "./DeliveryAccessPage";
import ShareAccessPage from "./ShareAccessPage";
import { resolveSeo, usePageSeo, useSeo } from "../lib/seo";

const SWIPE_THRESHOLD = 44;
const ComicPdfPage = lazy(() => import("./ComicPdfPage"));
let hasShownHomeSplashThisVisit = false;

function findPage(bootstrap, slug) {
  return bootstrap.pages.find((page) => page.slug === slug) || null;
}

function findIssue(bootstrap, slug) {
  return bootstrap.issues.find((issue) => issue.slug === slug) || null;
}

function sortByOrder(items) {
  return [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function formatMonth(dateString) {
  if (!dateString) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(dateString));
}

function getIssueLabel(issueSlug, issues) {
  const issue = issues.find((entry) => entry.slug === issueSlug);
  return issue?.title || issueSlug;
}

function uniqueItems(items) {
  return [...new Set(items.filter(Boolean))];
}

function getIssueFeaturedImage(issue) {
  return issue.featuredImage || issue.coverImage || issue.heroAssets?.[0] || "";
}

function getIssueGallery(issue) {
  return uniqueItems(issue.heroAssets || []);
}

function getIssueReaderImages(issue) {
  return uniqueItems([getIssueFeaturedImage(issue), ...getIssueGallery(issue)]);
}

function getIssuePresentationPath(issue) {
  if (!issue) {
    return "/read";
  }

  if (issue.slug === "/one-shot") {
    return "/read/3-10-to-nowhere";
  }

  return `/read${issue.slug}`;
}

const HOME_PANEL_ORDER = ["/read", "/meet", "/letters", "/buy"];
const HOME_PANEL_DEFAULTS = {
  "/read": { label: "Read", href: "/read" },
  "/meet": { label: "Meet", href: "/meet" },
  "/letters": { label: "Letters", href: "/letters" },
  "/buy": { label: "Buy", href: "/buy" },
};

function getHomePanels(page, lettersPage) {
  const panelLookup = Object.fromEntries((page?.content?.panels || []).map((panel) => [panel.href, panel]));

  return HOME_PANEL_ORDER.map((href) => {
    const base = {
      ...HOME_PANEL_DEFAULTS[href],
      ...(panelLookup[href] || {}),
    };

    if (href === "/letters") {
      return {
        ...base,
        image: base.image || lettersPage?.hero.backgroundImage || page?.hero?.backgroundImage,
        layout: "half",
      };
    }

    if (href === "/read") {
      return { ...base, layout: "hero" };
    }

    if (href === "/meet") {
      return { ...base, layout: "half" };
    }

    return { ...base, layout: "footer" };
  }).filter((panel) => panel.href && panel.image);
}

export default function PublicSite({ bootstrap, refreshBootstrap }) {
  const location = useLocation();
  const hideBreadcrumbs =
    location.pathname.startsWith("/a/") || location.pathname.startsWith("/share/");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="site-shell">
      {hideBreadcrumbs ? null : <BreadcrumbBar bootstrap={bootstrap} />}
      <div className="site-shell__content">
        <Routes>
          <Route path="/" element={<HomePage bootstrap={bootstrap} />} />
          <Route path="/buy" element={<BuyPage bootstrap={bootstrap} />} />
          <Route path="/connect" element={<TeamPage bootstrap={bootstrap} routeSlug="/connect" />} />
          <Route path="/meet" element={<TeamPage bootstrap={bootstrap} routeSlug="/meet" />} />
          <Route path="/read" element={<ReadPage bootstrap={bootstrap} />} />
          <Route path="/read/issue-1" element={<IssuePage bootstrap={bootstrap} slug="/issue-1" />} />
          <Route path="/read/issue-2" element={<IssuePage bootstrap={bootstrap} slug="/issue-2" />} />
          <Route path="/read/3-10-to-nowhere" element={<IssuePage bootstrap={bootstrap} slug="/one-shot" />} />
          <Route path="/issue-1" element={<IssuePage bootstrap={bootstrap} slug="/issue-1" />} />
          <Route path="/issue-2" element={<IssuePage bootstrap={bootstrap} slug="/issue-2" />} />
          <Route path="/issue-3" element={<IssuePage bootstrap={bootstrap} slug="/issue-3" />} />
          <Route path="/one-shot" element={<IssuePage bootstrap={bootstrap} slug="/one-shot" />} />
          <Route path="/go" element={<RedirectPage bootstrap={bootstrap} pathName="/go" />} />
          <Route path="/a/:token" element={<DeliveryAccessPage />} />
          <Route path="/share/:token" element={<ShareAccessPage />} />
          <Route
            path="/3-10-to-nowhere"
            element={<RedirectPage bootstrap={bootstrap} pathName="/3-10-to-nowhere" />}
          />
          <Route
            path="/letters"
            element={<LettersPage bootstrap={bootstrap} refreshBootstrap={refreshBootstrap} />}
          />
          <Route path="/correspondence" element={<CorrespondencePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      <SiteFooter footer={bootstrap.siteSettings.footer} />
    </div>
  );
}

function HomePage({ bootstrap }) {
  const page = findPage(bootstrap, "/");
  const settings = bootstrap.siteSettings;
  const [showSplash, setShowSplash] = useState(false);
  const splashWords = settings.homeSplash.subtitle.split(/\s+/).filter(Boolean);
  const SPLASH_WORD_BASE_DELAY = 700;
  const SPLASH_WORD_STAGGER = 320;
  const SPLASH_WORD_IN_DURATION = 420;
  const SPLASH_HOLD_DURATION = 900;
  const SPLASH_OUT_DURATION = 450;
  const splashOutDelay =
    SPLASH_WORD_BASE_DELAY +
    Math.max(splashWords.length - 1, 0) * SPLASH_WORD_STAGGER +
    SPLASH_WORD_IN_DURATION +
    SPLASH_HOLD_DURATION;
  const splashTotalDuration = splashOutDelay + SPLASH_OUT_DURATION;
  const lettersPage = findPage(bootstrap, "/letters");
  const homePanels = getHomePanels(page, lettersPage);
  const featuredLetters = bootstrap.lettersSubmissions.filter((letter) => letter.featured).slice(0, 3);
  usePageSeo(page, { siteSettings: bootstrap.siteSettings });

  useLayoutEffect(() => {
    if (!settings.homeSplash.enabled || hasShownHomeSplashThisVisit) {
      return;
    }

    hasShownHomeSplashThisVisit = true;
    setShowSplash(true);
    const timeout = setTimeout(() => {
      setShowSplash(false);
    }, splashTotalDuration);

    return () => clearTimeout(timeout);
  }, [settings.homeSplash.enabled, splashTotalDuration]);

  return (
    <>
      {showSplash ? (
        <div
          className="splash-screen"
          style={{
            "--splash-out-delay": `${splashOutDelay}ms`,
            "--splash-out-duration": `${SPLASH_OUT_DURATION}ms`,
          }}
        >
          <div className="splash-screen__inner">
            <img src={settings.homeSplash.logoUrl} alt="Renowned splash logo" />
            <p className="splash-screen__subtitle">
              {splashWords.map((word, index) => (
                <span
                  key={`${word}-${index}`}
                  style={{ "--splash-word-delay": `${SPLASH_WORD_BASE_DELAY + index * SPLASH_WORD_STAGGER}ms` }}
                >
                  {word}
                </span>
              ))}
            </p>
          </div>
        </div>
      ) : null}
      <HeroSection hero={page.hero} variant="home" />
      <main className="page-stack">
        <section className="panel-grid panel-grid--home">
          {homePanels.map((panel, index) => (
            <RevealOnScroll key={panel.href} delay={index * 120} className={`panel-slot panel-slot--${panel.layout}`}>
              <Link className={`panel-card panel-card--home panel-card--${panel.layout}`} to={panel.href}>
                <div
                  className="panel-card__image"
                  style={{ backgroundImage: `url(${panel.image})` }}
                />
                <span className="panel-card__label">{panel.label}</span>
              </Link>
            </RevealOnScroll>
          ))}
        </section>
        {featuredLetters.length ? (
          <section className="quote-section">
            <SectionHeading title="Featured Letters" narrow />
            <div className="quote-grid quote-grid--letters">
              {featuredLetters.map((letter, index) => (
                <RevealOnScroll key={letter.id} delay={index * 140}>
                  <LetterCard letter={letter} issues={bootstrap.issues} compact />
                </RevealOnScroll>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

function BuyPage({ bootstrap }) {
  const page = findPage(bootstrap, "/buy");
  const products = sortByOrder(bootstrap.issues).map((issue) => ({
    issue,
    formats: [
      {
        key: "digital",
        label: "Digital",
        href: issue.purchaseLinks?.digital || "",
      },
      {
        key: "physical",
        label: "Physical",
        href: issue.purchaseLinks?.physical || "",
      },
    ],
  }));
  usePageSeo(page, { siteSettings: bootstrap.siteSettings });

  return (
    <main className="page-stack page-stack--subpage">
      <HeroSection hero={page.hero} variant="subpage" />
      <section className="section-shell section-shell--subpage">
        <div className="shop-intro">
          <h2>{page.content.heading}</h2>
          <p>
            Pick an issue, choose digital or physical, and keep the details contained to the item
            itself. This layout is ready to plug into per-format checkout links as soon as the
            store side is in place.
          </p>
        </div>
        <div className="shop-grid shop-grid--catalog">
          {products.map(({ issue, formats }) => (
            <article key={issue.id} className="shop-product">
              <div className="shop-product__media">
                {issue.coverImage ? (
                  <img src={issue.coverImage} alt={`${issue.title} cover`} />
                ) : (
                  <div className="shop-product__placeholder">Cover coming soon</div>
                )}
              </div>
              <div className="shop-product__content">
                <div className="shop-product__header">
                  <p>{issue.shortLabel || issue.title}</p>
                  <h3>{issue.title}</h3>
                </div>
                <p className="shop-product__summary">
                  {issue.seo.description || "A new case from the world of Renowned."}
                </p>
                <div className="shop-product__formats" aria-label={`${issue.title} formats`}>
                  {formats.map((format) => (
                    <div key={format.key} className="shop-format">
                      <div className="shop-format__copy">
                        <span>{format.label}</span>
                        <small>{format.href ? "Available now" : "Coming soon"}</small>
                      </div>
                      {format.href ? (
                        <a
                          className="button-secondary shop-format__button"
                          href={format.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Buy {format.label}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className="button-secondary button-secondary--disabled shop-format__button"
                          disabled
                        >
                          {format.label} Soon
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="section-note">{page.content.footerNote}</p>
      </section>
    </main>
  );
}

function TeamPage({ bootstrap, routeSlug }) {
  const seoPage = findPage(bootstrap, routeSlug);
  const meetPage = findPage(bootstrap, "/meet");
  const connectPage = findPage(bootstrap, "/connect");
  usePageSeo(seoPage || meetPage, { siteSettings: bootstrap.siteSettings });

  return (
    <main className="page-stack page-stack--subpage">
      <HeroSection hero={meetPage.hero} variant="meet" />
      <section className="section-shell section-shell--meet section-shell--subpage">
        <SectionHeading kicker="The Team" title={meetPage.content.heading} />
        <div className="team-stack team-stack--combined">
          {sortByOrder(bootstrap.teamMembers).map((member, index) => (
            <RevealOnScroll key={member.id} delay={index * 120}>
              <article className="team-feature">
                <img className="team-feature__portrait" src={member.image} alt={member.name} />
                <div className="team-feature__body">
                  <p className="team-feature__eyebrow">{member.role}</p>
                  <h3>{member.name}</h3>
                  <p>{member.bio}</p>
                  <div className="team-feature__links">
                    {sortByOrder(
                      bootstrap.socialLinks.filter((link) => link.personName === member.name),
                    ).map((link) => (
                      <a key={link.id} className="team-feature__link" href={link.url} target="_blank" rel="noreferrer">
                        <img src={link.iconUrl} alt={link.label} />
                        <span>{link.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            </RevealOnScroll>
          ))}
        </div>
      </section>
        <section id="headlines" className="section-shell section-shell--narrow section-shell--subpage">
          <div className="newsletter-card newsletter-card--headlines">
            <h3 className="newsletter-card__title">
              {connectPage.content.newsletterCardEyebrow || "The Headlines"}
            </h3>
            <div className="headlines-bar">
              {connectPage.content.newsletterCtaUrl ? (
                <a
                  className="button-secondary headlines-bar__cta"
                  href={connectPage.content.newsletterCtaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {connectPage.content.newsletterCtaLabel || "Subscribe on Substack"}
                </a>
              ) : null}
              <p className="headlines-bar__desc">
                {connectPage.content.newsletterSubtitle || connectPage.content.newsletterCardTitle}
              </p>
            </div>
          </div>
        </section>
    </main>
  );
}

function ReadPage({ bootstrap }) {
  const page = findPage(bootstrap, "/read");
  usePageSeo(page, { siteSettings: bootstrap.siteSettings });
  return (
    <main className="page-stack page-stack--subpage">
      <HeroSection hero={page.hero} variant="subpage" />
      <section className="section-shell section-shell--narrow section-shell--subpage section-shell--story">
        <SectionHeading title={page.content.heading} />
        <p className="body-copy body-copy--centered">{page.content.intro}</p>
      </section>
      <section className="section-shell section-shell--subpage">
        <div className="read-grid">
          {sortByOrder(bootstrap.issues).map((issue) => (
            <Link key={issue.id} className="issue-card" to={getIssuePresentationPath(issue)}>
              <div
                className="issue-card__image"
                style={{ backgroundImage: `url(${getIssueFeaturedImage(issue) || page.hero.backgroundImage})` }}
              />
              <div className="issue-card__content">
                <h3>{issue.shortLabel || issue.title}</h3>
              </div>
            </Link>
          ))}
          <div className="issue-card issue-card--placeholder">
            <div className="issue-card__content">
              <h3>Chapter 3</h3>
              <p>Coming Soon</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function IssuePage({ bootstrap, slug }) {
  const issue = findIssue(bootstrap, slug);
  const [readerState, setReaderState] = useState({ isOpen: false, startPage: 1 });
  if (!issue) {
    return <NotFoundPage />;
  }
  const seo = resolveSeo(issue, { siteSettings: bootstrap.siteSettings });
  useSeo(seo.title, seo.description, seo.canonicalUrl, seo.noindex, seo.ogImage, seo.keywords);
  const synopsis = issue.description.split("\n\n").filter(Boolean);
  const featuredImage = getIssueFeaturedImage(issue);
  const galleryImages = getIssueGallery(issue);
  const readerImages = getIssueReaderImages(issue);
  const hasReader = Boolean(issue.readerPdfUrl || readerImages.length);
  const credits = [
    ["Release", issue.releaseDate || "TBD"],
    ["Writer", issue.writer],
    ["Artist", issue.artist],
    ["Colorist", issue.colorist],
  ].filter(([, value]) => Boolean(value));

  function openReader(startPage = 1) {
    if (!hasReader) {
      return;
    }
    setReaderState({ isOpen: true, startPage });
  }

  return (
    <>
      <main className="page-stack page-stack--issue">
        <section className="issue-hero section-shell">
          <div className="issue-hero__media">
            {featuredImage ? (
              <button
                type="button"
                className={`issue-cover ${hasReader ? "issue-cover--interactive" : ""}`}
                onClick={() => openReader(1)}
                aria-label={hasReader ? `Open ${issue.title} preview` : issue.title}
              >
                <img src={featuredImage} alt={`${issue.title} featured art`} />
              </button>
            ) : (
              <div className="issue-cover issue-cover--placeholder">
                <span>Preview coming soon</span>
              </div>
            )}
          </div>
          <div className="issue-hero__content">
            <p className="issue-hero__eyebrow">{issue.shortLabel || issue.title}</p>
            <h1>{issue.title}</h1>
            <p className="issue-hero__dek">
              {issue.seo.description || synopsis[0] || "A new case from the world of Renowned."}
            </p>
            <div className="issue-hero__actions">
              {hasReader && slug !== "/one-shot" ? (
                <button type="button" className="button-primary" onClick={() => openReader(1)}>
                  {issue.readerLabel || (slug === "/issue-2" ? "Preview Pages" : "Open preview")}
                </button>
              ) : null}
              {issue.previewUrl ? (
                <a className="button-secondary" href={issue.previewUrl} target="_blank" rel="noreferrer">
                  {issue.previewLabel || (slug === "/issue-2" ? "Follow" : "Learn more")}
                </a>
              ) : null}
            </div>
          </div>
        </section>
        <section className="section-shell issue-story">
          <article className="issue-synopsis issue-story__synopsis">
            <SectionHeading kicker="Synopsis" title={issue.shortLabel || issue.title} />
            <div className="body-copy body-copy--issue">
              {synopsis.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </article>
          <section className="issue-meta-card issue-story__credits">
            <p className="issue-meta-card__eyebrow">Credits</p>
            <div className="issue-meta-list">
              {credits.map(([label, value]) => (
                <div key={label} className="issue-meta-list__row">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
        </section>
        {galleryImages.length ? (
          <section className="section-shell issue-gallery-section">
            <div className="issue-gallery">
              {galleryImages.map((asset, index) => {
                const pageNumber = readerImages.indexOf(asset) + 1 || 1;

                return (
                  <button
                    key={`${issue.id}-gallery-${asset}`}
                    type="button"
                    className="issue-gallery__item"
                    onClick={() => openReader(pageNumber)}
                    aria-label={`Open preview page ${pageNumber}`}
                  >
                    <img src={asset} alt="" loading="lazy" />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>
      <ComicReaderOverlay
        title={issue.title}
        isOpen={readerState.isOpen}
        onClose={() => setReaderState((current) => ({ ...current, isOpen: false }))}
        initialPage={readerState.startPage}
        pdfUrl={issue.readerPdfUrl}
        imagePages={readerImages}
      />
    </>
  );
}

function ComicReaderOverlay({ title, isOpen, onClose, initialPage = 1, pdfUrl, imagePages }) {
  const stageRef = useRef(null);
  const touchStartRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageCount, setPageCount] = useState(pdfUrl ? 0 : imagePages.length);
  const [showChrome, setShowChrome] = useState(false);
  const [stageWidth, setStageWidth] = useState(960);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    setCurrentPage(initialPage);
    setShowChrome(false);
    document.body.style.overflow = "hidden";

    function updateStageWidth() {
      if (!stageRef.current) {
        return;
      }
      setStageWidth(Math.max(280, Math.min(stageRef.current.clientWidth - 32, 1120)));
    }

    function handleKeydown(event) {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowRight") {
        setCurrentPage((page) => Math.min(page + 1, pageCount || page + 1));
      }
      if (event.key === "ArrowLeft") {
        setCurrentPage((page) => Math.max(page - 1, 1));
      }
    }

    updateStageWidth();
    window.addEventListener("resize", updateStageWidth);
    window.addEventListener("keydown", handleKeydown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", updateStageWidth);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [initialPage, isOpen, onClose, pageCount]);

  useEffect(() => {
    if (!isOpen || pdfUrl || !imagePages[currentPage]) {
      return undefined;
    }

    const preload = new window.Image();
    preload.src = imagePages[currentPage];
    return () => {
      preload.src = "";
    };
  }, [currentPage, imagePages, isOpen, pdfUrl]);

  useEffect(() => {
    if (!pdfUrl) {
      setPageCount(imagePages.length);
    }
  }, [imagePages.length, pdfUrl]);

  if (!isOpen) {
    return null;
  }

  function goToPrevious() {
    setCurrentPage((page) => Math.max(page - 1, 1));
  }

  function goToNext() {
    setCurrentPage((page) => Math.min(page + 1, pageCount || page + 1));
  }

  function handleTouchStart(event) {
    touchStartRef.current = event.changedTouches[0]?.clientX || null;
  }

  function handleTouchEnd(event) {
    if (touchStartRef.current == null) {
      return;
    }
    const delta = (event.changedTouches[0]?.clientX || 0) - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      setShowChrome((visible) => !visible);
      return;
    }
    if (delta < 0) {
      goToNext();
      return;
    }
    goToPrevious();
  }

  const canGoNext = currentPage < (pageCount || currentPage);
  const preloadPageNumbers = pageCount && currentPage < pageCount ? [currentPage + 1] : [];

  return (
    <div className={`comic-reader ${showChrome ? "comic-reader--chrome-visible" : ""}`}>
      <div className="comic-reader__veil" onClick={onClose} />
      <div className="comic-reader__shell">
        <header className="comic-reader__topbar">
          <p>{title}</p>
          <button type="button" className="comic-reader__close" onClick={onClose} aria-label="Close preview">
            Close
          </button>
        </header>
        <div
          ref={stageRef}
          className="comic-reader__stage"
          onMouseMove={() => setShowChrome(true)}
          onMouseLeave={() => setShowChrome(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            type="button"
            className="comic-reader__nav comic-reader__nav--prev"
            onClick={goToPrevious}
            aria-label="Previous page"
          />
          <button
            type="button"
            className="comic-reader__nav comic-reader__nav--next"
            onClick={goToNext}
            aria-label="Next page"
          />
          <button
            type="button"
            className="comic-reader__center-toggle"
            onClick={() => setShowChrome((visible) => !visible)}
            aria-label="Toggle reader controls"
          />
          <div className="comic-reader__page">
            {pdfUrl ? (
              <Suspense fallback={<ReaderLoading />}>
                <ComicPdfPage
                  pdfFile={pdfUrl}
                  currentPage={currentPage}
                  width={stageWidth}
                  loading={<ReaderLoading />}
                  onLoadSuccess={setPageCount}
                  preloadPageNumbers={preloadPageNumbers}
                />
              </Suspense>
            ) : imagePages[currentPage - 1] ? (
              <img
                className="comic-reader__image"
                src={imagePages[currentPage - 1]}
                alt={`${title} page ${currentPage}`}
              />
            ) : (
              <ReaderLoading />
            )}
          </div>
        </div>
        <footer className="comic-reader__bottombar">
          <button
            type="button"
            className="comic-reader__step"
            onClick={goToPrevious}
            disabled={currentPage <= 1}
          >
            Prev
          </button>
          <div className="comic-reader__status">
            <span>{currentPage}</span>
            <span>/</span>
            <span>{pageCount || "..."}</span>
          </div>
          <button
            type="button"
            className="comic-reader__step"
            onClick={goToNext}
            disabled={!canGoNext}
          >
            Next
          </button>
        </footer>
      </div>
    </div>
  );
}

function ReaderLoading() {
  return (
    <div className="comic-reader__loading">
      <span />
    </div>
  );
}

function LettersPage({ bootstrap, refreshBootstrap }) {
  const page = findPage(bootstrap, "/letters");
  const issues = sortByOrder(bootstrap.issues);
  const publicLetters = [...bootstrap.lettersSubmissions]
    .sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
  const initialVisibleCount = 8;
  const formRef = useRef(null);
  const [formState, setFormState] = useState({
    issueSlug: "",
    message: "",
  });
  const [nameValue, setNameValue] = useState("");
  const [locationValue, setLocationValue] = useState("");
  const [formStatus, setFormStatus] = useState("");
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showAllLetters, setShowAllLetters] = useState(false);
  usePageSeo(page, { siteSettings: bootstrap.siteSettings });

  const visibleLetters = showAllLetters
    ? publicLetters
    : publicLetters.slice(0, initialVisibleCount);

  useEffect(() => {
    if (!showToast) {
      return undefined;
    }

    const timeout = setTimeout(() => setShowToast(false), 2600);
    return () => clearTimeout(timeout);
  }, [showToast]);

  useEffect(() => {
    if (!showCelebration) {
      return undefined;
    }

    const timeout = setTimeout(() => setShowCelebration(false), 1200);
    return () => clearTimeout(timeout);
  }, [showCelebration]);

  async function submitLetter() {
    setIsSubmitting(true);
    setFormStatus("");
    try {
      await api.submitLetter({
        name: nameValue.trim(),
        location: locationValue.trim(),
        email: "",
        issueSlug: formState.issueSlug,
        message: formState.message,
      });
      setFormState({ issueSlug: "", message: "" });
      setNameValue("");
      setLocationValue("");
      setIsNameModalOpen(false);
      setShowCelebration(true);
      setShowToast(true);
      await refreshBootstrap();
    } catch (error) {
      setFormStatus(error.message || "Unable to submit.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenNameModal(event) {
    event.preventDefault();
    setFormStatus("");
    if (!formRef.current?.reportValidity()) {
      return;
    }
    setIsNameModalOpen(true);
  }

  return (
    <>
      <main className="page-stack page-stack--letters">
        <HeroSection
          hero={{
            ...page.hero,
            title: "LETTERS",
            kicker: "",
            intro: "",
            subtitle: "Have thoughts? Leave 'em here.",
          }}
          variant="letters"
        />
        <section className="section-shell section-shell--narrow section-shell--subpage">
          <form ref={formRef} className="letter-composer" onSubmit={handleOpenNameModal}>
            {showCelebration ? (
              <div className="letter-composer__celebration" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, index) => (
                  <span
                    key={index}
                    style={{
                      "--burst-x": `${Math.cos((index / 12) * Math.PI * 2) * 120}px`,
                      "--burst-y": `${Math.sin((index / 12) * Math.PI * 2) * 120}px`,
                      "--burst-delay": `${index * 20}ms`,
                    }}
                  />
                ))}
              </div>
            ) : null}
            <label className="letter-composer__issue">
              <select
                required
                value={formState.issueSlug}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, issueSlug: event.target.value }))
                }
              >
                <option value="">Choose an issue</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.slug}>
                    {issue.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="letter-composer__message">
              <textarea
                required
                rows={10}
                placeholder="Write your letter here..."
                value={formState.message}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, message: event.target.value }))
                }
              />
            </label>
            <div className="letter-composer__actions">
              <button className="button-primary letter-composer__button" type="submit">
                Sign and Send
              </button>
            </div>
            {formStatus ? <p className="status-line status-line--error">{formStatus}</p> : null}
          </form>
        </section>
        <section className="section-shell">
          {publicLetters.length ? (
            <>
              <div className="letters-grid letters-grid--letters-page">
                {visibleLetters.map((letter) => (
                  <LetterCard key={letter.id} letter={letter} issues={issues} compact={!letter.editorReply} />
                ))}
              </div>
              {publicLetters.length > initialVisibleCount ? (
                <div className="letters-grid__more">
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => setShowAllLetters((current) => !current)}
                  >
                    {showAllLetters ? "Show less" : "See more"}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty-state">
              No public letters just yet. The first few will appear here once they have been
              reviewed.
            </div>
          )}
        </section>
      </main>
      <LetterNameModal
        isOpen={isNameModalOpen}
        nameValue={nameValue}
        locationValue={locationValue}
        isSubmitting={isSubmitting}
        onClose={() => {
          if (isSubmitting) {
            return;
          }
          setIsNameModalOpen(false);
        }}
        onConfirm={submitLetter}
        onNameChange={setNameValue}
        onLocationChange={setLocationValue}
      />
      <LetterToast isVisible={showToast} message="your letter's in the mail!" />
    </>
  );
}

function LetterNameModal({
  isOpen,
  nameValue,
  locationValue,
  isSubmitting,
  onClose,
  onConfirm,
  onNameChange,
  onLocationChange,
}) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handleKeydown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeydown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="letter-modal">
      <button type="button" className="letter-modal__veil" onClick={onClose} aria-label="Close modal" />
      <div className="letter-modal__card" role="dialog" aria-modal="true" aria-labelledby="letter-modal-title">
        <h2 id="letter-modal-title">Sign your letter</h2>
        <p>What name and hometown should we put on it?</p>
        <input
          autoFocus
          value={nameValue}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Your name"
        />
        <input
          value={locationValue}
          onChange={(event) => onLocationChange(event.target.value)}
          placeholder="Where ya from"
        />
        <div className="letter-modal__actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={!nameValue.trim() || isSubmitting}
            onClick={onConfirm}
          >
            {isSubmitting ? "Sending..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LetterToast({ isVisible, message }) {
  return (
    <div className={`letter-toast ${isVisible ? "letter-toast--visible" : ""}`} aria-live="polite">
      {message}
    </div>
  );
}

function LetterCard({ letter, issues, compact = false }) {
  const signature = letter.location ? `${letter.name}, ${letter.location}` : letter.name;

  return (
    <article className={`letter-card ${letter.featured ? "letter-card--featured" : ""}`}>
      <div className="letter-card__meta">
        <div className="letter-card__tags">
          <span className="tag">{getIssueLabel(letter.issueSlug, issues)}</span>
        </div>
        <span>{formatMonth(letter.publishedAt || letter.createdAt)}</span>
      </div>
      <div className="letter-card__body">
        <p>{letter.message}</p>
      </div>
      <footer className="letter-card__footer">- {signature}</footer>
      {!compact && letter.editorReply ? (
        <div className="letter-card__reply">
          <p>{letter.editorReply}</p>
        </div>
      ) : null}
    </article>
  );
}

function RedirectPage({ bootstrap, pathName }) {
  const redirect = bootstrap.redirects.find((entry) => entry.sourcePath === pathName);

  useEffect(() => {
    if (redirect?.destination) {
      window.location.replace(redirect.destination);
    }
  }, [redirect]);

  if (!redirect) {
    return <NotFoundPage />;
  }

  return (
    <div className="state-shell">
      Redirecting to <a href={redirect.destination}>{redirect.destination}</a>...
    </div>
  );
}

function NotFoundPage() {
  useSeo("Not Found - Renowned", "Page not found.", "", true, "");
  return (
    <div className="state-shell">
      <h1>Not found</h1>
      <p>The page you requested does not exist.</p>
      <Link className="button-primary" to="/">
        Back home
      </Link>
    </div>
  );
}

function HeroSection({ hero, variant }) {
  const className = `hero hero--standard hero--${variant}`;
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    if (!hero.backgroundImage) {
      return undefined;
    }

    const mobileQuery = window.matchMedia("(max-width: 700px)");

    function handleScroll() {
      if (mobileQuery.matches) {
        setParallaxOffset(0);
        return;
      }

      const node = heroRef.current;
      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      const offset = Math.max(-120, Math.min(120, rect.top * -0.18));
      setParallaxOffset(offset);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    mobileQuery.addEventListener("change", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      mobileQuery.removeEventListener("change", handleScroll);
    };
  }, [hero.backgroundImage]);

  return (
    <section className={className} ref={heroRef}>
      <div
        className="hero__background"
        style={{
          backgroundImage: hero.backgroundImage ? `url(${hero.backgroundImage})` : "none",
          transform: `translate3d(0, ${parallaxOffset}px, 0) scale(1.1)`,
        }}
      />
      <div className="hero__scrim" />
      <div className="hero__content hero__content--centered">
        {hero.kicker ? <p className="hero__kicker">{hero.kicker}</p> : null}
        {hero.titleImage ? (
          <img className="hero__logo" src={hero.titleImage} alt={hero.title} />
        ) : (
          <h1>{hero.title}</h1>
        )}
        {hero.subtitle ? <p className="hero__subtitle hero__subtitle--brand">{hero.subtitle}</p> : null}
        {hero.intro ? <p className="hero__lede">{hero.intro}</p> : null}
        {hero.ctaUrl ? (
          <a
            className="button-primary"
            href={hero.ctaUrl}
            target={hero.ctaUrl.startsWith("#") ? undefined : "_blank"}
            rel={hero.ctaUrl.startsWith("#") ? undefined : "noreferrer"}
          >
            {hero.ctaLabel}
          </a>
        ) : null}
      </div>
    </section>
  );
}

function SectionHeading({ title, kicker, narrow = false }) {
  return (
    <div className={`section-heading ${narrow ? "section-heading--narrow" : ""}`}>
      {kicker ? <p>{kicker}</p> : null}
      <h2>{title}</h2>
    </div>
  );
}

function SiteFooter({ footer }) {
  return (
    <footer className="site-footer">
      <p>{footer?.copyright}</p>
      <p>{footer?.email}</p>
    </footer>
  );
}

function BreadcrumbBar({ bootstrap }) {
  const location = useLocation();
  const currentIssue = bootstrap.issues.find((issue) => {
    const presentationPath = getIssuePresentationPath(issue);
    return (
      location.pathname === issue.slug ||
      location.pathname === presentationPath ||
      (issue.slug === "/one-shot" && location.pathname === "/3-10-to-nowhere")
    );
  });

  if (currentIssue) {
    const crumbs = [
      { label: "HOME", href: "/" },
      { label: "READ", href: "/read" },
      { label: currentIssue.title.toUpperCase(), href: getIssuePresentationPath(currentIssue) },
    ];

    return (
      <nav className="breadcrumb-bar" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={crumb.href} className="breadcrumb-bar__item">
              {isLast ? (
                <span className="breadcrumb-bar__current">{crumb.label}</span>
              ) : (
                <Link to={crumb.href}>{crumb.label}</Link>
              )}
              {!isLast ? <span className="breadcrumb-bar__sep">/</span> : null}
            </span>
          );
        })}
      </nav>
    );
  }

  const parts = location.pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "HOME", href: "/" }];

  let currentPath = "";
  for (const part of parts) {
    currentPath += `/${part}`;
    crumbs.push({
      label: part.replace(/-/g, " ").toUpperCase(),
      href: currentPath,
    });
  }

  return (
    <nav className="breadcrumb-bar" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="breadcrumb-bar__item">
            {isLast ? (
              <span className="breadcrumb-bar__current">{crumb.label}</span>
            ) : (
              <Link to={crumb.href}>{crumb.label}</Link>
            )}
            {!isLast ? <span className="breadcrumb-bar__sep">/</span> : null}
          </span>
        );
      })}
    </nav>
  );
}

function CorrespondencePage() {
  const fileInputRef = useRef(null);
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!showCelebration) {
      return undefined;
    }
    const timeout = setTimeout(() => setShowCelebration(false), 1200);
    return () => clearTimeout(timeout);
  }, [showCelebration]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError("");
  }

  function handleRetake() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setImageFile(null);
    setPreviewUrl(null);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!imageFile || !name.trim() || !location.trim()) {
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      await api.submitCorrespondence({
        imageFile,
        name: name.trim(),
        location: location.trim(),
      });
      setShowCelebration(true);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Unable to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="page-stack page-stack--subpage">
        <section className="section-shell section-shell--narrow section-shell--subpage correspondence-shell">
          <div className="correspondence-success">
            {showCelebration ? (
              <div className="letter-composer__celebration" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, index) => (
                  <span
                    key={index}
                    style={{
                      "--burst-x": `${Math.cos((index / 12) * Math.PI * 2) * 120}px`,
                      "--burst-y": `${Math.sin((index / 12) * Math.PI * 2) * 120}px`,
                      "--burst-delay": `${index * 20}ms`,
                    }}
                  />
                ))}
              </div>
            ) : null}
            <h1>Reader Correspondence</h1>
            <p className="correspondence-success__message">Received. Thank you.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-stack page-stack--subpage">
      <section className="section-shell section-shell--narrow section-shell--subpage correspondence-shell">
        <h1>Reader Correspondence</h1>
        <form className="letter-composer correspondence-composer" onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="correspondence-file-input"
            onChange={handleFileChange}
            aria-label="Photograph your submission"
          />
          <button
            type="button"
            className={`correspondence-scan-zone ${previewUrl ? "correspondence-scan-zone--captured" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            aria-label={previewUrl ? "Retake photo" : "Photograph your submission"}
          >
            {previewUrl ? (
              <img
                className="correspondence-scan-zone__preview"
                src={previewUrl}
                alt="Your submission preview"
              />
            ) : (
              <div className="correspondence-scan-zone__prompt">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span>Photograph your submission</span>
              </div>
            )}
          </button>
          {previewUrl ? (
            <button
              type="button"
              className="correspondence-retake"
              onClick={handleRetake}
            >
              Retake
            </button>
          ) : null}
          <label className="letter-composer__issue correspondence-field">
            <input
              required
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </label>
          <label className="letter-composer__issue correspondence-field">
            <input
              required
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Where ya from"
            />
          </label>
          <div className="letter-composer__actions">
            <button
              className="button-primary letter-composer__button"
              type="submit"
              disabled={!imageFile || !name.trim() || !location.trim() || isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Submit"}
            </button>
          </div>
          {error ? <p className="status-line status-line--error">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

function RevealOnScroll({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal-on-scroll ${className} ${isVisible ? "is-visible" : ""}`.trim()}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
