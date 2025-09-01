export let previousPathname = "/";
export const updatePreviousPathname = (path) => {
  previousPathname = path;
};
export const getPreviousPathname = () => previousPathname;
