import { useEffect } from "react";

const COLORS = [
  ["Ember", "var(--ember)", "#E1502A", "Primary commerce CTA"],
  ["Ember hover", "var(--ember-strong)", "#F2653F", "Hover state"],
  ["Ember deep", "var(--ember-deep)", "#B63C1D", "Active / press"],
  ["Brass", "var(--brass)", "#C9A15B", "Membership / all-access"],
  ["BG deep", "var(--bg-deep)", "#0A0D14", "Page canvas"],
  ["BG panel", "var(--bg-panel)", "#0F141F", "Cards / panels"],
  ["Text", "var(--text)", "#F2F4F8", "Primary text"],
  ["Text dim", "var(--text-dim)", "#C7CCD6", "Secondary text"],
];

const TYPE = [
  ["--fs-h1", "Just Good Story", "h1 · display"],
  ["--fs-h2", "A supernatural detective mystery", "h2 · section"],
  ["--fs-h3", "3:10 to Nowhere", "h3 · card title"],
  ["--fs-body", "The case reopens in 1920s Denver, where the dead don't stay quiet.", "body"],
  ["--fs-sm", "Digital · $4.99", "small / meta"],
];

export default function SystemPage() {
  useEffect(() => {
    document.title = "Design system - Renowned";
  }, []);

  return (
    <main className="ds">
      <h1>Design System</h1>
      <p className="ds__lede">
        Design reference for the sales-forward redesign. Ember Noir signals the money
        action; Brass is reserved for membership.
      </p>

      <section>
        <h2>Color</h2>
        <div className="ds__swatches">
          {COLORS.map(([name, cssVar, hex, use]) => (
            <div key={name} className="ds__swatch">
              <div className="ds__swatch-chip" style={{ background: cssVar }} />
              <div className="ds__swatch-meta">
                <strong>{name}</strong>
                <span>{hex}</span>
                <div style={{ marginTop: "0.25rem", color: "var(--text-dim)" }}>{use}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Typography</h2>
        <div className="ds__type">
          {TYPE.map(([token, sample, label]) => (
            <div key={token} style={{ marginBottom: "1rem" }}>
              <div
                style={{
                  fontFamily:
                    token === "--fs-body" || token === "--fs-sm"
                      ? "'Nunito Sans', sans-serif"
                      : "'Josefin Sans', sans-serif",
                  fontSize: `var(${token})`,
                  lineHeight: 1.15,
                }}
              >
                {sample}
              </div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.72rem", marginTop: "0.25rem" }}>
                {label} · {token}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Buttons</h2>
        <div className="ds__row">
          <button type="button" className="button-primary">
            Buy digital
          </button>
          <button type="button" className="button-secondary">
            Read free preview
          </button>
          <button type="button" className="button-primary" disabled>
            Sold out
          </button>
        </div>
      </section>

      <section>
        <h2>Buy box</h2>
        <div className="ds__buybox">
          <div className="shop-format">
            <div className="shop-format__copy">
              <span>Digital</span>
              <small>$4.99</small>
            </div>
            <button type="button" className="button-secondary shop-format__button">
              Buy Digital
            </button>
          </div>
          <div className="shop-format">
            <div className="shop-format__copy">
              <span>Physical</span>
              <small>$12.00</small>
            </div>
            <button type="button" className="button-secondary shop-format__button">
              Buy Physical
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
