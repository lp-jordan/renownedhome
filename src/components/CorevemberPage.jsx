import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useSeo } from "../lib/seo";

// Corevember — a two-person daily core-challenge tracker (Jordan + McKenzie).
// Standalone single-screen tool; PublicSite hides the storefront chrome for it
// and it's noindexed. Totals live server-side (see /api/corevember) so both
// people share the same source of truth across devices all month. The only
// thing kept in the browser is the live plank stopwatch (so a mid-plank
// refresh resumes) and the last profile you picked — those are per-device.

const ACTIVE_USER_KEY = "corevember:activeUser:v1";
const runningKey = (slug) => `corevember:running:${slug}:v1`;

// Daily floor: 5:00 of planks + 50 bicycle crunches, counted as 5 sets of 10
// ("every 10 crunches on both sides = one rep" → one set = 10).
const PLANK_GOAL_SECONDS = 5 * 60;
const CRUNCHES_PER_SET = 10;
const CRUNCH_GOAL = 50;
const CRUNCH_GOAL_SETS = CRUNCH_GOAL / CRUNCHES_PER_SET;

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    if (value == null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* storage off — the running timer just won't survive a refresh */
  }
}

function formatClock(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function entryFor(days, dateKey, slug) {
  return days?.[dateKey]?.[slug] || { plankSeconds: 0, crunchSets: 0 };
}

export default function CorevemberPage() {
  useSeo(
    "Corevember",
    "Jordan & McKenzie's daily core challenge: plank timer + crunch counter.",
    "",
    true,
    "",
  );

  const [users, setUsers] = useState([]);
  const [days, setDays] = useState({});
  const [activeUser, setActiveUser] = useState(() => readLocal(ACTIVE_USER_KEY, null));
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [syncError, setSyncError] = useState(false);

  // Live plank stopwatch for the active profile (epoch ms the run started, or
  // null). Kept per-device so a refresh mid-plank resumes.
  const [runningSince, setRunningSince] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [lastSession, setLastSession] = useState(0);
  const dateRef = useRef(todayKey());

  const key = todayKey();

  // Load the shared log once on mount.
  useEffect(() => {
    let cancelled = false;
    api
      .getCorevember()
      .then((data) => {
        if (cancelled) {
          return;
        }
        const roster = data.users || [];
        setUsers(roster);
        setDays(data.days || {});
        setActiveUser((current) => {
          const valid = roster.some((u) => u.slug === current);
          return valid ? current : roster[0]?.slug || null;
        });
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pick up the active profile's running timer whenever the profile changes.
  useEffect(() => {
    if (!activeUser) {
      return;
    }
    writeLocal(ACTIVE_USER_KEY, activeUser);
    const stored = readLocal(runningKey(activeUser), null);
    setRunningSince(typeof stored === "number" ? stored : null);
    setLastSession(0);
    setNow(Date.now());
  }, [activeUser]);

  // Tick only while a plank is running.
  useEffect(() => {
    if (runningSince == null) {
      return undefined;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [runningSince]);

  // Roll the display to a new day if the page is left open past midnight.
  useEffect(() => {
    const id = setInterval(() => {
      const current = todayKey();
      if (current !== dateRef.current) {
        dateRef.current = current;
        setNow(Date.now());
      }
    }, 15000);
    return () => clearInterval(id);
  }, []);

  if (loadState === "loading") {
    return <main className="corevember corevember--state">Loading Corevember…</main>;
  }
  if (loadState === "error") {
    return (
      <main className="corevember corevember--state">
        <p>Couldn&apos;t reach the tracker.</p>
        <button type="button" className="corevember__timer-btn" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  const today = entryFor(days, key, activeUser);
  const running = runningSince != null;
  const liveSessionSeconds = running ? (now - runningSince) / 1000 : lastSession;
  const dailyPlankSeconds = today.plankSeconds + (running ? (now - runningSince) / 1000 : 0);

  const plankMet = dailyPlankSeconds >= PLANK_GOAL_SECONDS;
  const crunchesMet = today.crunchSets >= CRUNCH_GOAL_SETS;
  const allMet = plankMet && crunchesMet;

  const sweep = (liveSessionSeconds % 60) / 60;
  const RADIUS = 120;
  const CIRC = 2 * Math.PI * RADIUS;
  const plankProgress = Math.min(1, dailyPlankSeconds / PLANK_GOAL_SECONDS);
  const crunchProgress = Math.min(1, today.crunchSets / CRUNCH_GOAL_SETS);
  const crunchCount = today.crunchSets * CRUNCHES_PER_SET;

  // Write today's totals for the active user to the server, keeping local
  // state optimistic so the UI never waits on the network. The POST sends the
  // full daily totals (not deltas), so it's idempotent and self-healing: the
  // next successful save corrects anything a dropped request missed.
  function persist(nextEntry) {
    setDays((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [activeUser]: { ...nextEntry } },
    }));
    api
      .saveCorevember({ user: activeUser, date: key, ...nextEntry })
      .then(() => setSyncError(false))
      .catch(() => setSyncError(true));
  }

  function startPlank() {
    setLastSession(0);
    const ts = Date.now();
    setRunningSince(ts);
    writeLocal(runningKey(activeUser), ts);
  }

  function stopPlank() {
    if (runningSince == null) {
      return;
    }
    const elapsed = (Date.now() - runningSince) / 1000;
    setLastSession(elapsed);
    setRunningSince(null);
    writeLocal(runningKey(activeUser), null);
    persist({
      plankSeconds: today.plankSeconds + elapsed,
      crunchSets: today.crunchSets,
    });
  }

  function adjustCrunches(delta) {
    const nextSets = Math.max(0, today.crunchSets + delta);
    if (nextSets === today.crunchSets) {
      return;
    }
    persist({ plankSeconds: today.plankSeconds, crunchSets: nextSets });
  }

  function resetToday() {
    setRunningSince(null);
    writeLocal(runningKey(activeUser), null);
    setLastSession(0);
    persist({ plankSeconds: 0, crunchSets: 0 });
  }

  return (
    <main className={`corevember ${allMet ? "corevember--done" : ""}`}>
      <header className="corevember__head">
        <h1>Corevember</h1>
        <p>{formatLongDate()}</p>
      </header>

      <div className="corevember__who">
        <label className="corevember__who-label" htmlFor="corevember-user">Logging as</label>
        <select
          id="corevember-user"
          className="corevember__who-select"
          value={activeUser || ""}
          onChange={(event) => setActiveUser(event.target.value)}
        >
          {users.map((user) => (
            <option key={user.slug} value={user.slug}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <section className="corevember__panel corevember__plank" aria-label="Plank timer">
        <div className="corevember__dial-wrap">
          <svg className="corevember__dial" viewBox="0 0 280 280" aria-hidden="true">
            <circle className="corevember__dial-track" cx="140" cy="140" r={RADIUS} />
            <circle
              className={`corevember__dial-sweep ${running ? "is-running" : ""} ${plankMet ? "is-met" : ""}`}
              cx="140"
              cy="140"
              r={RADIUS}
              style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - sweep) }}
            />
          </svg>
          <div className="corevember__dial-center">
            <span className="corevember__time">{formatClock(liveSessionSeconds)}</span>
            <span className="corevember__time-label">{running ? "this session" : "last session"}</span>
          </div>
        </div>

        <button
          type="button"
          className={`corevember__timer-btn ${running ? "is-running" : ""}`}
          onClick={running ? stopPlank : startPlank}
        >
          {running ? "Stop" : "Start plank"}
        </button>

        <div className="corevember__daily">
          <div className="corevember__daily-row">
            <span>Today&apos;s planks</span>
            <strong className={plankMet ? "is-met" : ""}>
              {formatClock(dailyPlankSeconds)} / {formatClock(PLANK_GOAL_SECONDS)}
            </strong>
          </div>
          <div className="corevember__bar">
            <div
              className={`corevember__bar-fill ${plankMet ? "is-met" : ""}`}
              style={{ width: `${plankProgress * 100}%` }}
            />
          </div>
        </div>
      </section>

      <section className="corevember__panel corevember__crunch" aria-label="Crunch sets">
        <div className="corevember__crunch-top">
          <div className="corevember__crunch-count">
            <span className="corevember__crunch-num">{today.crunchSets}</span>
            <span className="corevember__crunch-unit">sets</span>
          </div>
          <div className="corevember__crunch-sub">
            {crunchCount} / {CRUNCH_GOAL} crunches
            <small>{CRUNCHES_PER_SET} per set</small>
          </div>
        </div>

        <div className="corevember__crunch-controls">
          <button
            type="button"
            className="corevember__step corevember__step--minus"
            onClick={() => adjustCrunches(-1)}
            disabled={today.crunchSets <= 0}
            aria-label="Remove a crunch set"
          >
            –
          </button>
          <button
            type="button"
            className="corevember__step corevember__step--plus"
            onClick={() => adjustCrunches(1)}
            aria-label="Add a crunch set"
          >
            +
          </button>
        </div>

        <div className="corevember__bar">
          <div
            className={`corevember__bar-fill ${crunchesMet ? "is-met" : ""}`}
            style={{ width: `${crunchProgress * 100}%` }}
          />
        </div>
      </section>

      <section className="corevember__standings" aria-label="Today's standings">
        {users.map((user) => {
          const entry = entryFor(days, key, user.slug);
          const liveExtra =
            user.slug === activeUser && running ? (now - runningSince) / 1000 : 0;
          const plankSec = entry.plankSeconds + liveExtra;
          const userPlankMet = plankSec >= PLANK_GOAL_SECONDS;
          const userCrunchMet = entry.crunchSets >= CRUNCH_GOAL_SETS;
          return (
            <div
              key={user.slug}
              className={`corevember__standing ${user.slug === activeUser ? "is-active" : ""}`}
            >
              <span className="corevember__standing-name">{user.name}</span>
              <span className="corevember__standing-stat">
                <span className={userPlankMet ? "is-met" : ""}>{formatClock(plankSec)}</span> plank
              </span>
              <span className="corevember__standing-stat">
                <span className={userCrunchMet ? "is-met" : ""}>{entry.crunchSets}</span> sets of crunches
              </span>
            </div>
          );
        })}
      </section>

      <footer className="corevember__foot">
        <p className="corevember__status">
          {allMet ? "Floor cleared. 🔥" : `${plankMet ? "✓" : "○"} plank  ${crunchesMet ? "✓" : "○"} crunches`}
        </p>
        {syncError ? (
          <p className="corevember__sync-note">Saved on this device — couldn&apos;t reach the server. It&apos;ll retry.</p>
        ) : null}
        <button type="button" className="corevember__reset" onClick={resetToday}>
          Reset {users.find((u) => u.slug === activeUser)?.name || "today"}&apos;s day
        </button>
      </footer>
    </main>
  );
}
