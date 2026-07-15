import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "./Cart";
import { useSeo } from "../lib/seo";

const POLL_INTERVAL_MS = 1800;
const MAX_POLL_ATTEMPTS = 6;

export default function CheckoutReturnPage({ bootstrap }) {
  const location = useLocation();
  const sessionId = new URLSearchParams(location.search).get("session_id") || "";
  const [state, setState] = useState({ status: "checking" });
  const cancelledRef = useRef(false);
  const cart = useCart();
  const cartClearedRef = useRef(false);

  useSeo("Order Confirmation", "Confirming your purchase.", "", true);

  useEffect(() => {
    cancelledRef.current = false;

    if (!sessionId) {
      setState({ status: "not-found" });
      return undefined;
    }

    async function checkOnce(attempt) {
      let session;
      try {
        const res = await fetch(`/api/checkout/session/${encodeURIComponent(sessionId)}`);
        if (!res.ok) {
          if (!cancelledRef.current) setState({ status: "not-found" });
          return;
        }
        session = await res.json();
      } catch {
        if (!cancelledRef.current) setState({ status: "not-found" });
        return;
      }

      if (cancelledRef.current) return;

      if (!session.paid) {
        setState({ status: "not-paid" });
        return;
      }

      // Payment confirmed: the cart's job is done.
      if (!cartClearedRef.current) {
        cartClearedRef.current = true;
        cart?.clear();
      }

      if (session.deliveryToken) {
        try {
          const deliveryRes = await fetch(`/api/order-delivery/${encodeURIComponent(session.deliveryToken)}`);
          const delivery = await deliveryRes.json();
          if (cancelledRef.current) return;
          if (deliveryRes.ok && delivery.items?.length > 0) {
            setState({
              status: "onboard",
              token: session.deliveryToken,
              email: session.email,
              digitalItems: delivery.items,
            });
            return;
          }
        } catch {
          // Delivery lookup failed; fall through to retry/onboard-with-no-items below.
        }
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setState({ status: "onboard", token: null, email: session.email, digitalItems: [] });
        return;
      }

      setTimeout(() => {
        if (!cancelledRef.current) checkOnce(attempt + 1);
      }, POLL_INTERVAL_MS);
    }

    checkOnce(1);

    return () => {
      cancelledRef.current = true;
    };
  }, [sessionId]);

  if (state.status === "onboard") {
    return (
      <CheckoutOnboarding
        sessionId={sessionId}
        token={state.token}
        email={state.email}
        digitalItems={state.digitalItems}
        issues={bootstrap?.issues || []}
      />
    );
  }

  if (state.status === "not-paid" || state.status === "not-found") {
    return (
      <main className="page-stack page-stack--subpage">
        <div className="order-delivery-shell">
          <div className="order-delivery__error">
            <h1>{state.status === "not-paid" ? "Payment not confirmed" : "Order not found"}</h1>
            <p>
              {state.status === "not-paid"
                ? "We weren't able to confirm this payment."
                : "This checkout session could not be found."}
            </p>
            <div className="order-delivery__actions">
              <Link className="button-primary" to="/shop">Back to shop</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-stack page-stack--subpage">
      <div className="state-shell">Confirming your order&hellip;</div>
    </main>
  );
}

// Redesign path (Phase 4): the return page is an onboarding + upsell moment,
// not just a receipt. Claims a library session from the paid Stripe session
// (same email-possession proof as the emailed delivery link), offers Read Now,
// and cross-sells the rest of the run.
function CheckoutOnboarding({ sessionId, token, email, digitalItems, issues }) {
  const [librarySaved, setLibrarySaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/library/claim-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    })
      .then((res) => {
        if (!cancelled && res.ok) {
          setLibrarySaved(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const hasDigital = Boolean(digitalItems?.length);
  const purchasedIssueIds = new Set((digitalItems || []).map((item) => item.issueId));
  const upsellIssues = issues
    .filter((issue) => !purchasedIssueIds.has(issue.id))
    .filter((issue) => {
      const shop = issue.shop || {};
      return Boolean(shop.digitalPriceId || shop.physicalPriceId || shop.externalUrl);
    })
    .slice(0, 3);

  return (
    <main className="page-stack page-stack--subpage">
      <div className="order-delivery-shell checkout-onboard">
        <header className="order-delivery__header">
          <div className="order-delivery__eyebrow">Order Confirmed</div>
          <h1>{hasDigital ? "It's in your library." : "Thanks for your order!"}</h1>
          <p>
            {hasDigital
              ? "Read it right now, or come back anytime — your library remembers what you own."
              : email
                ? `A confirmation has been sent to ${email}.`
                : "A confirmation email is on its way."}
          </p>
        </header>
        <div className="order-delivery__actions checkout-onboard__actions">
          {hasDigital && token ? (
            <Link className="button-primary" to={`/order/${token}`}>
              Read Now
            </Link>
          ) : null}
          <Link className="button-secondary" to="/library">
            {librarySaved ? "Open My Library" : "Set Up My Library"}
          </Link>
        </div>
        {librarySaved ? (
          <p className="checkout-onboard__note">
            Library saved{email ? ` for ${email}` : ""} — no password needed on this device.
          </p>
        ) : null}
        {upsellIssues.length ? (
          <section className="checkout-onboard__upsell">
            <p className="checkout-onboard__upsell-eyebrow">Complete the Run</p>
            <div className="shop-card-grid shop-card-grid--upsell">
              {upsellIssues.map((issue) => (
                <Link key={issue.id} className="shop-card" to={issue.slug}>
                  <div className="shop-card__media">
                    {issue.coverImage ? (
                      <img src={issue.coverImage} alt={`${issue.title} cover`} />
                    ) : (
                      <div className="shop-card__placeholder">Cover coming soon</div>
                    )}
                  </div>
                  <p className="shop-card__title">{issue.title}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
