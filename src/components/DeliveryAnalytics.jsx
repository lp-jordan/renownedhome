import { useMemo, useState } from "react";

function formatRate(count, total) {
  if (!total) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function niceCeil(value) {
  if (!value) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = Math.pow(10, exponent);
  for (const step of [1, 2, 5, 10]) {
    const candidate = step * base;
    if (candidate >= value) return candidate;
  }
  return value;
}

export default function DeliveryAnalytics({ analytics, status, onReset }) {
  const [hovered, setHovered] = useState(null);

  const totals = analytics?.totals || null;
  const timeline = analytics?.timeline || [];

  const yMax = useMemo(() => {
    const max = timeline.reduce((m, day) => Math.max(m, day.pageViews, day.downloads), 0);
    return niceCeil(max);
  }, [timeline]);

  const yTicks = useMemo(() => {
    if (!yMax) return [0];
    return [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax].map((value) => Math.round(value));
  }, [yMax]);

  if (!totals) {
    return (
      <section className="editor-card delivery-section">
        <div className="delivery-section__header">
          <h2>Analytics</h2>
          {onReset ? (
            <button
              className="delivery-tier-card__link-button"
              type="button"
              onClick={onReset}
            >
              Reset analytics
            </button>
          ) : null}
        </div>
        <p className="status-line">
          {status || "Analytics will appear after this campaign has activity."}
        </p>
      </section>
    );
  }

  return (
    <section className="editor-card delivery-section">
      <div className="delivery-section__header">
        <h2>Analytics</h2>
        <div className="delivery-section__header-actions">
          <span className="status-line">Last {analytics.windowDays} days</span>
          {onReset ? (
            <button
              className="delivery-tier-card__link-button"
              type="button"
              onClick={onReset}
            >
              Reset analytics
            </button>
          ) : null}
        </div>
      </div>

      <div className="delivery-inline-stats delivery-analytics-stats">
        <div>
          <span>Unique openers</span>
          <strong>
            {totals.uniqueOpeners} / {totals.backerCount}
          </strong>
          <small>{formatRate(totals.uniqueOpeners, totals.backerCount)} opened</small>
        </div>
        <div>
          <span>Total page views</span>
          <strong>{totals.totalPageViews}</strong>
          <small>{analytics.windowDays} day trend</small>
        </div>
        <div>
          <span>Unique downloaders</span>
          <strong>{totals.uniqueDownloaders}</strong>
          <small>{formatRate(totals.uniqueDownloaders, totals.backerCount)} downloaded</small>
        </div>
        <div>
          <span>Total downloads</span>
          <strong>{totals.totalDownloads}</strong>
          <small>{totals.unopenedBackers} still unopened</small>
        </div>
      </div>

      <div className="delivery-chart">
        <div className="delivery-chart__head">
          <div className="delivery-analytics-legend">
            <span>
              <i className="delivery-analytics-swatch delivery-analytics-swatch--views" /> Views
            </span>
            <span>
              <i className="delivery-analytics-swatch delivery-analytics-swatch--downloads" /> Downloads
            </span>
          </div>
          {hovered ? (
            <div className="delivery-chart__tooltip">
              <strong>{hovered.label}</strong>
              <span>{hovered.pageViews} views</span>
              <span>{hovered.downloads} downloads</span>
            </div>
          ) : (
            <span className="status-line">Hover a bar for daily values.</span>
          )}
        </div>
        <div className="delivery-chart__body">
          <div className="delivery-chart__yaxis">
            {[...yTicks].reverse().map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
          <div className="delivery-chart__plot">
            <div className="delivery-chart__gridlines">
              {yTicks.map((tick) => (
                <span key={tick} />
              ))}
            </div>
            <div className="delivery-chart__bars">
              {timeline.map((day) => {
                const viewHeight = yMax ? (day.pageViews / yMax) * 100 : 0;
                const downloadHeight = yMax ? (day.downloads / yMax) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="delivery-chart__day"
                    onMouseEnter={() => setHovered(day)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(day)}
                    onBlur={() => setHovered(null)}
                    tabIndex={0}
                    aria-label={`${day.label}: ${day.pageViews} views, ${day.downloads} downloads`}
                  >
                    <div className="delivery-chart__bar-pair">
                      <div
                        className="delivery-chart__bar delivery-chart__bar--views"
                        style={{ height: `${viewHeight}%` }}
                      />
                      <div
                        className="delivery-chart__bar delivery-chart__bar--downloads"
                        style={{ height: `${downloadHeight}%` }}
                      />
                    </div>
                    <span className="delivery-chart__xlabel">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <p className="status-line">
        Backer-level activity lives in the Audience tab, where each row links to that person&apos;s page.
      </p>
    </section>
  );
}
