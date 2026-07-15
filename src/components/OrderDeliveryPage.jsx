import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSeo } from "../lib/seo";

// Phase 5: the emailed order token proves ownership of the buyer's email, so
// it can open a persistent library session — the token link keeps working,
// but now resolves into the library instead of being the only door.
function LibraryClaimBanner({ token }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState("idle");

  async function handleClaim() {
    setStatus("pending");
    try {
      const res = await fetch("/api/library/claim-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ orderToken: token }),
      });
      if (!res.ok) {
        throw new Error();
      }
      navigate("/library");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="library-claim">
      <p>These issues are yours to keep — save them to your library and skip this link next time.</p>
      <button type="button" className="button-secondary" onClick={handleClaim} disabled={status === "pending"}>
        {status === "pending" ? "Opening…" : "Save to My Library"}
      </button>
      {status === "error" ? <p className="library-claim__error">Could not open your library. Try again.</p> : null}
    </div>
  );
}

export default function OrderDeliveryPage() {
  const { token = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [order, setOrder] = useState(null);

  useSeo("Your Order", "Access your purchased downloads.", "", true);

  useEffect(() => {
    if (!token) {
      setError("Invalid order link.");
      setLoading(false);
      return;
    }

    fetch(`/api/order-delivery/${encodeURIComponent(token)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Order not found.");
        setOrder(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="page-stack page-stack--subpage">
        <div className="state-shell">Loading your order&hellip;</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-stack page-stack--subpage">
        <div className="order-delivery-shell">
          <div className="order-delivery__error">
            <h1>Order not found</h1>
            <p>{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (order.items.length === 0) {
    return (
      <main className="page-stack page-stack--subpage">
        <div className="order-delivery-shell">
          <header className="order-delivery__header">
            <div className="order-delivery__eyebrow">Order Confirmed</div>
            <h1>Thanks for your order!</h1>
            <p>This order doesn't include any digital downloads. A confirmation was sent to your email.</p>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main className="page-stack page-stack--subpage">
      <div className="order-delivery-shell">
        <header className="order-delivery__header">
          <div className="order-delivery__eyebrow">Order Confirmed</div>
          <h1>Your downloads are ready.</h1>
          <p>Click any item below to download. Keep this link — it works anytime.</p>
        </header>

        <div className="order-delivery__items">
          {order.items.map((item) => (
            <div key={item.issueId} className="order-delivery__item">
              {item.coverImage && (
                <div className="order-delivery__cover">
                  <img src={item.coverImage} alt={`${item.issueTitle} cover`} />
                </div>
              )}
              <div className="order-delivery__item-info">
                <h2>{item.issueTitle}</h2>
                {item.downloadUrl ? (
                  <a
                    className="button-primary order-delivery__download"
                    href={item.downloadUrl}
                    download
                  >
                    Download
                  </a>
                ) : (
                  <p className="order-delivery__pending">
                    {item.hasAsset
                      ? "Download link is being prepared. Check back shortly."
                      : "Digital file coming soon."}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <LibraryClaimBanner token={token} />
      </div>
    </main>
  );
}
