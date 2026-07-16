import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { api } from "../lib/api";
import InlinePdfReader from "./InlinePdfReader";
import DeliveryAccessPage from "./DeliveryAccessPage";
import ShareAccessPage from "./ShareAccessPage";
import OrderDeliveryPage from "./OrderDeliveryPage";
import CheckoutReturnPage from "./CheckoutReturnPage";
import LibraryPage from "./LibraryPage";
import { CartButton, CartDrawer, CartPage, CartProvider, useCart } from "./Cart";
import SystemPage from "./SystemPage";
import { resolveSeo, usePageSeo, useSeo } from "../lib/seo";

const SWIPE_THRESHOLD = 44;
const HOME_CAROUSEL_AUTO_ROTATE_MS = 6000;
const HOME_SPLASH_SEEN_KEY = "renowned:homeSplashSeen";

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

// Shop card grid (redesign flag only, Phase 2): the card headline price drops
// a trailing ".00" for a cleaner "$8" vs. the panel's full "$8.00".
function formatSimplePrice(display) {
  if (!display) {
    return "";
  }
  return display.replace(/\.00$/, "");
}

// The issue the sales-forward home leads with: the first purchasable issue in
// run order, falling back to the first issue if nothing is sellable yet.
function getFlagshipIssue(issues) {
  const ordered = sortByOrder(issues);
  const sellable = ordered.find((issue) => {
    const shop = issue.shop || {};
    return Boolean(shop.digitalPriceId || shop.physicalPriceId || shop.externalUrl);
  });
  return sellable || ordered[0] || null;
}

// The issue behind the homepage hero background. An editor can pin one via
// the "isFlagship" toggle in the admin Products list; otherwise this falls
// back to getFlagshipIssue's sellable-first pick. Deliberately separate from
// getFlagshipIssue so the toggle only affects the hero background, not the
// carousel's starting slide (which still uses getFlagshipIssue directly).
function getHeroBackgroundIssue(issues) {
  const ordered = sortByOrder(issues);
  const pinned = ordered.find((issue) => issue.isFlagship);
  return pinned || getFlagshipIssue(issues);
}

function getIssueGallery(issue) {
  return uniqueItems(issue.heroAssets || []);
}

function getIssueReaderImages(issue) {
  return uniqueItems([getIssueFeaturedImage(issue), ...getIssueGallery(issue)]);
}

