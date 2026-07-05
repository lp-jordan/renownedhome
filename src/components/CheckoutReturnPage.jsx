import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useSeo } from "../lib/seo";

const POLL_INTERVAL_MS = 1800;
const MAX_POLL_ATTEMPTS = 6;

export default function CheckoutReturnPage() {
  const location = useLocation();
  const sessionId = new URLSearchParams(location.search).get("session_id") || "";
  const [state, setState] = useState({ status: "checking" });
  const cancelledRef = useRef(false);

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

      if (session.deliveryToken) {
        try {
          const deliveryRes = await fetch(`/api/order-delivery/${encodeURIComponent(session.deliveryToken)}`);
          const delivery = await deliveryRes.json();
          if (cancelledRef.current) return;
          if (deliveryRes.ok && delivery.items?.length > 0) {
            setState({ status: "redirect", token: session.deliveryToken });
            return;
          }
        } catch {
          // Delivery lookup failed; fall through to retry/generic-thanks below.
        }
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setState({ status: "thanks", email: session.email });
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

  if (state.status === "redirect") {
    return <Navigate to={`/order/${state.token}`} replace />;
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
              <Link className="button-primary" to="/buy">Back to shop</Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (state.status === "thanks") {
    return (
      <main className="page-stack page-stack--subpage">
        <div className="order-delivery-shell">
          <header className="order-delivery__header">
            <div className="order-delivery__eyebrow">Order Confirmed</div>
            <h1>Thanks for your order!</h1>
            <p>
              {state.email
                ? `A confirmation has been sent to ${state.email}.`
                : "A confirmation email is on its way."}
            </p>
          </header>
          <div className="order-delivery__actions">
            <Link className="button-primary" to="/buy">Back to shop</Link>
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
