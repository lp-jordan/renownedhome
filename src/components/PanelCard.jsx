import { Link } from "react-router-dom";

export default function PanelCard({
  className = "",
  imageSrc,
  label,
  to,
}) {
  const content = (
    <div
      className={`relative w-full h-full overflow-hidden cursor-pointer group ${className}`}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt={label}
          className="object-cover w-full h-full"
        />
      )}
      <div className="absolute inset-0 bg-black opacity-0 transition-opacity duration-300 group-hover:opacity-20 pointer-events-none" />
      {label && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {label}
        </div>
      )}
    </div>
  );

  return to ? (
    <Link to={to} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
}
