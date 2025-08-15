export default function PanelCard({
  imageSrc,
  label,
  onClick,
  className = "",
}) {
  return (
    <div
      onClick={onClick}
      className={`relative group cursor-pointer w-full h-full overflow-hidden border-4 ${className}`}
      style={{ borderColor: "var(--border)" }}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt={label}
          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition" />
      {label && (
        <span className="absolute bottom-2 left-2 z-10 text-white">{label}</span>
      )}
    </div>
  );
}
