export default function PanelCard({
  className = "",
  imageSrc,
  label,
  onClick,
}) {
  return (
    <div
      className={`relative w-full border-4 overflow-hidden aspect-[3/2] ${className}`}
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
