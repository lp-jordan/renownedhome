import { useEffect, useState } from "react";
import { api } from "../lib/api";

const SECTION_LABELS = [
  ["intro", "Intro"],
  ["team", "Team"],
  ["reader", "Reader"],
  ["cta", "CTA"],
];

const CTA_LABELS = [
  ["buy", "Shop the series"],
  ["tip", "Tip the team"],
  ["mailing", "Mailing list"],
];

function formatRate(count, total) {
  if (!total) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function formatSeconds(seconds) {
  if (!seconds) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export default function FunnelAdmin() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getFunnelAnalytics()
      .then((d) => setAnalytics(d.analytics))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="admin-empty-state">{error}</div>;
  if (!analytics) return <div className="admin-empty-state">Loading funnel data…</div>;
  if (!analytics.totalSessions) {
    return <div className="admin-empty-state">No /read activity yet — data will appear once readers start visiting.</div>;
  }

  const introCount = analytics.sections.intro || analytics.totalSessions;
  const maxPageSessions = analytics.pageDropoff.reduce((max, row) => Math.max(max, row.sessions), 0);

  return (
    <div className="admin-orders">
      <div className="admin-workspace-header">
        <h2>Funnel</h2>
        <p className="field-help">{analytics.totalSessions} session{analytics.totalSessions !== 1 ? "s" : ""} on /read</p>
      </div>

      <div className="dashboard-stat-grid">
        <div className="dashboard-stat-card">
          <span className="dashboard-stat-card__label">Avg time on page</span>
          <span className="dashboard-stat-card__value">{formatSeconds(analytics.avgTimeOnPageSeconds)}</span>
        </div>
        {SECTION_LABELS.map(([key, label]) => (
          <div key={key} className="dashboard-stat-card">
            <span className="dashboard-stat-card__label">{label} reached</span>
            <span className="dashboard-stat-card__value">{formatRate(analytics.sections[key], introCount)}</span>
            <span className="dashboard-stat-card__hint">{analytics.sections[key]} sessions</span>
          </div>
        ))}
      </div>

      <section className="dashboard-section">
        <h3>CTA clicks</h3>
        <table className="orders-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Clicks</th>
              <th>% of sessions reaching CTA</th>
            </tr>
          </thead>
          <tbody>
            {CTA_LABELS.map(([key, label]) => (
              <tr key={key}>
                <td>{label}</td>
                <td>{analytics.ctaClicks[key] || 0}</td>
                <td>{formatRate(analytics.ctaClicks[key], analytics.sections.cta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {analytics.pageDropoff.length ? (
        <section className="dashboard-section">
          <h3>Reader page drop-off</h3>
          <p className="field-help">Sessions that reached each page of the issue.</p>
          <div className="funnel-admin__page-list">
            {analytics.pageDropoff.map((row) => (
              <div key={row.page} className="funnel-admin__page-row">
                <span className="funnel-admin__page-label">Page {row.page}</span>
                <div className="funnel-admin__bar-track">
                  <div
                    className="funnel-admin__bar-fill"
                    style={{ width: formatRate(row.sessions, maxPageSessions) }}
                  />
                </div>
                <span className="funnel-admin__page-value">{row.sessions}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
