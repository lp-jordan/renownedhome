import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useSeo } from "../lib/seo";

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
      </div>
    </main>
  );
}
