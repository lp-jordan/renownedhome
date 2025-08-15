export default function PanelCard({ className = "", children }) {
  return (
    <div
      className={`w-full h-full border-4 ${className}`}
      style={{ borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}
