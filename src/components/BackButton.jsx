import { useState } from "react";

export default function BackButton() {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full text-soft-bone border-[1rem] transition-colors duration-200 ${
        hovered ? "bg-faded-rust/80" : "bg-faded-rust"
      }`}
      style={{ borderColor: "var(--border)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Base
    </button>
  );
}
