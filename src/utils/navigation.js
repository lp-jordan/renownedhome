export let previousPathname = "/";
export const updatePreviousPathname = (path) => {
  previousPathname = path;
};
export const getPreviousPathname = () => previousPathname;

export const getFirstPathSegment = (path = "/") => {
  const parts = path.split("/").filter(Boolean);
  return parts.length ? `/${parts[0]}` : "/";
};
