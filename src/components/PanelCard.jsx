export default function PanelCard({
  className = "",
  imageSrc,
  label,
  // Handler for when the panel is clicked.
  // TODO: Wire this up to navigation once routing is added.
  onClick,
}) {
  return (
    <div
      className={`relative w-full h-full border-4 overflow-hidden ${className}`}
      style={{ borderColor: "var(--border)" }}
      onClick={onClick}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt={label}
          className="object-cover w-full h-full"
        />
      )}
      {label && (
        <div className="absolute inset-0 flex items-center justify-center">
          {label}
        </div>
      )}
    </div>
  );
}
