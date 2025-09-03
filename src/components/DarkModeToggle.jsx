import { useEffect, useState } from "react";

export default function DarkModeToggle({ className = "" }) {
  const [isDark, setIsDark] = useState(() =>
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <button
      type="button"
      onClick={() => setIsDark(!isDark)}
      className={`px-3 py-1 rounded border bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] text-sm ${className}`}
    >
      {isDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
