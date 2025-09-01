import { Link, useLocation } from "react-router-dom";

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter(Boolean);

  const crumbs = [
    { name: "home", to: "/" },
    ...pathnames.map((segment, index) => {
      const to = "/" + pathnames.slice(0, index + 1).join("/");
      return { name: segment.replace(/-/g, " "), to };
    }),
  ];

  return (
    <nav
      aria-label="Breadcrumb"
      className="fixed top-2 left-2 right-2 z-50 flex items-center overflow-x-auto whitespace-nowrap font-hero text-sm"
    >
      {crumbs.map((crumb, index) => (
        <span key={crumb.to} className="flex items-center">
          <Link
            to={crumb.to}
            className="text-[var(--foreground)] hover:underline"
          >
            {crumb.name}
          </Link>
          {index < crumbs.length - 1 && (
            <span className="mx-1 select-none text-[var(--muted)]">/</span>
          )}
        </span>
      ))}
    </nav>
  );
}
