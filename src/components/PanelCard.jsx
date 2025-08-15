import { Link } from "react-router-dom";

export default function PanelCard({
  className = "",
  imageSrc,
  label,
  to,
}) {
  const content = (
    <div
      className={`relative w-full h-full overflow-hidden cursor-pointer transition-transform duration-300 hover:scale-105 ${className}`}
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
          <span className="text-black font-bold uppercase text-center">
            {label}
          </span>
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
