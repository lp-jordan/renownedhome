import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import applePayMark from "../assets/payment-badges/apple-pay-mark.svg";
import googlePayMark from "../assets/payment-badges/google-pay-mark.svg";

// Cart. Client-side state persisted to
// localStorage; checkout hands the whole cart to POST /api/checkout, which
// builds one multi-line Stripe hosted-checkout session. Prices shown here are
// the display strings resolved live from Stripe at bootstrap — Stripe itself
// remains the source of truth at checkout.

const CART_STORAGE_KEY = "renowned:cart";

const CartContext = createContext(null);

export function useCart() {
  return useContext(CartContext);
}

function readStoredItems() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item) =>
        item &&
        ((item.kind === "bundle" && typeof item.bundleId === "string") ||
          (typeof item.issueId === "string" && (item.format === "digital" || item.format === "physical"))),
    );
  } catch {
    return [];
  }
}

function getFormatPriceId(issue, format) {
  return format === "digital" ? issue?.shop?.digitalPriceId : issue?.shop?.physicalPriceId;
}

function getFormatPriceDisplay(issue, format) {
  return (format === "digital" ? issue?.shop?.digitalPrice : issue?.shop?.physicalPrice) || "";
}

function parsePriceCents(display) {
  const value = parseFloat(String(display).replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

function formatCents(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function CartProvider({ issues, bundle, children }) {
  const [items, setItems] = useState(readStoredItems);
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  // Drop lines whose issue/format is no longer purchasable (issue unlisted,
  // price removed) or whose bundle is no longer purchasable, so a stale cart
  // can't produce a failing checkout.
  useEffect(() => {
    setItems((current) =>
      current.filter((item) => {
        if (item.kind === "bundle") {
          return Boolean(bundle && bundle.id === item.bundleId && bundle.digitalPriceId);
        }
        const issue = issues.find((entry) => entry.id === item.issueId);
        return Boolean(getFormatPriceId(issue, item.format));
      }),
    );
  }, [issues, bundle]);

  const addItem = useCallback((issueId, format) => {
    setItems((current) => {
      const existing = current.find((item) => item.issueId === issueId && item.format === format);
      if (existing) {
        return current.map((item) =>
          item === existing ? { ...item, quantity: Math.min((item.quantity || 1) + 1, 10) } : item,
        );
      }
      return [...current, { issueId, format, quantity: 1 }];
    });
    setError("");
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((issueId, format) => {
    setItems((current) => current.filter((item) => !(item.issueId === issueId && item.format === format)));
  }, []);

  const setQuantity = useCallback((issueId, format, quantity) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((item) => !(item.issueId === issueId && item.format === format))
        : current.map((item) =>
            item.issueId === issueId && item.format === format
              ? { ...item, quantity: Math.min(quantity, 10) }
              : item,
          ),
    );
  }, []);

  const addBundle = useCallback((bundleId) => {
    setItems((current) => {
      const existing = current.find((item) => item.kind === "bundle" && item.bundleId === bundleId);
      if (existing) {
        return current.map((item) =>
          item === existing ? { ...item, quantity: Math.min((item.quantity || 1) + 1, 5) } : item,
        );
      }
      return [...current, { kind: "bundle", bundleId, quantity: 1 }];
    });
    setError("");
    setIsOpen(true);
  }, []);

  const removeBundle = useCallback((bundleId) => {
    setItems((current) => current.filter((item) => !(item.kind === "bundle" && item.bundleId === bundleId)));
  }, []);

  const setBundleQuantity = useCallback((bundleId, quantity) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((item) => !(item.kind === "bundle" && item.bundleId === bundleId))
        : current.map((item) =>
            item.kind === "bundle" && item.bundleId === bundleId
              ? { ...item, quantity: Math.min(quantity, 5) }
              : item,
          ),
    );
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const startCheckout = useCallback(async () => {
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) =>
            item.kind === "bundle"
              ? { kind: "bundle", bundleId: item.bundleId, quantity: item.quantity }
              : { issueId: item.issueId, format: item.format, quantity: item.quantity },
          ),
          cancelPath: "/cart",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout unavailable.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Checkout unavailable.");
      setPending(false);
    }
  }, [items]);

  const count = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  const value = useMemo(
    () => ({
      items,
      count,
      isOpen,
      pending,
      error,
      addItem,
      removeItem,
      setQuantity,
      addBundle,
      removeBundle,
      setBundleQuantity,
      clear,
      startCheckout,
      openDrawer: () => setIsOpen(true),
      closeDrawer: () => setIsOpen(false),
    }),
    [
      items,
      count,
      isOpen,
      pending,
      error,
      addItem,
      removeItem,
      setQuantity,
      addBundle,
      removeBundle,
      setBundleQuantity,
      clear,
      startCheckout,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Resolve cart lines against the live catalog for display.
function useCartLines(issues, bundle) {
  const cart = useCart();
  const lines = cart.items.map((item) => {
    if (item.kind === "bundle") {
      const priceDisplay = bundle?.digitalPrice || "";
      const priceCents = parsePriceCents(priceDisplay);
      return {
        ...item,
        title: bundle?.title || "The Complete Run",
        coverImage: "",
        priceDisplay,
        lineTotalCents: priceCents != null ? priceCents * (item.quantity || 1) : null,
      };
    }
    const issue = issues.find((entry) => entry.id === item.issueId);
    const priceDisplay = getFormatPriceDisplay(issue, item.format);
    const priceCents = parsePriceCents(priceDisplay);
    return {
      ...item,
      issue,
      title: issue?.title || item.issueId,
      coverImage: issue?.coverImage || "",
      priceDisplay,
      lineTotalCents: priceCents != null ? priceCents * (item.quantity || 1) : null,
    };
  });
  const subtotalCents = lines.every((line) => line.lineTotalCents != null)
    ? lines.reduce((sum, line) => sum + line.lineTotalCents, 0)
    : null;
  return { lines, subtotalCents };
}

function CartLines({ issues, bundle }) {
  const cart = useCart();
  const { lines } = useCartLines(issues, bundle);

  if (!lines.length) {
    return <p className="cart-empty">Your cart is empty.</p>;
  }

  return (
    <ul className="cart-lines">
      {lines.map((line) => {
        const key = line.kind === "bundle" ? `bundle:${line.bundleId}` : `${line.issueId}:${line.format}`;
        const decrease = () =>
          line.kind === "bundle"
            ? cart.setBundleQuantity(line.bundleId, (line.quantity || 1) - 1)
            : cart.setQuantity(line.issueId, line.format, (line.quantity || 1) - 1);
        const increase = () =>
          line.kind === "bundle"
            ? cart.setBundleQuantity(line.bundleId, (line.quantity || 1) + 1)
            : cart.setQuantity(line.issueId, line.format, (line.quantity || 1) + 1);
        const remove = () =>
          line.kind === "bundle" ? cart.removeBundle(line.bundleId) : cart.removeItem(line.issueId, line.format);

        return (
          <li key={key} className="cart-line">
            <div className="cart-line__media">
              {line.coverImage ? <img src={line.coverImage} alt={`${line.title} cover`} /> : null}
            </div>
            <div className="cart-line__info">
              <p className="cart-line__title">{line.title}</p>
              <p className="cart-line__format">
                {line.kind === "bundle" ? "Digital bundle" : line.format === "digital" ? "Digital" : "Physical"}
                {line.priceDisplay ? ` · ${line.priceDisplay}` : ""}
              </p>
              <div className="cart-line__qty" aria-label={`${line.title} quantity`}>
                <button type="button" onClick={decrease} aria-label="Decrease quantity">
                  &minus;
                </button>
                <span>{line.quantity || 1}</span>
                <button type="button" onClick={increase} aria-label="Increase quantity">
                  +
                </button>
              </div>
            </div>
            <div className="cart-line__end">
              <span className="cart-line__total">
                {line.lineTotalCents != null ? formatCents(line.lineTotalCents) : "—"}
              </span>
              <button type="button" className="cart-line__remove" onClick={remove}>
                Remove
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// viewBox is cropped tight to the drawn shape (y 5-19, x 3-21 in the original
// 0-24 box) so its height matches the wallet marks without a padding hack —
// safe to do since this is our own icon, not a brand's untouchable artwork.
function PaymentCardIcon() {
  return (
    <svg viewBox="3 5 18 14" aria-label="Cards accepted">
      <path
        d="M3 6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v1H3V6Zm0 3h18v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Zm2 6h5v1.5H5V15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CartSummary({ issues, bundle }) {
  const cart = useCart();
  const { subtotalCents } = useCartLines(issues, bundle);

  if (!cart.items.length) {
    return null;
  }

  return (
    <div className="cart-summary">
      <div className="cart-summary__row">
        <span>Subtotal</span>
        <strong>{subtotalCents != null ? formatCents(subtotalCents) : "—"}</strong>
      </div>
      <p className="cart-summary__note">Shipping (if any) and taxes are handled at checkout.</p>
      <p className="cart-summary__paymentIcons">
        <img src={applePayMark} alt="Apple Pay" className="cart-summary__paymentIcons-apple" />
        <img src={googlePayMark} alt="Google Pay" className="cart-summary__paymentIcons-google" />
        <PaymentCardIcon />
      </p>
      {cart.error ? <p className="cart-error">{cart.error}</p> : null}
      <button
        type="button"
        className="button-primary cart-summary__checkout"
        onClick={cart.startCheckout}
        disabled={cart.pending}
      >
        {cart.pending ? "Redirecting…" : "Checkout"}
      </button>
    </div>
  );
}

// Header affordance: bag + live count. Rendered in the breadcrumb bar.
export function CartButton() {
  const cart = useCart();
  if (!cart) {
    return null;
  }

  return (
    <button
      type="button"
      className="cart-button"
      onClick={cart.openDrawer}
      aria-label={`Open cart, ${cart.count} item${cart.count === 1 ? "" : "s"}`}
    >
      <svg
        className="cart-button__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M1 1h3l2.4 12.6a2 2 0 0 0 2 1.6h9.2a2 2 0 0 0 2-1.6L21.5 5H5.1" />
      </svg>
      {cart.count ? <span className="cart-button__count">{cart.count}</span> : null}
    </button>
  );
}

// Slide-out drawer, same desktop right-rail / mobile bottom-sheet split as the
// shop detail panel, but layered above the reader overlay so in-reader
// add-to-cart lands somewhere visible.
export function CartDrawer({ issues, bundle }) {
  const cart = useCart();
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!cart.isOpen) {
      return undefined;
    }

    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        cart.closeDrawer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart.isOpen, cart]);

  if (!cart.isOpen) {
    return null;
  }

  return (
    <div className="cart-drawer__backdrop" onClick={cart.closeDrawer}>
      <div
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="cart-drawer__close"
          onClick={cart.closeDrawer}
          ref={closeButtonRef}
          aria-label="Close cart"
        >
          &times;
        </button>
        <p className="cart-drawer__eyebrow">Your Cart</p>
        <CartLines issues={issues} bundle={bundle} />
        <CartSummary issues={issues} bundle={bundle} />
        {cart.items.length ? (
          <Link className="cart-drawer__page-link" to="/cart" onClick={cart.closeDrawer}>
            Open full cart
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function CartPage({ issues, bundle }) {
  const cart = useCart();

  return (
    <main className="page-stack page-stack--subpage">
      <section className="section-shell section-shell--narrow section-shell--subpage cart-page">
        <h1 className="cart-page__title">Your Cart</h1>
        <CartLines issues={issues} bundle={bundle} />
        <CartSummary issues={issues} bundle={bundle} />
        {!cart.items.length ? (
          <div className="cart-page__empty-cta">
            <Link className="button-primary" to="/shop">
              Shop the Series
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
