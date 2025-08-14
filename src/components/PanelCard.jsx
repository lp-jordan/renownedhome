export default function PanelCard({ className = "", children }) {
  return (
    <div className={`w-full h-full border-4 border-black ${className}`}>
      {children}
    </div>
  );
}
