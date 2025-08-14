export default function PanelCard({ className = "", children }) {
  return <div className={`w-full h-full ${className}`}>{children}</div>;
}