export default function PublicSite({ bootstrap, refreshBootstrap }) {
  const location = useLocation();
  const hideBreadcrumbs =
    location.pathname.startsWith("/a/") ||
    location.pathname.startsWith("/share/") ||
    location.pathname.startsWith("/order/") ||
    location.pathname.startsWith("/checkout/return");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <CartProvider issues={bootstrap.issues} bundle={bootstrap.bundle}>
      <div className="site-shell">
      {hideBreadcrumbs ? null : <BreadcrumbBar bootstrap={bootstrap} />}
      <div className="site-shell__content">
        <Routes>
          <Route path="/" element={<HomePage bootstrap={bootstrap} />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="/shop" element={<ShopPage bootstrap={bootstrap} />} />
          <Route path="/cart" element={<CartPage issues={bootstrap.issues} bundle={bootstrap.bundle} />} />
          <Route path="/library" element={<LibraryPage bootstrap={bootstrap} />} />
          <Route path="/connect" element={<TeamPage bootstrap={bootstrap} routeSlug="/connect" />} />
          <Route path="/meet" element={<TeamPage bootstrap={bootstrap} routeSlug="/meet" />} />
          <Route path="/read" element={<RedirectPage bootstrap={bootstrap} pathName="/read" />} />
          <Route path="/issue-1" element={<IssuePage bootstrap={bootstrap} slug="/issue-1" />} />
          <Route path="/issue-2" element={<IssuePage bootstrap={bootstrap} slug="/issue-2" />} />
          <Route path="/issue-3" element={<IssuePage bootstrap={bootstrap} slug="/issue-3" />} />
          <Route path="/one-shot" element={<IssuePage bootstrap={bootstrap} slug="/one-shot" />} />
          <Route path="/go" element={<RedirectPage bootstrap={bootstrap} pathName="/go" />} />
          <Route path="/a/:token" element={<DeliveryAccessPage />} />
          <Route path="/share/:token" element={<ShareAccessPage />} />
          <Route path="/order/:token" element={<OrderDeliveryPage />} />
          <Route path="/checkout/return" element={<CheckoutReturnPage />} />
          <Route
            path="/3-10-to-nowhere"
            element={<RedirectPage bootstrap={bootstrap} pathName="/3-10-to-nowhere" />}
          />
          <Route
            path="/read/issue-1"
            element={<RedirectPage bootstrap={bootstrap} pathName="/read/issue-1" />}
          />
          <Route
            path="/read/issue-2"
            element={<RedirectPage bootstrap={bootstrap} pathName="/read/issue-2" />}
          />
          <Route
            path="/read/3-10-to-nowhere"
            element={<RedirectPage bootstrap={bootstrap} pathName="/read/3-10-to-nowhere" />}
          />
          <Route
            path="/letters"
            element={<LettersPage bootstrap={bootstrap} refreshBootstrap={refreshBootstrap} />}
          />
          <Route path="/correspondence" element={<CorrespondencePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      <SiteFooter footer={bootstrap.siteSettings.footer} connectPage={findPage(bootstrap, "/connect")} />
      <CartDrawer issues={bootstrap.issues} bundle={bootstrap.bundle} />
      </div>
    </CartProvider>
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
  const featuredLetters = bootstrap.lettersSubmissions.filter((letter) => letter.featured).slice(0, 3);
  const homeLeadBackground = getIssueFeaturedImage(getHeroBackgroundIssue(bootstrap.issues) || {}) || page.hero.backgroundImage;
  usePageSeo(page, { siteSettings: bootstrap.siteSettings });

  useLayoutEffect(() => {
    if (!settings.homeSplash.enabled || localStorage.getItem(HOME_SPLASH_SEEN_KEY) === "1") {
      return;
    }

    localStorage.setItem(HOME_SPLASH_SEEN_KEY, "1");
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
      <section className="home-lead">
        <div
          className="home-lead__bg"
          style={{ backgroundImage: homeLeadBackground ? `url(${homeLeadBackground})` : "none" }}
        />
        <div className="home-lead__scrim" />
        <div className="home-lead__content">
          <div className="home-brand">
            {page.hero.titleImage ? (
              <img className="home-brand__logo" src={page.hero.titleImage} alt={page.hero.title} />
            ) : (
              <h1 className="home-brand__title">{page.hero.title}</h1>
            )}
            {page.hero.subtitle ? (
              <p className="home-brand__subtitle">{page.hero.subtitle}</p>
            ) : null}
            <Link className="button-primary home-brand__cta" to="/shop">
              Shop the Series
            </Link>
          </div>
        </div>
      </section>
      <main className="page-stack">
        <HomeCarousel issues={bootstrap.issues} />
        <FeaturedLettersSection
          title="Letters from Readers"
          letters={featuredLetters}
          issues={bootstrap.issues}
          alwaysShow
          writeCtaHref="/letters"
        />
      </main>
    </>
  );
}

function FeaturedLettersSection({ title, letters, issues, alwaysShow = false, writeCtaHref }) {
  if (!letters.length && !alwaysShow) {
    return null;
  }

  return (
    <section className="quote-section">
      <SectionHeading title={title} narrow />
      {letters.length ? (
        <div className="quote-grid quote-grid--letters">
          {letters.map((letter, index) => (
            <RevealOnScroll key={letter.id} delay={index * 140}>
              <LetterCard letter={letter} issues={issues} compact />
            </RevealOnScroll>
          ))}
        </div>
      ) : null}
      {writeCtaHref ? (
        <div className="quote-section__cta">
          <Link className="button-secondary" to={writeCtaHref}>
            Write a Letter
          </Link>
        </div>
      ) : null}
    </section>
  );
}

// Sales-forward home carousel (redesign flag only): a single centered card —
// eyebrow, 16:9 cover, description, Add-to-cart + Explore-the-series, dot
// controls. Replaces the old three-panel Buy/Meet/Letters grid on this path;
// the CTA adds to the cart (Phase 4) instead of redirecting to Stripe.
function HomeCarousel({ issues }) {
  const cart = useCart();
  const slides = sortByOrder(issues).filter((issue) => issue.status !== "draft");
  const flagship = getFlagshipIssue(issues);
  const [index, setIndex] = useState(() => {
    const flagshipIndex = slides.findIndex((slide) => slide.id === flagship?.id);
    return flagshipIndex >= 0 ? flagshipIndex : 0;
  });
  const touchStartRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);
  // 0..1 through the current slide's dwell time. A single timer drives both
  // auto-advance and the progress bar's fill so they can never drift out of
  // sync. Pausing (hover) just stops accumulating elapsed time; resuming
  // continues from the same value instead of restarting the interval — no
  // reset-storms from hover in/out, and nothing to get "stuck".
  const [progress, setProgress] = useState(0);
  const count = slides.length;

  function goTo(next) {
    setIndex(((next % count) + count) % count);
    setProgress(0);
  }

  useEffect(() => {
    if (count <= 1 || isPaused) {
      return undefined;
    }
    let lastTick = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;
      setProgress((prev) => {
        const next = prev + delta / HOME_CAROUSEL_AUTO_ROTATE_MS;
        if (next >= 1) {
          setIndex((current) => (current + 1) % count);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [count, isPaused]);

  function handleTouchStart(event) {
    touchStartRef.current = event.changedTouches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event) {
    if (touchStartRef.current == null) {
      return;
    }
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartRef.current;
    touchStartRef.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) {
      return;
    }
    goTo(delta < 0 ? index + 1 : index - 1);
  }

  if (!count) {
    return null;
  }

  const issue = slides[index];
  const shop = issue.shop || {};
  const hasDigital = Boolean(shop.digitalPriceId);
  const hasPhysical = Boolean(shop.physicalPriceId);
  const hasExternal = Boolean(shop.externalUrl);
  const hasCheckout = hasDigital || hasPhysical;
  const format = hasDigital ? "digital" : "physical";
  const price = shop.digitalPrice || shop.physicalPrice || "";
  const cover = getIssueFeaturedImage(issue);
  const hook = issue.homeHook || (issue.description || "").split(/\n+/)[0];

  return (
    <section
      className="home-carousel"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div key={index} className="home-carousel__slide">
        <p className="home-carousel__eyebrow">
          {issue.shortLabel || issue.title} · {hasCheckout || hasExternal ? "Out Now" : "Coming Soon"}
        </p>
        <Link className="home-carousel__cover" to={issue.slug} aria-label={`View ${issue.title}`}>
          {cover ? (
            <img
              src={cover}
              alt={`${issue.title} cover`}
              style={Number.isFinite(issue.carouselFocalY) ? { objectPosition: `center ${issue.carouselFocalY}%` } : undefined}
            />
          ) : null}
        </Link>
        <p className="home-carousel__desc">{hook}</p>
        <div className="home-carousel__actions">
          {hasCheckout ? (
            <button
              type="button"
              className="button-primary home-carousel__buy"
              onClick={() => cart.addItem(issue.id, format)}
            >
              {`Add to Cart${price ? ` — ${price}` : ""}`}
            </button>
          ) : hasExternal ? (
            <a className="button-primary home-carousel__buy" href={shop.externalUrl} target="_blank" rel="noreferrer">
              Get it
            </a>
          ) : (
            <button type="button" className="button-secondary button-secondary--disabled home-carousel__buy" disabled>
              Coming soon
            </button>
          )}
          <Link className="button-secondary home-carousel__explore" to="/shop">
            Explore the series
          </Link>
        </div>
      </div>
      {count > 1 ? (
        <>
          <div className="home-carousel__progress" style={{ "--dot-count": count }}>
            <div
              className="home-carousel__progress-fill"
              style={{ width: `${Math.min(progress, 1) * 100}%` }}
            />
          </div>
          <div className="home-carousel__dots">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                className={`home-carousel__dot ${slideIndex === index ? "is-active" : ""}`}
                onClick={() => goTo(slideIndex)}
                aria-label={`Go to ${slide.title}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function ShopPage({ bootstrap }) {
  const page = findPage(bootstrap, "/shop");
  const allIssues = sortByOrder(bootstrap.issues).filter((issue) => issue.shop?.listedInShop);
  const bundle = bootstrap.bundle;
  const [activeProductId, setActiveProductId] = useState(null);

  usePageSeo(page, { siteSettings: bootstrap.siteSettings });

  const activeProduct =
    activeProductId === "bundle"
      ? { kind: "bundle", bundle }
      : activeProductId
        ? { kind: "issue", issue: allIssues.find((issue) => issue.id === activeProductId) }
        : null;

  return (
    <main className="page-stack page-stack--subpage page-stack--shop">
      <HeroSection hero={page.hero} variant="subpage" />
      <section className="section-shell section-shell--subpage section-shell--shop">
        <div className="shop-card-grid">
          {bundle ? (
            <ShopCard kind="bundle" bundle={bundle} onSelect={() => setActiveProductId("bundle")} />
          ) : null}
          {allIssues.map((issue) => (
            <ShopCard
              key={issue.id}
              kind="issue"
              issue={issue}
              onSelect={() => setActiveProductId(issue.id)}
            />
          ))}
        </div>
        <ShopDetailPanel product={activeProduct} onClose={() => setActiveProductId(null)} />
      </section>
    </main>
  );
}

// Shop card (redesign flag only, Phase 2): small portrait card — cover, title,
// simple price. Click opens ShopDetailPanel, which owns the format toggle and
// the actual buy action.
function ShopCard({ kind, issue, bundle, onSelect }) {
  const isBundle = kind === "bundle";
  const shop = issue?.shop || {};
  const usingDigital = isBundle ? true : Boolean(shop.digitalPrice);
  const rawPrice = isBundle ? bundle?.digitalPrice : usingDigital ? shop.digitalPrice : shop.physicalPrice;
  const rawBasePrice = isBundle ? bundle?.digitalBasePrice : usingDigital ? shop.digitalBasePrice : shop.physicalBasePrice;
  const onSale = isBundle ? Boolean(bundle?.digitalOnSale) : Boolean(usingDigital ? shop.digitalOnSale : shop.physicalOnSale);
  const simplePrice = formatSimplePrice(rawPrice);
  const priceLabel = simplePrice || (isBundle ? "Coming soon" : shop.externalUrl ? "Available" : "Coming soon");
  const title = isBundle ? bundle?.title || "The Complete Run" : issue.title;
  const cover = isBundle ? null : issue.coverImage;

  return (
    <button
      type="button"
      className={`shop-card ${isBundle ? "shop-card--bundle" : ""}`}
      onClick={onSelect}
    >
      <div className="shop-card__media">
        {cover ? (
          <img src={cover} alt={`${title} cover`} />
        ) : (
          <div className="shop-card__placeholder">{isBundle ? "Complete Run" : "Cover coming soon"}</div>
        )}
        {isBundle ? <span className="shop-card__badge">Bundle</span> : null}
        {onSale ? <span className="shop-card__badge shop-card__badge--sale">Sale</span> : null}
      </div>
      <p className="shop-card__title">{title}</p>
      <p className="shop-card__price">
        {onSale && rawBasePrice ? <s className="shop-card__price-base">{formatSimplePrice(rawBasePrice)}</s> : null}
        {priceLabel}
      </p>
    </button>
  );
}

// Shop detail panel (redesign flag only, Phase 2): right-rail panel on desktop,
// bottom sheet on mobile (see .shop-panel in redesign.css). Owns the format
// toggle (ShopFormatToggle) and the add-to-cart action; the bundle side adds
// one real bundle SKU to the cart (its own Stripe price, admin-configured).
function ShopDetailPanel({ product, onClose }) {
  const cart = useCart();
  const isOpen = Boolean(product);
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previouslyFocusedRef.current = document.activeElement;
    closeButtonRef.current?.focus();
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable.length) {
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      // Only restore focus if we're still on this page (panel closed via
      // Escape/backdrop/close button) — if the panel is unmounting because
      // a Link inside it navigated to a new route, the trigger element may
      // already be gone, and focusing it mid-transition can cause a visible
      // scroll/focus jump back toward the old page.
      if (previouslyFocusedRef.current?.isConnected) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const isBundle = product.kind === "bundle";
  const issue = product.issue;
  const bundle = product.bundle;
  const includedCount = bundle?.includedIssueIds?.length || 0;
  const bundlePurchasable = isBundle && Boolean(bundle?.digitalPriceId);

  function addBundleToCart() {
    cart.addBundle(bundle.id);
    onClose();
  }

  return (
    <div className="shop-panel__backdrop" onClick={onClose}>
      <div
        className="shop-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isBundle ? bundle?.title || "The Complete Run" : issue.title}
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
      >
        <button
          type="button"
          className="shop-panel__close"
          onClick={onClose}
          ref={closeButtonRef}
          aria-label="Close"
        >
          &times;
        </button>
        <div className="shop-panel__media">
          {isBundle ? (
            <div className="shop-panel__placeholder">Complete Run</div>
          ) : issue.coverImage ? (
            <img src={issue.coverImage} alt={`${issue.title} cover`} />
          ) : (
            <div className="shop-panel__placeholder">Cover coming soon</div>
          )}
        </div>
        <div className="shop-panel__content">
          <p className="shop-panel__eyebrow">{isBundle ? "Bundle" : issue.shortLabel || issue.title}</p>
          <h3>{isBundle ? bundle?.title || "The Complete Run" : issue.title}</h3>
          <p className="shop-panel__summary">
            {isBundle
              ? includedCount > 1
                ? `All ${includedCount} issues in one checkout.`
                : "The full run in one checkout."
              : issue.seo?.description || "A new case from the world of Renowned."}
          </p>
          <div className="shop-panel__formats">
            {isBundle ? (
              bundlePurchasable ? (
                <div className="shop-format shop-format--toggle">
                  <div className="shop-format__copy">
                    <span>
                      {bundle.digitalOnSale && bundle.digitalBasePrice ? (
                        <>
                          <s>{bundle.digitalBasePrice}</s> {bundle.digitalPrice}
                        </>
                      ) : (
                        bundle.digitalPrice
                      )}
                      {" · "}
                      {includedCount} issue{includedCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button type="button" className="button-primary shop-format__button" onClick={addBundleToCart}>
                    Add the Run to Cart
                  </button>
                </div>
              ) : (
                <div className="shop-format shop-format--toggle">
                  <div className="shop-format__copy">
                    <span>Coming soon</span>
                  </div>
                  <button
                    type="button"
                    className="button-secondary button-secondary--disabled shop-format__button"
                    disabled
                  >
                    Notify Me
                  </button>
                </div>
              )
            ) : (
              <ShopFormatToggle issue={issue} />
            )}
          </div>
          {!isBundle ? (
            <Link className="shop-panel__more-info" to={issue.slug}>
              {issue.isFree ? "Read Free" : "More info"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// Per-card format toggle (redesign flag only, Phase 2): one price + one CTA
// instead of a stacked Buy Digital / Buy Physical pair. As of Phase 4 the CTA
// is a real add-to-cart (opens the cart drawer); checkout happens from the cart.
// Below this many remaining, show the count as an urgency nudge; at 0, the
// format is sold out but still shown (disabled) rather than hidden, so a
// buyer who wanted it knows a print run existed.
const LOW_STOCK_THRESHOLD = 5;

function ShopFormatToggle({ issue }) {
  const cart = useCart();
  const shop = issue.shop || {};
  const physicalStock = shop.physicalStock;
  const physicalSoldOut = typeof physicalStock === "number" && physicalStock <= 0;
  const physicalLowStock =
    typeof physicalStock === "number" && physicalStock > 0 && physicalStock <= LOW_STOCK_THRESHOLD
      ? physicalStock
      : null;
  const formats = [
    shop.digitalPriceId && {
      key: "digital",
      label: "Digital",
      price: shop.digitalPrice,
      basePrice: shop.digitalOnSale ? shop.digitalBasePrice : null,
    },
    shop.physicalPriceId && {
      key: "physical",
      label: "Physical",
      price: shop.physicalPrice,
      basePrice: shop.physicalOnSale ? shop.physicalBasePrice : null,
      soldOut: physicalSoldOut,
      lowStock: physicalLowStock,
    },
  ].filter(Boolean);
  const [selectedKey, setSelectedKey] = useState(formats[0]?.key);
  const hasExternal = Boolean(shop.externalUrl);

  if (!formats.length) {
    if (hasExternal) {
      return (
        <div className="shop-format shop-format--toggle">
          <div className="shop-format__copy">
            <span>Available</span>
          </div>
          <a className="button-primary shop-format__button" href={shop.externalUrl} target="_blank" rel="noreferrer">
            Get it
          </a>
        </div>
      );
    }
    return (
      <div className="shop-format shop-format--toggle">
        <div className="shop-format__copy">
          <span>Coming soon</span>
        </div>
        <button type="button" className="button-secondary button-secondary--disabled shop-format__button" disabled>
          Soon
        </button>
      </div>
    );
  }

  const current = formats.find((format) => format.key === selectedKey) || formats[0];

  return (
    <div className="shop-format shop-format--toggle">
      {formats.length > 1 ? (
        <div className="format-toggle" role="group" aria-label={`${issue.title} format`}>
          {formats.map((format) => (
            <button
              key={format.key}
              type="button"
              className={`format-toggle__option ${format.key === current.key ? "format-toggle__option--active" : ""} ${format.soldOut ? "format-toggle__option--soldout" : ""}`}
              aria-pressed={format.key === current.key}
              disabled={format.soldOut}
              onClick={() => setSelectedKey(format.key)}
            >
              {format.soldOut ? `${format.label} — Sold out` : format.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="shop-format__copy">
          <span>{current.soldOut ? `${current.label} — Sold out` : current.label}</span>
        </div>
      )}
      <div className="shop-format__copy shop-format__copy--price">
        {current.basePrice ? <s>{current.basePrice}</s> : null}
        {current.price && <small>{current.price}</small>}
        {current.lowStock ? <span className="shop-format__stock-note">Only {current.lowStock} left</span> : null}
      </div>
      <button
        type="button"
        className="button-primary shop-format__button"
        onClick={() => cart.addItem(issue.id, current.key)}
        disabled={current.soldOut}
      >
        {current.soldOut ? "Sold Out" : "Add to Cart"}
      </button>
    </div>
  );
}

function TeamPage({ bootstrap, routeSlug }) {
  const seoPage = findPage(bootstrap, routeSlug);
  const meetPage = findPage(bootstrap, "/meet");
  usePageSeo(seoPage || meetPage, { siteSettings: bootstrap.siteSettings });

  return (
    <main className="page-stack page-stack--subpage page-stack--meet-redesign">
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
  const readerImages = getIssueReaderImages(issue);
  const hasReader = Boolean(issue.readerPdfUrl || readerImages.length);
  const isFree = Boolean(issue.isFree);
  const previewPageLimit = issue.previewPageLimit ?? 5;
  const shop = issue.shop || {};
  const isPurchasable = Boolean(shop.digitalPriceId || shop.physicalPriceId || shop.externalUrl);
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
      <main className="page-stack page-stack--issue page-stack--issue-redesign">
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
              {hasReader ? (
                <button type="button" className="button-secondary" onClick={() => openReader(1)}>
                  {isFree ? "Read Free" : issue.readerLabel || "Preview"}
                </button>
              ) : null}
            </div>
          </div>
        </section>
        <section className="section-shell issue-story issue-story--redesign">
          <div className="issue-story__main">
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
          </div>
          <div className={`issue-buybox ${isPurchasable ? "" : "issue-buybox--unavailable"}`}>
            <p className="issue-meta-card__eyebrow">Get this issue</p>
            <ShopFormatToggle issue={issue} />
          </div>
        </section>
        <IssueCrossSell currentIssue={issue} allIssues={bootstrap.issues} bundle={bootstrap.bundle} />
      </main>
      <IssueReaderOverlay
        title={issue.title}
        isOpen={readerState.isOpen}
        onClose={() => setReaderState((current) => ({ ...current, isOpen: false }))}
        pdfUrl={issue.readerPdfUrl}
        imagePages={readerImages}
        isFree={isFree}
        previewPageLimit={previewPageLimit}
        issue={issue}
      />
    </>
  );
}

// Redesign-only reader (Phase 3): same modal shell used across the site
// (veil, title bar, close, Escape-to-close), but the paging surface is
// InlinePdfReader (already used by the post-purchase
// delivery reader — zoom, fullscreen, wide-spread, swipe, preloading all come
// for free). Preview boundaries are enforced here by controlling how many
// pages are handed to the reader, not by modifying InlinePdfReader itself.
function IssueReaderOverlay({
  title,
  isOpen,
  onClose,
  pdfUrl,
  imagePages,
  isFree,
  previewPageLimit,
  issue,
}) {
  const [emailUnlocked, setEmailUnlocked] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    setEmailUnlocked(false);
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
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const totalPages = imagePages.length;
  const emailGatePage = Math.min(3, totalPages);
  const hasEmailGate = isFree && !emailUnlocked && emailGatePage > 0 && emailGatePage < totalPages;
  const visibleLimit = isFree
    ? (hasEmailGate ? emailGatePage : totalPages)
    : Math.min(previewPageLimit, totalPages);
  const hasBuyGate = !isFree && visibleLimit < totalPages;
  const visiblePages = imagePages.slice(0, visibleLimit).map((url) => ({ url }));

  return (
    <div className="comic-reader comic-reader--redesign comic-reader--chrome-visible">
      <div className="comic-reader__veil" onClick={onClose} />
      <div className="comic-reader__shell">
        <header className="comic-reader__topbar">
          <p>{title}</p>
          <button type="button" className="comic-reader__close" onClick={onClose} aria-label="Close reader">
            Close
          </button>
        </header>
        <div className="comic-reader__stage comic-reader__stage--inline">
          <InlinePdfReader pdfUrl={visiblePages.length ? undefined : pdfUrl} pages={visiblePages} />
          {hasBuyGate ? <ReaderBuyGate issue={issue} /> : null}
          {hasEmailGate ? (
            <ReaderEmailGate issue={issue} onUnlock={() => setEmailUnlocked(true)} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReaderBuyGate({ issue }) {
  return (
    <div className="reader-gate">
      <p className="reader-gate__eyebrow">Preview ended</p>
      <h3>Keep reading {issue.title}</h3>
      <p className="reader-gate__copy">Buy the issue to unlock the rest.</p>
      <ShopFormatToggle issue={issue} />
    </div>
  );
}

function ReaderEmailGate({ issue, onUnlock }) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await api.submitLead({ email: trimmed, issueSlug: issue.slug });
      onUnlock();
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="reader-gate">
      <p className="reader-gate__eyebrow">Keep reading, free</p>
      <h3>Enter your email to continue {issue.title}</h3>
      <form className="reader-gate__form" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? "Unlocking…" : "Keep Reading"}
        </button>
      </form>
      {error ? <p className="reader-gate__error">{error}</p> : null}
    </div>
  );
}

// Cross-sell (redesign only, Phase 3): next issue in the run + the bundle,
// reusing the .shop-card visual language from Phase 2 but as plain links
// (there's no in-page panel to open here — both routes lead to /shop or the
// next issue's own page).
function IssueCrossSell({ currentIssue, allIssues, bundle }) {
  const ordered = sortByOrder(allIssues);
  const currentIndex = ordered.findIndex((entry) => entry.id === currentIssue.id);
  const nextIssue = currentIndex >= 0 ? ordered[currentIndex + 1] : null;

  if (!nextIssue) {
    return null;
  }

  const nextShop = nextIssue.shop || {};
  const nextPrice =
    formatSimplePrice(nextShop.digitalPrice || nextShop.physicalPrice) || (nextShop.externalUrl ? "Available" : "Coming soon");

  return (
    <section className="section-shell issue-cross-sell">
      <SectionHeading kicker="Continue the Run" title="Keep Reading" narrow />
      <div className="shop-card-grid">
        <Link className="shop-card" to={nextIssue.slug}>
          <div className="shop-card__media">
            {nextIssue.coverImage ? (
              <img src={nextIssue.coverImage} alt={`${nextIssue.title} cover`} />
            ) : (
              <div className="shop-card__placeholder">Cover coming soon</div>
            )}
          </div>
          <p className="shop-card__title">{nextIssue.title}</p>
          <p className="shop-card__price">{nextPrice}</p>
        </Link>
        <Link className="shop-card shop-card--bundle" to="/shop">
          <div className="shop-card__media">
            <div className="shop-card__placeholder">Complete Run</div>
            <span className="shop-card__badge">Bundle</span>
          </div>
          <p className="shop-card__title">{bundle?.title || "The Complete Run"}</p>
          <p className="shop-card__price">{formatSimplePrice(bundle?.digitalPrice) || "Coming soon"}</p>
        </Link>
      </div>
    </section>
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
      <main className="page-stack page-stack--letters page-stack--letters-redesign">
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

// Site-wide email capture (Brand pages phase): reuses the Phase 3 leads
// endpoint with source: "footer" rather than an issueSlug, so it lands in the
// same admin Leads table tagged apart from reader-gate captures. Folds in the
// Meet page's old standalone Substack "Headlines" card as a secondary link —
// the real existing subscriber base stays reachable, just demoted now that
// there's a native, site-wide capture.
function FooterCapture({ connectPage }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const newsletterUrl = connectPage?.content?.newsletterCtaUrl;
  const newsletterLabel = connectPage?.content?.newsletterCtaLabel || "Subscribe on Substack";

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || status === "submitting") {
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      await api.submitLead({ email: trimmed, source: "footer" });
      setStatus("done");
      setEmail("");
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="footer-capture">
      <p className="footer-capture__title">Get the Headlines</p>
      <p className="footer-capture__copy">A sorta-monthly look behind the scenes on Renowned.</p>
      {status === "done" ? (
        <p className="footer-capture__done">You're on the list.</p>
      ) : (
        <form className="footer-capture__form" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="button-primary" disabled={status === "submitting"}>
            {status === "submitting" ? "Joining…" : "Join"}
          </button>
        </form>
      )}
      {error ? <p className="footer-capture__error">{error}</p> : null}
      {newsletterUrl ? (
        <a className="footer-capture__substack" href={newsletterUrl} target="_blank" rel="noreferrer">
          {newsletterLabel}
        </a>
      ) : null}
    </div>
  );
}

function SiteFooter({ footer, connectPage }) {
  return (
    <footer className="site-footer">
      <FooterCapture connectPage={connectPage} />
      <nav className="site-footer__nav" aria-label="Footer">
        <Link to="/meet">Meet the Team</Link>
        <Link to="/letters">Letters</Link>
        <Link to="/library">My Library</Link>
      </nav>
      <div className="site-footer__legal">
        <p>{footer?.copyright}</p>
        <p>{footer?.email}</p>
      </div>
    </footer>
  );
}

function BreadcrumbBar({ bootstrap }) {
  const location = useLocation();
  const currentIssue = bootstrap.issues.find((issue) => location.pathname === issue.slug);

  if (currentIssue) {
    const crumbs = [
      { label: "HOME", href: "/" },
      { label: "SHOP", href: "/shop" },
      { label: currentIssue.title.toUpperCase(), href: currentIssue.slug },
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
        <CartButton />
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
      <CartButton />
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
      <main className="page-stack page-stack--subpage page-stack--correspondence-redesign">
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
